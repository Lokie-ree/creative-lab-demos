import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface PhysicsSolidProps {
  mode: "crossSection" | "rotation";
  geometry: THREE.BufferGeometry;
  planeTransformRef?: { current: { position: THREE.Vector3; quaternion: THREE.Quaternion } };
  onIntersectionEnter?: () => void;
  onIntersectionExit?: () => void;
  initialPosition?: [number, number, number];
  usesBallCollider?: boolean;
}

const FLOOR_Y = -3;

function PhysicsInner({
  mode,
  geometry,
  planeTransformRef,
  onIntersectionEnter,
  onIntersectionExit,
  initialPosition = [0, 0, 0],
  usesBallCollider = false,
}: PhysicsSolidProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const planeBodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const torqueFiredRef = useRef(false);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.opacity = 0;
    gsap.to(mat, { opacity: 0.85, duration: 0.4, delay: 0.05 });
  }, []);

  useFrame(() => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    // Defer initial torque to first frame so the RigidBody is guaranteed ready
    if (mode === "rotation" && !torqueFiredRef.current) {
      torqueFiredRef.current = true;
      rb.applyTorqueImpulse({ x: 3, y: 1, z: 5 }, true);
    }

    // Keep kinematic plane collider in sync with joystick each frame
    if (mode === "crossSection" && planeBodyRef.current && planeTransformRef) {
      const { position, quaternion } = planeTransformRef.current;
      planeBodyRef.current.setNextKinematicTranslation(position);
      // THREE.Quaternion has { x, y, z, w } — matches Rapier's expected shape directly
      planeBodyRef.current.setNextKinematicRotation(quaternion);
    }
  });

  const handleClick = () => {
    const rb = rigidBodyRef.current;
    if (!rb) return;
    if (mode === "crossSection") {
      // Normalize by mass so all shapes launch to the same height (~3 units)
      rb.applyImpulse({ x: 0, y: rb.mass() * 8, z: 0 }, true);
    } else {
      rb.applyTorqueImpulse(
        { x: (Math.random() - 0.5) * 8, y: 2, z: (Math.random() - 0.5) * 8 },
        true,
      );
    }
  };

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        type="dynamic"
        colliders={usesBallCollider ? "ball" : "hull"}
        restitution={0.85}
        friction={0.1}
        lockRotations={mode === "crossSection"}
        angularDamping={mode === "rotation" ? 0.2 : 0.1}
        position={initialPosition}
      >
        <mesh ref={meshRef} geometry={geometry} onClick={handleClick}>
          <meshStandardMaterial
            color={0xb8924e}
            transparent
            opacity={0.85}
            roughness={0.4}
            metalness={0.3}
            emissive={new THREE.Color(0x3a2e1a)}
            emissiveIntensity={0.4}
          />
        </mesh>
      </RigidBody>

      {mode === "crossSection" && (
        <>
          {/* Kinematic plane — solid bounces here; collision events drive the flash disc */}
          <RigidBody
            ref={planeBodyRef}
            type="kinematicPosition"
            colliders={false}
            position={[0, 0, 0]}
            onCollisionEnter={onIntersectionEnter}
            onCollisionExit={onIntersectionExit}
          >
            <CuboidCollider args={[10, 0.05, 10]} restitution={0.85} friction={0} />
          </RigidBody>
          <CuboidCollider position={[0, FLOOR_Y, 0]} args={[20, 0.5, 20]} />
        </>
      )}
    </>
  );
}

export function PhysicsSolid(props: PhysicsSolidProps) {
  return (
    <Physics gravity={props.mode === "rotation" ? [0, 0, 0] : [0, -9.81, 0]}>
      <PhysicsInner {...props} />
    </Physics>
  );
}
