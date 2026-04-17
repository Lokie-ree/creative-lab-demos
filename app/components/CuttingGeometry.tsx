import { Geometry, Base, Subtraction, type CSGGeometryRef } from "@react-three/csg";
import { PivotControls } from "@react-three/drei";
import { useRef, useEffect } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { wireframeMaterial } from "~/data/materials";

interface CuttingGeometryProps {
  solidGeometry: THREE.BufferGeometry;
  onShapeChange?: (geometryResult: THREE.BufferGeometry) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onInteract?: () => void;
}

// Solid material props — kept inline so R3F attaches them directly to the brush mesh.
// Using <primitive attach="material"> on a singleton doesn't reliably set brush.material
// in R3F v9; the inline JSX approach matches the official @react-three/csg example.
const SOLID_COLOR = 0x232018;
const SECTION_COLOR = 0xd4962a;

export function CuttingGeometry({
  solidGeometry,
  onShapeChange,
  onDragStart,
  onDragEnd,
  onInteract,
}: CuttingGeometryProps) {
  const csg = useRef<CSGGeometryRef>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const pulseTargetRef = useRef<THREE.Mesh>(null);
  const hasInteracted = useRef(false);
  const prevMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());

  // Safety net: if the CSG library's __r3f material-assignment path fails in R3F v9,
  // force a 2-entry array so groups with materialIndex 0/1 always resolve correctly.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || Array.isArray(mesh.material)) return;
    mesh.material = [
      new THREE.MeshStandardMaterial({ color: SOLID_COLOR, transparent: true, opacity: 0.85, roughness: 0.7, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: SECTION_COLOR, transparent: true, opacity: 0.85, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }),
    ];
  }, []);

  // GSAP pulse on drag handle to signal affordance
  useEffect(() => {
    const target = pulseTargetRef.current;
    if (!target) return;
    gsap.set(target.scale, { x: 1, y: 1, z: 1 });
    const tween = gsap.to(target.scale, {
      x: 1.06,
      y: 1.06,
      z: 1.06,
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => { tween.kill(); };
  }, []);

  const handleDrag = (matrix: THREE.Matrix4) => {
    csg.current?.update();

    // Track meaningful interaction — compare full matrix to catch tilt-only gestures
    if (!hasInteracted.current && !matrix.equals(prevMatrixRef.current)) {
      hasInteracted.current = true;
      onInteract?.();
      if (pulseTargetRef.current) gsap.killTweensOf(pulseTargetRef.current.scale);
    }
    prevMatrixRef.current.copy(matrix);

    if (onShapeChange && csg.current) {
      onShapeChange(csg.current.geometry);
    }
  };

  return (
    <mesh ref={meshRef}>
      <Geometry ref={csg} useGroups consolidateGroups computeVertexNormals>
        <Base geometry={solidGeometry}>
          <meshStandardMaterial
            color={SOLID_COLOR}
            transparent
            opacity={0.85}
            roughness={0.7}
            metalness={0.1}
          />
        </Base>
        <PivotControls
          depthTest={false}
          anchor={[0, -1, 0]}
          onDrag={handleDrag}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          scale={80}
          fixed
        >
          <Subtraction position={[0, 5, 0]}>
            <boxGeometry args={[10, 10, 10]} />
            <meshStandardMaterial
              color={SECTION_COLOR}
              transparent
              opacity={0.85}
              roughness={0.3}
              metalness={0.2}
              side={THREE.DoubleSide}
            />
          </Subtraction>
          {/* Invisible pulse target — gives GSAP something to animate without distorting the cutter */}
          <mesh ref={pulseTargetRef} visible={false}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial />
          </mesh>
        </PivotControls>
      </Geometry>
      <mesh geometry={solidGeometry} material={wireframeMaterial} />
    </mesh>
  );
}
