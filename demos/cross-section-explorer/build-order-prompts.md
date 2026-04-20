# Cross-Section Explorer — Build Order Prompts

**Pipeline step:** 3 of 3  
**Input:** PRD v2 + UX Spec  
**For use with:** Claude Code  
**Rule:** Complete each round fully. Run `npm run build` — zero TypeScript errors before proceeding.

---

## Before Starting

The project is already scaffolded as a React Router 7 framework app with Tailwind CSS v4 and TypeScript. Install the 3D stack:

```bash
npm install @react-three/fiber @react-three/drei @react-three/csg @react-three/rapier three gsap
```

Place `PRD_v2.md` and `UX_SPEC.md` in the repo root. Reference them throughout.

---

## Round 1 — Scaffold, Tokens, Four Solids Rendering

**Context:** First runnable state. No interaction yet. Establishes dark palette, material system, camera, and all four solids rendering correctly.

**Files to create:**

- `app/tokens.ts`
- `app/data/materials.ts`
- `app/components/SolidScene.tsx`
- `app/components/SolidSelector.tsx`
- `app/components/ModeBar.tsx`
- `app/r3f.d.ts`

**Files to update:**

- `app/routes/home.tsx` — replace the Welcome redirect with CrossSectionExplorer (this is the React Router 7 route, equivalent to App.tsx in a plain Vite setup)
- `app/app.css` — already exists with Tailwind imports; add any additional global resets needed

**Requirements:**

`app/tokens.ts`:

```ts
export const tokens = {
  color: {
    ground: "oklch(12% 0.015 75)",
    surface: "oklch(17% 0.018 75)",
    surfaceHi: "oklch(22% 0.018 75)",
    ink: "oklch(92% 0.010 80)",
    muted: "oklch(55% 0.012 75)",
    rule: "oklch(28% 0.014 75)",
    amber: "oklch(72% 0.16 78)",
    amberDim: "oklch(55% 0.12 78)",
  },
  three: {
    ground: 0x1a1612,
    surface: 0x232018,
    ink: 0xede8e0,
    muted: 0x7a7268,
    amber: 0xd4962a,
    amberDim: 0x8a6018,
  },
};
```

`app/data/materials.ts`:
Define all shared material instances exactly as specified in UX_SPEC.md § Materials.
Export: `solidMaterial`, `wireframeMaterial`, `sectionMaterial`, `silhouetteMaterial`, `axisLineMaterial`.
All created once at module level — never recreated inside components.

`app/components/SolidScene.tsx`:

- `<Canvas>` with `dpr={[1, 2]}`, `camera={{ position: [0, 2, 7], fov: 45 }}`
- `<OrbitControls>` with exact settings from UX_SPEC.md § Camera
- Three lights as specified in UX_SPEC.md § Lighting
- Renders the active solid geometry based on `solidId` prop
- Four geometries in `useMemo`: cone (open, 64 radial), cylinder (open, 64), cube, sphere (64×32)
- Each solid: `<mesh>` with `solidMaterial` + separate `<mesh>` with `wireframeMaterial`
- No cutting plane yet

`app/components/ModeBar.tsx`:
HTML overlay, not in Canvas. Mode toggle (CROSS SECTION | ROTATION) + physics button placeholder (disabled for now, renders but does nothing). Exact styles from UX_SPEC.md § HTML chrome.

`app/components/SolidSelector.tsx`:
Four pills: CONE, CYLINDER, CUBE, SPHERE. Active state: amber left border. Calls `onSolidChange` prop. Exact styles from UX_SPEC.md § HTML chrome.

`app/routes/home.tsx`:

```tsx
const [solidId, setSolidId] = useState<SolidId>("cone");
const [mode, setMode] = useState<ModeId>("crossSection");
// Layout: ModeBar top, SolidScene middle (fills remaining height), SolidSelector bottom
// Canvas height: calc(100dvh - 100px)
```

`app/r3f.d.ts`:

```ts
import { type ThreeElement } from "@react-three/fiber";
import type { Line } from "three";
declare module "@react-three/fiber" {
  interface ThreeElements {
    line_: ThreeElement<typeof Line>;
  }
}
```

**Completion check:** `npm run build` passes. All four solids visible in browser. Switching solid selector changes the mesh. Dark palette correct.

---

## Round 2 — CSG Cutting Plane (Cone Only)

**Context:** The critical validation round. Implements the full CSG pipeline for the cone. The hexagon validation gate is in Round 3 — this round's gate is: does the amber cross-section face appear and update in real time as the plane moves?

**Files to create:**

- `app/components/CuttingGeometry.tsx`

**Files to update:**

- `app/routes/home.tsx` — add cutting plane state, pass to SolidScene
- `app/components/SolidScene.tsx` — render CuttingGeometry when mode === 'crossSection'

**Requirements:**

`app/components/CuttingGeometry.tsx`:

```tsx
import { Geometry, Base, Subtraction } from "@react-three/csg";
import { PivotControls } from "@react-three/drei";
import { useRef } from "react";
import {
  solidMaterial,
  sectionMaterial,
  wireframeMaterial,
} from "~/data/materials";

interface CuttingGeometryProps {
  solidGeometry: THREE.BufferGeometry;
  onShapeChange?: (geometryResult: THREE.BufferGeometry) => void;
}

export function CuttingGeometry({
  solidGeometry,
  onShapeChange,
}: CuttingGeometryProps) {
  const csg = useRef();

  const handleDrag = () => {
    csg.current?.update();
    // After update, call onShapeChange with the new geometry for classification
    // csg.current.geometry is the result — pass to useShapeClassifier in Round 3
  };

  return (
    <mesh>
      <Geometry ref={csg} useGroups computeVertexNormals>
        <Base geometry={solidGeometry}>
          {/* Group 0 — solid surface */}
          <meshStandardMaterial {...solidMaterial} />
        </Base>
        <PivotControls
          depthTest={false}
          anchor={[0, 0, 0]}
          activeAxes={[false, true, false]} // Y-axis drag only for now
          onDrag={handleDrag}
        >
          <Subtraction position={[0, 5, 0]}>
            {/* Large box used as upper half-space cutter */}
            {/* Position [0,5,0] means the cutting plane starts at y=0 of the solid */}
            <boxGeometry args={[10, 10, 10]} />
            {/* Group 1 — cross section face (amber) */}
            <meshStandardMaterial {...sectionMaterial} />
          </Subtraction>
        </PivotControls>
      </Geometry>

      {/* Wireframe overlay — always visible */}
      <mesh geometry={solidGeometry}>
        <meshBasicMaterial {...wireframeMaterial} />
      </mesh>
    </mesh>
  );
}
```

**PivotControls configuration note:** The subtraction box starts at [0, 5, 0] — positioned so the bottom face of the box aligns with the world origin (y=0), cutting the solid exactly in half on load. The student drags the pivot down to reveal more cross section, up to reveal less. `activeAxes={[false, true, false]}` restricts drag to Y axis only in this round (tilt comes in Round 3).

**Completion check:** `npm run build` passes. Cone renders with amber cross-section face at mid-solid on load. Dragging the plane up/down changes the circle size visibly. The face illuminates correctly with the amber point light.

---

## Round 3 — Shape Classification, All Four Solids, Tilt, Labels, Pulse

**Context:** Completes Mode A. All four solids functional. Tilt handle enabled. Shape labels appear after meaningful interaction. **Hexagon validation gate.**

**Files to create:**

- `app/hooks/useShapeClassifier.ts`
- `app/components/ShapeLabel.tsx`
- `app/data/silhouettes.ts` (stub — full content in Round 4)

**Files to update:**

- `app/components/CuttingGeometry.tsx` — enable full PivotControls (Y + rotation), add pulse
- `app/components/SolidScene.tsx` — switch solid geometry based on solidId
- `app/routes/home.tsx` — add label state, wire ShapeLabel

**Requirements:**

`app/hooks/useShapeClassifier.ts`:

```ts
// Derives shape label from CSG result geometry
// Strategy: examine bounding box aspect ratio + vertex count of cross-section face
// Circle: aspect ratio ≈ 1:1, many vertices (>20)
// Ellipse: aspect ratio ≠ 1:1, many vertices (>20)
// Triangle: 3 vertices
// Rectangle/Square: 4 vertices, check aspect ratio for square vs rect
// Hexagon: 6 vertices
// Parabola: many vertices, bounding box taller than wide, open at bottom
// Point: bounding box near-zero

interface ClassifyResult {
  label: string;
  key: string; // e.g. 'cone-circle', 'cube-hexagon'
}

export function useShapeClassifier(
  csgGeometry: THREE.BufferGeometry | null,
  solidId: SolidId,
  planeInteracted: boolean,
): ClassifyResult | null;
```

Implementation approach: After `csg.current.update()`, access the geometry groups. Group 1 (the cross-section face) has its own vertex range. Compute bounding box of those vertices. Count distinct vertex positions. Map to label string using the CROSS_SECTION_LABELS map from PRD_v2.md § Copy Spec.

`app/components/CuttingGeometry.tsx` — updates:

1. Enable full `PivotControls` (remove `activeAxes` restriction — allow Y drag AND X rotation for tilt)
2. Add drag handle pulse: after component mounts, `gsap.to(dragHandleMeshRef.current.scale, { x: 1.06, duration: 1, repeat: -1, yoyo: true, ease: 'sine.inOut' })`. Kill the tween on first drag: `gsap.killTweensOf(dragHandleMeshRef.current.scale)`.
3. Track `hasInteracted` state — only set to true after drag delta > 0.05 units. Pass to `useShapeClassifier` as `planeInteracted`.

`app/components/ShapeLabel.tsx`:
HTML overlay. Positioned absolute, bottom 68px, full width, centered.
Renders the shape label in Fraunces italic amber (see UX_SPEC.md § HTML chrome).
Also renders the connection moment sentence when `connectionVisible` prop is true.
GSAP entrance animation on label change: `fromTo { opacity: 0, y: 10 } → { opacity: 1, y: 0 }, 0.4s`.
Auto-dismiss connection moment after 4s.

`app/components/SolidScene.tsx` — updates:
Switch active geometry based on `solidId` prop. Pass correct geometry to `CuttingGeometry`.
On `solidId` change: reset cutting plane to mid-solid position.

**HEXAGON VALIDATION GATE:**
Before proceeding to Round 4, manually verify:

1. Select CUBE
2. Drag the cutting plane to mid-solid (y ≈ 0)
3. Rotate the cutting plane (tilt) to approximately 45° on the X axis
4. Confirm a hexagon appears as the cross-section face
5. Confirm `useShapeClassifier` returns `{ label: 'hexagon', key: 'cube-hexagon' }`
6. Confirm the label "hexagon" appears below the canvas

**Do not proceed to Round 4 until the hexagon is confirmed.**

**Completion check:** `npm run build` passes. All four solids functional in Mode A. Shape labels appear after interaction. Hexagon validated.

---

## Round 4 — Rotation Mode (Mode B)

**Context:** Implements Mode B — silhouette + LatheGeometry builder + auto-rotate + connection moment.

**Files to create:**

- `app/components/RotationScene.tsx`
- `app/hooks/useSolidRotation.ts`
- `app/data/silhouettes.ts` (complete — replace stub from Round 3)

**Files to update:**

- `app/routes/home.tsx` — rotation state, ROTATE/RESET button, connection logic
- `app/components/ModeBar.tsx` — cube disables Mode B
- `app/components/ShapeLabel.tsx` — connection moment trigger

**Requirements:**

`app/data/silhouettes.ts`:

```ts
import * as THREE from "three";
// Vector2 arrays for LatheGeometry — right-hand profile only (x ≥ 0)
// Y range: [-1.5, 1.5] to match solid height
export const SILHOUETTES: Record<Exclude<SolidId, "cube">, THREE.Vector2[]> = {
  cone: [
    new THREE.Vector2(0, 1.5), // apex
    new THREE.Vector2(1.2, -1.5), // base edge
    new THREE.Vector2(0, -1.5), // base center
  ],
  cylinder: [new THREE.Vector2(1, 1.5), new THREE.Vector2(1, -1.5)],
  sphere: [
    // Semicircle — 16 points from top to bottom
    ...Array.from({ length: 17 }, (_, i) => {
      const angle = (i / 16) * Math.PI;
      return new THREE.Vector2(Math.sin(angle) * 1.3, Math.cos(angle) * 1.3);
    }),
  ],
};
```

`app/hooks/useSolidRotation.ts`:

```ts
// Manages rotation animation and LatheGeometry construction
export function useSolidRotation(solidId: SolidId, onComplete: () => void) {
  const [angle, setAngle] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const start = () => {
    setIsRotating(true);
    gsap.to(
      { val: 0 },
      {
        val: 360,
        duration: 1.8,
        ease: "power2.inOut", // single ease — power2.inOut handles the landing naturally
        onUpdate: function () {
          setAngle(this.targets()[0].val);
        },
        onComplete: () => {
          setIsRotating(false);
          onComplete();
        },
      },
    );
  };

  const reset = () => {
    gsap.killTweensOf({ val: angle });
    setAngle(0);
    setIsRotating(false);
  };

  const geometry = useMemo(() => {
    if (solidId === "cube" || !SILHOUETTES[solidId]) return null;
    const segments = Math.max(3, Math.round((angle / 360) * 64));
    return new THREE.LatheGeometry(
      SILHOUETTES[solidId],
      segments,
      0,
      (angle * Math.PI) / 180,
    );
  }, [solidId, Math.round(angle / 5)]); // bucket to 5° for performance

  return { angle, isRotating, geometry, start, reset };
}
```

`app/components/RotationScene.tsx`:

- Renders axis line (vertical, amber, from [0,-1.8,0] to [0,1.8,0])
- Renders silhouette as `line_` geometry (right-hand profile, using `silhouetteMaterial`)
- Renders LatheGeometry mesh with opacity = `(angle / 360) * 0.85` (materializes as rotation progresses)
- At angle = 360: silhouette fades out (GSAP opacity 0, 0.4s), solid fades to full opacity
- ROTATE → button appears below canvas (HTML overlay, not in Canvas)

`app/components/ModeBar.tsx` — updates:
When `solidId === 'cube'`, ROTATION segment is `pointer-events: none`, opacity 0.4.
Add tooltip/label below: "Not a solid of revolution" in 11px muted text, visible only when cube is selected.

`app/routes/home.tsx` — connection logic:

```ts
// After rotation completes:
dispatch({
  type: "MARK_MODE_COMPLETE",
  payload: { solidId, mode: "rotation" },
});

// After meaningful Mode A interaction:
dispatch({
  type: "MARK_MODE_COMPLETE",
  payload: { solidId, mode: "crossSection" },
});
```

**Completion check:** `npm run build` passes. Mode B shows silhouette + axis. ROTATE button triggers sweep. Cone → cone label appears. Connection moment fires after completing both modes with same solid. Cube shows disabled Mode B with copy.

---

## Round 5 — Rapier Physics Mode

**Context:** The tech flex. Lazy-loaded — zero cost until activated.

**Files to create:**

- `app/components/PhysicsSolid.tsx`

**Files to update:**

- `app/routes/home.tsx` — physics toggle state, lazy-load Physics
- `app/components/ModeBar.tsx` — activate physics button
- `app/components/SolidScene.tsx` — conditional Physics wrapper

**Requirements:**

`app/components/PhysicsSolid.tsx`:

```tsx
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";

interface PhysicsSolidProps {
  solidGeometry: THREE.BufferGeometry;
  active: boolean;
  onImpact: () => void;
}

export function PhysicsSolid({
  solidGeometry,
  active,
  onImpact,
}: PhysicsSolidProps) {
  const rigidBodyRef = useRef();

  const handleClick = () => {
    if (!active) return;
    rigidBodyRef.current?.applyImpulse(
      { x: (Math.random() - 0.5) * 4, y: 10, z: (Math.random() - 0.5) * 4 },
      true,
    );
  };

  return (
    <Physics gravity={[0, -9.81, 0]}>
      <Suspense fallback={null}>
        <RigidBody
          ref={rigidBodyRef}
          type={active ? "dynamic" : "fixed"}
          colliders="hull"
          restitution={0.6}
          onContactForce={({ totalForce }) => {
            if (totalForce.y > 15) onImpact();
          }}
        >
          <mesh geometry={solidGeometry} onClick={handleClick}>
            <meshStandardMaterial {...solidMaterial} />
          </mesh>
        </RigidBody>
        <CuboidCollider position={[0, -3, 0]} args={[20, 0.5, 20]} />
      </Suspense>
    </Physics>
  );
}
```

Lazy load in `app/components/SolidScene.tsx`:

```tsx
const PhysicsSolid = React.lazy(() =>
  import("./PhysicsSolid").then((m) => ({ default: m.PhysicsSolid })),
);
```

`onImpact` callback in `app/routes/home.tsx`: trigger a GSAP flash on the cutting plane overlay div — `gsap.fromTo(planeOverlayRef.current, { opacity: 0 }, { opacity: 0.4, duration: 0.1, yoyo: true, repeat: 1 })`.

When physics is active: cutting plane is hidden (`display: none`), OrbitControls disabled, cutting plane UI hidden.

**Completion check:** `npm run build` passes. Physics toggle activates simulation. Tapping/clicking solid launches it. Floor collision works. Deactivating physics restores cutting plane.

---

## Round 6 — Polish, Mobile, Reduced Motion

**Context:** Final quality pass. No new features.

**Requirements:**

GSAP camera reset on solid change:

```ts
// In app/hooks/useCameraReset.ts
export function useCameraReset(solidId: SolidId, camera: THREE.Camera) {
  const targetPos = useMemo(() => new THREE.Vector3(0, 2, 7), []);
  useEffect(() => {
    gsap.to(camera.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 0.6,
      ease: "power2.inOut",
      onUpdate: () => camera.lookAt(0, 0, 0),
    });
  }, [solidId]);
}
```

Reduced motion support:

```ts
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
// If true:
//   - Skip auto-rotate animation (show completed solid immediately at 360°)
//   - Skip entrance animations (set opacity to target directly)
//   - Keep all interactions — only remove time-based animations
```

Mobile segment reduction:

```ts
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const SEGMENTS = isTouchDevice
  ? { cone: 32, cylinder: 32, sphere: [32, 16] }
  : { cone: 64, cylinder: 64, sphere: [64, 32] };
```

Mobile layout (≤520px):

- Solid selector: CSS grid 2×2, height 88px
- Canvas height: `calc(100dvh - 136px)`
- Physics button: hidden at ≤360px

Performance audit — verify:

- No `new THREE.Vector3()` or similar inside `useFrame`
- No geometry recreation on re-render (all in `useMemo`)
- CSG `update()` not called in `useFrame`
- GSAP tweens killed before starting new ones on the same target

**Completion check:** `npm run build` passes. Chrome DevTools mobile emulation works at 375px and 390px. No console errors. Lighthouse performance score ≥ 70 (canvas-heavy experiences are expected to score lower than text pages).

---

## Round 7 — Export and Deploy

**Context:** Package as standalone deploy and as importable portfolio component.

**Requirements:**

`app/root.tsx` — font preconnects are already present in the existing scaffold; verify they include:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

`vite.config.ts` — manual chunk splitting:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'three': ['three'],
        'r3f': ['@react-three/fiber', '@react-three/drei', '@react-three/csg'],
        'rapier': ['@react-three/rapier'],
        'gsap': ['gsap'],
      }
    }
  }
}
```

`app/CrossSectionExplorerExport.tsx`:

```tsx
// Clean export for portfolio embedding
export { CrossSectionExplorer } from "~/components/CrossSectionExplorer";
```

Portfolio integration (`portfolio/src/components/DemoInteractive.tsx`):

```tsx
const CrossSectionExplorer = React.lazy(() =>
  import("cross-section-explorer/CrossSectionExplorerExport").then((m) => ({
    default: m.CrossSectionExplorer,
  })),
);

export function DemoInteractive() {
  return (
    <Suspense
      fallback={
        <div style={{ height: 600, background: "var(--color-surface)" }} />
      }
    >
      <CrossSectionExplorer />
    </Suspense>
  );
}
```

Deploy standalone to Vercel. Project name: `cross-section-explorer`.
Generate QR code pointing to the Vercel URL.

**Final check before deploy:**

- Open on a real phone. Hand it to someone who doesn't know what it is. Watch where they touch first.
- If they touch the solid and try to orbit it before touching the cutting plane: the pulse affordance needs strengthening.
- If they touch the cutting plane immediately: the affordance is working.

**Completion check:** Standalone Vercel deploy live. QR code generated. Portfolio Live Demo section shows the experience with no loading flash. `npm run build` in the portfolio repo passes.

---

## Integration Points

| Round | Previous dependency       | Next dependency                                               |
| ----- | ------------------------- | ------------------------------------------------------------- |
| 1     | None                      | Round 2 needs `SolidScene` accepting `solidId` prop           |
| 2     | Round 1 complete          | Round 3 needs `onShapeChange` callback from `CuttingGeometry` |
| 3     | Round 2 hexagon validated | Round 4 needs `MARK_MODE_COMPLETE` action in reducer          |
| 4     | Round 3 complete          | Round 5 needs `SolidScene` conditional Physics wrapper        |
| 5     | Round 4 complete          | Round 6 needs all components stable                           |
| 6     | Round 5 complete          | Round 7 needs clean build                                     |
| 7     | Round 6 complete          | Portfolio needs `DemoInteractive.tsx`                         |

## NOT DOING (scope boundary)

- No multiple simultaneous cutting planes
- No saving/exporting cross-section shapes
- No step-by-step instructional mode (this is a demo, not a module)
- No surface area calculations from cross sections (future module)
- No Cavalieri's principle visualization (future G-GMD.A.1 module)
- No AR/VR mode
- No dark/light toggle — dark is the design
- No analytics until after ISTE
