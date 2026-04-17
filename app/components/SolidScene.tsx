import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { solidMaterial, wireframeMaterial } from "~/data/materials";
import { CuttingGeometry } from "~/components/CuttingGeometry";
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
}

function SceneContent({ solidId, mode, orbitRef, onInteract, onShapeChange }: SceneContentProps) {
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
    <group>
      <mesh geometry={geometry} material={solidMaterial} />
      <mesh geometry={geometry} material={wireframeMaterial} />
    </group>
  );
}

interface SolidSceneProps {
  solidId: SolidId;
  mode: ModeId;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
}

export function SolidScene({ solidId, mode, onInteract, onShapeChange }: SolidSceneProps) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 2, 7], fov: 45, near: 0.1, far: 100 }}
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
      <SceneContent solidId={solidId} mode={mode} orbitRef={orbitRef} onInteract={onInteract} onShapeChange={onShapeChange} />
    </Canvas>
  );
}
