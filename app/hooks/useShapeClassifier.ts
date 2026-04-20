import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SolidId } from "~/types";
import { deduplicateVerts, classifyShape } from "~/utils/classifyShape";

export interface ClassifyResult {
  label: string;
  key: string;
}

export function useShapeClassifier(
  csgGeometry: THREE.BufferGeometry | null,
  solidId: SolidId,
  planeInteracted: boolean,
): ClassifyResult | null {
  const prevKeyRef = useRef<string | null>(null);
  return useMemo(() => {
    if (!planeInteracted || !csgGeometry) return null;

    const positions = csgGeometry.attributes.position as THREE.BufferAttribute;
    const group1 = csgGeometry.groups[1];
    if (!group1 || !positions) return null;

    const rawArray = positions.array;
    const startVert = group1.start;
    const vertCount = group1.count;

    const slice = rawArray.slice(startVert * 3, (startVert + vertCount) * 3);
    const unique = deduplicateVerts(slice, vertCount);

    if (unique.length === 0) return null;

    const label = classifyShape(unique, solidId);
    if (!label) return null;

    const key = `${solidId}-${label}`;
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      console.log(`[classify] ${solidId} → ${label}`);
    }
    return { label, key };
  }, [csgGeometry, solidId, planeInteracted]);
}
