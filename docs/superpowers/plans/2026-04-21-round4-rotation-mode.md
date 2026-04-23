# Round 4 — Rotation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Mode B (Rotation) by introducing `useReducer` state architecture and a GSAP-driven lathe-geometry sweep that materializes solids of revolution, then fire the connection moment when both modes are completed with the same solid.

**Architecture:** Sub-pass A converts all `useState`/`useCallback` in `home.tsx` to a single `useReducer` with a pure reducer in `useDemoReducer.ts`, with a green-build gate before proceeding. Sub-pass B adds the rotation animation hook (`useSolidRotation`), the Three.js scene component (`RotationScene`), a dedicated `rotationMaterial`, and wires everything into `home.tsx` and the existing display components.

**Tech Stack:** React 19, React Router 7, Three.js 0.184, @react-three/fiber, GSAP 3, Vitest

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `app/hooks/useDemoReducer.ts` | **Create** | State shape, action types, pure reducer |
| `app/hooks/useDemoReducer.test.ts` | **Create** | Unit tests for reducer cases |
| `app/hooks/useSolidRotation.ts` | **Create** | GSAP tween, LatheGeometry bucketing, start/reset |
| `app/components/RotationScene.tsx` | **Create** | Axis line, silhouette profile, LatheGeometry mesh, completion fade |
| `app/data/materials.ts` | **Modify** | Add `rotationMaterial` |
| `app/data/silhouettes.ts` | **Modify** | Replace stub with full `SILHOUETTES` map |
| `app/routes/home.tsx` | **Modify** | Replace `useState` with `useReducer`; wire Sub-pass B hooks and components |
| `app/components/ModeBar.tsx` | **Modify** | Accept `solidId` prop; disable rotation segment for cube |
| `app/components/ShapeLabel.tsx` | **Modify** | Accept `rotationLabel` prop; guard update |
| `app/components/SolidScene.tsx` | **Modify** | Accept and forward rotation props; render `<RotationScene>` |

---

## Sub-pass A — Reducer Rewrite

---

### Task 1: Create `useDemoReducer.ts` — state, actions, reducer

**Files:**
- Create: `app/hooks/useDemoReducer.ts`

Context: The current `home.tsx` uses scattered `useState` hooks. This task extracts all state into a single pure reducer so `completedModes` and connection-moment logic can be handled atomically inside the reducer (avoids stale-closure bugs from chained dispatches).

- [ ] **Step 1: Create the file with state shape, initial state, and action union**

```ts
// app/hooks/useDemoReducer.ts
import type * as THREE from "three";
import type { SolidId, ModeId } from "~/types";

export interface DemoState {
  mode: ModeId;
  solidId: SolidId;
  // Mode A
  csgGeometry: THREE.BufferGeometry | null;
  planeInteracted: boolean;
  distinctShapes: Set<string>;
  shapeLabel: string | null;
  labelVisible: boolean;
  // Mode B
  rotationAngle: number;
  rotationComplete: boolean;
  // Connection moment
  completedModes: Set<`${SolidId}-${ModeId}`>;
  connectionVisible: boolean;
  connectionDismissed: boolean;
}

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
  | { type: "HIDE_CONNECTION" };
```

- [ ] **Step 2: Implement the reducer function**

```ts
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload, connectionVisible: false };

    case "SET_SOLID":
      return {
        ...state,
        solidId: action.payload,
        csgGeometry: null,
        planeInteracted: false,
        distinctShapes: new Set(),
        shapeLabel: null,
        labelVisible: false,
        rotationAngle: 0,
        rotationComplete: false,
        connectionVisible: false,
        connectionDismissed: false,
      };

    case "SET_CSG_GEOMETRY":
      return { ...state, csgGeometry: action.payload };

    case "PLANE_INTERACTED":
      return { ...state, planeInteracted: true };

    case "REVEAL_LABEL": {
      const nextShapes = new Set(state.distinctShapes).add(action.payload.key);
      let nextCompleted = state.completedModes;
      let nextConnection = state.connectionVisible;
      if (nextShapes.size >= 2) {
        nextCompleted = new Set(state.completedModes).add(`${state.solidId}-crossSection`);
        const bothDone = nextCompleted.has(`${state.solidId}-rotation`);
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

    case "HIDE_LABEL":
      return { ...state, labelVisible: false };

    case "SET_ROTATION_ANGLE":
      return { ...state, rotationAngle: action.payload };

    case "COMPLETE_ROTATION": {
      const nextCompleted = new Set(state.completedModes).add(`${state.solidId}-rotation`);
      const bothDone = nextCompleted.has(`${state.solidId}-crossSection`);
      const showConnection = bothDone && state.solidId !== "cube" && !state.connectionDismissed;
      return {
        ...state,
        rotationComplete: true,
        completedModes: nextCompleted,
        connectionVisible: showConnection,
      };
    }

    case "RESET_ROTATION":
      return { ...state, rotationAngle: 0, rotationComplete: false };

    case "HIDE_CONNECTION":
      return { ...state, connectionVisible: false, connectionDismissed: true };

    default:
      return state;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/hooks/useDemoReducer.ts
git commit -m "feat: add useDemoReducer — state shape, actions, pure reducer"
```

---

### Task 2: Write and pass reducer unit tests

**Files:**
- Create: `app/hooks/useDemoReducer.test.ts`

Context: The reducer has non-trivial inline logic in `REVEAL_LABEL` and `COMPLETE_ROTATION` — these are the cases most likely to regress. All tests use the pure reducer directly (no React, no hooks).

- [ ] **Step 1: Write tests**

```ts
// app/hooks/useDemoReducer.test.ts
import { describe, test, expect } from "vitest";
import { demoReducer, initialState } from "./useDemoReducer";
import type { DemoState } from "./useDemoReducer";

describe("SET_SOLID", () => {
  test("resets mode-A fields and rotation fields, preserves mode and completedModes", () => {
    const withData: DemoState = {
      ...initialState,
      solidId: "cone",
      mode: "rotation",
      planeInteracted: true,
      distinctShapes: new Set(["cone-circle"]),
      shapeLabel: "circle",
      labelVisible: true,
      rotationAngle: 180,
      rotationComplete: true,
      connectionVisible: true,
      connectionDismissed: true,
      completedModes: new Set(["cone-crossSection"]),
    };
    const next = demoReducer(withData, { type: "SET_SOLID", payload: "cylinder" });
    expect(next.solidId).toBe("cylinder");
    expect(next.mode).toBe("rotation");
    expect(next.planeInteracted).toBe(false);
    expect(next.distinctShapes.size).toBe(0);
    expect(next.shapeLabel).toBeNull();
    expect(next.labelVisible).toBe(false);
    expect(next.rotationAngle).toBe(0);
    expect(next.rotationComplete).toBe(false);
    expect(next.connectionVisible).toBe(false);
    expect(next.connectionDismissed).toBe(false);
    // completedModes is preserved across solid changes
    expect(next.completedModes.has("cone-crossSection")).toBe(true);
  });
});

describe("SET_MODE", () => {
  test("resets connectionVisible only, preserves rotation state", () => {
    const state: DemoState = {
      ...initialState,
      rotationAngle: 180,
      rotationComplete: true,
      connectionVisible: true,
    };
    const next = demoReducer(state, { type: "SET_MODE", payload: "crossSection" });
    expect(next.mode).toBe("crossSection");
    expect(next.connectionVisible).toBe(false);
    expect(next.rotationAngle).toBe(180);
    expect(next.rotationComplete).toBe(true);
  });
});

describe("REVEAL_LABEL", () => {
  test("first key — adds to distinctShapes, no completion yet", () => {
    const next = demoReducer(initialState, {
      type: "REVEAL_LABEL",
      payload: { label: "circle", key: "cone-circle" },
    });
    expect(next.shapeLabel).toBe("circle");
    expect(next.labelVisible).toBe(true);
    expect(next.distinctShapes.has("cone-circle")).toBe(true);
    expect(next.connectionVisible).toBe(false);
    expect(next.completedModes.has("cone-crossSection")).toBe(false);
  });

  test("second distinct key — marks crossSection complete", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cone",
      distinctShapes: new Set(["cone-circle"]),
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "ellipse", key: "cone-ellipse" },
    });
    expect(next.completedModes.has("cone-crossSection")).toBe(true);
    expect(next.connectionVisible).toBe(false); // rotation not done yet
  });

  test("second key with rotation already done — shows connection for non-cube", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cone",
      distinctShapes: new Set(["cone-circle"]),
      completedModes: new Set(["cone-rotation"]),
      connectionDismissed: false,
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "ellipse", key: "cone-ellipse" },
    });
    expect(next.connectionVisible).toBe(true);
  });

  test("connection never fires for cube", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cube",
      distinctShapes: new Set(["cube-square"]),
      completedModes: new Set(["cube-rotation"]),
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "rectangle", key: "cube-rectangle" },
    });
    expect(next.connectionVisible).toBe(false);
  });

  test("connection suppressed if already dismissed", () => {
    const withOne: DemoState = {
      ...initialState,
      solidId: "cone",
      distinctShapes: new Set(["cone-circle"]),
      completedModes: new Set(["cone-rotation"]),
      connectionDismissed: true,
    };
    const next = demoReducer(withOne, {
      type: "REVEAL_LABEL",
      payload: { label: "ellipse", key: "cone-ellipse" },
    });
    expect(next.connectionVisible).toBe(false);
  });
});

describe("COMPLETE_ROTATION", () => {
  test("marks rotation complete and adds to completedModes", () => {
    const next = demoReducer({ ...initialState, solidId: "cylinder" }, { type: "COMPLETE_ROTATION" });
    expect(next.rotationComplete).toBe(true);
    expect(next.completedModes.has("cylinder-rotation")).toBe(true);
    expect(next.connectionVisible).toBe(false); // crossSection not done yet
  });

  test("fires connection when crossSection already done", () => {
    const state: DemoState = {
      ...initialState,
      solidId: "sphere",
      completedModes: new Set(["sphere-crossSection"]),
    };
    const next = demoReducer(state, { type: "COMPLETE_ROTATION" });
    expect(next.connectionVisible).toBe(true);
  });

  test("never fires connection for cube", () => {
    const state: DemoState = {
      ...initialState,
      solidId: "cube",
      completedModes: new Set(["cube-crossSection"]),
    };
    const next = demoReducer(state, { type: "COMPLETE_ROTATION" });
    expect(next.connectionVisible).toBe(false);
  });
});

describe("HIDE_CONNECTION", () => {
  test("clears connectionVisible and sets connectionDismissed", () => {
    const state: DemoState = { ...initialState, connectionVisible: true };
    const next = demoReducer(state, { type: "HIDE_CONNECTION" });
    expect(next.connectionVisible).toBe(false);
    expect(next.connectionDismissed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

Run: `npx vitest run app/hooks/useDemoReducer.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/useDemoReducer.test.ts
git commit -m "test: reducer unit tests for useDemoReducer"
```

---

### Task 3: Update `ModeBar.tsx` — add `solidId` prop and cube guard

**Files:**
- Modify: `app/components/ModeBar.tsx`

Context: `ModeBar` now needs to know which solid is selected so it can disable the Rotation segment when `solidId === 'cube'` (cube is not a solid of revolution). A muted label below the bar communicates why.

- [ ] **Step 1: Update the file**

Replace the full file content:

```tsx
// app/components/ModeBar.tsx
import type { ModeId, SolidId } from "~/types";

interface ModeBarProps {
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  solidId: SolidId;
}

const segmentStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
  width: "50%",
  height: "100%",
  border: "none",
  background: active ? "var(--color-surface-hi)" : "transparent",
  color: active ? "var(--color-amber)" : "var(--color-muted)",
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: disabled ? "default" : "pointer",
  pointerEvents: disabled ? "none" : "auto",
  opacity: disabled ? 0.4 : 1,
});

export function ModeBar({ mode, onModeChange, solidId }: ModeBarProps) {
  const rotationDisabled = solidId === "cube";

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "stretch",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-rule)",
          position: "relative",
        }}
      >
        <button
          style={segmentStyle(mode === "crossSection")}
          onClick={() => onModeChange("crossSection")}
        >
          Cross Section
        </button>
        <button
          style={segmentStyle(mode === "rotation", rotationDisabled)}
          onClick={() => !rotationDisabled && onModeChange("rotation")}
        >
          Rotation
        </button>
        <button
          disabled
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            height: 28,
            padding: "0 12px",
            border: "1px solid var(--color-rule)",
            background: "transparent",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "var(--color-muted)",
            cursor: "default",
          }}
        >
          ◆ PHYSICS
        </button>
      </div>
      {rotationDisabled && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 11,
            color: "var(--color-muted)",
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.04em",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          Cube is not a solid of revolution
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ModeBar.tsx
git commit -m "feat: ModeBar accepts solidId prop; disables rotation for cube"
```

---

### Task 4: Rewrite `home.tsx` — Sub-pass A (useReducer, Mode A parity)

**Files:**
- Modify: `app/routes/home.tsx`

Context: Replace all `useState`/`useCallback` with `useReducer(demoReducer, initialState)`. The `classifyResult` useEffect now dispatches `REVEAL_LABEL` instead of calling setters directly. `prevKeyRef` is removed — `distinctShapes` in the reducer tracks seen keys. The ROTATE button is rendered as a placeholder no-op (wired in Sub-pass B). All Mode A behavior must be identical to Round 3.

- [ ] **Step 1: Rewrite `home.tsx` (Sub-pass A version)**

```tsx
// app/routes/home.tsx
import { useReducer, useRef, useEffect } from "react";
import type { SolidId } from "~/types";
import { demoReducer, initialState } from "~/hooks/useDemoReducer";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";
import { ShapeLabel } from "~/components/ShapeLabel";
import { useShapeClassifier } from "~/hooks/useShapeClassifier";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

export default function Home() {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classifyResult = useShapeClassifier(
    state.csgGeometry,
    state.solidId,
    state.planeInteracted,
  );

  // Dispatch REVEAL_LABEL when classifier produces a new key
  useEffect(() => {
    if (!classifyResult) return;
    dispatch({ type: "REVEAL_LABEL", payload: { label: classifyResult.label, key: classifyResult.key } });
  }, [classifyResult?.key]);

  // Auto-dismiss connection moment after 4s
  useEffect(() => {
    if (!state.connectionVisible) return;
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => {
      dispatch({ type: "HIDE_CONNECTION" });
    }, 4000);
    return () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    };
  }, [state.connectionVisible]);

  const handleSolidChange = (id: SolidId) => {
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    dispatch({ type: "SET_SOLID", payload: id });
  };

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
      <ModeBar
        mode={state.mode}
        onModeChange={(m) => dispatch({ type: "SET_MODE", payload: m })}
        solidId={state.solidId}
      />
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <SolidScene
          solidId={state.solidId}
          mode={state.mode}
          onInteract={() => dispatch({ type: "PLANE_INTERACTED" })}
          onShapeChange={(geo) => dispatch({ type: "SET_CSG_GEOMETRY", payload: geo.clone() })}
        />
        {state.mode === "crossSection" && (
          <ShapeLabel result={classifyResult} connectionVisible={state.connectionVisible} />
        )}
        {state.mode === "rotation" && state.solidId !== "cube" && (
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <button
              onClick={() => {/* wired in Sub-pass B */}}
              style={{
                height: 36,
                padding: "0 20px",
                border: "1px solid var(--color-rule)",
                background: "transparent",
                color: "var(--color-amber)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: "pointer",
              }}
            >
              {state.rotationComplete ? "RESET" : "ROTATE →"}
            </button>
          </div>
        )}
      </div>
      <SolidSelector solidId={state.solidId} onSolidChange={handleSolidChange} />
    </div>
  );
}
```

- [ ] **Step 2: Run build to verify Sub-pass A gate**

Run: `npm run build`

Expected: Build completes with no errors. TypeScript passes. Mode A behavior is preserved.

- [ ] **Step 3: Commit**

```bash
git add app/routes/home.tsx
git commit -m "feat: home.tsx — replace useState with useReducer (Sub-pass A)"
```

---

## Sub-pass B — Rotation Features

---

### Task 5: Update `materials.ts` and `silhouettes.ts`

**Files:**
- Modify: `app/data/materials.ts`
- Modify: `app/data/silhouettes.ts`

Context: `rotationMaterial` must be a separate material from `solidMaterial` so its opacity can be mutated in `RotationScene` without corrupting Mode A rendering. `silhouettes.ts` was a stub that gets replaced now with the actual `THREE.Vector2` profiles for each non-cube solid.

- [ ] **Step 1: Add `rotationMaterial` to `materials.ts`**

Append to the existing file (after `axisLineMaterial`):

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

- [ ] **Step 2: Replace `silhouettes.ts` stub**

```ts
// app/data/silhouettes.ts
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

- [ ] **Step 3: Commit**

```bash
git add app/data/materials.ts app/data/silhouettes.ts
git commit -m "feat: add rotationMaterial; replace silhouettes stub"
```

---

### Task 6: Create `useSolidRotation.ts`

**Files:**
- Create: `app/hooks/useSolidRotation.ts`

Context: This hook owns the GSAP tween, angle state, and LatheGeometry reconstruction. It does NOT own `rotationComplete` — that lives in the reducer. `progressRef` is the tween target (not the component's angle state) so `gsap.killTweensOf` works reliably on reset. `bucketedAngle` (rounded to nearest 5°) stabilizes the `useMemo` dep so geometry isn't recreated on every frame.

- [ ] **Step 1: Create the file**

```ts
// app/hooks/useSolidRotation.ts
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
  }, [solidId, bucketedAngle]);

  return { angle, isRotating, geometry, start, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/hooks/useSolidRotation.ts
git commit -m "feat: useSolidRotation — GSAP tween with LatheGeometry bucketing"
```

---

### Task 7: Create `RotationScene.tsx`

**Files:**
- Create: `app/components/RotationScene.tsx`

Context: This component lives inside the R3F `<Canvas>` tree (inside `SolidScene`). It renders three things: (1) a vertical axis line, (2) the silhouette profile as a `line_` element, and (3) the materializing LatheGeometry mesh. On `rotationComplete`, the silhouette fades out and the solid fades to full opacity via GSAP tweens on the material objects directly.

Note: R3F uses lowercase primitives with trailing underscores for Three.js objects — `line_`, `bufferGeometry_`, `lineBasicMaterial_`, etc.

- [ ] **Step 1: Create the file**

```tsx
// app/components/RotationScene.tsx
import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { SILHOUETTES } from "~/data/silhouettes";
import { rotationMaterial, silhouetteMaterial, axisLineMaterial } from "~/data/materials";
import type { SolidId } from "~/types";

interface RotationSceneProps {
  solidId: SolidId;
  angle: number;
  rotationComplete: boolean;
  geometry: THREE.BufferGeometry | null;
}

export function RotationScene({ solidId, angle, rotationComplete, geometry }: RotationSceneProps) {
  const silhouetteRef = useRef<THREE.Line>(null);

  // Axis line geometry — static
  const axisGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.8, 0),
      new THREE.Vector3(0, 1.8, 0),
    ]);
    return geo;
  }, []);

  // Silhouette profile geometry — 2D points lifted to 3D (x, y, z=0)
  const silhouetteGeometry = useMemo(() => {
    if (solidId === "cube") return null;
    const points = SILHOUETTES[solidId];
    if (!points) return null;
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((v) => new THREE.Vector3(v.x, v.y, 0)),
    );
    return geo;
  }, [solidId]);

  // Mutate rotationMaterial opacity per frame during sweep
  useFrame(() => {
    if (!rotationComplete) {
      rotationMaterial.opacity = (angle / 360) * 0.85;
    }
  });

  // On rotation complete: fade silhouette out, hold solid opacity
  useEffect(() => {
    if (!rotationComplete) return;
    if (silhouetteRef.current) {
      gsap.to((silhouetteRef.current as any).material, { opacity: 0, duration: 0.4 });
    }
    gsap.to(rotationMaterial, { opacity: 0.85, duration: 0.5 });
  }, [rotationComplete]);

  if (solidId === "cube") return null;

  return (
    <group>
      {/* Axis line */}
      <line_ geometry={axisGeometry} material={axisLineMaterial} />

      {/* Silhouette profile */}
      {silhouetteGeometry && (
        <line_ ref={silhouetteRef} geometry={silhouetteGeometry} material={silhouetteMaterial} />
      )}

      {/* Materializing solid */}
      {geometry && <mesh geometry={geometry} material={rotationMaterial} />}
    </group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/RotationScene.tsx
git commit -m "feat: RotationScene — axis line, silhouette, LatheGeometry mesh with opacity fade"
```

---

### Task 8: Update `SolidScene.tsx` — forward rotation props and render `RotationScene`

**Files:**
- Modify: `app/components/SolidScene.tsx`

Context: `SolidScene` is the R3F Canvas wrapper. `SceneContent` currently renders a plain mesh in rotation mode. That fallback gets replaced with `<RotationScene>`, which receives angle/complete/geometry as props from `home.tsx` via `SolidScene`.

- [ ] **Step 1: Update the file**

```tsx
// app/components/SolidScene.tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CuttingGeometry } from "~/components/CuttingGeometry";
import { RotationScene } from "~/components/RotationScene";
import type { SolidId, ModeId } from "~/types";

const GEOMETRIES = {
  cone: new THREE.ConeGeometry(1.2, 3, 64, 1, false),
  cylinder: new THREE.CylinderGeometry(1, 1, 3, 64, 1, false),
  cube: new THREE.BoxGeometry(2.2, 2.2, 2.2),
  sphere: new THREE.SphereGeometry(1.3, 64, 32),
};

interface SceneContentProps {
  solidId: SolidId;
  mode: ModeId;
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  rotationAngle: number;
  rotationComplete: boolean;
  rotationGeometry: THREE.BufferGeometry | null;
}

function SceneContent({
  solidId,
  mode,
  orbitRef,
  onInteract,
  onShapeChange,
  rotationAngle,
  rotationComplete,
  rotationGeometry,
}: SceneContentProps) {
  const geometry = GEOMETRIES[solidId];

  const handleDragStart = () => {
    if (orbitRef.current) orbitRef.current.enabled = false;
  };
  const handleDragEnd = () => {
    if (orbitRef.current) orbitRef.current.enabled = true;
  };

  if (mode === "crossSection") {
    return (
      <CuttingGeometry
        key={solidId}
        solidGeometry={geometry}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onInteract={onInteract}
        onShapeChange={onShapeChange}
      />
    );
  }

  return (
    <RotationScene
      solidId={solidId}
      angle={rotationAngle}
      rotationComplete={rotationComplete}
      geometry={rotationGeometry}
    />
  );
}

interface SolidSceneProps {
  solidId: SolidId;
  mode: ModeId;
  onInteract?: () => void;
  onShapeChange?: (geo: THREE.BufferGeometry) => void;
  rotationAngle?: number;
  rotationComplete?: boolean;
  rotationGeometry?: THREE.BufferGeometry | null;
}

export function SolidScene({
  solidId,
  mode,
  onInteract,
  onShapeChange,
  rotationAngle = 0,
  rotationComplete = false,
  rotationGeometry = null,
}: SolidSceneProps) {
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [5, 2, 5], fov: 45, near: 0.1, far: 100 }}
      style={{ background: "var(--color-ground)", width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.3} color={0xede8e0} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color={0xede8e0} />
      <pointLight position={[-3, 4, -3]} intensity={0.4} color={0xd4962a} />
      <OrbitControls
        ref={orbitRef}
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
      />
    </Canvas>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/SolidScene.tsx
git commit -m "feat: SolidScene renders RotationScene in rotation mode"
```

---

### Task 9: Update `ShapeLabel.tsx` — add `rotationLabel` prop

**Files:**
- Modify: `app/components/ShapeLabel.tsx`

Context: `ShapeLabel` currently guards on `if (!result) return null`. Mode B needs it to display a label when `result` is null but `rotationLabel` is set. The GSAP entrance animation triggers on `rotationLabel` change just like it does for `result?.key`.

- [ ] **Step 1: Update the file**

```tsx
// app/components/ShapeLabel.tsx
import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ClassifyResult } from "~/hooks/useShapeClassifier";

interface ShapeLabelProps {
  result: ClassifyResult | null;
  connectionVisible: boolean;
  rotationLabel?: string;
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

export function ShapeLabel({ result, connectionVisible, rotationLabel }: ShapeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);

  const displayLabel = rotationLabel ?? result?.label ?? null;
  const animKey = rotationLabel ?? result?.key;

  // Animate label in when shape or rotationLabel changes
  useEffect(() => {
    if (!labelRef.current || !displayLabel) return;
    const tween = gsap.fromTo(
      labelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
    return () => { tween.kill(); };
  }, [animKey]);

  // Animate connection sentence on visibility toggle
  useEffect(() => {
    if (!connectionRef.current) return;
    let tween: gsap.core.Tween;
    if (connectionVisible) {
      tween = gsap.fromTo(
        connectionRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      );
    } else {
      tween = gsap.to(connectionRef.current, { opacity: 0, duration: 0.3 });
    }
    return () => { tween.kill(); };
  }, [connectionVisible]);

  if (!result && !rotationLabel) return null;

  const sentence = result ? (CONNECTION_SENTENCES[result.key] ?? null) : null;

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
        {displayLabel}
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

- [ ] **Step 2: Commit**

```bash
git add app/components/ShapeLabel.tsx
git commit -m "feat: ShapeLabel accepts rotationLabel prop for Mode B"
```

---

### Task 10: Wire Sub-pass B into `home.tsx`

**Files:**
- Modify: `app/routes/home.tsx`

Context: The final wiring task. `useSolidRotation` is instantiated here with `handleRotationComplete` as its `onComplete` callback. A `useEffect` on `solidId` calls `reset()` to sync `useSolidRotation` internal state when the solid changes, and resets `rotationMaterial.opacity` to prevent stale opacity bleed. The ROTATE button `onClick` is wired. `SolidScene` and `ShapeLabel` receive the new props.

- [ ] **Step 1: Define `ROTATION_LABELS` constant**

Add near the top of the file (before the component):

```ts
const ROTATION_LABELS: Record<string, string> = {
  cone: "cone",
  cylinder: "cylinder",
  sphere: "sphere",
};
```

- [ ] **Step 2: Add `useSolidRotation` and wire the full component**

Replace the full `home.tsx` with the final version:

```tsx
// app/routes/home.tsx
import { useReducer, useRef, useEffect } from "react";
import type { SolidId } from "~/types";
import { demoReducer, initialState } from "~/hooks/useDemoReducer";
import { useSolidRotation } from "~/hooks/useSolidRotation";
import { rotationMaterial } from "~/data/materials";
import { ModeBar } from "~/components/ModeBar";
import { SolidScene } from "~/components/SolidScene";
import { SolidSelector } from "~/components/SolidSelector";
import { ShapeLabel } from "~/components/ShapeLabel";
import { useShapeClassifier } from "~/hooks/useShapeClassifier";

export function meta() {
  return [{ title: "Cross-Section Explorer" }];
}

const ROTATION_LABELS: Record<string, string> = {
  cone: "cone",
  cylinder: "cylinder",
  sphere: "sphere",
};

export default function Home() {
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRotationComplete = () => {
    dispatch({ type: "COMPLETE_ROTATION" });
  };

  const { angle: rotationAngle, geometry: rotationGeometry, start, reset } = useSolidRotation(
    state.solidId,
    handleRotationComplete,
  );

  const classifyResult = useShapeClassifier(
    state.csgGeometry,
    state.solidId,
    state.planeInteracted,
  );

  // Dispatch REVEAL_LABEL when classifier produces a new key
  useEffect(() => {
    if (!classifyResult) return;
    dispatch({ type: "REVEAL_LABEL", payload: { label: classifyResult.label, key: classifyResult.key } });
  }, [classifyResult?.key]);

  // Auto-dismiss connection moment after 4s
  useEffect(() => {
    if (!state.connectionVisible) return;
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => {
      dispatch({ type: "HIDE_CONNECTION" });
    }, 4000);
    return () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    };
  }, [state.connectionVisible]);

  // Sync useSolidRotation internal state and reset material on solid change
  useEffect(() => {
    reset();
    rotationMaterial.opacity = 0;
  }, [state.solidId]);

  const handleSolidChange = (id: SolidId) => {
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    dispatch({ type: "SET_SOLID", payload: id });
  };

  const rotationLabel =
    state.rotationComplete && state.mode === "rotation"
      ? ROTATION_LABELS[state.solidId]
      : undefined;

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
      <ModeBar
        mode={state.mode}
        onModeChange={(m) => dispatch({ type: "SET_MODE", payload: m })}
        solidId={state.solidId}
      />
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <SolidScene
          solidId={state.solidId}
          mode={state.mode}
          onInteract={() => dispatch({ type: "PLANE_INTERACTED" })}
          onShapeChange={(geo) => dispatch({ type: "SET_CSG_GEOMETRY", payload: geo.clone() })}
          rotationAngle={rotationAngle}
          rotationComplete={state.rotationComplete}
          rotationGeometry={rotationGeometry}
        />
        {state.mode === "crossSection" && (
          <ShapeLabel result={classifyResult} connectionVisible={state.connectionVisible} />
        )}
        {state.mode === "rotation" && state.rotationComplete && (
          <ShapeLabel
            result={null}
            connectionVisible={state.connectionVisible}
            rotationLabel={rotationLabel}
          />
        )}
        {state.mode === "rotation" && state.solidId !== "cube" && (
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <button
              onClick={() => (state.rotationComplete ? reset() : start())}
              style={{
                height: 36,
                padding: "0 20px",
                border: "1px solid var(--color-rule)",
                background: "transparent",
                color: "var(--color-amber)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: "pointer",
              }}
            >
              {state.rotationComplete ? "RESET" : "ROTATE →"}
            </button>
          </div>
        )}
      </div>
      <SolidSelector solidId={state.solidId} onSolidChange={handleSolidChange} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/home.tsx
git commit -m "feat: wire useSolidRotation and rotation UI into home.tsx (Sub-pass B)"
```

---

### Task 11: Final build gate

**Files:** None — verification only.

- [ ] **Step 1: Run tests**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: Build completes with no errors. No TypeScript errors.

- [ ] **Step 3: Manual smoke test checklist**

Start the dev server with `npm run dev` and verify:

- [ ] Mode A (Cross-Section) — plane drag produces shape labels; connection sentence fires after 2 distinct shapes; auto-dismisses after 4s
- [ ] Switching solid resets Mode A state; previous connection sentence does not reappear
- [ ] Switching to Rotation mode: silhouette profile + axis line visible; previous Mode A state preserved in reducer
- [ ] ROTATE button triggers 1.8s sweep; solid materializes from silhouette; label appears on completion
- [ ] RESET button returns to silhouette (opacity 0), button label returns to "ROTATE →"
- [ ] Completing both modes with same non-cube solid fires connection moment
- [ ] Cube: Rotation segment in ModeBar is visually muted; "Cube is not a solid of revolution" text appears; ROTATE button not shown
- [ ] Switching solids mid-sweep does not leave stale opacity on new solid

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: [describe any smoke test fixes]"
```
