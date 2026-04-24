# Physics Mode Design — Cross-Section Explorer
**Date:** 2026-04-24  
**Round:** 6 (Rapier physics mode)  
**PRD ref:** Section 6 (Rapier physics mode), Section 7 (State Architecture)  
**UX Spec ref:** Pass 2 (Level 3 — Available on demand), Pass 4 (Physics mode is visually isolated), Pass 5 (ANY → PHYSICS_ACTIVE)

---

## Summary

Physics mode is available in both Mode A (Cross Section) and Mode B (Rotation). Each mode produces a distinct, pedagogically connected physics experience. The physics button is always visible and accessible — including on small screens, except when `prefers-reduced-motion` is active (see Edge Cases).

The core design principle: **physics does not replace the mode's geometry interaction — it inverts it.**

- Mode A normally: you move the plane through a fixed solid. Mode A physics: the solid moves through a fixed plane.
- Mode B normally: a silhouette sweeps to build a solid. Mode B physics: the finished solid spins around the same axis it was built from.

---

## Mode A — Sensor Plane Physics

### Supersedes PRD Section 6

The PRD's Round 6 code snippet uses `onContactForce` on the floor collider to flash the cross-section plane on impact (`if (totalForce.y > 15) flashCrossSectionPlane()`). This spec replaces that mechanism with a sensor plane approach. The `onContactForce` floor-impact flash is retired. The sensor plane approach is pedagogically richer: the solid passes through the plane it was cutting, reinforcing the cross-section concept continuously rather than only at floor impact.

### Behavior

Activating physics in Mode A:
- Removes PivotControls drag and tilt handles (plane is non-interactive)
- Keeps the semi-transparent plane mesh visible at current `planeY` (passive sensor reference)
- Disables `OrbitControls` (prevents orbit gesture conflicts with click-to-impulse on mobile)
- Switches `RigidBody` to `type="dynamic"`, `colliders="hull"`
- Adds a thin `CuboidCollider` with `sensor={true}` at `planeY`
- Floor `CuboidCollider` at y = −3 (physical, not sensor)

Clicking the solid applies `applyImpulse({ x: (Math.random() - 0.5) * 4, y: 10, z: (Math.random() - 0.5) * 4 }, true)`.

Each time the solid passes through the sensor plane, `onIntersectionEnter` fires — the cross-section face illuminates with the same amber flash as Mode A manipulation. `onIntersectionExit` dims the face.

### Sensor collider

```tsx
<CuboidCollider
  sensor
  args={[2, 0.05, 2]}
  position={[0, planeY, 0]}
  onIntersectionEnter={() => flashCrossSectionFace()}
  onIntersectionExit={() => dimCrossSectionFace()}
/>
```

### `flashCrossSectionFace` / `dimCrossSectionFace` implementation

During physics mode `CuttingGeometry` is still mounted but non-interactive — the CSG computation has already produced the amber section face as a grouped material. The face is lit via `sectionMaterial` (defined in `materials.ts`, `emissive` defaults to `0x000000`).

`flashCrossSectionFace`: GSAP tween `sectionMaterial.emissive` from `0x000000` to `0xd4962a` over 0.15s. Direct material mutation — no re-render required.

`dimCrossSectionFace`: GSAP tween `sectionMaterial.emissive` back to `0x000000` over 0.3s.

These are module-level functions in `materials.ts` that operate on the shared material instance. No React state involved.

### Debounce

Both `onIntersectionEnter` and `onIntersectionExit` are debounced with a shared 200ms `useRef` timestamp to prevent strobing when the solid oscillates near the plane boundary. The amber face stays in its last state (on or off) until 200ms after the last crossing event resolves.

### Deactivating

The reset must happen while the `RigidBody` ref is still valid — before `physicsMode` flips and the `<Physics>` wrapper unmounts. The toggle handler in the component calls `rigidBody.setTranslation({ x: 0, y: 0, z: 0 }, true)` and `rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)` imperatively via the ref, then dispatches `TOGGLE_PHYSICS` on the next tick (wrapped in `requestAnimationFrame` or `setTimeout(0)`). This guarantees the Rapier world processes the reset before the context is torn down.

A short GSAP opacity fade (0.85 → 0 → 0.85 over 0.3s) masks the position snap. `OrbitControls` re-enabled. PivotControls handles reappear. Sensor collider unmounts with the `<Physics>` tree.

---

## Mode B — Axis Spin Physics

### Availability

The physics button is `disabled` in Mode B until `rotationComplete === true`. Before completion there is no solid to spin. Visually: fully muted, `cursor-not-allowed`. No tooltip.

### Behavior

Activating physics in Mode B after rotation completes:
- Silhouette line fades out
- Axis line stays visible (it is the literal axis of spin)
- `OrbitControls` disabled
- `RigidBody` wraps the completed LatheGeometry mesh with `colliders="hull"`
- On mount: `applyTorqueImpulse({ x: 0, y: 8, z: 0 }, true)` applied once via a local `useRef` guard (not reducer state — see State Changes)
- `angularDamping={1.5}` — solid spins down over ~3 seconds
- Floor `CuboidCollider` at y = −3
- Clicking the solid mid-spin: `applyImpulse` to launch, `applyTorqueImpulse` to re-spin

The axis the solid was built around is the same axis it spins around. No label. No explanation. The axis line connects the construction motion to the physics motion.

### Deactivating

Same reset timing pattern as Mode A: call `rigidBody.setTranslation({ x: 0, y: 0, z: 0 }, true)` and `rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)` imperatively before dispatching `TOGGLE_PHYSICS` (via `requestAnimationFrame`). GSAP opacity fade masks the snap. `OrbitControls` re-enabled. Silhouette fades in aligned with the reset geometry. RESET button reappears. Rotation state is preserved — student can re-watch the build.

---

## State Changes

### `physicsTorqueActive` is removed

The `physicsTorqueActive` boolean in `DemoState` is unnecessary. The torque-once guard is handled by a component-local `useRef<boolean>` inside `PhysicsSolid` — it flips to `true` after the first `applyTorqueImpulse` and never triggers again for that component instance. Since the `<Physics>` wrapper unmounts on physics deactivate or solid change, the component remounts fresh with the ref reset to `false` on next activation. No reducer action required.

### Reducer behavior

| Action | Effect on physics state |
|---|---|
| `TOGGLE_PHYSICS` | Flips `physicsMode` |
| `SOLID_CHANGE` | Sets `physicsMode: false` |
| `COMPLETE_ROTATION` | No effect on physics state — button becomes enabled via `rotationComplete` flag |
| `SET_MODE` | Sets `physicsMode: false` |

No new state fields. No new action types.

---

## Component Architecture

### `PhysicsSolid.tsx`

Gains a `mode` prop. Branches internally on `mode` to render either:
- **`'crossSection'`**: sensor `CuboidCollider` at `planeY` + standard `applyImpulse` on click
- **`'rotation'`**: torque setup + `applyTorqueImpulse` on mount (guarded by local ref) and on click

```tsx
interface PhysicsSolidProps {
  mode: 'crossSection' | 'rotation';
  planeY?: number;                       // Mode A: sensor position
  geometry: THREE.BufferGeometry;        // LatheGeometry in Mode B, standard in Mode A
  onIntersectionEnter?: () => void;      // Mode A: flash callback
  onIntersectionExit?: () => void;       // Mode A: dim callback
}
```

Remains `React.lazy` — unchanged from PRD.

### `<Physics>` wrapper placement

Separate `<Physics>` wrappers per scene. `SolidScene` and `RotationScene` are independent trees — shared physics context is not needed and would couple state that should stay isolated.

The floor `CuboidCollider` is a scene-level concern, not a `PhysicsSolid`-level concern. It lives as a direct child of `<Physics>`, sibling to `PhysicsSolid`.

```tsx
// SolidScene.tsx
{physicsMode && (
  <Physics gravity={[0, -9.81, 0]}>
    <PhysicsSolid
      mode="crossSection"
      planeY={planeY}
      geometry={solidGeometry}
      onIntersectionEnter={flashCrossSectionFace}
      onIntersectionExit={dimCrossSectionFace}
    />
    <CuboidCollider position={[0, -3, 0]} args={[20, 0.5, 20]} /> {/* floor — scene level */}
  </Physics>
)}

// RotationScene.tsx
{physicsMode && rotationComplete && (
  <Physics gravity={[0, -9.81, 0]}>
    <PhysicsSolid mode="rotation" geometry={latheGeometry} />
    <CuboidCollider position={[0, -3, 0]} args={[20, 0.5, 20]} /> {/* floor — scene level */}
  </Physics>
)}
```

### `ModeBar.tsx`

Physics button `disabled` condition:
```tsx
disabled={mode === 'rotation' && !rotationComplete}
```

`OrbitControls` receives `enabled={!physicsMode}` in both `SolidScene` and `RotationScene`.

---

## Physics Button — All Screen Sizes

The physics button is visible at all viewport widths including ≤360px, overriding the PRD UX spec rule that hid it at that breakpoint. At narrow widths it collapses to icon-only to fit alongside the mode toggle.

```tsx
<button className="physics-btn">
  <span>◆</span>
  <span className="hidden sm:inline"> PHYSICS</span>
</button>
```

`sm:` breakpoint = 361px in Tailwind config. Below 361px: diamond only. At or above 361px: `◆ PHYSICS`.

The amber border active state and 44px minimum touch target are preserved at all widths.

---

## Performance Contracts

| Concern | Contract |
|---|---|
| Sensor collider | Position fixed at `planeY` on activate — no per-frame updates |
| LatheGeometry hull | Computed once on `RigidBody` mount on next physics activation after solid change. `SOLID_CHANGE` sets `physicsMode: false`, unmounting the `<Physics>` tree; the hull is never stale. |
| Torque impulse | Applied once via component-local `useRef<boolean>` guard — never in `useFrame` |
| Intersection debounce | Both `onIntersectionEnter` and `onIntersectionExit` share a 200ms `useRef` timestamp — no `setTimeout` state, no render cycle cost |
| Rapier WASM | Lazy-loaded — zero cost until first `physicsMode` activation |
| Physics `<Physics>` unmount | Rapier handles unmount/remount cleanly on toggle |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Solid change while physics active | `SOLID_CHANGE` sets `physicsMode: false`. Both `<Physics>` wrappers unmount. New solid loads fixed. |
| Mode switch while physics active | `SET_MODE` sets `physicsMode: false`. Student lands in target mode with physics off. |
| Rapid physics toggle | `React.lazy` guard prevents double-load. Unmount/remount is the intended Rapier pattern. |
| Rotation incomplete, physics button clicked | Button is `disabled` — no handler fires. |
| Sensor at solid extremity (planeY near top/bottom) | Shared 200ms debounce on enter/exit prevents strobe. |
| Solid drifted or rotated on physics deactivate | `setTranslation` and `setRotation` called on the `RigidBody` ref before `<Physics>` unmounts. Unconditional — no drift threshold. Masked by GSAP opacity fade. |
| Mode B solid angular state on deactivate | `setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)` resets to upright before unmount. Silhouette re-aligns with reset geometry. |
| `prefers-reduced-motion` | Physics button hidden entirely. Simulation is motion-heavy (bouncing, spinning) and cannot be meaningfully reduced. This is a new policy — not established in the PRD or UX spec — made here explicitly because physics cannot be reduced to a static state. |

---

## What This Is Not

- Not a replacement for Mode A's cutting plane interaction — physics is a parallel lens, not a substitute
- Not the PRD's `onContactForce` floor-impact flash — that mechanism is superseded by the sensor plane approach
- Not available during Mode B before rotation completes — a partial LatheGeometry dropping and tumbling would confuse, not teach
- Not a revolute joint motor (considered and rejected — GSAP rotation is smoother and more controllable; the spin is an echo, not a replay)
- Not `InstancedRigidBodies` raining copies of the solid (visually wild, pedagogically empty)
