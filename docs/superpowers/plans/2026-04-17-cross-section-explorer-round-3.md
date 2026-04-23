# Cross-Section Explorer Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Mode A — shape classification, all four solids working with tilt, shape labels with GSAP animation, and drag-handle pulse affordance.

**Architecture:** The CSG geometry's group 1 (cross-section face) is extracted after each `csg.current.update()`, its raw triangle vertices are deduplicated with epsilon, and the resulting distinct-vertex count + bounding-box aspect ratio map to a shape label. A React hook (`useShapeClassifier`) owns this logic and returns a `ClassifyResult`. A separate HTML overlay component (`ShapeLabel`) renders the label with GSAP entrance animation.

**Tech Stack:** React Router 7, React Three Fiber, @react-three/csg, @react-three/drei PivotControls, Three.js, GSAP, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `app/hooks/useShapeClassifier.ts` | Pure classification logic: extract group 1 verts, deduplicate, classify |
| Create | `app/components/ShapeLabel.tsx` | HTML overlay: label display + GSAP entrance + connection moment |
| Create | `app/data/silhouettes.ts` | Stub export (content fills in Round 4) |
| Modify | `app/components/CuttingGeometry.tsx` | Enable tilt, add GSAP pulse, track hasInteracted, remove debug log |
| Modify | `app/components/SolidScene.tsx` | Reset plane on solid change, pass solidId to CuttingGeometry |
| Modify | `app/routes/home.tsx` | Wire label state + ShapeLabel |

---

## Task 1: Create `useShapeClassifier` hook

**Files:**
- Create: `app/hooks/useShapeClassifier.ts`

This hook receives the CSG result geometry and returns a classified shape label. Classification strategy (validated empirically in Round 2 debug session):
- Extract group 1 vertices from `geometry.attributes.position` using `group.start` and `group.count`
- Deduplicate with epsilon `0.001` (raw count is triangle vertices, not distinct verts)
- Count distinct vertices + compute bounding box aspect ratio → shape name

Shape rules (distinct vert count after dedup):
- 3 → `"triangle"`
- 4, aspect ~1:1 → `"square"` / aspect ≠ 1:1 → `"rectangle"`
- 6 → `"hexagon"`
- >6, many, bounding box aspect ~1:1 → `"circle"`
- >6, many, bounding box aspect ≠ 1:1 → `"ellipse"`
- >6, bounding box height > width * 1.5, open at bottom → `"parabola"`
- bounding box near-zero (all dims < 0.05) → `"point"`

- [ ] **Step 1.1: Create the file with types and dedup utility**

```ts
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
```

- [ ] **Step 1.2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors related to `useShapeClassifier.ts`.

- [ ] **Step 1.3: Commit**

```bash
git add app/hooks/useShapeClassifier.ts
git commit -m "feat: add useShapeClassifier hook for CSG cross-section shape detection"
```

---

## Task 2: Create `ShapeLabel` component

**Files:**
- Create: `app/components/ShapeLabel.tsx`

HTML overlay positioned absolutely over the canvas. Renders shape name in Fraunces italic amber. GSAP animates it in on each label change. Connection moment sentence auto-dismisses after 4s.

- [ ] **Step 2.1: Create the component**

```tsx
// app/components/ShapeLabel.tsx
import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ClassifyResult } from "~/hooks/useShapeClassifier";

interface ShapeLabelProps {
  result: ClassifyResult | null;
  connectionVisible: boolean;
}

const CONNECTION_SENTENCES: Record<string, string> = {
  "cone-circle": "A horizontal cut through a cone is always a circle.",
  "cone-ellipse": "Tilt the cut and the circle stretches into an ellipse.",
  "cone-triangle": "Cut through the apex and you get a triangle.",
  "cone-parabola": "A cut parallel to the slant gives a parabola.",
  "cone-point": "The apex itself is just a point.",
  "cylinder-circle": "A flat cut through a cylinder is a circle.",
  "cylinder-ellipse": "Tilt it and the circle becomes an ellipse.",
  "cylinder-rectangle": "A side cut through a cylinder gives a rectangle.",
  "cube-square": "A horizontal cut through a cube is a square.",
  "cube-rectangle": "Cut off-axis and the square becomes a rectangle.",
  "cube-hexagon": "Tilt at 45° and a cube reveals a hexagon.",
  "cube-triangle": "A corner cut gives a triangle.",
  "sphere-circle": "Every cross-section of a sphere is a circle.",
};

export function ShapeLabel({ result, connectionVisible }: ShapeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!labelRef.current || !result) return;
    gsap.fromTo(
      labelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
  }, [result?.key]);

  useEffect(() => {
    if (!connectionRef.current) return;
    if (connectionVisible) {
      gsap.fromTo(
        connectionRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      );
    } else {
      gsap.to(connectionRef.current, { opacity: 0, duration: 0.3 });
    }
  }, [connectionVisible]);

  if (!result) return null;

  const sentence = CONNECTION_SENTENCES[result.key] ?? null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 68,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      <div
        ref={labelRef}
        style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          fontSize: 28,
          color: "var(--color-amber)",
          letterSpacing: "0.01em",
          textTransform: "lowercase",
        }}
      >
        {result.label}
      </div>
      {sentence && (
        <div
          ref={connectionRef}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "var(--color-muted)",
            letterSpacing: "0.03em",
            opacity: 0,
          }}
        >
          {sentence}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add app/components/ShapeLabel.tsx
git commit -m "feat: add ShapeLabel overlay with GSAP entrance animation"
```

---

## Task 3: Create `silhouettes.ts` stub

**Files:**
- Create: `app/data/silhouettes.ts`

Stub only — full content comes in Round 4. Must export `SILHOUETTES` so Round 4 can fill it without changing import paths.

- [ ] **Step 3.1: Create stub**

```ts
// app/data/silhouettes.ts
// Stub — populated in Round 4 (Rotation Mode)
export const SILHOUETTES = {} as Record<string, never>;
```

- [ ] **Step 3.2: Commit**

```bash
git add app/data/silhouettes.ts
git commit -m "chore: add silhouettes stub for Round 4"
```

---

## Task 4: Update `CuttingGeometry.tsx` — tilt, pulse, interaction tracking, debug removal

**Files:**
- Modify: `app/components/CuttingGeometry.tsx`

Four changes in one file:
1. Remove `activeAxes` restriction from PivotControls (enables tilt)
2. Remove debug logging added in the validation session
3. Add GSAP pulse on drag handle mesh after mount, kill on first drag
4. Track `hasInteracted` state, pass through `onInteract` callback

- [ ] **Step 4.1: Read current file**

Read `app/components/CuttingGeometry.tsx` in full before editing.

- [ ] **Step 4.2: Rewrite the component with all four changes**

```tsx
// app/components/CuttingGeometry.tsx
import { Geometry, Base, Subtraction, type CSGGeometryRef } from "@react-three/csg";
import { PivotControls } from "@react-three/drei";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { wireframeMaterial } from "~/data/materials";

interface CuttingGeometryProps {
  solidGeometry: THREE.BufferGeometry;
  onShapeChange?: (geometryResult: THREE.BufferGeometry) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onInteract?: () => void;
}

const SOLID_COLOR = 0x232018;
const SECTION_COLOR = 0xd4962a;

export function CuttingGeometry({
  solidGeometry,
  onShapeChange,
  onDragStart,
  onDragEnd,
  onInteract,
}: CuttingGeometryProps) {
  const csg = useRef<CSGGeometryRef>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const pulseTargetRef = useRef<THREE.Mesh>(null);
  const hasInteracted = useRef(false);
  const prevMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());

  // Force multi-material array when R3F v9 doesn't attach it correctly
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || Array.isArray(mesh.material)) return;
    mesh.material = [
      new THREE.MeshStandardMaterial({ color: SOLID_COLOR, transparent: true, opacity: 0.85, roughness: 0.7, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: SECTION_COLOR, transparent: true, opacity: 0.85, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }),
    ];
  });

  // GSAP pulse on drag handle to signal affordance
  useEffect(() => {
    const target = pulseTargetRef.current;
    if (!target) return;
    const tween = gsap.to(target.scale, {
      x: 1.06,
      y: 1.06,
      z: 1.06,
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => { tween.kill(); };
  }, []);

  const handleDrag = (matrix: THREE.Matrix4) => {
    csg.current?.update();

    // Track meaningful interaction — compare full matrix to catch tilt-only gestures
    if (!hasInteracted.current && !matrix.equals(prevMatrixRef.current)) {
      hasInteracted.current = true;
      onInteract?.();
      if (pulseTargetRef.current) gsap.killTweensOf(pulseTargetRef.current.scale);
    }
    prevMatrixRef.current.copy(matrix);

    if (onShapeChange && csg.current) {
      onShapeChange(csg.current.geometry);
    }
  };

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
        <PivotControls
          depthTest={false}
          anchor={[0, -1, 0]}
          onDrag={handleDrag}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          scale={80}
          fixed
        >
          <Subtraction position={[0, 5, 0]}>
            <boxGeometry args={[10, 10, 10]} />
            <meshStandardMaterial
              color={SECTION_COLOR}
              transparent
              opacity={0.85}
              roughness={0.3}
              metalness={0.2}
              side={THREE.DoubleSide}
            />
          </Subtraction>
          {/* Invisible pulse target — gives GSAP something to animate without distorting the cutter */}
          <mesh ref={pulseTargetRef} visible={false}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial />
          </mesh>
        </PivotControls>
      </Geometry>
      <mesh geometry={solidGeometry} material={wireframeMaterial} />
    </mesh>
  );
}
```

> **Note on pulse target:** PivotControls renders its own gizmo — we can't easily scale that. The invisible mesh gives GSAP a transform target. If PivotControls exposes a ref or `scale` prop in a future version, this can be simplified.

- [ ] **Step 4.3: Verify build passes**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 4.4: Commit**

```bash
git add app/components/CuttingGeometry.tsx
git commit -m "feat: enable tilt on cutting plane, add pulse affordance, track interaction"
```

---

## Task 5: Update `SolidScene.tsx` — geometry switching + plane reset

**Files:**
- Modify: `app/components/SolidScene.tsx`

Two changes:
1. The geometry map is already in `SolidScene` — confirm it's passed to `CuttingGeometry` correctly
2. Add a `key` prop on `CuttingGeometry` tied to `solidId` — this unmounts/remounts the component on solid change, which resets the cutting plane to its initial position automatically (React's reconciler handles the reset for free)

- [ ] **Step 5.1: Read current file**

Read `app/components/SolidScene.tsx` in full.

- [ ] **Step 5.2: Add `key={solidId}` to CuttingGeometry and wire `onInteract`**

In `SceneContent`, update the `CuttingGeometry` usage:

```tsx
// Pass key to force remount on solid change (resets plane position)
// Pass onInteract through to home.tsx via a new prop
<CuttingGeometry
  key={solidId}
  solidGeometry={geometry}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onInteract={onInteract}
  onShapeChange={onShapeChange}
/>
```

Add `onInteract` and `onShapeChange` to `SceneContentProps` and thread them through `SolidSceneProps`:

```tsx
interface SceneContentProps {
  solidId: SolidId;
  mode: ModeId;
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
}

interface SolidSceneProps {
  solidId: SolidId;
  mode: ModeId;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
}
```

- [ ] **Step 5.3: Verify build passes**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 5.4: Commit**

```bash
git add app/components/SolidScene.tsx
git commit -m "feat: reset cutting plane on solid change, thread onInteract/onShapeChange props"
```

---

## Task 6: Update `home.tsx` — wire state + ShapeLabel

**Files:**
- Modify: `app/routes/home.tsx`

Add three pieces of state:
- `csgGeometry` — the latest CSG result, updated via `onShapeChange`
- `planeInteracted` — flipped to true once `onInteract` fires
- `connectionVisible` — true for 4s after first classify result per solid, then auto-dismisses

Wire `useShapeClassifier` and render `ShapeLabel` inside the canvas container (positioned absolutely).

- [ ] **Step 6.1: Read current home.tsx**

Read `app/routes/home.tsx` in full.

- [ ] **Step 6.2: Rewrite home.tsx with all wiring**

```tsx
// app/routes/home.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import type { SolidId, ModeId } from "~/types";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";
import { ShapeLabel } from "~/components/ShapeLabel";
import { useShapeClassifier } from "~/hooks/useShapeClassifier";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

export default function Home() {
  const [solidId, setSolidId] = useState<SolidId>("cone");
  const [mode, setMode] = useState<ModeId>("crossSection");
  const [csgGeometry, setCsgGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [planeInteracted, setPlaneInteracted] = useState(false);
  const [connectionVisible, setConnectionVisible] = useState(false);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSolidChange = useCallback((id: SolidId) => {
    setSolidId(id);
    setCsgGeometry(null);
    setPlaneInteracted(false);
    setConnectionVisible(false);
  }, []);

  const handleInteract = useCallback(() => {
    setPlaneInteracted(true);
  }, []);

  const handleShapeChange = useCallback((geo: THREE.BufferGeometry) => {
    setCsgGeometry(geo.clone()); // clone so reference changes and useMemo re-runs
  }, []);

  const classifyResult = useShapeClassifier(csgGeometry, solidId, planeInteracted);

  // Show connection moment for 4s on first classify result per solid
  const prevKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!classifyResult) return;
    if (classifyResult.key === prevKeyRef.current) return;
    prevKeyRef.current = classifyResult.key;
    setConnectionVisible(true);
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => setConnectionVisible(false), 4000);
  }, [classifyResult?.key]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--color-ground)",
      }}
    >
      <ModeBar mode={mode} onModeChange={setMode} />
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <SolidScene
          solidId={solidId}
          mode={mode}
          onInteract={handleInteract}
          onShapeChange={handleShapeChange}
        />
        {mode === "crossSection" && (
          <ShapeLabel result={classifyResult} connectionVisible={connectionVisible} />
        )}
      </div>
      <SolidSelector solidId={solidId} onSolidChange={handleSolidChange} />
    </div>
  );
}
```

- [ ] **Step 6.3: Verify build passes**

```bash
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Expected: zero TypeScript errors.

- [ ] **Step 6.4: Commit**

```bash
git add app/routes/home.tsx
git commit -m "feat: wire shape classification and label display in home route"
```

---

## Task 7: Hexagon Validation Gate

This is a manual verification step. Do not proceed to Round 4 until all six points pass.

- [ ] **Step 7.1: Run dev server**

```bash
pnpm dev
```

- [ ] **Step 7.2: Validate each point**

1. Select **CUBE** in the solid selector
2. Drag the cutting plane to mid-solid (y ≈ 0) — label should read "square" or "rectangle"
3. Tilt the cutting plane to approximately 45° on the X axis using the PivotControls rotation handle
4. Confirm an amber hexagon face appears as the cross-section
5. Confirm the label below the canvas reads **"hexagon"**
6. Confirm switching to a different solid resets the label (it disappears until you interact again)

- [ ] **Step 7.3: Smoke test all four solids**

| Solid | Expected flat-cut label | Expected tilted label |
|-------|------------------------|-----------------------|
| Cone | circle | ellipse |
| Cylinder | circle | ellipse |
| Cube | square | hexagon (at ~45°) |
| Sphere | circle | circle (always) |

- [ ] **Step 7.4: Commit validation result**

```bash
git commit --allow-empty -m "chore: Round 3 hexagon gate validated"
```

---

## Integration Notes

- `useShapeClassifier` memoizes on `[csgGeometry, solidId, planeInteracted]` — passing a cloned geometry reference from `handleShapeChange` ensures the memo re-runs on each drag
- The `key={solidId}` on `CuttingGeometry` is the simplest correct way to reset position — avoids imperative ref manipulation
- GSAP pulse uses an invisible child mesh inside PivotControls rather than trying to animate the gizmo itself
- `connectionVisible` auto-dismisses after 4s via `setTimeout`, not GSAP — GSAP handles the visual fade inside `ShapeLabel`

## Scope Boundary (NOT in this round)

- `MARK_MODE_COMPLETE` reducer (Round 4)
- Rotation mode (Round 4)
- Physics (Round 5)
- Mobile layout (Round 6)
