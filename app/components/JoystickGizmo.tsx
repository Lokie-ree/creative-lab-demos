import { useRef, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Subtraction, type CSGGeometryRef } from "@react-three/csg";
import * as THREE from "three";
import gsap from "gsap";
import { useReducedMotion } from "~/hooks/useReducedMotion";

const SECTION_COLOR = 0xd4962a;
const HEIGHT_SENSITIVITY = 0.01;
// 3× higher than before — ellipse threshold (33°) now reachable in ~38px, parabola (66°) in ~77px
const TILT_SENSITIVITY = 0.015;

export interface JoystickGizmoProps {
  csgRef: React.RefObject<CSGGeometryRef | null>;
  solidGeometry: THREE.BufferGeometry;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  physicsActive?: boolean;
  onHeightChange?: (y: number) => void;
}

export function JoystickGizmo({
  csgRef,
  solidGeometry,
  onDragStart,
  onDragEnd,
  onInteract,
  onShapeChange,
  physicsActive,
  onHeightChange,
}: JoystickGizmoProps) {
  const prefersReducedMotion = useReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  const handleRef = useRef<THREE.Mesh>(null);
  const pulseTargetRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const hasInteracted = useRef(false);
  const prevClientX = useRef(0);
  const prevClientY = useRef(0);
  const cameraRight = useRef(new THREE.Vector3());
  const solidBoundsY = useRef({ min: -1.5, max: 1.5 });

  // Separate state avoids reading unreliable elements[13] once rotation is mixed in.
  // Matrix is always rebuilt as T(height) × R(tiltQuat) — group origin = cutting plane position.
  const heightRef = useRef(0);
  const tiltQuatRef = useRef(new THREE.Quaternion());

  // Compute solid Y bounds on solid change
  useEffect(() => {
    const box = new THREE.Box3().setFromBufferAttribute(
      solidGeometry.attributes.position as THREE.BufferAttribute,
    );
    solidBoundsY.current = { min: box.min.y, max: box.max.y };
  }, [solidGeometry]);

  // GSAP pulse on handle sphere to signal affordance
  useEffect(() => {
    const target = pulseTargetRef.current;
    if (!target) return;
    if (prefersReducedMotion) return;
    gsap.set(target.scale, { x: 1, y: 1, z: 1 });
    const tween = gsap.to(target.scale, {
      x: 1.18, y: 1.18, z: 1.18,
      duration: 1, repeat: -1, yoyo: true, ease: "sine.inOut",
    });
    return () => { tween.kill(); };
  }, [prefersReducedMotion]);

  // Canvas-level drag handlers — reliable even when pointer leaves the sphere
  useEffect(() => {
    const canvas = gl.domElement;

    const onMove = (e: PointerEvent) => {
      if (!isDragging.current || !groupRef.current || !csgRef.current) return;

      const dx = e.clientX - prevClientX.current;
      const dy = e.clientY - prevClientY.current;
      prevClientX.current = e.clientX;
      prevClientY.current = e.clientY;

      // Height: clamp directly using dedicated ref (no matrix element reading)
      const targetY = heightRef.current - dy * HEIGHT_SENSITIVITY;
      heightRef.current = Math.max(
        solidBoundsY.current.min,
        Math.min(solidBoundsY.current.max, targetY),
      );
      onHeightChange?.(heightRef.current);

      // Tilt: accumulate as world-space quaternion via premultiply.
      // premultiply(dq) = dq * q, which gives "old rotation first, then dq in world space".
      // This is correct regardless of previous tilt — unlike multiply() which applies in local space.
      if (dx !== 0) {
        const dQuat = new THREE.Quaternion().setFromAxisAngle(
          cameraRight.current,
          dx * TILT_SENSITIVITY,
        );
        tiltQuatRef.current.premultiply(dQuat);
      }

      // Rebuild matrix from scratch: M = T(height) × R(tilt)
      // Cutting plane passes through world (0, height, 0) with tilted normal.
      groupRef.current.matrix
        .makeTranslation(0, heightRef.current, 0)
        .multiply(new THREE.Matrix4().makeRotationFromQuaternion(tiltQuatRef.current));
      groupRef.current.matrixAutoUpdate = false;
      groupRef.current.updateMatrixWorld(true);
      csgRef.current.update();

      if (!hasInteracted.current && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
        hasInteracted.current = true;
        onInteract?.();
        if (pulseTargetRef.current) gsap.killTweensOf(pulseTargetRef.current.scale);
      }

      if (csgRef.current) onShapeChange?.(csgRef.current.geometry);
    };

    const onUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
      onDragEnd?.();
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [gl.domElement, csgRef, onDragEnd, onInteract, onShapeChange]);

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      {/* CSG brush — large half-space box; bottom face at local y=0 is the cutting plane */}
      <Subtraction position={[0, 50, 0]}>
        <boxGeometry args={[50, 100, 50]} />
        <meshStandardMaterial
          color={SECTION_COLOR}
          transparent
          opacity={0.85}
          roughness={0.3}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </Subtraction>

      {/* Stem */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.8, 8]} />
        <meshBasicMaterial color={SECTION_COLOR} transparent opacity={0.25} />
      </mesh>

      {/* Handle — pulseTargetRef outer mesh for GSAP scale; handleRef inner mesh for pointer events */}
      <mesh ref={pulseTargetRef} position={[0, -0.8, 0]}>
        <mesh
          ref={handleRef}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            isDragging.current = true;
            prevClientX.current = e.clientX;
            prevClientY.current = e.clientY;
            // Sample camera right ONCE at drag start — fixed axis for this gesture
            cameraRight.current.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
            try { gl.domElement.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
            onDragStart?.();
          }}
        >
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial
            color={SECTION_COLOR}
            roughness={0.2}
            metalness={0.5}
            emissive={new THREE.Color(SECTION_COLOR)}
            emissiveIntensity={0.35}
          />
        </mesh>
      </mesh>
    </group>
  );
}
