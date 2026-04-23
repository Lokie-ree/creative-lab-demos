# Round 4 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four issues blocking Round 4 from shippable quality: the connection sentence never firing, the rotation scene lacking Mode A visual quality, RESET not clearing the label, and button/label overlap.

**Architecture:** Four targeted edits across four files — `ShapeLabel.tsx` (connection sentence logic + styling), `silhouettes.ts` (cylinder caps), `RotationScene.tsx` (wireframe overlay + point light), and `home.tsx` (RESET dispatch + button spacing). No new files, no new hooks, no new materials. All changes are self-contained within their file.

**Tech Stack:** React 19, React Three Fiber v9, Three.js 0.184, GSAP 3, Vitest

---

## File Map

| File | Change |
|------|--------|
| `app/components/ShapeLabel.tsx` | Remove `CONNECTION_SENTENCES` map; rewire sentence to `connectionVisible`; fix styling to Fraunces italic amber |
| `app/data/silhouettes.ts` | Add axis endpoints to cylinder profile to close LatheGeometry caps |
| `app/components/RotationScene.tsx` | Add wireframe overlay mesh; add axis point light that tweens in on completion |
| `app/routes/home.tsx` | Dispatch `RESET_ROTATION` on reset; make button `bottom` dynamic to prevent label overlap |

---

## Task 1: Fix `ShapeLabel.tsx` — connection sentence

**Files:**
- Modify: `app/components/ShapeLabel.tsx`

Context: `ShapeLabel` has a `CONNECTION_SENTENCES` per-shape map that fires on every shape classification (wired to `result?.key`). The PRD specifies a single sentence — "That cross section — it's the shape you started with." — that fires only when `connectionVisible` is true. The sentence div also uses wrong styling (DM Sans, muted colour) instead of PRD-specified Fraunces italic amber.

- [ ] **Step 1: Remove `CONNECTION_SENTENCES` and rewire sentence logic**

Replace the full file content:

```tsx
import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ClassifyResult } from "~/hooks/useShapeClassifier";

interface ShapeLabelProps {
  result: ClassifyResult | null;
  connectionVisible: boolean;
  rotationLabel?: string;
}

export function ShapeLabel({ result, connectionVisible, rotationLabel }: ShapeLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);

  const displayLabel = rotationLabel ?? result?.label ?? null;
  const animKey = rotationLabel ?? result?.key;

  useEffect(() => {
    if (!labelRef.current || !displayLabel) return;
    const tween = gsap.fromTo(
      labelRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
    return () => { tween.kill(); };
  }, [animKey]);

  useEffect(() => {
    if (!connectionRef.current || !connectionVisible) return;
    const tween = gsap.fromTo(
      connectionRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
    );
    return () => { tween.kill(); };
  }, [connectionVisible]);

  if (!result && !rotationLabel) return null;

  const sentence = connectionVisible
    ? "That cross section — it's the shape you started with."
    : null;

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
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/ShapeLabel.tsx
git commit -m "fix: rewire connection sentence to connectionVisible, remove per-shape sentences, fix styling"
```

---

## Task 2: Fix `silhouettes.ts` — cylinder caps

**Files:**
- Modify: `app/data/silhouettes.ts`

Context: `THREE.LatheGeometry` closes top and bottom faces only when the first and last profile points lie on the Y axis (x=0). The current cylinder profile has only the outer edge — two points at x=1 — producing an open tube. Adding axis endpoints (x=0) at top and bottom creates proper caps. Cone and sphere profiles already have axis endpoints and are not changed.

- [ ] **Step 1: Update the cylinder profile**

In `app/data/silhouettes.ts`, replace the `cylinder` entry:

```ts
cylinder: [
  new THREE.Vector2(0, 1.5),    // top center — closes top cap
  new THREE.Vector2(1, 1.5),    // top edge
  new THREE.Vector2(1, -1.5),   // bottom edge
  new THREE.Vector2(0, -1.5),   // bottom center — closes bottom cap
],
```

Do NOT change the `cone` or `sphere` entries.

- [ ] **Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/data/silhouettes.ts
git commit -m "fix: add axis endpoints to cylinder silhouette to close LatheGeometry caps"
```

---

## Task 3: Update `RotationScene.tsx` — wireframe overlay + axis point light

**Files:**
- Modify: `app/components/RotationScene.tsx`

Context: Mode A renders solids with a faint gray wireframe overlay (`wireframeMaterial`, already exported from `materials.ts`). The rotation solid has none. Additionally, no scene light activates when rotation completes — the materialised solid lacks the lighting quality of Mode A. The fix: add a wireframe mesh sibling to the solid mesh, and add a `<pointLight>` that GSAP-tweens from intensity 0 to 0.6 when `rotationComplete` fires.

The `wireframeMaterial` import needs to be added alongside the existing material imports.

- [ ] **Step 1: Update `RotationScene.tsx`**

Replace the full file content:

```tsx
import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import * as THREE from "three";
import { SILHOUETTES } from "~/data/silhouettes";
import { rotationMaterial, silhouetteMaterial, axisLineMaterial, wireframeMaterial } from "~/data/materials";
import type { SolidId } from "~/types";

interface RotationSceneProps {
  solidId: SolidId;
  angle: number;
  rotationComplete: boolean;
  geometry: THREE.BufferGeometry | null;
}

export function RotationScene({ solidId, angle, rotationComplete, geometry }: RotationSceneProps) {
  const silhouetteRef = useRef<THREE.Line>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const axisGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.8, 0),
      new THREE.Vector3(0, 1.8, 0),
    ]);
    return geo;
  }, []);

  const axisLine = useMemo(() => new THREE.Line(axisGeometry, axisLineMaterial), [axisGeometry]);

  const silhouetteGeometry = useMemo(() => {
    if (solidId === "cube") return null;
    const points = SILHOUETTES[solidId];
    if (!points) return null;
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((v) => new THREE.Vector3(v.x, v.y, 0)),
    );
    return geo;
  }, [solidId]);

  const silhouetteLine = useMemo(() => {
    if (!silhouetteGeometry) return null;
    return new THREE.Line(silhouetteGeometry, silhouetteMaterial);
  }, [silhouetteGeometry]);

  useFrame(() => {
    if (!rotationComplete) {
      rotationMaterial.opacity = (angle / 360) * 0.85;
    }
  });

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

  if (solidId === "cube") return null;

  return (
    <group>
      <primitive object={axisLine} />
      {silhouetteLine && (
        <primitive ref={silhouetteRef} object={silhouetteLine} />
      )}
      {geometry && (
        <>
          <mesh geometry={geometry} material={rotationMaterial} />
          <mesh geometry={geometry} material={wireframeMaterial} />
        </>
      )}
      <pointLight ref={lightRef} position={[2, 1, 2]} intensity={0} color={0xede8e0} />
    </group>
  );
}
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/RotationScene.tsx
git commit -m "fix: add wireframe overlay and axis point light to RotationScene"
```

---

## Task 4: Update `home.tsx` — RESET dispatch + button spacing

**Files:**
- Modify: `app/routes/home.tsx`

Context: Two independent fixes in the same file. (1) The RESET button only calls `reset()` from `useSolidRotation` — it never dispatches `RESET_ROTATION` to the reducer, so `state.rotationComplete` stays `true` and the rotation label persists after reset. (2) When rotation is complete, the button (`bottom: 80`) and ShapeLabel (`bottom: 68`) occupy overlapping vertical space. Raising the button to `bottom: 128` when `rotationComplete` is true creates clear separation.

- [ ] **Step 1: Fix the RESET button onClick handler**

In `app/routes/home.tsx`, replace the button `onClick`:

```tsx
// Before
onClick={() => (state.rotationComplete ? reset() : start())}

// After
onClick={() => {
  if (state.rotationComplete) {
    reset();
    dispatch({ type: "RESET_ROTATION" });
  } else {
    start();
  }
}}
```

- [ ] **Step 2: Fix button bottom position**

In the same file, replace the button wrapper div's `bottom` value:

```tsx
// Before
<div
  style={{
    position: "absolute",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)",
  }}
>

// After
<div
  style={{
    position: "absolute",
    bottom: state.rotationComplete ? 128 : 80,
    left: "50%",
    transform: "translateX(-50%)",
  }}
>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`

Expected: All tests pass (reducer tests for `RESET_ROTATION` already exist and should remain green).

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add app/routes/home.tsx
git commit -m "fix: dispatch RESET_ROTATION on reset; fix button/label overlap in rotation mode"
```

---

## Task 5: Smoke test

**Files:** None — verification only.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify connection sentence**

- Complete Mode A with a cone (drag plane to find 2 distinct shapes)
- Switch to Rotation mode and complete the sweep
- Expected: "That cross section — it's the shape you started with." fades in beneath the rotation label in Fraunces italic amber, auto-fades after 4s
- Repeat starting from Rotation mode first — sentence should still fire when Mode A completes second

- [ ] **Step 3: Verify no sentence on Mode A classification**

- Start fresh, drag the cone cutting plane to reveal "circle"
- Expected: shape label "circle" appears — NO sentence beneath it
- Drag to reveal "ellipse" — same: label only, no sentence

- [ ] **Step 4: Verify cube never fires**

- Select cube, complete Mode A, attempt Rotation (disabled)
- Expected: connection sentence never appears

- [ ] **Step 5: Verify cylinder caps**

- Select cylinder, switch to Rotation mode, press ROTATE →
- Expected: solid materialises as a proper cylinder with flat top and bottom caps — not an open tube

- [ ] **Step 6: Verify wireframe overlay**

- After rotation completes on any solid (cone, cylinder, sphere)
- Expected: faint gray wireframe visible over the dark solid, matching Mode A visual quality

- [ ] **Step 7: Verify RESET clears label**

- Complete a rotation sweep — label appears (e.g. "cone")
- Press RESET
- Expected: label disappears, button returns to "ROTATE →", button sits lower (bottom: 80)

- [ ] **Step 8: Verify button/label spacing**

- Complete a rotation sweep
- Expected: rotation label visible above a clear gap above the "RESET" button — no overlap
