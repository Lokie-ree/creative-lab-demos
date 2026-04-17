// app/hooks/useShapeClassifier.ts
import { useMemo } from "react";
import * as THREE from "three";
import type { SolidId } from "~/types";

export interface ClassifyResult {
  label: string;
  key: string; // e.g. 'cone-circle', 'cube-hexagon'
}

function deduplicateVerts(
  raw: Float32Array | ArrayLike<number>,
  count: number,
  epsilon = 0.001,
): THREE.Vector3[] {
  const unique: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const x = raw[i * 3];
    const y = raw[i * 3 + 1];
    const z = raw[i * 3 + 2];
    const isDup = unique.some(
      (v) => Math.abs(v.x - x) < epsilon && Math.abs(v.y - y) < epsilon && Math.abs(v.z - z) < epsilon,
    );
    if (!isDup) unique.push(new THREE.Vector3(x, y, z));
  }
  return unique;
}

function classifyShape(verts: THREE.Vector3[], solidId: SolidId): string {
  if (verts.length === 0) return "";

  const box = new THREE.Box3().setFromPoints(verts);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Point — essentially zero cross-section (tip of cone, etc.)
  if (size.x < 0.05 && size.y < 0.05 && size.z < 0.05) return "point";

  const n = verts.length;

  if (n === 3) return "triangle";

  if (n === 4) {
    // Largest two dims of the cut face
    const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
    const ratio = dims[0] / (dims[1] || 1);
    return ratio < 1.15 ? "square" : "rectangle";
  }

  if (n === 6) return "hexagon";

  // Many vertices: distinguish circle, ellipse, parabola
  // Parabola heuristic: cone + cut face is significantly taller than wide in world Y
  // (cutting plane parallel to slant produces an open, elongated curve)
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  const aspectRatio = dims[0] / (dims[1] || 1);

  if (solidId === "cone" && size.y > size.x * 1.6 && size.y > size.z * 1.6) {
    return "parabola";
  }

  const isRound = aspectRatio < 1.2;
  return isRound ? "circle" : "ellipse";
}

export function useShapeClassifier(
  csgGeometry: THREE.BufferGeometry | null,
  solidId: SolidId,
  planeInteracted: boolean,
): ClassifyResult | null {
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

    return { label, key: `${solidId}-${label}` };
  }, [csgGeometry, solidId, planeInteracted]);
}
