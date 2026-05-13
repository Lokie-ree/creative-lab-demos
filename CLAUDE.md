# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server at http://localhost:5173
pnpm build        # production build (SPA, outputs build/client and build/server)
pnpm start        # serve the production build
pnpm typecheck    # react-router typegen + tsc
pnpm test         # vitest (all tests)
pnpm test app/utils/classifyShape.test.ts   # run a single test file
pnpm test app/hooks/useDemoReducer.test.ts  # run reducer tests
```

No lint script is configured — TypeScript is the only static check.

## Stack

- **React Router v7** (SPA mode, `ssr: false`) — Three.js and R3F are browser-only and crash Node, so SSR is explicitly disabled in `react-router.config.ts`.
- **React Three Fiber + Three.js** for 3D rendering, **@react-three/csg** for boolean geometry, **@react-three/rapier** for physics.
- **GSAP** for animation (camera tweens, material opacity, plane transitions).
- **Tailwind CSS v4** (Vite plugin).
- **Vitest** (node environment, `~` alias mapped to `./app`).

## Architecture

The app is a single route (`/`) that hosts the **Cross-Section Explorer** — an interactive 3D geometry tool with two modes:

- **Cross-section mode**: drag a cutting plane through a solid; the 2D section face is classified and labeled.
- **Rotation mode**: animate a 2D silhouette revolving into a 3D solid.

### State

All UI and interaction state lives in one `useReducer` in `app/hooks/useDemoReducer.ts`. Key state slices:

| Slice | Purpose |
|---|---|
| `mode` / `solidId` | navigation |
| `csgGeometry` | cloned CSG result passed into the classifier |
| `planeInteracted` | gates label reveal until first meaningful drag |
| `distinctShapes` | tracks unique section keys per solid; completion fires after 2 |
| `rotationAngle` / `rotationComplete` | rotation animation progress |
| `completedModes` | which `"solid-mode"` combos are done; drives connection sentence |
| `physicsMode` | Rapier physics active |

`SET_SOLID` and `SET_MODE` both reset physics. Connection sentence requires both `solid-crossSection` and `solid-rotation` complete for the same (non-cube) solid.

### Component topology

```
Home (routes/home.tsx)
├── ModeBar           — mode switch + physics toggle
├── SolidScene        — R3F Canvas
│   ├── CuttingGeometry  (crossSection mode)
│   │   └── JoystickGizmo  — pointer drag → plane height + tilt
│   ├── RotationScene    (rotation mode)
│   └── PhysicsSolid     (lazy-loaded, both modes)
├── ShapeLabel        — overlay label + connection sentence
└── SolidSelector     — cone / cylinder / cube / sphere switcher
```

### Classification pipeline (cross-section mode)

`JoystickGizmo` → emits CSG geometry → `Home` dispatches `SET_CSG_GEOMETRY` → `useShapeClassifier` runs `classifyShape` (in `app/utils/classifyShape.ts`) → dispatches `REVEAL_LABEL`.

`classifyShape` pipeline: vertex deduplication → 2D projection → convex hull → near-collinear cleanup → bounding-box aspect analysis → solid-specific invariant gates. It is designed to absorb CSG triangulation noise; its test file (`classifyShape.test.ts`) captures real artifact cases.

### Shared data modules

- `app/data/materials.ts` — shared Three material **instances** (mutated for animation, not re-created).
- `app/data/silhouettes.ts` — lathe profile point sets for each solid.
- `app/data/segments.ts` — device-adaptive mesh segment counts via `(pointer: coarse)` media query.
- `app/tokens.ts` — design tokens for both CSS (`oklch`) and Three.js (`0x…`) color values.
- `app/types.ts` — `SolidId` and `ModeId` unions.

### Styling

Global CSS variables are defined in `app/app.css` (referencing `tokens.ts` values). All colors in components use `var(--color-*)`. Responsive breakpoints: ≤360 px hides physics label; ≤520 px converts solid selector to 2×2 grid.

## Known gaps vs. spec

The `demos/cross-section-explorer/` folder contains the original PRD, UX spec, and `ARCHITECTURE.md`. The architecture doc's **Known Gaps** section lists intentional and temporary deviations from the spec — read it before modifying completion thresholds, connection copy, or camera defaults.
