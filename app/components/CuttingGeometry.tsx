import { Geometry, Base, Subtraction } from "@react-three/csg";
import { PivotControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import {
  solidMaterial,
  sectionMaterial,
  wireframeMaterial,
} from "~/data/materials";

interface CuttingGeometryProps {
  solidGeometry: THREE.BufferGeometry;
  onShapeChange?: (geometryResult: THREE.BufferGeometry) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

type CsgApi = { update(): void; geometry: THREE.BufferGeometry };

const CSG_MATERIALS = [solidMaterial, sectionMaterial];

export function CuttingGeometry({
  solidGeometry,
  onShapeChange,
  onDragStart,
  onDragEnd,
}: CuttingGeometryProps) {
  const csg = useRef<CsgApi>(null);

  const handleDrag = () => {
    csg.current?.update();
    if (onShapeChange && csg.current) {
      onShapeChange(csg.current.geometry);
    }
  };

  return (
    <mesh material={CSG_MATERIALS}>
      <Geometry ref={csg} useGroups computeVertexNormals>
        <Base geometry={solidGeometry} />
        <PivotControls
          depthTest={false}
          anchor={[0, -1, 0]}
          activeAxes={[false, true, false]}
          onDrag={handleDrag}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          scale={80}
          fixed
        >
          <Subtraction position={[0, 5, 0]}>
            <boxGeometry args={[10, 10, 10]} />
          </Subtraction>
        </PivotControls>
      </Geometry>
      <mesh geometry={solidGeometry} material={wireframeMaterial} />
    </mesh>
  );
}
