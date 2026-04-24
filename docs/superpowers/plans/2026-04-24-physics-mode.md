# Physics Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement physics mode for both Mode A (sensor plane cross-section flash) and Mode B (axis spin after rotation completes), with physics button visible at all screen widths.

**Architecture:** `PhysicsSolid.tsx` is a self-contained component that includes the `<Physics>` wrapper, `<RigidBody>`, floor collider, and (in Mode A) a sensor collider. It is lazy-loaded from `SolidScene.tsx` so Rapier WASM only loads on first physics activation. `SolidScene` renders a flash plane mesh alongside `PhysicsSolid` in Mode A; in Mode B it passes `geometry={null}` to `RotationScene` (suppressing only the solid mesh — the axis line and silhouette are preserved by `RotationScene`'s existing `{geometry && (...)}` guard) while `PhysicsSolid` handles the physics solid. `useDemoReducer` gains `physicsMode` state driven by a new `TOGGLE_PHYSICS` action. `OrbitControls` is disabled during physics via the `enabled` prop.

**Architecture deviations from spec:**
- *`<Physics>` + floor placement:* The spec diagrams show the `<Physics>` wrapper in `SolidScene`/`RotationScene` with the floor as a sibling to `PhysicsSolid`. This plan self-contains `<Physics>` and the floor inside `PhysicsSolid.tsx` so the lazy-loaded module brings everything it needs with no Rapier imports outside `PhysicsSolid`. The behavior is identical.
- *Flash mechanism:* The spec calls for tweening `sectionMaterial.emissive` from `materials.ts`. In the actual codebase, `CuttingGeometry.tsx` creates its section face material locally (not using the shared `sectionMaterial` instance), so tweening that shared instance would be a no-op. This plan uses a separate amber flash plane mesh at `planeY` driven by GSAP opacity — functionally equivalent, no CSG material access required.

**Tech Stack:** `@react-three/rapier` ^2.2.0, `@react-three/fiber` ^9.6.0, `gsap` ^3.15.0, React 19, TypeScript, Vitest

---

## File Map

**Create:**
- `app/components/PhysicsSolid.tsx` — self-contained physics component: `<Physics>` + `<RigidBody>` + floor collider + (Mode A) sensor collider

**Modify:**
- `app/hooks/useDemoReducer.ts` — add `physicsMode: boolean`, `TOGGLE_PHYSICS` action, reset in `SET_SOLID`/`SET_MODE`
- `app/hooks/useDemoReducer.test.ts` — add tests for physics state transitions
- `app/components/JoystickGizmo.tsx` — add `physicsActive?: boolean` (hide visuals), `onHeightChange?: (y: number) => void` (expose plane Y)
- `app/components/CuttingGeometry.tsx` — thread `physicsActive` and `onHeightChange` through to `JoystickGizmo`
- `app/components/SolidScene.tsx` — add `physicsMode` prop, lazy-load `PhysicsSolid`, render flash plane, disable `OrbitControls` during physics, conditionally suppress `RotationScene` solid in Mode B
- `app/components/ModeBar.tsx` — wire physics button with `physicsMode`, `onPhysicsToggle`, `rotationComplete` props
- `app/routes/home.tsx` — connect `physicsMode` state to `ModeBar` and `SolidScene`
- `app/app.css` — physics button label class for narrow widths, `prefers-reduced-motion` hide

---

### Task 1: Reducer — `physicsMode` state and `TOGGLE_PHYSICS` action

**Files:**
- Modify: `app/hooks/useDemoReducer.ts`
- Modify: `app/hooks/useDemoReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `app/hooks/useDemoReducer.test.ts`:

```ts
describe("TOGGLE_PHYSICS", () => {
  test("flips physicsMode from false to true", () => {
    const next = demoReducer(initialState, { type: "TOGGLE_PHYSICS" });
    expect(next.physicsMode).toBe(true);
  });

  test("flips physicsMode from true to false", () => {
    const on: DemoState = { ...initialState, physicsMode: true };
    const next = demoReducer(on, { type: "TOGGLE_PHYSICS" });
    expect(next.physicsMode).toBe(false);
  });
});

describe("physicsMode reset on navigation", () => {
  test("SET_SOLID resets physicsMode to false", () => {
    const on: DemoState = { ...initialState, physicsMode: true };
    const next = demoReducer(on, { type: "SET_SOLID", payload: "cylinder" });
    expect(next.physicsMode).toBe(false);
  });

  test("SET_MODE resets physicsMode to false", () => {
    const on: DemoState = { ...initialState, physicsMode: true };
    const next = demoReducer(on, { type: "SET_MODE", payload: "rotation" });
    expect(next.physicsMode).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/hooks/useDemoReducer.test.ts
```

Expected: FAIL — `physicsMode` property does not exist, `TOGGLE_PHYSICS` action not handled.

- [ ] **Step 3: Implement the changes in `useDemoReducer.ts`**

Add `physicsMode: boolean` to `DemoState` interface and `initialState`. Add `TOGGLE_PHYSICS` to `DemoAction`. Update `SET_SOLID` and `SET_MODE` cases. Add `TOGGLE_PHYSICS` case:

```ts
// DemoState — add field:
physicsMode: boolean;

// initialState — add field:
physicsMode: false,

// DemoAction — add variant:
| { type: "TOGGLE_PHYSICS" }

// SET_SOLID case — add to return:
physicsMode: false,

// SET_MODE case — add to return:
physicsMode: false,

// New case:
case "TOGGLE_PHYSICS":
  return { ...state, physicsMode: !state.physicsMode };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/hooks/useDemoReducer.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/hooks/useDemoReducer.ts app/hooks/useDemoReducer.test.ts
git commit -m "feat: add physicsMode state and TOGGLE_PHYSICS action to reducer"
```

---

### Task 2: Create `PhysicsSolid.tsx`

**Files:**
- Create: `app/components/PhysicsSolid.tsx`

This component is self-contained: it owns the `<Physics>` wrapper, `<RigidBody>`, floor collider, and (in Mode A) the sensor collider. It is exported as a named export and lazy-loaded by `SolidScene`.

- [ ] **Step 1: Create the file**

```tsx
// app/components/PhysicsSolid.tsx
import { useRef, useEffect, Suspense } from "react";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RigidBody as RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface PhysicsSolidProps {
  mode: "crossSection" | "rotation";
  geometry: THREE.BufferGeometry;
  planeY?: number;                    // Mode A only: sensor collider Y position
  onIntersectionEnter?: () => void;   // Mode A only: called when solid enters sensor plane
  onIntersectionExit?: () => void;    // Mode A only: called when solid exits sensor plane
  initialPosition?: [number, number, number]; // Mode B: match RotationScene group offset [0, 0.5, 0]
}

const FLOOR_Y = -3;
const SENSOR_HALF_HEIGHT = 0.05;
const SENSOR_HALF_WIDTH = 2;
const DEBOUNCE_MS = 200;

export function PhysicsSolid({
  mode,
  geometry,
  planeY = 0,
  onIntersectionEnter,
  onIntersectionExit,
  initialPosition = [0, 0, 0],
}: PhysicsSolidProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const torqueFiredRef = useRef(false);
  const lastIntersectionMs = useRef(0);

  // Mode B: apply torque once on mount
  useEffect(() => {
    if (mode !== "rotation" || torqueFiredRef.current) return;
    torqueFiredRef.current = true;
    rigidBodyRef.current?.applyTorqueImpulse({ x: 0, y: 8, z: 0 }, true);
  }, [mode]);

  // Reset position and rotation before the Physics context unmounts.
  // React unmounts children before parents, so this cleanup fires while the
  // parent <Physics> context (and its Rapier world) is still alive.
  // The try/catch handles the rare case where the world is already destroyed.
  useEffect(() => {
    return () => {
      try {
        rigidBodyRef.current?.setTranslation(
          { x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] },
          true,
        );
        rigidBodyRef.current?.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      } catch (_) {
        // Rapier world may already be torn down — safe to swallow
      }
    };
  }, [initialPosition]);

  const handleClick = () => {
    rigidBodyRef.current?.applyImpulse(
      { x: (Math.random() - 0.5) * 4, y: 10, z: (Math.random() - 0.5) * 4 },
      true,
    );
    if (mode === "rotation") {
      rigidBodyRef.current?.applyTorqueImpulse({ x: 0, y: 6, z: 0 }, true);
    }
  };

  const handleIntersectionEnter = () => {
    const now = Date.now();
    if (now - lastIntersectionMs.current < DEBOUNCE_MS) return;
    lastIntersectionMs.current = now;
    onIntersectionEnter?.();
  };

  const handleIntersectionExit = () => {
    const now = Date.now();
    if (now - lastIntersectionMs.current < DEBOUNCE_MS) return;
    lastIntersectionMs.current = now;
    onIntersectionExit?.();
  };

  return (
    <Suspense fallback={null}>
      <Physics gravity={[0, -9.81, 0]}>
        <RigidBody
          ref={rigidBodyRef}
          type="dynamic"
          colliders="hull"
          restitution={0.6}
          angularDamping={mode === "rotation" ? 1.5 : 0.1}
          position={initialPosition}
        >
          <mesh geometry={geometry} onClick={handleClick}>
            <meshStandardMaterial
              color={0x232018}
              transparent
              opacity={0.85}
              roughness={0.7}
              metalness={0.1}
            />
          </mesh>
        </RigidBody>

        {/* Floor */}
        <CuboidCollider position={[0, FLOOR_Y, 0]} args={[20, 0.5, 20]} />

        {/* Mode A: sensor at cutting plane Y */}
        {mode === "crossSection" && (
          <CuboidCollider
            sensor
            args={[SENSOR_HALF_WIDTH, SENSOR_HALF_HEIGHT, SENSOR_HALF_WIDTH]}
            position={[0, planeY, 0]}
            onIntersectionEnter={handleIntersectionEnter}
            onIntersectionExit={handleIntersectionExit}
          />
        )}
      </Physics>
    </Suspense>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero TypeScript errors in the new file. If `RapierRigidBody` import path is wrong, check `@react-three/rapier` exports — the type may be `RigidBodyApi` in older versions. Adjust the import if needed.

- [ ] **Step 3: Commit**

```bash
git add app/components/PhysicsSolid.tsx
git commit -m "feat: create PhysicsSolid component with Mode A sensor plane and Mode B axis spin"
```

---

### Task 3: Add `physicsActive` and `onHeightChange` to `JoystickGizmo` and `CuttingGeometry`

**Files:**
- Modify: `app/components/JoystickGizmo.tsx`
- Modify: `app/components/CuttingGeometry.tsx`

- [ ] **Step 1: Update `JoystickGizmo.tsx`**

Add two props to `JoystickGizmoProps`:

```ts
physicsActive?: boolean;            // hide stem + handle when true
onHeightChange?: (y: number) => void; // called on every height update
```

In the `onMove` handler (inside the `useEffect` for canvas events), after `heightRef.current` is updated, add:

```ts
onHeightChange?.(heightRef.current);
```

This line goes right after:
```ts
heightRef.current = Math.max(
  solidBoundsY.current.min,
  Math.min(solidBoundsY.current.max, targetY),
);
```

On the stem `<mesh>` and handle `<mesh ref={pulseTargetRef}>`, add `visible={!physicsActive}`:

```tsx
{/* Stem */}
<mesh position={[0, -0.4, 0]} visible={!physicsActive}>
  ...
</mesh>

{/* Handle */}
<mesh ref={pulseTargetRef} position={[0, -0.8, 0]} visible={!physicsActive}>
  ...
</mesh>
```

- [ ] **Step 2: Update `CuttingGeometry.tsx`**

Add two props to `CuttingGeometryProps`:

```ts
physicsActive?: boolean;
onHeightChange?: (y: number) => void;
```

Pass them through to `JoystickGizmo`:

```tsx
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
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/JoystickGizmo.tsx app/components/CuttingGeometry.tsx
git commit -m "feat: add physicsActive and onHeightChange to JoystickGizmo/CuttingGeometry"
```

---

### Task 4: Update `SolidScene.tsx` — physics rendering, flash plane, OrbitControls toggle

**Files:**
- Modify: `app/components/SolidScene.tsx`

- [ ] **Step 1: Add imports**

At the top of `SolidScene.tsx`, add:

```tsx
import { lazy, Suspense, useRef, useCallback } from "react";
import gsap from "gsap";
```

Replace the existing `import { useRef } from "react"` with the above (merge if already present).

Add lazy import of `PhysicsSolid` (do NOT add a top-level import of `@react-three/rapier`):

```tsx
const PhysicsSolid = lazy(() =>
  import("~/components/PhysicsSolid").then((m) => ({ default: m.PhysicsSolid })),
);
```

- [ ] **Step 2: Update `SceneContentProps` and `SolidSceneProps`**

Add `physicsMode: boolean` to both interfaces.

`SceneContentProps` already has `orbitRef`. Also add:
```ts
physicsMode: boolean;
```

`SolidSceneProps` — add:
```ts
physicsMode?: boolean;
```

- [ ] **Step 3: Update `SceneContent` — add flash plane, planeYRef, intersection handlers**

At the top of `SceneContent`, add:

```tsx
const planeYRef = useRef(0);
const flashPlaneRef = useRef<THREE.Mesh>(null);

const handleIntersectionEnter = useCallback(() => {
  const mat = flashPlaneRef.current?.material as THREE.MeshBasicMaterial | null;
  if (!mat) return;
  gsap.killTweensOf(mat);
  gsap.to(mat, { opacity: 0.45, duration: 0.1 });
}, []);

const handleIntersectionExit = useCallback(() => {
  const mat = flashPlaneRef.current?.material as THREE.MeshBasicMaterial | null;
  if (!mat) return;
  gsap.killTweensOf(mat);
  gsap.to(mat, { opacity: 0, duration: 0.3 });
}, []);
```

- [ ] **Step 4: Update the `crossSection` branch in `SceneContent`**

Replace the current `if (mode === 'crossSection') { return <CuttingGeometry ... /> }` with:

```tsx
if (mode === "crossSection") {
  return (
    <>
      <CuttingGeometry
        key={solidId}
        solidGeometry={geometry}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onInteract={onInteract}
        onShapeChange={onShapeChange}
        onHeightChange={(y) => { planeYRef.current = y; }}
        physicsActive={physicsMode}
      />
      {physicsMode && (
        <>
          <mesh
            ref={flashPlaneRef}
            position={[0, planeYRef.current, 0]}
            renderOrder={1}
          >
            <planeGeometry args={[4, 4]} />
            <meshBasicMaterial
              color={0xd4962a}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Suspense fallback={null}>
            <PhysicsSolid
              mode="crossSection"
              geometry={geometry}
              planeY={planeYRef.current}
              onIntersectionEnter={handleIntersectionEnter}
              onIntersectionExit={handleIntersectionExit}
            />
          </Suspense>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Update the `rotation` branch in `SceneContent`**

Replace the current `return <RotationScene ... />` with:

```tsx
return (
  <>
    <RotationScene
      solidId={solidId}
      angle={rotationAngle}
      rotationComplete={rotationComplete}
      geometry={physicsMode ? null : rotationGeometry}
    />
    {physicsMode && rotationComplete && rotationGeometry && (
      <Suspense fallback={null}>
        <PhysicsSolid
          mode="rotation"
          geometry={rotationGeometry}
          initialPosition={[0, 0.5, 0]}
        />
      </Suspense>
    )}
  </>
);
```

Note: `initialPosition={[0, 0.5, 0]}` matches `RotationScene`'s `<group position={[0, 0.5, 0]}>` so the physics solid spawns at the same location as the completed solid.

Note: Passing `geometry={null}` to `RotationScene` suppresses **only** the solid mesh — `RotationScene` guards it with `{geometry && (...)}`. The axis line and the (already-faded) silhouette render independently of the `geometry` prop and are unaffected.

- [ ] **Step 6: Wire `physicsMode` into `SolidScene` and `SceneContent`**

In `SolidScene`, add `physicsMode = false` to destructured props and pass it to `SceneContent`:

```tsx
export function SolidScene({
  solidId,
  mode,
  onInteract,
  onShapeChange,
  rotationAngle = 0,
  rotationComplete = false,
  rotationGeometry = null,
  physicsMode = false,      // new
}: SolidSceneProps) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas ...>
      ...
      <OrbitControls
        ref={orbitRef}
        enabled={!physicsMode}   // disable during physics
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
      />
      <SceneContent
        solidId={solidId}
        mode={mode}
        orbitRef={orbitRef}
        onInteract={onInteract}
        onShapeChange={onShapeChange}
        rotationAngle={rotationAngle}
        rotationComplete={rotationComplete}
        rotationGeometry={rotationGeometry}
        physicsMode={physicsMode}    // new
      />
    </Canvas>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors. If `lazy` is not in the existing `react` import, add it.

- [ ] **Step 8: Commit**

```bash
git add app/components/SolidScene.tsx
git commit -m "feat: add physics rendering, flash plane, and OrbitControls toggle to SolidScene"
```

---

### Task 5: Wire `ModeBar.tsx` and `home.tsx`

**Files:**
- Modify: `app/components/ModeBar.tsx`
- Modify: `app/routes/home.tsx`

- [ ] **Step 1: Update `ModeBar.tsx` props and physics button**

The existing physics button in `ModeBar.tsx` is hardcoded `disabled` and renders as a single text node `◆ PHYSICS` with no props. This entire button element is replaced — including removing the hardcoded `disabled` attribute, splitting the label into two spans, and adding the new props.

Replace the `ModeBarProps` interface:

```ts
interface ModeBarProps {
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  solidId: SolidId;
  physicsMode: boolean;           // new
  onPhysicsToggle: () => void;    // new
  rotationComplete: boolean;      // new
}
```

Update the function signature to destructure the new props.

Replace the existing physics button JSX with:

```tsx
<button
  onClick={physicsDisabled ? undefined : onPhysicsToggle}
  disabled={physicsDisabled}
  className="physics-btn"
  style={{
    flex: "0 0 auto",
    height: "100%",
    padding: "0 16px",
    border: "none",
    borderLeft: `1px solid ${physicsMode && !physicsDisabled ? "var(--color-amber)" : "var(--color-rule)"}`,
    background: "transparent",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 11,
    letterSpacing: "0.08em",
    color: physicsMode && !physicsDisabled ? "var(--color-amber)" : "var(--color-muted)",
    cursor: physicsDisabled ? "not-allowed" : "pointer",
    opacity: physicsDisabled ? 0.4 : 1,
  }}
>
  <span>◆</span>
  <span className="physics-btn-label"> PHYSICS</span>
</button>
```

Add this variable before the return:

```ts
const physicsDisabled = mode === "rotation" && !rotationComplete;
```

- [ ] **Step 2: Update `home.tsx`**

In `home.tsx`, pass the new props to `ModeBar` and `SolidScene`:

Add a `handlePhysicsToggle` handler (the button calls this; it simply dispatches):

```ts
const handlePhysicsToggle = () => {
  dispatch({ type: "TOGGLE_PHYSICS" });
};
```

Update `<ModeBar>`:

```tsx
<ModeBar
  mode={state.mode}
  onModeChange={(m) => dispatch({ type: "SET_MODE", payload: m })}
  solidId={state.solidId}
  physicsMode={state.physicsMode}
  onPhysicsToggle={handlePhysicsToggle}
  rotationComplete={state.rotationComplete}
/>
```

Update `<SolidScene>`:

```tsx
<SolidScene
  solidId={state.solidId}
  mode={state.mode}
  onInteract={() => dispatch({ type: "PLANE_INTERACTED" })}
  onShapeChange={(geo) => dispatch({ type: "SET_CSG_GEOMETRY", payload: geo.clone() })}
  rotationAngle={rotationAngle}
  rotationComplete={state.rotationComplete}
  rotationGeometry={rotationGeometry}
  physicsMode={state.physicsMode}
/>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/ModeBar.tsx app/routes/home.tsx
git commit -m "feat: wire physics button in ModeBar and connect physicsMode state in home.tsx"
```

---

### Task 6: CSS — physics button label class and `prefers-reduced-motion`

**Files:**
- Modify: `app/app.css`

- [ ] **Step 1: Add physics button label rules to `app.css`**

After the existing `.mode-label-short` / `.mode-label-full` block, add:

```css
/* Physics button label — shown at all widths except ≤360px */
.physics-btn-label { display: inline; }

@media (max-width: 360px) {
  .physics-btn-label { display: none; }
}

/* Physics is motion-heavy — hide the button entirely for reduced-motion users */
@media (prefers-reduced-motion: reduce) {
  .physics-btn { display: none; }
}
```

- [ ] **Step 2: Typecheck + build**

```bash
npm run typecheck
```

Expected: zero errors. (CSS changes don't affect TypeScript.)

- [ ] **Step 3: Commit**

```bash
git add app/app.css
git commit -m "feat: physics button icon-only at ≤360px, hidden for prefers-reduced-motion"
```

---

### Task 7: Manual Verification

Start the dev server and verify all physics interactions work correctly.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify Mode A physics — sensor plane flash**

1. Open the app. Select any solid (e.g., cone).
2. Drag the cutting plane to a mid position (y ≈ 0). Note the position.
3. Click `◆ PHYSICS`. The gizmo handle and stem should disappear. The cutting plane mesh stays visible. `OrbitControls` should be disabled (dragging the canvas does not rotate the solid).
4. Click the solid. It should launch upward with a random horizontal offset.
5. As the solid passes through the semi-transparent plane, the amber flash plane (`flashPlaneRef`) should glow on passage.
6. The solid should bounce off the floor at y = −3.
7. Click `◆ PHYSICS` again to deactivate. The solid should disappear and the gizmo handle should reappear. `OrbitControls` should re-enable.

- [ ] **Step 3: Verify Mode A — plane position transferred correctly**

1. Drag the cutting plane to a noticeably off-center position (e.g., near the top of the solid).
2. Click `◆ PHYSICS`. The visible plane mesh and sensor should be at the same Y as where the plane was dragged.
3. Launch the solid. Verify the flash occurs when the solid passes through that Y level, not at y = 0.

- [ ] **Step 4: Verify Mode B physics — axis spin**

1. Switch to ROTATION mode. Select cone or sphere.
2. Click `◆ PHYSICS`. The button should be muted and non-interactive (rotation not complete).
3. Click ROTATE →. Wait for rotation to complete. Label should appear.
4. Click `◆ PHYSICS`. The solid should start spinning around the Y axis. The axis line should still be visible. The silhouette should already be faded (it faded when rotation completed). `OrbitControls` should be disabled.
5. Click the solid mid-spin. It should launch upward and re-spin.
6. Let it slow. Click `◆ PHYSICS` again to deactivate. The solid resets and the rotation scene returns to its completed state (solid visible, silhouette faded).

- [ ] **Step 5: Verify solid change exits physics**

1. Activate physics in Mode A.
2. Switch solid selector to a different solid.
3. Physics should deactivate. The new solid should render normally in cross-section mode.

- [ ] **Step 6: Verify mode switch exits physics**

1. Activate physics.
2. Click the mode toggle (CROSS SECTION ↔ ROTATION).
3. Physics should deactivate. The new mode should render normally.

- [ ] **Step 6b: Verify silhouette behavior on Mode B physics deactivate**

1. Complete rotation (ROTATE →, wait for 360°). Silhouette should have faded out.
2. Activate physics (◆ PHYSICS). Solid spins.
3. Deactivate physics. Silhouette should **not** reappear — it faded on `rotationComplete` and stays faded. The solid (non-physics) reappears at its completed position. Axis line stays visible throughout.

- [ ] **Step 7: Verify narrow viewport (≤360px)**

In browser DevTools, set viewport width to 340px.
- The physics button should show only `◆` (no " PHYSICS" text).
- The `◆` should still be tappable and functional.

- [ ] **Step 8: Commit any fixes found during verification**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: physics mode verification fixes"
```

---

## Run Order Summary

1. Task 1 — Reducer tests + implementation
2. Task 2 — `PhysicsSolid.tsx` (no dependencies from Tasks 3–6, can proceed immediately)
3. Task 3 — `JoystickGizmo` + `CuttingGeometry` height tracking
4. Task 4 — `SolidScene` physics integration (depends on Tasks 2 and 3)
5. Task 5 — `ModeBar` + `home.tsx` wiring (depends on Task 4)
6. Task 6 — CSS
7. Task 7 — Manual verification

Tasks 2 and 3 can be implemented in parallel (they touch independent files).
