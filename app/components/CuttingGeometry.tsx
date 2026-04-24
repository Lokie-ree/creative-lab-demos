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
  onHeightChange?: (y: number) => void;
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
  onHeightChange,
}: CuttingGeometryProps) {
  const csg = useRef<CSGGeometryRef>(null);
  const meshRef = useRef<THREE.Mesh>(null);

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
          onHeightChange={onHeightChange}
        />
      </Geometry>
      <mesh geometry={solidGeometry} material={wireframeMaterial} />
    </mesh>
  );
}
