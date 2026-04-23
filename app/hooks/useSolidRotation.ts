import { useState, useRef, useMemo } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { SILHOUETTES } from "~/data/silhouettes";
import type { SolidId } from "~/types";
import { useReducedMotion } from "~/hooks/useReducedMotion";

export function useSolidRotation(solidId: SolidId, onComplete: () => void) {
  const prefersReducedMotion = useReducedMotion();
  const [angle, setAngle] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const progressRef = useRef({ val: 0 });

  const start = () => {
    progressRef.current.val = 0;
    setAngle(0);
    setIsRotating(true);
    if (prefersReducedMotion) {
      progressRef.current.val = 360;
      setAngle(360);
      setIsRotating(false);
      onComplete();
      return;
    }
    gsap.to(progressRef.current, {
      val: 360,
      duration: 1.8,
      ease: "power2.inOut",
      onUpdate: () => setAngle(progressRef.current.val),
      onComplete: () => {
        setAngle(360);
        setIsRotating(false);
        onComplete();
      },
    });
  };

  const reset = () => {
    gsap.killTweensOf(progressRef.current);
    setAngle(0);
    setIsRotating(false);
  };

  const bucketedAngle = Math.round(angle / 5);
  const geometry = useMemo(() => {
    if (solidId === "cube") return null;
    const points = SILHOUETTES[solidId];
    if (!points) return null;
    const segments = Math.max(3, Math.round((angle / 360) * 64));
    return new THREE.LatheGeometry(points, segments, 0, (angle * Math.PI) / 180);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solidId, bucketedAngle]);

  return { angle, isRotating, geometry, start, reset };
}
