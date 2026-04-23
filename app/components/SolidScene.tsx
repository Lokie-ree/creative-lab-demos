import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CuttingGeometry } from "~/components/CuttingGeometry";
import { RotationScene } from "~/components/RotationScene";
import { useCameraReset } from "~/hooks/useCameraReset";
import type { SolidId, ModeId } from "~/types";

const GEOMETRIES = {
  cone: new THREE.ConeGeometry(1.2, 3, 64, 1, false),
  cylinder: new THREE.CylinderGeometry(1, 1, 3, 64, 1, false),
  cube: new THREE.BoxGeometry(2.2, 2.2, 2.2),
  sphere: new THREE.SphereGeometry(1.3, 64, 32),
};

interface SceneContentProps {
  solidId: SolidId;
  mode: ModeId;
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  rotationAngle: number;
  rotationComplete: boolean;
  rotationGeometry: THREE.BufferGeometry | null;
}

function SceneContent({
  solidId,
  mode,
  orbitRef,
  onInteract,
  onShapeChange,
  rotationAngle,
  rotationComplete,
  rotationGeometry,
}: SceneContentProps) {
  useCameraReset(solidId, orbitRef);
  const geometry = GEOMETRIES[solidId];

  const handleDragStart = () => {
    if (orbitRef.current) orbitRef.current.enabled = false;
  };
  const handleDragEnd = () => {
    if (orbitRef.current) orbitRef.current.enabled = true;
  };

  if (mode === "crossSection") {
    return (
      <CuttingGeometry
        key={solidId}
        solidGeometry={geometry}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onInteract={onInteract}
        onShapeChange={onShapeChange}
      />
    );
  }

  return (
    <RotationScene
      solidId={solidId}
      angle={rotationAngle}
      rotationComplete={rotationComplete}
      geometry={rotationGeometry}
    />
  );
}

interface SolidSceneProps {
  solidId: SolidId;
  mode: ModeId;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  rotationAngle?: number;
  rotationComplete?: boolean;
  rotationGeometry?: THREE.BufferGeometry | null;
}

export function SolidScene({
  solidId,
  mode,
  onInteract,
  onShapeChange,
  rotationAngle = 0,
  rotationComplete = false,
  rotationGeometry = null,
}: SolidSceneProps) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [5, 2, 5], fov: 45, near: 0.1, far: 100 }}
      style={{ background: "var(--color-ground)", width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.3} color={0xede8e0} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color={0xede8e0} />
      <pointLight position={[-3, 4, -3]} intensity={0.4} color={0xd4962a} />
      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
      />
      <SceneContent
        solidId={solidId}
        mode={mode}
        orbitRef={orbitRef}
        onInteract={onInteract}
        onShapeChange={onShapeChange}
        rotationAngle={rotationAngle}
        rotationComplete={rotationComplete}
        rotationGeometry={rotationGeometry}
      />
    </Canvas>
  );
}
