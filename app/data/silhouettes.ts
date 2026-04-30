import * as THREE from "three";
import type { SolidId } from "~/types";

export const SILHOUETTES: Record<Exclude<SolidId, "cube">, THREE.Vector2[]> = {
  cone: [
    new THREE.Vector2(0, 1.5),
    new THREE.Vector2(0.001, 1.499),
    new THREE.Vector2(1.2, -1.5),
    new THREE.Vector2(1.199, -1.5),
    new THREE.Vector2(0, -1.5),
  ],
  cylinder: [
    new THREE.Vector2(0, 1.5),
    new THREE.Vector2(1, 1.5),
    new THREE.Vector2(1, -1.5),
    new THREE.Vector2(0, -1.5),
  ],
  sphere: [
    ...Array.from({ length: 17 }, (_, i) => {
      const angle = (i / 16) * Math.PI;
      return new THREE.Vector2(Math.sin(angle) * 1.3, Math.cos(angle) * 1.3);
    }),
  ],
};
