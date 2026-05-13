# Cross-Section Explorer Architecture (As Built)

This document describes the current implementation in `creative-lab-demos` for the cross-section explorer route.

## Purpose and Scope

The app delivers one interactive experience with two geometry modes:

- `crossSection`: cut a 3D solid and classify the resulting 2D section.
- `rotation`: revolve a 2D silhouette into a 3D solid and label the result.

It is implemented as a single page route with a shared reducer, a Three.js scene orchestrated by React Three Fiber, and HTML overlays for controls/labels.

## Runtime Entry Points

- Router config: `app/routes.ts` maps index route to `app/routes/home.tsx`.
- App shell: `app/root.tsx` provides document layout, fonts, and global CSS.
- Feature root: `app/routes/home.tsx` owns state, mode orchestration, and overlays.

## High-Level Component Topology

`Home` composes:

1. `ModeBar` (mode switch + physics toggle)
2. `SolidScene` (R3F canvas)
3. `ShapeLabel` (cross-section/rotation label + connection sentence)
4. `SolidSelector` (cone/cylinder/cube/sphere)

`SolidScene` composes:

- Camera/lights/`OrbitControls`
- `SceneContent` branch:
  - `CuttingGeometry` in `crossSection` mode
  - `RotationScene` in `rotation` mode
- Optional lazy-loaded `PhysicsSolid` when physics is active

## State Architecture

The core state is handled by `useReducer` in `app/hooks/useDemoReducer.ts`.

### State Model

- Navigation: `mode`, `solidId`
- Cross-section mode: `csgGeometry`, `planeInteracted`, `distinctShapes`, `shapeLabel`, `labelVisible`
- Rotation mode: `rotationAngle`, `rotationComplete`
- Connection moment: `completedModes`, `connectionVisible`, `connectionDismissed`
- Physics: `physicsMode`

### Reducer Contracts

- `SET_SOLID`: resets per-solid interaction state and rotation progress, keeps current mode, turns physics off.
- `SET_MODE`: switches mode, turns physics off, hides active connection.
- `REVEAL_LABEL`: tracks distinct shape keys; after 2 distinct cross-section keys for a solid, marks `solid-crossSection` complete.
- `COMPLETE_ROTATION`: marks `solid-rotation` complete.
- Connection sentence shows only when both completions exist for same solid and solid is not `cube`.
- `HIDE_CONNECTION` marks it dismissed so it does not keep reappearing immediately.

`Home` also runs a 4-second timeout to auto-hide connection copy after it appears.

## Cross-Section Pipeline (Mode A)

### Geometry and CSG

- Implemented in `app/components/CuttingGeometry.tsx`.
- Uses `@react-three/csg` `Geometry` + `Base` + `Subtraction`.
- Subtraction brush is a large translated box acting as a half-space cutter.
- `useGroups` and dual materials assign base solid vs section-face materials.

### Interaction Gizmo

- Implemented in `app/components/JoystickGizmo.tsx`.
- Pointer drag updates:
  - Y translation (height)
  - Quaternion tilt around camera-right axis
- Gizmo keeps its own transform refs (`heightRef`, `tiltQuatRef`) and rebuilds matrix each drag event.
- On each update:
  - calls `csgRef.current.update()`
  - emits resulting geometry through `onShapeChange`
  - emits plane transform for physics sync
- First meaningful movement triggers `onInteract` and stops affordance pulse.

### Shape Classification Flow

1. `Home` stores cloned CSG result geometry in reducer via `SET_CSG_GEOMETRY`.
2. `useShapeClassifier` extracts section group vertices from `csgGeometry.groups[1]`.
3. `classifyShape` (`app/utils/classifyShape.ts`) performs:
   - 3D vertex deduplication
   - projection to robust local 2D basis
   - hull building with tolerance
   - near-collinear cleanup
   - minimum-area bounding box aspect analysis
   - solid-specific invariant gating (cube/cylinder/cone/sphere constraints)
4. New result key dispatches `REVEAL_LABEL`.

This is designed to absorb noisy CSG triangulation artifacts while preserving major pedagogical labels (including cube hexagon and cone parabola cases).

## Rotation Pipeline (Mode B)

### Rotation Control

- `useSolidRotation` owns angle progression and generated lathe geometry.
- GSAP tween runs `0 -> 360` over 1.8s (or instant completion under reduced motion).
- Geometry rebuild is bucketed by `Math.round(angle / 5)` to limit recomputation.

### Mesh Construction

- `RotationScene` uses silhouette point sets from `app/data/silhouettes.ts`.
- Builds `THREE.LatheGeometry` for cone/cylinder/sphere (cube returns `null`).
- Displays axis + silhouette pre-completion.
- During progression, material opacity scales with angle.
- On completion, silhouette fades and solid opacity animates to full.

### Rotation UX Rules

- Cube rotation is disabled at the control layer (`ModeBar`) with explanatory copy.
- Rotate button in `Home` switches to reset after completion.

## Physics Mode Integration

- `PhysicsSolid` is lazy-loaded (`React.lazy`) to avoid up-front Rapier cost.
- Physics is available in both modes, but with different behavior:
  - Cross-section mode: gravity on, kinematic plane collider synced to gizmo transform, floor collider, impact-triggered flash feedback.
  - Rotation mode: gravity off, torque impulses for free spin.
- Scene and material transitions are coordinated with GSAP when toggling physics.

## Camera, Lighting, and Rendering Defaults

Configured in `SolidScene`:

- `Canvas` DPR range `[1, 2]`
- Perspective camera with orbit controls (pan disabled, distance/polar clamped)
- Ambient + directional + amber point lighting
- Camera reset on solid change handled by `useCameraReset` (GSAP tween)

Geometry segment density is device-adaptive in `app/data/segments.ts` using `(pointer: coarse)` media query.

## Styling and UI Layer

- Global tokens and theme live in `app/app.css` and `app/tokens.ts`.
- Overlays (`ModeBar`, `SolidSelector`, `ShapeLabel`) are regular DOM above the canvas.
- Responsive rules:
  - abbreviated nav labels on very small widths
  - physics label hidden on <=360px
  - solid selector converts to 2x2 grid on <=520px
  - physics button hidden for reduced-motion users

## Data and Asset Modules

- `app/data/materials.ts`: shared Three material instances.
- `app/data/silhouettes.ts`: lathe profile points for revolved solids.
- `app/data/segments.ts`: quality profile for mesh segment counts by pointer type.
- `app/types.ts`: shared `SolidId` and `ModeId` unions.

## Testing Surface

Current automated tests focus on:

- `app/utils/classifyShape.test.ts`
  - cube section families (triangle/square/rectangle/pentagon/hexagon)
  - sphere/cylinder/cone invariants
  - edge cases from real CSG noise captures
- `app/hooks/useDemoReducer.test.ts`
  - state transitions for mode/solid switching
  - connection gating and dismissal behavior
  - physics reset semantics

## Key Implementation Decisions

- CSG-first section generation rather than hand-built per-solid section geometry.
- Reducer-centered state machine to keep mode transitions explicit.
- Separation of concerns:
  - scene orchestration (`SolidScene`)
  - interaction primitive (`JoystickGizmo`)
  - classification pipeline (`classifyShape`)
  - animation orchestration (GSAP in focused components/hooks)
- Robustness to triangulation artifacts prioritized in classification logic.

## Known Gaps vs PRD/UX Spec

These are intentional or current implementation differences between the spec docs in `demos/cross-section-explorer` and the shipped code.

- Cross-section completion threshold currently triggers after **2** distinct section labels, while the UX spec narrative describes completion after seeing **3** distinct labels.
- Label reveal gate is currently broad (`planeInteracted` after first meaningful pointer movement), rather than using explicit distance/angle thresholds like `> 0.3` world units or `> 10°`.
- Connection copy is mode-specific in code: cross-section uses `"That cross section — it's the shape you started with."` while rotation uses `"Slice this solid — you'll find the shape you swept from."`; spec language suggests a single canonical sentence.
- Camera start/reset values differ across scene setup and reset flow (`Canvas` starts at `[5, 2, 5]`, reset animates to `[0, 2, 7]`), while spec examples present a single default camera position.
- CSG material assignment includes a runtime safety fallback for R3F v9 compatibility (forcing a 2-material array when needed), which is an implementation hardening detail not captured in PRD/UX docs.
- Physics affordance behavior is stricter than baseline spec text in rotation mode: physics toggle is disabled until rotation completes (`rotationComplete`), avoiding mode overlap before the solid fully materializes.

### Gap Triage Tags

- `temporary` - Cross-section completion threshold is 2 labels in reducer; spec target is 3 labels.
- `temporary` - Label reveal uses first meaningful interaction instead of explicit distance/angle thresholds.
- `temporary` - Connection sentence differs by mode instead of using one canonical line.
- `temporary` - Camera start/reset defaults are inconsistent between initial scene mount and reset animation.
- `intentional` - CSG material fallback for R3F v9 compatibility is a defensive runtime guard.
- `intentional` - Physics toggle is disabled in rotation mode until completion to prevent pre-materialization overlap.
