# Mode A: Joystick Gizmo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PivotControls with a custom joystick gizmo (translucent plane disc + stem + draggable sphere handle) that controls the CSG cutting plane via height and tilt, while preserving OrbitControls.

**Architecture:** `JoystickGizmo` is a self-contained R3F component rendered inside `<Geometry>`. It owns the `Subtraction` brush, all gizmo visuals, and the GSAP pulse affordance. `CuttingGeometry` is simplified to own only the CSG mesh setup and the outer wireframe. Drag interaction is handled via canvas-level `pointermove`/`pointerup` listeners (not R3F event props) so the handle stays responsive even when the pointer leaves the sphere during fast drags.

**Tech Stack:** React 19, React Router 7, @react-three/fiber v9, @react-three/csg v4, three-bvh-csg v0.0.16, Three.js 0.184, GSAP 3, TypeScript, Vitest (existing unit tests only)

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `app/components/JoystickGizmo.tsx` | **Create** | Subtraction brush + disc/stem/handle visuals + drag interaction + GSAP pulse |
| `app/components/CuttingGeometry.tsx` | **Modify** | Remove PivotControls; render JoystickGizmo inside Geometry; remove now-moved logic |
| `app/utils/classifyShape.ts` | **Modify (temp)** | Add dev console.logs for smoke test — remove before final commit |

No changes to: `SolidScene.tsx`, `home.tsx`, `useShapeClassifier.ts`, `ShapeLabel.tsx`.

---

## Key Constants (tune in testing)

```ts
const HEIGHT_SENSITIVITY = 0.01; // world units per pixel of vertical drag
const TILT_SENSITIVITY = 0.005;  // radians per pixel of horizontal drag
const SECTION_COLOR = 0xd4962a;  // amber — matches existing section material
```

---

## Task 1: Create JoystickGizmo — Visuals Only

**Files:**
- Create: `app/components/JoystickGizmo.tsx`

> **Note:** R3F components can't be meaningfully unit-tested without a canvas. Verification for Tasks 1–3 is visual: run `pnpm dev`, open the browser, confirm what you see.

- [ ] **Step 1: Create the file with visual-only implementation**

```tsx
// app/components/JoystickGizmo.tsx
import { useRef, useEffect } from "react";
import { Subtraction, type CSGGeometryRef } from "@react-three/csg";
import * as THREE from "three";
import gsap from "gsap";

const SECTION_COLOR = 0xd4962a;
const HEIGHT_SENSITIVITY = 0.01;
const TILT_SENSITIVITY = 0.005;

export interface JoystickGizmoProps {
  csgRef: React.RefObject<CSGGeometryRef>;
  solidGeometry: THREE.BufferGeometry;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
}

export function JoystickGizmo({
  csgRef,
  solidGeometry,
  onDragStart,
  onDragEnd,
  onInteract,
  onShapeChange,
}: JoystickGizmoProps) {
  const groupRef = useRef<THREE.Group>(null);
  const handleRef = useRef<THREE.Mesh>(null);
  const pulseTargetRef = useRef<THREE.Mesh>(null);

  // GSAP pulse on handle sphere to signal affordance
  useEffect(() => {
    const target = pulseTargetRef.current;
    if (!target) return;
    gsap.set(target.scale, { x: 1, y: 1, z: 1 });
    const tween = gsap.to(target.scale, {
      x: 1.18, y: 1.18, z: 1.18,
      duration: 1, repeat: -1, yoyo: true, ease: "sine.inOut",
    });
    return () => { tween.kill(); };
  }, []);

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      {/* CSG brush — large half-space box, bottom face at y=0 is the cutting plane */}
      <Subtraction position={[0, 50, 0]}>
        <boxGeometry args={[50, 100, 50]} />
        <meshStandardMaterial
          color={SECTION_COLOR}
          transparent
          opacity={0.85}
          roughness={0.3}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </Subtraction>

      {/* Plane disc — flat cylinder at y=0 (the cutting plane position) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.015, 64]} />
        <meshStandardMaterial
          color={SECTION_COLOR}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Plane rim ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.25, 64]} />
        <meshBasicMaterial
          color={SECTION_COLOR}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Stem */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.8, 8]} />
        <meshBasicMaterial color={SECTION_COLOR} transparent opacity={0.25} />
      </mesh>

      {/* Handle sphere — draggable; pulseTarget drives GSAP scale */}
      <mesh ref={pulseTargetRef} position={[0, -0.8, 0]}>
        <mesh ref={handleRef}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial
            color={SECTION_COLOR}
            roughness={0.2}
            metalness={0.5}
            emissive={new THREE.Color(SECTION_COLOR)}
            emissiveIntensity={0.35}
          />
        </mesh>
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run `pnpm dev` and open the app in cross-section mode. Confirm you see the joystick gizmo: a faint amber disc at the cutting plane, a short stem below, and a glowing sphere at the bottom. (PivotControls is still present at this point — that's fine, we remove it in Task 3.)

---

## Task 2: Implement Drag Interaction

**Files:**
- Modify: `app/components/JoystickGizmo.tsx`

- [ ] **Step 1: Add `useThree` import and drag state refs**

Add these imports at the top of `JoystickGizmo.tsx`:

```ts
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
```

Add these refs inside the component (after existing refs):

```ts
const { camera, gl } = useThree();
const isDragging = useRef(false);
const hasInteracted = useRef(false);
const prevClientX = useRef(0);
const prevClientY = useRef(0);
const cameraRight = useRef(new THREE.Vector3());
const solidBoundsY = useRef({ min: -1.5, max: 1.5 });
```

- [ ] **Step 2: Compute solid Y bounds on mount**

Add this effect after the GSAP pulse effect:

```ts
useEffect(() => {
  const box = new THREE.Box3().setFromBufferAttribute(
    solidGeometry.attributes.position as THREE.BufferAttribute,
  );
  solidBoundsY.current = { min: box.min.y, max: box.max.y };
}, [solidGeometry]);
```

- [ ] **Step 3: Add canvas-level pointermove/pointerup listeners**

Add this effect (handles drag while pointer may be outside the handle sphere):

```ts
useEffect(() => {
  const canvas = gl.domElement;

  const onMove = (e: PointerEvent) => {
    if (!isDragging.current || !groupRef.current || !csgRef.current) return;

    const dx = e.clientX - prevClientX.current;
    const dy = e.clientY - prevClientY.current;
    prevClientX.current = e.clientX;
    prevClientY.current = e.clientY;

    const group = groupRef.current;

    // --- Height: translate in world Y, clamp to solid bounds ---
    const currentY = group.matrix.elements[13];
    const targetY = currentY - dy * HEIGHT_SENSITIVITY;
    const clampedY = Math.max(solidBoundsY.current.min, Math.min(solidBoundsY.current.max, targetY));
    const deltaY = clampedY - currentY;
    if (deltaY !== 0) {
      group.matrix.premultiply(new THREE.Matrix4().makeTranslation(0, deltaY, 0));
    }

    // --- Tilt: rotate around camera right vector sampled at pointerdown ---
    if (dx !== 0) {
      const tiltAngle = dx * TILT_SENSITIVITY;
      group.matrix.multiply(
        new THREE.Matrix4().makeRotationAxis(cameraRight.current, tiltAngle),
      );
    }

    group.matrixAutoUpdate = false;
    group.updateMatrixWorld(true);
    csgRef.current.update();

    // Fire onInteract once on first real movement
    if (!hasInteracted.current && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
      hasInteracted.current = true;
      onInteract?.();
      if (pulseTargetRef.current) gsap.killTweensOf(pulseTargetRef.current.scale);
    }

    onShapeChange?.(csgRef.current.geometry);
  };

  const onUp = (e: PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    onDragEnd?.();
  };

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  return () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
  };
}, [gl.domElement, csgRef, onDragEnd, onInteract, onShapeChange]);
```

- [ ] **Step 4: Add pointerdown handler on the handle mesh**

Replace the inner `<mesh ref={handleRef}>` with:

```tsx
<mesh
  ref={handleRef}
  onPointerDown={(e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = true;
    prevClientX.current = e.clientX;
    prevClientY.current = e.clientY;
    // Sample camera right once — do NOT re-sample during drag
    cameraRight.current.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    try { gl.domElement.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    onDragStart?.();
  }}
>
  <sphereGeometry args={[0.18, 16, 16]} />
  <meshStandardMaterial
    color={SECTION_COLOR}
    roughness={0.2}
    metalness={0.5}
    emissive={new THREE.Color(SECTION_COLOR)}
    emissiveIntensity={0.35}
  />
</mesh>
```

- [ ] **Step 5: Verify drag interaction**

In the browser, try dragging the handle sphere:
- Drag up/down: cutting plane should move and CSG should update (cross-section changes)
- Drag left/right: plane should tilt (cross-section changes shape)
- Orbit (drag anywhere else on canvas): camera moves, gizmo stays put ✓
- Release handle: plane stays in position (no spring-back) ✓

---

## Task 3: Integrate JoystickGizmo into CuttingGeometry

**Files:**
- Modify: `app/components/CuttingGeometry.tsx`

- [ ] **Step 1: Remove PivotControls and its dead code**

Replace the entire contents of `CuttingGeometry.tsx` with:

```tsx
// app/components/CuttingGeometry.tsx
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
        />
      </Geometry>
      <mesh geometry={solidGeometry} material={wireframeMaterial} />
    </mesh>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm typecheck
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 3: Visual check — all four solids**

In the browser, switch through Cone → Cylinder → Cube → Sphere. For each:
- Gizmo appears (disc + stem + handle) ✓
- No PivotControls handles visible ✓
- Dragging handle moves/tilts the cutting plane ✓
- Switching solids resets the gizmo to center/horizontal ✓
- Orbiting works when not dragging handle ✓

- [ ] **Step 4: Commit**

```bash
git add app/components/JoystickGizmo.tsx app/components/CuttingGeometry.tsx
git commit -m "feat: replace PivotControls with joystick gizmo (disc + stem + handle)"
```

---

## Task 4: Smoke Test — Classification and Labels

**Files:**
- Modify (temp): `app/utils/classifyShape.ts`

- [ ] **Step 1: Add dev console.logs to classifyShape**

In `app/utils/classifyShape.ts`, add two logs as described in the spec.

After `const hullN = hull.length;` (around line 79), add:
```ts
console.log('[classify] hullN:', hullN, 'solidId:', solidId);
```

Inside the many-vertex branch (after `const aspect2d = ...` is computed, around line 97), add:
```ts
console.log('[classify] aspect2d:', aspect2d.toFixed(2), 'solidId:', solidId);
```

> React Strict Mode double-invokes memos in dev — logs may appear twice per event. Ignore duplicates; values are identical.

- [ ] **Step 2: Open browser devtools console and walk the 8 smoke cases**

For each row, perform the cut described, then check the logged `hullN`/`aspect2d` and the label shown on screen.

| # | Solid | Cut | Expected label | Expected hullN |
|---|---|---|---|---|
| 1 | Cone | Horizontal (default) | circle | > 6 |
| 2 | Cone | Drag handle sideways ~30° | ellipse | > 6 |
| 3 | Cylinder | Horizontal (default) | circle | > 6 |
| 4 | Cylinder | Drag handle sideways ~45° | ellipse | > 6 |
| 5 | Cube | Horizontal (default) | square | 4 |
| 6 | Cube | Drag handle diagonally | hexagon | 6 |
| 7 | Sphere | Horizontal (default) | circle | > 6 |
| 8 | Sphere | Any tilt | circle | > 6 |

If any case shows a wrong label: note the actual `hullN` and `aspect2d` from the log, compare against `classifyShape` logic, and fix before continuing.

- [ ] **Step 3: Verify label checklist**

For the same 8 cases, confirm:
- [ ] Shape name appears after first drag (not before)
- [ ] Shape name re-animates when shape changes (e.g., drag from square to hexagon on cube)
- [ ] Connection sentence appears, holds ~4 seconds, fades
- [ ] Switching solids: old label disappears, new label appears after first drag on new solid

- [ ] **Step 4: Remove console.logs**

Delete both `console.log` lines from `app/utils/classifyShape.ts`.

Run:
```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Final commit**

```bash
git add app/utils/classifyShape.ts
git commit -m "chore: remove smoke test logs from classifyShape"
```

Then tag the round complete:
```bash
git commit --allow-empty -m "chore: Round 3 complete — joystick gizmo + smoke test"
```

---

## Done

Mode A is shipped. Round 4 starts fresh.
