# Physics Mode Bug Fixes — Design Spec
**Date:** 2026-04-27  
**Scope:** `demos/cross-section-explorer` (app/)  
**Status:** Ready for implementation

---

## Background

A focused review of the cross-section explorer identified three physics-mode bugs. Bug 4 (cylinder silhouette bevel artifact) is explicitly excluded pending visual verification.

---

## Bug 1 — Rotation reset leaves physics stuck in a blank state

### Problem

`RESET_ROTATION` sets `rotationComplete: false` but does not reset `physicsMode`. After reset with physics on:
- `RotationScene` hides its axis/silhouette/geometry because `physicsMode=true`
- `PhysicsSolid` does not render because `rotationComplete=false`
- Physics button is disabled because `!rotationComplete`
- Result: blank scene, physics stuck on, no affordance to recover

### Fix

In `app/hooks/useDemoReducer.ts`, add `physicsMode: false` to the `RESET_ROTATION` case.

```ts
case "RESET_ROTATION":
  return { ...state, rotationAngle: 0, rotationComplete: false, physicsMode: false };
```

No other cases are touched.

### Acceptance test

1. Select any non-cube solid, switch to rotation mode
2. Click **ROTATE →**, wait for completion
3. Click **PHYSICS** to enable physics mode
4. Click **RESET**
5. Expected: scene shows the pre-rotation state (silhouette + axis visible), physics button is disabled

---

## Bug 2 — Cross-section physics ignores full cutting plane transform

### Problem

Three related issues:
1. `PhysicsSolid` syncs only the plane's Y position to the kinematic collider, ignoring tilt. A tilted cut produces a horizontal-bounce plane, not a tilted one.
2. The flash plane also tracks only Y, so it appears horizontal even when the cut is tilted.
3. The cutting UI (wireframe, CSG solid, joystick affordances) remains fully visible during physics, cluttering the scene.

### Design

Keep `CuttingGeometry` and `JoystickGizmo` mounted at all times. The CSG geometry must remain computed so that toggling physics off restores the previous cut exactly.

#### `app/components/JoystickGizmo.tsx`

**Callback change**

Replace `onHeightChange?: (y: number) => void` with:

```ts
onPlaneTransformChange?: (transform: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => void;
```

**Allocation-free emission**

Add a stable ref at the top of the component — allocated once, mutated per drag:

```ts
const emittedTransformRef = useRef({
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
});
```

In `onMove`, after updating `heightRef` and `tiltQuatRef`:

```ts
emittedTransformRef.current.position.set(0, heightRef.current, 0);
emittedTransformRef.current.quaternion.copy(tiltQuatRef.current);
onPlaneTransformChange?.(emittedTransformRef.current);
```

Also fire once at mount with the initial (0, identity) transform so the consumer ref is seeded before any drag occurs.

**Visual suppression when `physicsActive`**

- Stem mesh: `visible={!physicsActive}`
- Handle/pulse mesh: `visible={!physicsActive}`
- `onPointerDown` handler: guard with `if (physicsActive) return` — prevents drag while physics is active
- `<Subtraction>` brush: **always mounted** — required for CSG continuity

#### `app/components/CuttingGeometry.tsx`

**Callback rename**

Replace `onHeightChange` with `onPlaneTransformChange`, pass through to `JoystickGizmo`.

**Visual suppression — opacity, not parent visibility**

Do NOT use `visible={false}` on the outer `<mesh ref={meshRef}>` or on any ancestor of `<Geometry>`. Setting parent visibility in a CSG tree may affect traversal and render participation in unpredictable ways.

Instead, when `physicsActive`:

- CSG solid: set opacity to `0` on both materials in the two-entry array (solid body material and section-face material)
- Wireframe child mesh: `visible={!physicsActive}` (safe — it is a sibling of `<Geometry>`, not an ancestor)
- `JoystickGizmo` visual affordances: handled inside `JoystickGizmo` as above

When `physicsActive` becomes `false`, restore both material opacities to their original values: `0.85` for both the solid-body material and the section-face material. This is the explicit restore path — omitting it causes the cross-section to stay invisible after physics is disabled.

The mesh and `<Geometry>` remain in the scene graph and continue computing throughout.

#### `app/components/SolidScene.tsx`

**Replace `planeYRef`**

```ts
// before
const planeYRef = useRef(0);

// after
const planeTransformRef = useRef({
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
});
```

**Callback — copy, don't alias**

```ts
const handlePlaneTransformChange = useCallback(
  (t: { position: THREE.Vector3; quaternion: THREE.Quaternion }) => {
    planeTransformRef.current.position.copy(t.position);
    planeTransformRef.current.quaternion.copy(t.quaternion);
  },
  [],
);
```

This prevents `SolidScene` from depending on `JoystickGizmo`'s internal object identity.

**Flash plane — full transform sync**

In `useFrame`, replace the Y-only position update:

```ts
// before
flashPlaneRef.current.position.y = planeYRef.current;

// after
flashPlaneRef.current.position.copy(planeTransformRef.current.position);
flashPlaneRef.current.quaternion.copy(planeTransformRef.current.quaternion);
```

**Flash plane geometry orientation**

`circleGeometry` lies in the local XY plane (facing +Z) by default. The cutting/physics plane at identity is horizontal (XZ, facing +Y). Copying the cutting plane's quaternion directly onto the flash mesh will produce wrong orientation if the geometry starts in XY.

Before applying the dynamic quaternion, ensure the flash mesh's geometry lies in XZ. Options:
- Set a fixed base rotation of `-Math.PI / 2` around X on the flash mesh at construction, then compose the cutting plane quaternion on top: `flashPlaneRef.current.quaternion.copy(baseXRotQuat).multiply(planeTransformRef.current.quaternion)` where `baseXRotQuat` is allocated once outside `useFrame`.
- Or replace `circleGeometry` with geometry pre-rotated into XZ (e.g. `new THREE.CircleGeometry` with `rotateX(-Math.PI / 2)` applied once on construction).

The simpler option is the pre-rotated geometry; the composition approach is needed only if the base mesh rotation must stay at identity for other reasons.

**Pass transform ref to `PhysicsSolid`**

Replace `planeYRef={planeYRef}` with `planeTransformRef={planeTransformRef}`.

#### `app/components/PhysicsSolid.tsx`

**Prop change**

```ts
// before
planeYRef?: { current: number };

// after
planeTransformRef?: { current: { position: THREE.Vector3; quaternion: THREE.Quaternion } };
```

**Kinematic sync — both translation and rotation**

```ts
if (mode === "crossSection" && planeBodyRef.current && planeTransformRef) {
  const { position, quaternion } = planeTransformRef.current;
  planeBodyRef.current.setNextKinematicTranslation(position);
  // THREE.Quaternion has x, y, z, w — matches Rapier's expected shape
  planeBodyRef.current.setNextKinematicRotation(quaternion);
}
```

No helper needed; Rapier's `setNextKinematicRotation` accepts any `{ x, y, z, w }` object.

### Acceptance tests

1. **Horizontal plane physics**: leave plane untilted, enable physics → solid bounces off horizontal flash plane
2. **Tilted plane physics**: tilt the plane, enable physics → solid bounces off the tilted invisible collider, flash appears on the tilted plane
3. **Restore after physics**: tilt the plane, enable physics, then disable → exact same tilted cut reappears, cross-section label unchanged, plane transform unchanged
4. **UI suppression**: while physics is active, joystick stem/handle not visible, CSG solid and wireframe not visible, dragging has no effect

---

## Bug 3 — Silhouette stays invisible after rotation reset

### Problem

`RotationScene` fades `silhouetteMaterial.opacity` to `0` via gsap when rotation completes. On reset, `RESET_ROTATION` sets `rotationComplete: false` but does not restore the opacity. The `silhouetteMaterial.opacity = 0.75` restore in `home.tsx` runs only on solid change, not on reset. After pressing **RESET** for the same solid, the silhouette does not reappear.

### Fix

In `app/components/RotationScene.tsx`, extend the existing `useEffect` that depends on `[rotationComplete]` to handle the `false` branch:

```ts
useEffect(() => {
  if (!rotationComplete) {
    gsap.killTweensOf(silhouetteMaterial);
    silhouetteMaterial.opacity = 0.75;
    return;
  }
  // existing rotation-complete fade logic...
}, [rotationComplete]);
```

`silhouetteMaterial` is a module-level singleton imported from `~/data/materials`. Restoring it here keeps all silhouette visibility logic co-located in `RotationScene`. No changes needed in `home.tsx`.

The guard `gsap.killTweensOf(silhouetteMaterial)` prevents a concurrent fade-out tween from overwriting the restore.

### Acceptance test

1. Select a non-cube solid in rotation mode
2. Click **ROTATE →** and let it complete — silhouette fades out
3. Click **RESET**
4. Expected: silhouette reappears at full opacity (`0.75`), axis line visible, rotation can be started again

---

## Files changed

| File | Bug | Change summary |
|------|-----|----------------|
| `app/hooks/useDemoReducer.ts` | 1 | Add `physicsMode: false` to `RESET_ROTATION` |
| `app/components/RotationScene.tsx` | 3 | Restore silhouette opacity in `useEffect([rotationComplete])` `false` branch |
| `app/components/JoystickGizmo.tsx` | 2 | Replace `onHeightChange` with allocation-free `onPlaneTransformChange`; suppress visuals/interaction when `physicsActive` |
| `app/components/CuttingGeometry.tsx` | 2 | Pass through `onPlaneTransformChange`; hide CSG/wireframe via material opacity when `physicsActive` |
| `app/components/SolidScene.tsx` | 2 | Replace `planeYRef` with `planeTransformRef`; sync flash plane full transform in `useFrame` |
| `app/components/PhysicsSolid.tsx` | 2 | Accept `planeTransformRef`; sync kinematic body translation + rotation |

---

## Out of scope

**Bug 4 (cylinder silhouette bevel artifact):** Needs visual verification before any change. The current profile has cap-closing center points; removing them may fix the bevel but could affect capping in `LatheGeometry`. Do not modify `app/data/silhouettes.ts` without confirming the visual result first.
