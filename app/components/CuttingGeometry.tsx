import { Geometry, Base, type CSGGeometryRef } from "@react-three/csg";
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { wireframeMaterial } from "~/data/materials";
import { JoystickGizmo } from "~/components/JoystickGizmo";

interface CuttingGeometryProps {
  solidGeometry: THREE.BufferGeometry;
  onShapeChange?: (geometryResult: THREE.BufferGeometry) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onInteract?: () => void;
  physicsActive?: boolean;
  onPlaneTransformChange?: (transform: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => void;
}

const SOLID_COLOR = 0x232018;
const SECTION_COLOR = 0xd4962a;

export function CuttingGeometry({
  solidGeometry,
  onShapeChange,
  onDragStart,
  onDragEnd,
  onInteract,
  physicsActive,
  onPlaneTransformChange,
}: CuttingGeometryProps) {
  const csg = useRef<CSGGeometryRef>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !Array.isArray(mesh.material)) return;
    const opacity = physicsActive ? 0 : 0.85;
    (mesh.material as THREE.MeshStandardMaterial[]).forEach((mat) => {
      mat.opacity = opacity;
    });
  }, [physicsActive]);

  // Safety net: if the CSG library's material-assignment path fails in R3F v9,
  // force a 2-entry array so groups with materialIndex 0/1 always resolve correctly.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || Array.isArray(mesh.material)) return;
    mesh.material = [
      new THREE.MeshStandardMaterial({
        color: SOLID_COLOR, transparent: true, opacity: 0.85, roughness: 0.7, metalness: 0.1,
      }),
      new THREE.MeshStandardMaterial({
        color: SECTION_COLOR, transparent: true, opacity: 0.85, roughness: 0.3, metalness: 0.2,
        side: THREE.DoubleSide,
      }),
    ];
  }, []);

  return (
    <mesh ref={meshRef}>
      <Geometry ref={csg} useGroups consolidateGroups computeVertexNormals>
        <Base geometry={solidGeometry}>
          <meshStandardMaterial
            color={SOLID_COLOR}
            transparent
            opacity={0.85}
            roughness={0.7}
            metalness={0.1}
          />
        </Base>
        <JoystickGizmo
          csgRef={csg}
          solidGeometry={solidGeometry}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onInteract={onInteract}
          onShapeChange={onShapeChange}
          physicsActive={physicsActive}
          onPlaneTransformChange={onPlaneTransformChange}
        />
      </Geometry>
      <mesh geometry={solidGeometry} material={wireframeMaterial} visible={!physicsActive} />
    </mesh>
  );
}
