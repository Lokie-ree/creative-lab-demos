import { useRef, useEffect } from "react";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface PhysicsSolidProps {
  mode: "crossSection" | "rotation";
  geometry: THREE.BufferGeometry;
  planeY?: number;
  onIntersectionEnter?: () => void;
  onIntersectionExit?: () => void;
  initialPosition?: [number, number, number];
}

const FLOOR_Y = -3;
const SENSOR_HALF_HEIGHT = 0.05;
const SENSOR_HALF_WIDTH = 2;
const DEBOUNCE_MS = 200;

export function PhysicsSolid({
  mode,
  geometry,
  planeY = 0,
  onIntersectionEnter,
  onIntersectionExit,
  initialPosition = [0, 0, 0],
}: PhysicsSolidProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const torqueFiredRef = useRef(false);
  const lastIntersectionMs = useRef(0);

  useEffect(() => {
    if (mode !== "rotation" || torqueFiredRef.current) return;
    torqueFiredRef.current = true;
    rigidBodyRef.current?.applyTorqueImpulse({ x: 0, y: 8, z: 0 }, true);
  }, [mode]);

  // Reset position/rotation on unmount. React unmounts children before parents,
  // so this fires while the parent <Physics> world is still alive.
  useEffect(() => {
    return () => {
      try {
        rigidBodyRef.current?.setTranslation(
          { x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] },
          true,
        );
        rigidBodyRef.current?.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      } catch (_) {
        // Rapier world may already be torn down
      }
    };
  }, [initialPosition]);

  const handleClick = () => {
    rigidBodyRef.current?.applyImpulse(
      { x: (Math.random() - 0.5) * 4, y: 10, z: (Math.random() - 0.5) * 4 },
      true,
    );
    if (mode === "rotation") {
      rigidBodyRef.current?.applyTorqueImpulse({ x: 0, y: 6, z: 0 }, true);
    }
  };

  const handleIntersectionEnter = () => {
    const now = Date.now();
    if (now - lastIntersectionMs.current < DEBOUNCE_MS) return;
    lastIntersectionMs.current = now;
    onIntersectionEnter?.();
  };

  const handleIntersectionExit = () => {
    const now = Date.now();
    if (now - lastIntersectionMs.current < DEBOUNCE_MS) return;
    lastIntersectionMs.current = now;
    onIntersectionExit?.();
  };

  return (
    <Physics gravity={[0, -9.81, 0]}>
      <RigidBody
        ref={rigidBodyRef}
        type="dynamic"
        colliders="hull"
        restitution={0.6}
        angularDamping={mode === "rotation" ? 1.5 : 0.1}
        position={initialPosition}
      >
        <mesh geometry={geometry} onClick={handleClick}>
          <meshStandardMaterial
            color={0x232018}
            transparent
            opacity={0.85}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      <CuboidCollider position={[0, FLOOR_Y, 0]} args={[20, 0.5, 20]} />

      {mode === "crossSection" && (
        <CuboidCollider
          sensor
          args={[SENSOR_HALF_WIDTH, SENSOR_HALF_HEIGHT, SENSOR_HALF_WIDTH]}
          position={[0, planeY, 0]}
          onIntersectionEnter={handleIntersectionEnter}
          onIntersectionExit={handleIntersectionExit}
        />
      )}
    </Physics>
  );
}
