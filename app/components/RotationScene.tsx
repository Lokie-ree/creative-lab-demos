import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { SILHOUETTES } from "~/data/silhouettes";
import { rotationMaterial, silhouetteMaterial, axisLineMaterial } from "~/data/materials";
import type { SolidId } from "~/types";

interface RotationSceneProps {
  solidId: SolidId;
  angle: number;
  rotationComplete: boolean;
  geometry: THREE.BufferGeometry | null;
}

export function RotationScene({ solidId, angle, rotationComplete, geometry }: RotationSceneProps) {
  const silhouetteRef = useRef<THREE.Line>(null);

  const axisGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.8, 0),
      new THREE.Vector3(0, 1.8, 0),
    ]);
    return geo;
  }, []);

  const silhouetteGeometry = useMemo(() => {
    if (solidId === "cube") return null;
    const points = SILHOUETTES[solidId];
    if (!points) return null;
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((v) => new THREE.Vector3(v.x, v.y, 0)),
    );
    return geo;
  }, [solidId]);

  useFrame(() => {
    if (!rotationComplete) {
      rotationMaterial.opacity = (angle / 360) * 0.85;
    }
  });

  useEffect(() => {
    if (!rotationComplete) return;
    if (silhouetteRef.current) {
      gsap.to((silhouetteRef.current as any).material, { opacity: 0, duration: 0.4 });
    }
    gsap.to(rotationMaterial, { opacity: 0.85, duration: 0.5 });
  }, [rotationComplete]);

  if (solidId === "cube") return null;

  return (
    <group>
      <line_ geometry={axisGeometry} material={axisLineMaterial} />
      {silhouetteGeometry && (
        <line_ ref={silhouetteRef} geometry={silhouetteGeometry} material={silhouetteMaterial} />
      )}
      {geometry && <mesh geometry={geometry} material={rotationMaterial} />}
    </group>
  );
}
