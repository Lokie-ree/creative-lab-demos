# Physics Mode Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three physics-mode bugs: rotation reset leaving a blank scene with physics stuck on; cross-section physics ignoring the cutting plane's tilt; and the rotation silhouette not reappearing after reset.

**Architecture:** Bug 1 is a one-line reducer fix. Bug 3 is a one-block component change. Bug 2 is a 4-file refactor that upgrades the plane-transform API from a single Y-position scalar to a full `{ position, quaternion }` object, propagating it through JoystickGizmo → CuttingGeometry → SolidScene → PhysicsSolid.

**Tech Stack:** React 19, React Three Fiber (R3F) v9, Three.js, @react-three/rapier (Rapier physics), @react-three/csg, GSAP, Vitest, TypeScript, pnpm

---

## File Map

| File | Role in this fix |
|------|-----------------|
| `app/hooks/useDemoReducer.ts` | Bug 1: add `physicsMode: false` to `RESET_ROTATION` |
| `app/hooks/useDemoReducer.test.ts` | Bug 1: new test for the above |
| `app/components/RotationScene.tsx` | Bug 3: restore silhouette opacity when `rotationComplete` becomes false |
| `app/components/JoystickGizmo.tsx` | Bug 2: replace `onHeightChange` with allocation-free `onPlaneTransformChange`; suppress visuals/interaction when `physicsActive` |
| `app/components/CuttingGeometry.tsx` | Bug 2: pass `onPlaneTransformChange` through; hide CSG/wireframe via material opacity |
| `app/components/SolidScene.tsx` | Bug 2: replace `planeYRef` with `planeTransformRef`; full-transform flash plane sync; pass ref to `PhysicsSolid` |
| `app/components/PhysicsSolid.tsx` | Bug 2: accept `planeTransformRef`; sync kinematic body translation + rotation each frame |

---

## Task 1: Fix RESET_ROTATION stuck physics (Bug 1)

**Files:**
- Modify: `app/hooks/useDemoReducer.ts:124`
- Modify: `app/hooks/useDemoReducer.test.ts`

- [ ] **Step 1: Add the failing test**

  Open `app/hooks/useDemoReducer.test.ts`. Add this test at the bottom, inside a new `describe` block:

  ```ts
  describe("RESET_ROTATION", () => {
    test("resets physicsMode to false", () => {
      const state: DemoState = {
        ...initialState,
        rotationAngle: 180,
        rotationComplete: true,
        physicsMode: true,
      };
      const next = demoReducer(state, { type: "RESET_ROTATION" });
      expect(next.rotationAngle).toBe(0);
      expect(next.rotationComplete).toBe(false);
      expect(next.physicsMode).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the test — expect it to fail**

  ```bash
  pnpm exec vitest run app/hooks/useDemoReducer.test.ts
  ```

  Expected: `FAIL` — `physicsMode` is `true`, not `false`.

- [ ] **Step 3: Fix the reducer**

  In `app/hooks/useDemoReducer.ts`, find the `RESET_ROTATION` case (currently line 123) and replace it:

  ```ts
  case "RESET_ROTATION":
    return { ...state, rotationAngle: 0, rotationComplete: false, physicsMode: false };
  ```

- [ ] **Step 4: Run all reducer tests — expect all to pass**

  ```bash
  pnpm exec vitest run app/hooks/useDemoReducer.test.ts
  ```

  Expected: all tests `PASS` (13 total after the new one).

- [ ] **Step 5: Commit**

  ```bash
  git add app/hooks/useDemoReducer.ts app/hooks/useDemoReducer.test.ts
  git commit -m "fix: RESET_ROTATION now resets physicsMode to false"
  ```

---

## Task 2: Restore silhouette opacity on rotation reset (Bug 3)

**Files:**
- Modify: `app/components/RotationScene.tsx:54–63`

The `useEffect` at line 54 handles what happens when `rotationComplete` changes. Right now it only acts when `rotationComplete` is `true`. On reset, it becomes `false` but the silhouette material (a module-level singleton) stays at opacity `0` from the fade-out that happened at completion.

- [ ] **Step 1: Extend the useEffect**

  In `app/components/RotationScene.tsx`, find this block (starts around line 54):

  ```ts
  useEffect(() => {
    if (!rotationComplete) return;
    if (silhouetteRef.current) {
      gsap.to((silhouetteRef.current as any).material, { opacity: 0, duration: 0.4 });
    }
    gsap.to(rotationMaterial, { opacity: 0.85, duration: 0.5 });
    if (lightRef.current) {
      gsap.to(lightRef.current, { intensity: 0.6, duration: 0.8, ease: "power2.out" });
    }
  }, [rotationComplete]);
  ```

  Replace the early return with a restore block:

  ```ts
  useEffect(() => {
    if (!rotationComplete) {
      gsap.killTweensOf(silhouetteMaterial);
      silhouetteMaterial.opacity = 0.75;
      return;
    }
    if (silhouetteRef.current) {
      gsap.to((silhouetteRef.current as any).material, { opacity: 0, duration: 0.4 });
    }
    gsap.to(rotationMaterial, { opacity: 0.85, duration: 0.5 });
    if (lightRef.current) {
      gsap.to(lightRef.current, { intensity: 0.6, duration: 0.8, ease: "power2.out" });
    }
  }, [rotationComplete]);
  ```

  Note: `silhouetteMaterial` is already imported from `~/data/materials` at the top of this file. The `gsap.killTweensOf(silhouetteMaterial)` call kills any in-flight fade-out before restoring opacity. Without it, a concurrent tween could overwrite the restore.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add app/components/RotationScene.tsx
  git commit -m "fix: restore silhouette opacity when rotation is reset"
  ```

- [ ] **Step 4: Manual verification** *(required — no automated test possible for GSAP/Three.js visuals)*

  Start the dev server (`pnpm dev`), open the app, switch to Rotation mode, pick a non-cube solid:
  1. Click **ROTATE →**, wait for the animation to finish — the silhouette line fades away.
  2. Click **RESET** — the silhouette line should reappear at full opacity, axis line visible.
  3. Click **ROTATE →** again — animation should work normally.

---

## Task 3: Upgrade plane transform propagation — all four components (Bug 2)

These four files form a single interface chain: `JoystickGizmo` → `CuttingGeometry` → `SolidScene` → `PhysicsSolid`. Changing the callback/prop name breaks TypeScript across all of them simultaneously, so all four edits are in this task with a single typecheck and commit at the end.

**Files:**
- Modify: `app/components/JoystickGizmo.tsx`
- Modify: `app/components/CuttingGeometry.tsx`
- Modify: `app/components/SolidScene.tsx`
- Modify: `app/components/PhysicsSolid.tsx`

### Step 1 — Update `JoystickGizmo.tsx`

- [ ] **1a: Replace the prop interface**

  In the `JoystickGizmoProps` interface, replace:
  ```ts
  onHeightChange?: (y: number) => void;
  ```
  with:
  ```ts
  onPlaneTransformChange?: (transform: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => void;
  ```

  Update the destructuring in the function signature to match.

- [ ] **1b: Add the stable emitted-transform ref**

  At the top of `JoystickGizmo` (near the other `useRef` calls), add:

  ```ts
  const emittedTransformRef = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  });
  ```

  This object is allocated once and mutated in place on every drag move. No per-drag allocation.

- [ ] **1c: Seed the ref at mount**

  Add a new `useEffect` that fires once at mount to send the initial (zero, identity) transform to the consumer before any drag occurs:

  ```ts
  useEffect(() => {
    onPlaneTransformChange?.(emittedTransformRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```

  The empty dependency array is intentional — this seeds the parent ref once. The `onPlaneTransformChange` callback is intentionally omitted from deps to prevent re-seeding on every render; the parent ref is stable via `useCallback`.

- [ ] **1d: Emit on every drag move**

  In the `onMove` handler, find this line and delete it:

  ```ts
  onHeightChange?.(heightRef.current);
  ```

  In its place (after the matrix rebuild block — `groupRef.current.matrixAutoUpdate = false; groupRef.current.updateMatrixWorld(true); csgRef.current.update();`) add:

  ```ts
  emittedTransformRef.current.position.set(0, heightRef.current, 0);
  emittedTransformRef.current.quaternion.copy(tiltQuatRef.current);
  onPlaneTransformChange?.(emittedTransformRef.current);
  ```

  This emits the stable transform object with freshly mutated values after every drag tick. No allocation occurs here.

- [ ] **1e: Suppress visuals and interaction when `physicsActive`**

  The `physicsActive` prop already exists in the interface and is destructured. Apply it:

  - On the stem `<mesh position={[0, -0.4, 0]}>`: add `visible={!physicsActive}`
  - On the pulse target `<mesh ref={pulseTargetRef} position={[0, -0.8, 0]}>`: add `visible={!physicsActive}`
  - In the `onPointerDown` handler on the inner handle mesh, add as the very first line:
    ```ts
    if (physicsActive) return;
    ```

  The `<Subtraction>` brush is **not** gated — it must always remain mounted to keep the CSG geometry computing.

### Step 2 — Update `CuttingGeometry.tsx`

- [ ] **2a: Replace `onHeightChange` with `onPlaneTransformChange` in the interface**

  In `CuttingGeometryProps`, replace:
  ```ts
  onHeightChange?: (y: number) => void;
  ```
  with:
  ```ts
  onPlaneTransformChange?: (transform: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => void;
  ```

  Update the destructuring in the function signature.

- [ ] **2b: Pass the new prop through to `JoystickGizmo`**

  In the JSX, replace:
  ```tsx
  onHeightChange={onHeightChange}
  ```
  with:
  ```tsx
  onPlaneTransformChange={onPlaneTransformChange}
  ```

- [ ] **2c: Hide the CSG solid via material opacity when `physicsActive`**

  The CSG output lives on `meshRef`. Its materials are set imperatively in a `useEffect` at mount (the two-entry array). Add a second `useEffect` that reacts to `physicsActive`:

  ```ts
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !Array.isArray(mesh.material)) return;
    const opacity = physicsActive ? 0 : 0.85;
    (mesh.material as THREE.MeshStandardMaterial[]).forEach((mat) => {
      mat.opacity = opacity;
    });
  }, [physicsActive]);
  ```

  This sets both the solid-body material and the section-face material to `0` when physics is active, and restores both to `0.85` when physics is disabled. Do **not** use `visible={false}` on the outer mesh — the CSG library may skip computation on invisible parents.

- [ ] **2d: Hide the wireframe mesh when `physicsActive`**

  The wireframe is the sibling `<mesh geometry={solidGeometry} material={wireframeMaterial} />` inside the outer mesh JSX. Add `visible={!physicsActive}`:

  ```tsx
  <mesh geometry={solidGeometry} material={wireframeMaterial} visible={!physicsActive} />
  ```

  This is safe — it is a sibling of `<Geometry>`, not an ancestor.

### Step 3 — Update `SolidScene.tsx`

- [ ] **3a: Replace `planeYRef` with `planeTransformRef`**

  In `SceneContent`, find:
  ```ts
  const planeYRef = useRef(0);
  ```
  Replace with:
  ```ts
  const planeTransformRef = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  });
  ```

- [ ] **3b: Add the copy callback**

  Add this `useCallback` near `handleIntersectionEnter`/`handleIntersectionExit`:

  ```ts
  const handlePlaneTransformChange = useCallback(
    (t: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => {
      planeTransformRef.current.position.copy(t.position);
      planeTransformRef.current.quaternion.copy(t.quaternion);
    },
    [],
  );
  ```

  `copy` mutates the existing objects rather than aliasing the JoystickGizmo internals.

- [ ] **3c: Create a pre-rotated flash plane geometry**

  `circleGeometry` lies in the XY plane by default (faces +Z). The cutting/physics plane at identity is horizontal (XZ, faces +Y). Add a `useMemo` for the geometry:

  ```ts
  const flashPlaneGeometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(2, 48);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);
  ```

  Replace the JSX `<circleGeometry args={[2, 48]} />` inside the flash plane mesh with a `geometry` prop:

  ```tsx
  <mesh ref={flashPlaneRef} geometry={flashPlaneGeometry} renderOrder={1}>
    {/* no <circleGeometry> child anymore */}
    <meshBasicMaterial ... />
  </mesh>
  ```

- [ ] **3d: Sync the flash plane's full transform in `useFrame`**

  Find the existing `useFrame`:
  ```ts
  useFrame(() => {
    if (flashPlaneRef.current) {
      flashPlaneRef.current.position.y = planeYRef.current;
    }
  });
  ```

  Replace with:
  ```ts
  useFrame(() => {
    if (flashPlaneRef.current) {
      flashPlaneRef.current.position.copy(planeTransformRef.current.position);
      flashPlaneRef.current.quaternion.copy(planeTransformRef.current.quaternion);
    }
  });
  ```

- [ ] **3e: Wire the new callback and ref into `CuttingGeometry`**

  In the `CuttingGeometry` JSX, replace:
  ```tsx
  onHeightChange={(y) => { planeYRef.current = y; }}
  ```
  with:
  ```tsx
  onPlaneTransformChange={handlePlaneTransformChange}
  ```

- [ ] **3f: Pass `planeTransformRef` to `PhysicsSolid`**

  In the `PhysicsSolid` JSX (crossSection branch), replace:
  ```tsx
  planeYRef={planeYRef}
  ```
  with:
  ```tsx
  planeTransformRef={planeTransformRef}
  ```

### Step 4 — Update `PhysicsSolid.tsx`

- [ ] **4a: Replace the prop**

  In `PhysicsSolidProps`, replace:
  ```ts
  planeYRef?: { current: number };
  ```
  with:
  ```ts
  planeTransformRef?: { current: { position: THREE.Vector3; quaternion: THREE.Quaternion } };
  ```

  Update the destructuring in `PhysicsInner`.

- [ ] **4b: Sync both translation and rotation in `useFrame`**

  Find the existing kinematic sync block:
  ```ts
  if (mode === "crossSection" && planeBodyRef.current && planeYRef) {
    planeBodyRef.current.setNextKinematicTranslation({ x: 0, y: planeYRef.current, z: 0 });
  }
  ```

  Replace with:
  ```ts
  if (mode === "crossSection" && planeBodyRef.current && planeTransformRef) {
    const { position, quaternion } = planeTransformRef.current;
    planeBodyRef.current.setNextKinematicTranslation(position);
    // THREE.Quaternion has { x, y, z, w } — matches Rapier's expected shape directly
    planeBodyRef.current.setNextKinematicRotation(quaternion);
  }
  ```

- [ ] **4c: Fix the initial position of the kinematic plane body**

  The existing JSX for the kinematic `RigidBody` still seeds its initial position from `planeYRef`. Update it:

  ```tsx
  <RigidBody
    ref={planeBodyRef}
    type="kinematicPosition"
    colliders={false}
    position={[0, 0, 0]}   {/* seeded to origin; useFrame syncs it from planeTransformRef */}
    onCollisionEnter={onIntersectionEnter}
    onCollisionExit={onIntersectionExit}
  >
  ```

### Step 5 — Typecheck and commit

- [ ] **5a: Run TypeScript**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors. If there are `onHeightChange` references remaining, grep for them and remove:

  ```bash
  grep -rn "onHeightChange" app/
  ```

  Should return zero results.

- [ ] **5b: Commit**

  ```bash
  git add app/components/JoystickGizmo.tsx app/components/CuttingGeometry.tsx \
          app/components/SolidScene.tsx app/components/PhysicsSolid.tsx
  git commit -m "feat: full cutting plane transform for physics bounce and flash plane"
  ```

---

## Task 4: Integration acceptance testing

These are visual tests — run `pnpm dev` and check each scenario manually.

**Files:** none (verification only)

### Bug 1 verification

- [ ] Switch to **Rotation** mode, pick cone or cylinder
- [ ] Click **ROTATE →**, wait for it to finish
- [ ] Click **PHYSICS** (button turns amber)
- [ ] Click **RESET**
- [ ] Expected: axis line and silhouette reappear, physics button is greyed out, **ROTATE →** button is shown

### Bug 2 verification

- [ ] Switch to **Cross Section** mode

**Horizontal plane, physics on:**
- [ ] Leave the plane flat (no tilt), click **PHYSICS**
- [ ] Expected: CSG solid, wireframe, and joystick handle are all hidden; physics body drops and bounces; flash plane appears horizontal on collision

**Tilted plane, physics on:**
- [ ] Turn physics off, drag the joystick to tilt the plane significantly
- [ ] Click **PHYSICS**
- [ ] Expected: physics body bounces off the invisible tilted collider; flash disc appears tilted at the same angle as the cut plane

**Restore after physics:**
- [ ] With a tilted cut and physics on, click **PHYSICS** to disable it
- [ ] Expected: same tilted CSG cut reappears exactly as before physics; cross-section label is unchanged; joystick handle reappears; further drags work normally

**UI suppression while physics active:**
- [ ] Enable physics; try clicking and dragging where the joystick handle was
- [ ] Expected: no response; no shape change; no label update

### Bug 3 verification

- [ ] Switch to **Rotation** mode, pick cone
- [ ] Click **ROTATE →**, watch silhouette fade as solid appears
- [ ] Click **RESET**
- [ ] Expected: silhouette line reappears at full opacity (not faded), axis line visible
- [ ] Click **ROTATE →** again — animation works normally

---

## Reference

- Spec: `docs/superpowers/specs/2026-04-27-physics-mode-bugs-design.md`
- Run tests: `pnpm exec vitest run`
- Typecheck: `pnpm typecheck`
- Dev server: `pnpm dev`
