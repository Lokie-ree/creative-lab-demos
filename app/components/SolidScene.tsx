import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { lazy, Suspense, useRef, useCallback } from "react";
import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CuttingGeometry } from "~/components/CuttingGeometry";
import { RotationScene } from "~/components/RotationScene";
import { useCameraReset } from "~/hooks/useCameraReset";
import type { SolidId, ModeId } from "~/types";
import { SEGMENTS } from "~/data/segments";

const PhysicsSolid = lazy(() =>
  import("~/components/PhysicsSolid").then((m) => ({ default: m.PhysicsSolid })),
);

const GEOMETRIES = {
  cone: new THREE.ConeGeometry(1.2, 3, SEGMENTS.cone, 1, false),
  cylinder: new THREE.CylinderGeometry(1, 1, 3, SEGMENTS.cylinder, 1, false),
  cube: new THREE.BoxGeometry(2.2, 2.2, 2.2),
  sphere: new THREE.SphereGeometry(1.3, SEGMENTS.sphere[0], SEGMENTS.sphere[1]),
};

// Spawn physics solid above the cone top (Y=1.5) so it doesn't immediately
// intersect the default sensor plane at Y=0.
const CROSS_SECTION_PHYSICS_INIT: [number, number, number] = [0, 3, 0];

interface SceneContentProps {
  solidId: SolidId;
  mode: ModeId;
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  rotationAngle: number;
  rotationComplete: boolean;
  rotationGeometry: THREE.BufferGeometry | null;
  physicsMode: boolean;
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
  physicsMode,
}: SceneContentProps) {
  const planeYRef = useRef(0);
  const flashPlaneRef = useRef<THREE.Mesh>(null);

  const handleIntersectionEnter = useCallback(() => {
    const mat = flashPlaneRef.current?.material as THREE.MeshBasicMaterial | null;
    if (!mat) return;
    gsap.killTweensOf(mat);
    // Flash up then always auto-fade — exit event may never fire if solid rests below plane
    gsap.timeline()
      .to(mat, { opacity: 0.45, duration: 0.1 })
      .to(mat, { opacity: 0, duration: 0.5 });
  }, []);

  const handleIntersectionExit = useCallback(() => {
    const mat = flashPlaneRef.current?.material as THREE.MeshBasicMaterial | null;
    if (!mat) return;
    // Solid bounced back above plane — cut the auto-fade and fade faster
    gsap.killTweensOf(mat);
    gsap.to(mat, { opacity: 0, duration: 0.3 });
  }, []);

  useFrame(() => {
    if (flashPlaneRef.current) {
      flashPlaneRef.current.position.y = planeYRef.current;
    }
  });

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
      <>
        <CuttingGeometry
          key={solidId}
          solidGeometry={geometry}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onInteract={onInteract}
          onShapeChange={onShapeChange}
          onHeightChange={(y) => { planeYRef.current = y; }}
          physicsActive={physicsMode}
        />
        {physicsMode && (
          <>
            <mesh
              ref={flashPlaneRef}
              renderOrder={1}
            >
              <circleGeometry args={[2, 48]} />
              <meshBasicMaterial
                color={0xd4962a}
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            <Suspense fallback={null}>
              <PhysicsSolid
                mode="crossSection"
                geometry={geometry}
                planeYRef={planeYRef}
                initialPosition={CROSS_SECTION_PHYSICS_INIT}
                onIntersectionEnter={handleIntersectionEnter}
                onIntersectionExit={handleIntersectionExit}
              />
            </Suspense>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <RotationScene
        solidId={solidId}
        angle={rotationAngle}
        rotationComplete={rotationComplete}
        geometry={rotationGeometry}
        physicsMode={physicsMode}
      />
      {physicsMode && rotationComplete && rotationGeometry && (
        <Suspense fallback={null}>
          <PhysicsSolid
            mode="rotation"
            geometry={rotationGeometry}
            initialPosition={[0, 0.5, 0]}
          />
        </Suspense>
      )}
    </>
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
  physicsMode?: boolean;
}

export function SolidScene({
  solidId,
  mode,
  onInteract,
  onShapeChange,
  rotationAngle = 0,
  rotationComplete = false,
  rotationGeometry = null,
  physicsMode = false,
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
        enabled={!physicsMode}
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
        physicsMode={physicsMode}
      />
    </Canvas>
  );
}
