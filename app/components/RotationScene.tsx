import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { SILHOUETTES } from "~/data/silhouettes";
import { rotationMaterial, silhouetteMaterial, axisLineMaterial, wireframeMaterial } from "~/data/materials";
import type { SolidId } from "~/types";

interface RotationSceneProps {
  solidId: SolidId;
  angle: number;
  rotationComplete: boolean;
  geometry: THREE.BufferGeometry | null;
}

export function RotationScene({ solidId, angle, rotationComplete, geometry }: RotationSceneProps) {
  const silhouetteRef = useRef<THREE.Line>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const axisGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.8, 0),
      new THREE.Vector3(0, 1.8, 0),
    ]);
    return geo;
  }, []);

  // R3F v9 doesn't strip trailing underscore from <line_> before catalog lookup,
  // so we construct THREE.Line imperatively and render via <primitive>.
  const axisLine = useMemo(() => new THREE.Line(axisGeometry, axisLineMaterial), [axisGeometry]);

  const silhouetteGeometry = useMemo(() => {
    if (solidId === "cube") return null;
    const points = SILHOUETTES[solidId];
    if (!points) return null;
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((v) => new THREE.Vector3(v.x, v.y, 0)),
    );
    return geo;
  }, [solidId]);

  const silhouetteLine = useMemo(() => {
    if (!silhouetteGeometry) return null;
    return new THREE.Line(silhouetteGeometry, silhouetteMaterial);
  }, [silhouetteGeometry]);

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
    if (lightRef.current) {
      gsap.to(lightRef.current, { intensity: 0.6, duration: 0.8, ease: "power2.out" });
    }
  }, [rotationComplete]);

  if (solidId === "cube") return null;

  return (
    <group>
      <primitive object={axisLine} />
      {silhouetteLine && (
        <primitive ref={silhouetteRef} object={silhouetteLine} />
      )}
      {geometry && (
        <>
          <mesh geometry={geometry} material={rotationMaterial} />
          <mesh geometry={geometry} material={wireframeMaterial} />
        </>
      )}
      <pointLight ref={lightRef} position={[2, 1, 2]} intensity={0} color={0xede8e0} />
    </group>
  );
}
