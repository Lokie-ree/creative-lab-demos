# Round 4 — Rotation Mode Design Spec

**Date:** 2026-04-20  
**Project:** Cross-Section Explorer  
**Builds on:** Rounds 1–3 complete (Mode A fully functional, `useShapeClassifier` shipped)  
**Delivery approach:** Two sub-passes — Sub-pass A (reducer rewrite, green build gate) then Sub-pass B (rotation features)

---

## Context

Round 4 completes Mode B (Rotation) and wires the connection moment that fires after a student completes both modes with the same solid. It also introduces `useReducer` to replace the `useState` pattern in `home.tsx`, which is required to track `completedModes` cleanly.

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | State architecture | `useReducer` via `useDemoReducer.ts` | Required for `completedModes` Set and clean multi-action transitions |
| 2 | Mode A "complete" threshold | 2 distinct shape keys discovered | Earns the connection moment without being too lenient |
| 3 | GSAP tween target in `useSolidRotation` | `progressRef = useRef({ val: 0 })` | Fixes kill-on-reset bug; `this.targets()` pattern dropped |
| 4 | Rotation material | New `rotationMaterial` in `materials.ts` | Prevents shared `solidMaterial` opacity mutation from corrupting Mode A |
| 5 | ROTATE button placement | `home.tsx` sibling div (HTML, not Canvas) | Keeps all HTML chrome at the same layer; no drei `<Html>` portal needed |
| 6 | `ModeBar` cube guard | Pass `solidId: SolidId` prop | `ModeBar` owns all mode UI; cleaner than a `rotationDisabled` boolean |
| 7 | Rotation state on mode switch | Preserved | `SET_MODE` does not reset `rotationAngle` or `rotationComplete` |

---

## Sub-pass A — Reducer Rewrite

### Goal
Replace all `useState` + `useCallback` in `home.tsx` with `useReducer`. Build must pass and all Mode A behavior must be identical before proceeding to Sub-pass B.

### New file: `app/hooks/useDemoReducer.ts`

**State shape:**

```ts
import type * as THREE from "three";
import type { SolidId, ModeId } from "~/types";

export interface DemoState {
  mode: ModeId;
  solidId: SolidId;
  // Mode A
  csgGeometry: THREE.BufferGeometry | null;
  planeInteracted: boolean;
  distinctShapes: Set<string>;       // classify result keys seen — "complete" at size >= 2
  shapeLabel: string | null;
  labelVisible: boolean;
  // Mode B
  rotationAngle: number;             // [0, 360] — preserved on mode switch, reset on solid change
  rotationComplete: boolean;
  // Connection moment
  completedModes: Set<`${SolidId}-${ModeId}`>;
  connectionVisible: boolean;
  connectionDismissed: boolean;      // prevents re-showing after auto-dismiss within same solid
}
```

**Initial state:**

```ts
export const initialState: DemoState = {
  mode: "crossSection",
  solidId: "cone",
  csgGeometry: null,
  planeInteracted: false,
  distinctShapes: new Set(),
  shapeLabel: null,
  labelVisible: false,
  rotationAngle: 0,
  rotationComplete: false,
  completedModes: new Set(),
  connectionVisible: false,
  connectionDismissed: false,
};
```

**Actions:**

```ts
export type DemoAction =
  | { type: "SET_MODE"; payload: ModeId }
  | { type: "SET_SOLID"; payload: SolidId }
  | { type: "SET_CSG_GEOMETRY"; payload: THREE.BufferGeometry }
  | { type: "PLANE_INTERACTED" }
  | { type: "REVEAL_LABEL"; payload: { label: string; key: string } }
  | { type: "HIDE_LABEL" }
  | { type: "SET_ROTATION_ANGLE"; payload: number }
  | { type: "COMPLETE_ROTATION" }
  | { type: "RESET_ROTATION" }
  | { type: "MARK_MODE_COMPLETE"; payload: { solidId: SolidId; mode: ModeId } }
  | { type: "HIDE_CONNECTION" };
```

**Reducer rules:**

`SET_SOLID` resets: `csgGeometry`, `planeInteracted`, `distinctShapes` (new Set()), `shapeLabel`, `labelVisible`, `rotationAngle`, `rotationComplete`, `connectionVisible`, `connectionDismissed`. Preserves: `mode`, `completedModes`.

`SET_MODE` resets: `connectionVisible` only. Preserves all other state including `rotationAngle`, `rotationComplete`, and all Mode A state.

`REVEAL_LABEL`: sets `shapeLabel` and `labelVisible: true`; adds `payload.key` to `distinctShapes`. If the new set size >= 2, **inline in the same reducer case** (not by calling dispatch — reducers must be pure): compute `completedModes` and `connectionVisible` using the same logic as `MARK_MODE_COMPLETE` for `crossSection`. Example:

```ts
case "REVEAL_LABEL": {
  const nextShapes = new Set(state.distinctShapes).add(action.payload.key);
  let nextCompleted = state.completedModes;
  let nextConnection = state.connectionVisible;
  if (nextShapes.size >= 2) {
    nextCompleted = new Set(state.completedModes).add(`${state.solidId}-crossSection`);
    const bothDone = nextCompleted.has(`${state.solidId}-crossSection`) && nextCompleted.has(`${state.solidId}-rotation`);
    nextConnection = bothDone && state.solidId !== "cube" && !state.connectionDismissed;
  }
  return {
    ...state,
    shapeLabel: action.payload.label,
    labelVisible: true,
    distinctShapes: nextShapes,
    completedModes: nextCompleted,
    connectionVisible: nextConnection,
  };
}
```

`MARK_MODE_COMPLETE`:
```ts
case "MARK_MODE_COMPLETE": {
  const { solidId, mode } = action.payload;
  // Guard: crossSection requires >= 2 distinct shapes, rotation requires rotationComplete
  if (mode === "crossSection" && state.distinctShapes.size < 2) return state;
  if (mode === "rotation" && !state.rotationComplete) return state;
  const next = new Set(state.completedModes).add(`${solidId}-${mode}`);
  const bothDone =
    next.has(`${solidId}-crossSection`) && next.has(`${solidId}-rotation`);
  const showConnection = bothDone && solidId !== "cube" && !state.connectionDismissed;
  return { ...state, completedModes: next, connectionVisible: showConnection };
}
```

`HIDE_CONNECTION`: sets `connectionVisible: false`, `connectionDismissed: true`.

`COMPLETE_ROTATION`: sets `rotationComplete: true`. Does NOT auto-dispatch `MARK_MODE_COMPLETE` — that fires from `home.tsx` after `onComplete` callback.

### Updated file: `app/routes/home.tsx`

- `useReducer(demoReducer, initialState)` replaces all `useState`
- `useShapeClassifier(state.csgGeometry, state.solidId, state.planeInteracted)` — result in `classifyResult`
- `useEffect` on `classifyResult?.key`: dispatches `REVEAL_LABEL` when key changes and result is non-null
- `useEffect` on `state.connectionVisible`: starts 4s timer when true, dispatches `HIDE_CONNECTION` on expiry; clears timer on cleanup
- `connectionTimerRef` remains a `useRef<ReturnType<typeof setTimeout> | null>` (timers are side effects, not state)
- `prevKeyRef` removed — `distinctShapes` in the reducer replaces its function
- ROTATE button renders as a sibling `<div>` to the canvas container when `state.mode === 'rotation' && state.solidId !== 'cube'`
  - Label: `ROTATE →` when `!state.rotationComplete`, `RESET` when `state.rotationComplete`
  - onClick: calls `start()` or `reset()` from `useSolidRotation` (wired in Sub-pass B)
- `ModeBar` receives `solidId={state.solidId}` prop
- `ShapeLabel` receives `rotationLabel` for Mode B (wired in Sub-pass B)

### Sub-pass A completion gate
`npm run build` passes. All Mode A behavior identical to Round 3 output. ROTATE button visible in Rotation mode (can be a no-op placeholder). Connection moment does not fire yet.

---

## Sub-pass B — Rotation Features

### Updated file: `app/data/materials.ts`

Add alongside existing exports:

```ts
export const rotationMaterial = new THREE.MeshStandardMaterial({
  color: 0x232018,
  transparent: true,
  opacity: 0,
  roughness: 0.7,
  metalness: 0.1,
  side: THREE.FrontSide,
});
```

Opacity is mutated directly in `RotationScene` via `useFrame` — `rotationMaterial.opacity = (angle / 360) * 0.85`. Never recreated.

### Updated file: `app/data/silhouettes.ts`

Replace stub with full content (no changes from build-order-prompts.md § Round 4):

```ts
import * as THREE from "three";
import type { SolidId } from "~/types";

export const SILHOUETTES: Record<Exclude<SolidId, "cube">, THREE.Vector2[]> = {
  cone: [
    new THREE.Vector2(0, 1.5),
    new THREE.Vector2(1.2, -1.5),
    new THREE.Vector2(0, -1.5),
  ],
  cylinder: [
    new THREE.Vector2(1, 1.5),
    new THREE.Vector2(1, -1.5),
  ],
  sphere: [
    ...Array.from({ length: 17 }, (_, i) => {
      const angle = (i / 16) * Math.PI;
      return new THREE.Vector2(Math.sin(angle) * 1.3, Math.cos(angle) * 1.3);
    }),
  ],
};
```

### New file: `app/hooks/useSolidRotation.ts`

```ts
import { useState, useRef, useMemo } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { SILHOUETTES } from "~/data/silhouettes";
import type { SolidId } from "~/types";

export function useSolidRotation(solidId: SolidId, onComplete: () => void) {
  const [angle, setAngle] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const progressRef = useRef({ val: 0 });

  const start = () => {
    progressRef.current.val = 0;
    setAngle(0);
    setIsRotating(true);
    gsap.to(progressRef.current, {
      val: 360,
      duration: 1.8,
      ease: "power2.inOut",
      onUpdate: () => setAngle(progressRef.current.val),
      onComplete: () => {
        setAngle(360);
        setIsRotating(false);
        onComplete();
      },
    });
  };

  const reset = () => {
    gsap.killTweensOf(progressRef.current);
    setAngle(0);
    setIsRotating(false);
  };

  const bucketedAngle = Math.round(angle / 5);
  const geometry = useMemo(() => {
    if (solidId === "cube") return null;
    const points = SILHOUETTES[solidId];
    if (!points) return null;
    const segments = Math.max(3, Math.round((angle / 360) * 64));
    return new THREE.LatheGeometry(points, segments, 0, (angle * Math.PI) / 180);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solidId, bucketedAngle]);  // bucketedAngle stabilizes the dep — computed expressions are not valid in dep arrays

  return { angle, isRotating, geometry, start, reset };
}
```

### New file: `app/components/RotationScene.tsx`

Props:
```ts
interface RotationSceneProps {
  solidId: SolidId;
  angle: number;
  rotationComplete: boolean;
  geometry: THREE.BufferGeometry | null;
}
```

Contents:
- **Axis line**: `line_` from `[0, -1.8, 0]` to `[0, 1.8, 0]` using `axisLineMaterial`. BufferGeometry created once in `useMemo`.
- **Silhouette profile**: `line_` geometry from `SILHOUETTES[solidId]` Vector2 array converted to 3D positions (x, y, z=0) in a `useMemo`. Uses `silhouetteMaterial`. Returns null for cube. Attach a `useRef<THREE.Line>` named `silhouetteRef` to this `line_` element — used for the completion fade.
- **LatheGeometry mesh**: renders `geometry` prop with `rotationMaterial`. `useFrame` sets `rotationMaterial.opacity = (angle / 360) * 0.85`.
- **On `rotationComplete` change to true** (`useEffect` dep on `rotationComplete`): `gsap.to((silhouetteRef.current as any).material, { opacity: 0, duration: 0.4 })` then `gsap.to(rotationMaterial, { opacity: 0.85, duration: 0.5 })`.
- Does not call `useSolidRotation` — receives all data as props from `home.tsx`.

### Updated file: `app/components/SolidScene.tsx`

- Imports `RotationScene`
- `SceneContent` receives `rotationAngle`, `rotationComplete`, `rotationGeometry` props (only used when `mode === 'rotation'`)
- When `mode === 'rotation'`: renders `<RotationScene angle={rotationAngle} rotationComplete={rotationComplete} geometry={rotationGeometry} solidId={solidId} />`
- Bare mesh+wireframe fallback for rotation mode removed

### Updated file: `app/components/ModeBar.tsx`

- Receives `solidId: SolidId` prop
- ROTATION button: when `solidId === 'cube'`, apply `pointerEvents: 'none', opacity: 0.4, cursor: 'default'`
- Muted label `"Cube is not a solid of revolution"` renders beneath the mode bar (absolute positioned, centered, 11px, `--color-muted`), visible only when `solidId === 'cube'`

### Updated file: `app/components/ShapeLabel.tsx`

- Add `rotationLabel?: string` prop
- Component renders when **either** `result` is non-null (Mode A) **or** `rotationLabel` is set (Mode B) — the existing `if (!result) return null` guard must be replaced with `if (!result && !rotationLabel) return null`
- When `rotationLabel` is set, render it using the same Fraunces italic amber style and same GSAP entrance animation on key change; `result` may be null in this case
- `home.tsx` passes `rotationLabel={state.rotationComplete && state.mode === 'rotation' ? ROTATION_LABELS[state.solidId] : undefined}`
- `ROTATION_LABELS` defined in `home.tsx` or a new `app/data/labels.ts`: `{ cone: "cone", cylinder: "cylinder", sphere: "sphere" }`

### Updated file: `app/routes/home.tsx` (Sub-pass B additions)

- `const { angle: rotationAngle, geometry: rotationGeometry, isRotating, start, reset } = useSolidRotation(state.solidId, handleRotationComplete)` — destructure with aliases so prop names match `SolidScene`'s expectations
- `handleRotationComplete`: dispatches `COMPLETE_ROTATION` then `MARK_MODE_COMPLETE({ solidId: state.solidId, mode: 'rotation' })`
- `useEffect` on `state.solidId`: calls `reset()` to sync `useSolidRotation` internal state on solid change
- ROTATE button `onClick`: `state.rotationComplete ? reset() : start()`
- `SolidScene` receives `rotationAngle={rotationAngle}`, `rotationComplete={state.rotationComplete}`, `rotationGeometry={rotationGeometry}`

### Sub-pass B completion gate
`npm run build` passes. Switching to Rotation mode shows silhouette + axis line. ROTATE button triggers 1.8s sweep, solid materializes, label appears. RESET returns to silhouette. Connection moment fires after completing both modes with same solid (not cube). Cube shows disabled rotation segment with "Not a solid of revolution" copy.

---

## What Is NOT Changing in Round 4

- Physics button remains a disabled placeholder (Round 5)
- `useShapeClassifier` is unchanged
- `CuttingGeometry` is unchanged
- All Mode A behavior is identical to Round 3 output
- No camera reset on solid change (Round 6)
- No mobile breakpoints (Round 6)

---

## Integration Points

| Consumes from Round 3 | Produces for Round 5 |
|-----------------------|----------------------|
| `useShapeClassifier` return type | `completedModes` Set in reducer |
| `SolidScene` `SceneContent` pattern | `SolidScene` conditional Physics wrapper |
| `ShapeLabel` GSAP entrance | `ModeBar` physics button activation |
| `CuttingGeometry` `onInteract` / `onShapeChange` callbacks | — |
