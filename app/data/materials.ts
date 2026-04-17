import * as THREE from "three";

export const solidMaterial = new THREE.MeshStandardMaterial({
  color: 0x232018,
  transparent: true,
  opacity: 0.85,
  roughness: 0.7,
  metalness: 0.1,
  side: THREE.FrontSide,
});

export const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0x7a7268,
  wireframe: true,
  transparent: true,
  opacity: 0.1,
});

export const sectionMaterial = new THREE.MeshStandardMaterial({
  color: 0xd4962a,
  transparent: true,
  opacity: 0.85,
  roughness: 0.3,
  metalness: 0.2,
  side: THREE.DoubleSide,
});

export const silhouetteMaterial = new THREE.LineBasicMaterial({
  color: 0xede8e0,
  transparent: true,
  opacity: 0.75,
});

export const axisLineMaterial = new THREE.LineBasicMaterial({
  color: 0xd4962a,
  transparent: true,
  opacity: 0.5,
});
