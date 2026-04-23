# Round 4 Completion — Scene Quality & Connection Sentence

**Date:** 2026-04-21
**Project:** Cross-Section Explorer
**Spec authority:** `demos/cross-section-explorer/prd.md`
**Scope:** Four targeted fixes to complete Round 4 to shippable quality

---

## Context

Round 4 implementation is functionally complete but has two outstanding issues:

1. **Connection sentence never fires.** `ShapeLabel` wires the sentence animation to `result?.key` (fires on every cross-section classification) instead of `connectionVisible` (fires only on the connection moment). The PRD-defined sentence is also absent — a `CONNECTION_SENTENCES` per-shape map was added that has no basis in the PRD. In rotation mode, `result` is null so no sentence renders at all.

2. **Rotation scene lacks Mode A visual quality.** The materialising solid has no wireframe overlay (Mode A has one), the cylinder profile produces an open tube (no caps), and there is no scene lighting that activates with the solid.

3. **RESET does not clear the rotation label.** The RESET button calls `reset()` from `useSolidRotation` but never dispatches `RESET_ROTATION` to the reducer. `state.rotationComplete` remains `true` so `rotationLabel` keeps showing and the ShapeLabel does not unmount.

4. **Button and label overlap.** In rotation mode, the ROTATE/RESET button (`bottom: 80`) and the ShapeLabel (`bottom: 68`) occupy overlapping vertical space once rotation is complete and both are visible simultaneously.

---

## What Is NOT Changing

- No changes to `useDemoReducer`, `useSolidRotation`, `SolidScene`, `ModeBar`, `SolidSelector`, or `home.tsx`
- No changes to Mode A behaviour
- No changes to lighting outside `RotationScene`
- The cone and sphere profiles in `silhouettes.ts` are correct — only cylinder changes

---

## Fix 1 — Connection Sentence (`ShapeLabel.tsx`)

### What the PRD specifies

From `prd.md` §8 Copy Spec:

> **Connection moment copy**
> `"That cross section — it's the shape you started with."`
> Single sentence. Fraunces italic. Amber. Centered below the canvas. Fades in over 0.6s. No dismiss button — it fades out automatically after 4s. It is a confirmation, not an announcement.

### Changes

**Remove `CONNECTION_SENTENCES` map.** This per-shape map ("A horizontal cut through a cone is always a circle.") has no basis in the PRD and fires unconditionally on every classification — not on the connection moment.

**Replace `sentence` derivation:**

```ts
// Before
const sentence = result ? (CONNECTION_SENTENCES[result.key] ?? null) : null;

// After
const sentence = connectionVisible
  ? "That cross section — it's the shape you started with."
  : null;
```

**Replace sentence `useEffect`:**

The effect currently triggers on `result?.key` — meaning it animates in on every new shape classification regardless of `connectionVisible`. Replace with an effect driven by `connectionVisible`:

```ts
useEffect(() => {
  if (!connectionRef.current) return;
  let tween: gsap.core.Tween;
  if (connectionVisible) {
    tween = gsap.fromTo(
      connectionRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
    );
  } else {
    tween = gsap.to(connectionRef.current, { opacity: 0, duration: 0.3 });
  }
  return () => { tween.kill(); };
}, [connectionVisible]);
```

Duration for the sentence animation changes from 0.4s → 0.6s per PRD (sentence animation only — the shape label animation stays at 0.4s).

**Guard on `sentence`:** The `{sentence && <div ref={connectionRef} ...>}` guard already exists. Since `sentence` is now `null` when `connectionVisible` is false, the div unmounts between connection moments, which means `connectionRef.current` will be null when `connectionVisible` is false. The effect guard `if (!connectionRef.current) return` handles this safely — the fade-out tween is not needed since the element is absent.

Simplified sentence effect:

```ts
useEffect(() => {
  if (!connectionRef.current || !connectionVisible) return;
  const tween = gsap.fromTo(
    connectionRef.current,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
  );
  return () => { tween.kill(); };
}, [connectionVisible]);
```

**Connection sentence styling.** The PRD specifies amber / Fraunces italic for the connection moment copy. The current connection sentence div uses `color: "var(--color-muted)"` and `fontFamily: "'DM Sans'"` — matching the shape label's secondary style. Update the connection sentence div to:

```tsx
<div
  ref={connectionRef}
  style={{
    fontFamily: "'Fraunces', serif",
    fontStyle: "italic",
    fontSize: 16,
    color: "var(--color-amber)",
    letterSpacing: "0.01em",
    opacity: 0,
  }}
>
  {sentence}
</div>
```

Slightly smaller than the shape label (16px vs 28px) so it reads as subordinate copy, not a competing headline.

**Works in both modes.** `home.tsx` already passes `connectionVisible` to `ShapeLabel` in both crossSection and rotation render paths. No changes to `home.tsx` required.

---

## Fix 2 — Rotation Scene Visual Quality

### 2a — Cylinder caps (`silhouettes.ts`)

The current cylinder profile has two points — the side edge only:

```ts
cylinder: [
  new THREE.Vector2(1, 1.5),
  new THREE.Vector2(1, -1.5),
]
```

`THREE.LatheGeometry` does not add end caps automatically. The result is an open tube. Fix by adding axis endpoints, which `LatheGeometry` uses to close the top and bottom faces:

```ts
cylinder: [
  new THREE.Vector2(0, 1.5),    // top center — closes top cap
  new THREE.Vector2(1, 1.5),    // top edge
  new THREE.Vector2(1, -1.5),   // bottom edge
  new THREE.Vector2(0, -1.5),   // bottom center — closes bottom cap
]
```

The silhouette line display gains the correct half-rectangle profile (matching the PRD's "rectangle" silhouette description). The LatheGeometry gains closed caps.

**Cone and sphere are already correct.** The cone profile starts at `(0, 1.5)` (apex, on axis) and ends at `(0, -1.5)` (base center, on axis). The sphere profile is a 17-point semicircular arc starting at `(0, 1.3)` and ending at `(0, -1.3)`, both on the axis. `LatheGeometry` closes geometry automatically when the first and last points lie on the Y axis — only the cylinder was missing this. No changes to cone or sphere profiles.

**Wireframe and lighting (fixes 2b and 2c) apply equally to all three shapes** — they operate on the `geometry` prop in `RotationScene` unconditionally. Cone, cylinder, and sphere all receive the wireframe overlay and the axis point light.

### 2b — Wireframe overlay (`RotationScene.tsx`)

Mode A renders the solid with a faint wireframe overlay (`wireframeMaterial`, gray, opacity 0.1). Add the same treatment to the rotation solid:

```tsx
{geometry && (
  <>
    <mesh geometry={geometry} material={rotationMaterial} />
    <mesh geometry={geometry} material={wireframeMaterial} />
  </>
)}
```

`wireframeMaterial` is already exported from `app/data/materials.ts`. Import and use it directly — no new material instance.

The wireframe opacity tracks `rotationMaterial` implicitly since both meshes share the same geometry and the wireframe is already semi-transparent.

### 2c — Axis point light (`RotationScene.tsx`)

Add a `<pointLight>` positioned near the axis that activates on rotation completion. This gives the materialised solid the same lighting quality as Mode A:

```tsx
const lightRef = useRef<THREE.PointLight>(null);

// In the rotationComplete useEffect (alongside silhouette fade and solid fade):
if (lightRef.current) {
  gsap.to(lightRef.current, { intensity: 0.6, duration: 0.8, ease: "power2.out" });
}

// In JSX:
<pointLight ref={lightRef} position={[2, 1, 2]} intensity={0} color={0xede8e0} />
```

Light starts at intensity 0 and tweens to 0.6 on completion. Colour matches the ambient/directional lights already in `SolidScene` (`0xede8e0`).

---

## Fix 3 — RESET clears the label (`home.tsx`)

The RESET button handler calls `reset()` from `useSolidRotation` but does not dispatch `RESET_ROTATION` to the reducer. `state.rotationComplete` stays `true`, so the `rotationLabel` derived value remains set and the ShapeLabel stays mounted.

Fix: dispatch `RESET_ROTATION` alongside `reset()`:

```tsx
onClick={() => {
  if (state.rotationComplete) {
    reset();
    dispatch({ type: "RESET_ROTATION" });
  } else {
    start();
  }
}}
```

`RESET_ROTATION` sets `rotationComplete: false` and `rotationAngle: 0` in the reducer. `rotationLabel` then evaluates to `undefined`, the ShapeLabel unmounts, and the button label returns to "ROTATE →".

`RESET_ROTATION` does not touch `connectionVisible` — a student who earned the connection moment keeps it until the auto-dismiss timer fires.

---

## Fix 4 — Button / label spacing (`home.tsx`)

When rotation is complete, both the ShapeLabel (`bottom: 68`) and the ROTATE/RESET button (`bottom: 80`) are visible. The button occupies ~80–116px from the bottom of the scene container; the ShapeLabel label text occupies ~68–96px. They overlap.

Fix: raise the button to `bottom: 128` when `state.rotationComplete` is true so label and button stack cleanly with ~8px gap:

```tsx
<div
  style={{
    position: "absolute",
    bottom: state.rotationComplete ? 128 : 80,
    left: "50%",
    transform: "translateX(-50%)",
  }}
>
```

When `rotationComplete` is false the button sits at its original position. When true, the button is above the label with clear separation.

---

## Completion Criteria

- [ ] Connection sentence "That cross section — it's the shape you started with." appears when both modes are completed with the same non-cube solid, regardless of which mode the student is in when it fires
- [ ] Connection sentence does NOT appear on individual shape classifications in Mode A
- [ ] Connection sentence fades in over 0.6s, auto-fades after 4s (timer already in `home.tsx`)
- [ ] Completed rotation solid has visible wireframe overlay matching Mode A quality
- [ ] Cylinder LatheGeometry has closed top and bottom caps
- [ ] Axis point light activates on rotation completion
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Cube: connection moment does not fire
- [ ] RESET button clears the rotation label and returns button text to "ROTATE →"
- [ ] Button and label do not overlap — clear vertical separation when both are visible
