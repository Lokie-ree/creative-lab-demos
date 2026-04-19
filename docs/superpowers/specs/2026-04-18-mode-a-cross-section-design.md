# Mode A: Cross Section Explorer — Design Spec
**Date:** 2026-04-18
**Phase:** Round 3 (ships tonight)
**Context:** 73 days to ISTE. Mode A is Act 1 of the Cross-Section Explorer demo.

---

## Scope

Mode A is complete when:

1. **Joystick gizmo** replaces PivotControls as the cutting plane control
2. **Orbit** remains available whenever the user is not dragging the joystick handle
3. **Smoke test** passes — 6–8 key solid × cut combinations verified in the live app
4. **Labels** — shape name and connection sentence display correctly for smoke-test cases
5. **Plane resets** to horizontal/center on solid change (already implemented)

**Deferred to refinement phase:** Full audit of all 13 CONNECTION_SENTENCES, comprehensive regression suite, edge-case corner cuts.

---

## 1. Joystick Gizmo

### Visual

| Element | Description |
|---|---|
| Plane disc | Translucent amber ellipse, always visible, shows the cutting surface in 3D |
| Stem | Short line descending from disc center, amber, ~20% opacity |
| Handle | Glowing amber sphere at bottom of stem — the draggable control |

The handle's offset from the stem center visually encodes current state: centered = flat horizontal plane, displaced = tilted. Students read the tilt from the handle position without needing labels.

### Interaction

- **Pointer down on handle** → sample the camera's `right` vector once (do not re-sample during the drag); disable OrbitControls
- **Drag vertical (screen-Y delta `dy`)** → translate the cutting plane in world Y by `dy * 0.01` units per pixel (starting value — tune in testing)
- **Drag horizontal (screen-X delta `dx`)** → rotate the plane around the camera right vector sampled at pointer-down by `dx * 0.005` radians per pixel (starting value — tune in testing)
- **Diagonal drag** → both height and tilt simultaneously; this is how the cube hexagon is reached
- **Pointer up** → handle stays at released position (position control, not spring-back); OrbitControls re-enabled

> **Note on sampling:** The camera right vector must be captured on `pointerdown`, not updated each frame. If it were re-sampled mid-drag while the user also orbits, the tilt axis would drift unpredictably.

> **Note on hexagon:** The body diagonal of a cube requires approximately 54.7° of tilt (`arctan(√2)`). The 80° cap below is intentionally generous to accommodate this — do not tighten the cap below 60° without retesting the hexagon case.

### Constraints

- **Height:** clamped so the plane cannot exit the solid's bounding box in Y
- **Tilt:** clamped to ±80° from horizontal (avoids degenerate fully-vertical cut; accommodates ~55° hexagon)
- **On solid change:** plane resets to horizontal at Y-center of solid, handle snaps to stem center

### Migration from PivotControls

The following items in `CuttingGeometry.tsx` must be handled when removing PivotControls:

| Item | Action |
|---|---|
| `PivotControls` component | Remove entirely |
| `pulseTargetRef` mesh (invisible GSAP target) | Re-parent into `JoystickGizmo` — it must remain in the scene for the pulse affordance animation to work |
| `onDragStart` / `onDragEnd` props | Keep — `JoystickGizmo` fires these on pointer-down/up; prop interface to `SolidScene.tsx` is unchanged |
| `handleDrag` / `onShapeChange` | Keep — `JoystickGizmo` calls `csg.current?.update()` and fires `onShapeChange` on each pointer-move |
| `onInteract` | Keep — fire once on first pointer-move that changes the matrix, same logic as current `hasInteracted` ref |

`SolidScene.tsx` and `app/routes/home.tsx`: **no changes needed** — the prop interface (`onDragStart`, `onDragEnd`, `onInteract`, `onShapeChange`) is identical.

---

## 2. New Component: `JoystickGizmo`

**File:** `app/components/JoystickGizmo.tsx`

**Props:**
```ts
interface JoystickGizmoProps {
  brushRef: React.RefObject<THREE.Mesh>;   // the CSG brush mesh to transform
  csgRef: React.RefObject<CSGGeometryRef>; // to call .update() on drag
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  pulseTargetRef: React.RefObject<THREE.Mesh>; // handed in from CuttingGeometry
}
```

**Internal state:** a single `THREE.Matrix4` (`brushMatrix`) that accumulates the brush's transform. There is no separate `tiltX`/`tiltZ` decomposition — the matrix is updated incrementally on each pointer-move:

- Height drag: translate the matrix along world Y by `dy * 0.01`
- Tilt drag: rotate the matrix around the camera right vector sampled at pointer-down by `dx * 0.005` radians

This matches how PivotControls delivered its matrix to `handleDrag` and avoids any axis decomposition ambiguity. The plane disc and handle positions are derived from `brushMatrix` on each render.

**Rendering:** Three R3F meshes — disc (flat CylinderGeometry, translucent), stem (line or thin box), handle (SphereGeometry). The `pointerdown`, `pointermove`, `pointerup` events are attached to the handle mesh.

---

## 3. Shape Classification — Smoke Test

The classifier math is already unit-tested (16 tests, all passing). The smoke test verifies the full live pipeline: CSG output → vertex extraction → `classifyShape` → label display.

### Cases to verify manually in the running app

| Solid | Cut | Expected label | Sentence key |
|---|---|---|---|
| Cone | Horizontal (mid) | circle | cone-circle |
| Cone | Tilted ~30° | ellipse | cone-ellipse |
| Cylinder | Horizontal | circle | cylinder-circle |
| Cylinder | Tilted ~45° | ellipse | cylinder-ellipse |
| Cube | Horizontal | square | cube-square |
| Cube | Body diagonal (diagonal drag) | hexagon | cube-hexagon |
| Sphere | Horizontal | circle | sphere-circle |
| Sphere | Any tilt | circle | sphere-circle (same key) |

8 cut combinations → 7 unique sentence keys (both sphere rows share `sphere-circle`). This is correct — not a gap.

### Verification method

Add two `console.log` calls to `classifyShape` in `app/utils/classifyShape.ts`:

```ts
// After hull is computed (line ~82):
console.log('[classify] hullN:', hullN, 'solidId:', solidId);

// Inside the many-vertex branch, after aspect2d is computed:
console.log('[classify] aspect2d:', aspect2d.toFixed(2), '→', label);
```

Walk through the 8 cases above; confirm the logged `hullN` and `label` match the expected column. **Remove both logs before committing.**

> React Strict Mode double-invokes memos in dev — each classification may log twice. Ignore duplicates; the values will be identical.

---

## 4. Labels — Verification Checklist

Verify these behaviors during the smoke test (no code changes expected):

- [ ] Shape name appears after first meaningful drag (`planeInteracted` gate fires)
- [ ] Shape name re-animates on each new classification (label changes as you drag)
- [ ] Connection sentence appears and fades after 4 seconds
- [ ] No stale label persists when switching solids
- [ ] All 7 sentence keys in the smoke table display correct text from `CONNECTION_SENTENCES`

---

## 5. Files Changed

| File | Change |
|---|---|
| `app/components/CuttingGeometry.tsx` | Remove PivotControls; wire JoystickGizmo; re-parent pulse mesh |
| `app/components/JoystickGizmo.tsx` | **New** — plane disc + stem + handle, drag interaction, matrix output |
| `app/utils/classifyShape.ts` | Add dev console.logs for smoke test; remove before commit |
| `app/components/SolidScene.tsx` | **No changes** — prop interface unchanged |
| `app/routes/home.tsx` | **No changes** — prop interface unchanged |
| `app/hooks/useShapeClassifier.ts` | **No changes expected** |
| `app/components/ShapeLabel.tsx` | **No changes expected** |

---

## 6. Out of Scope (Tonight)

- Full CONNECTION_SENTENCES audit
- `cube-rectangle`, `cone-parabola`, `cylinder-rectangle`, corner cuts reachability
- Haptic feedback
- Accessibility (keyboard gizmo control)
- Any Round 4 work (rotation mode, silhouettes)
