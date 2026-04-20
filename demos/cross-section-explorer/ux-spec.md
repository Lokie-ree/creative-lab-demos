# Cross-Section Explorer — UX Spec

**Pipeline step:** 2 of 3  
**Input:** PRD v2  
**Output:** 6 passes → visual specs

---

## Pass 1 — Mental Model

**What mental model does the student arrive with?**

Most students (and most ISTE visitors) have seen a 3D solid but never sliced one interactively. Their mental model of a "cross section" is a static diagram in a textbook — a shape floating next to a dotted line on a solid. The idea that the cross section _changes_ as the cut position and angle change is not intuitive. The hexagon from a cube is genuinely surprising because the mental model says "cube → square."

For Rotation Mode: students can often name what shape rotates into a cylinder (rectangle) but struggle with the cone (right triangle — not isosceles). The silhouette-to-solid connection is weak because they've only seen the finished solid, never the generating motion.

**What mental model should they leave with?**

Cross sections: _A 3D solid contains infinitely many 2D shapes — which one you see depends on how you cut it._

Rotation: _A 3D solid of revolution is what happens when a 2D boundary traces a circle in space._

Connection: _These are the same idea from opposite directions._

**Design implication:** The experience must make the _change_ vivid — the cross section must visibly transform as the plane moves. A static starting position is not enough. The first frame must show motion already in progress or make motion immediately irresistible.

**First frame decision:** Mode A loads with the cutting plane at mid-solid (y=0) and a visible cross-section face already illuminated in amber. The plane has a drag handle with a subtle GSAP pulse animation — a "touch me" signal. The student has already seen a cross section before touching anything. Their first interaction is to move it.

---

## Pass 2 — Information Architecture

**What information exists in this experience?**

```
Level 0 — Always visible
  The 3D solid
  The cutting plane (Mode A)
  The axis line + silhouette (Mode B)
  Mode toggle
  Solid selector

Level 1 — Appears after meaningful interaction
  The cross-section face (amber illumination)
  The shape label

Level 2 — Appears after completing both modes (same solid)
  The connection moment sentence

Level 3 — Available on demand
  Physics mode (toggle)
```

**Hierarchy rule:** Nothing at Level 1 appears before the student has interacted. Nothing at Level 2 appears before both modes are complete. The experience progressively reveals its own depth — the student who spends 30 seconds gets levels 0 and 1. The student who spends 3 minutes gets all four levels.

**Navigation structure:**

```
                    ┌──────────────────────┐
                    │  CrossSectionExplorer │
                    └──────────┬───────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         Mode Toggle      Solid Selector   Physics Toggle
         (persistent)     (persistent)    (persistent)
               │
       ┌───────┴────────┐
       ▼                ▼
  Mode A: Cut      Mode B: Rotate
  [CuttingGeometry] [RotationScene]
       │                │
       ▼                ▼
  Shape Label       Shape Label
       │                │
       └────────┬───────┘
                ▼
         Connection Moment
         (both complete, same solid)
```

**Solid selector is global** — changing solid while in Mode B switches both modes simultaneously. The student never loses their place in the other mode; the solid just changes.

---

## Pass 3 — Affordances

**What must the student understand from looking, before touching?**

| Element        | Affordance signal              | Implementation                                                                                                                                     |
| -------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cutting plane  | Draggable — move it up/down    | Horizontal amber line on front edge. GSAP pulse (scale 1.0→1.05→1.0, infinite, 2s period) until first drag. Stops pulsing after first interaction. |
| Tilt handle    | Rotatable — spin the cut angle | Small amber circle on the right edge of the cutting plane. Cursor changes to `grab`.                                                               |
| Solid          | Rotatable (orbit)              | OrbitControls — the solid can be examined from any angle. No affordance signal needed — this is a universal 3D convention.                         |
| Solid selector | Tappable                       | Four pills. Active state: amber left-border. No hover states on mobile (touch devices). Pointer devices: `hover:bg-surface-hi`.                    |
| Mode toggle    | Switchable                     | Two segments. Active: amber text, surface-hi bg. Inactive: muted text. Sharp edges — no border-radius.                                             |
| Rotate button  | Triggers animation             | Appears only in Mode B. Label: `ROTATE →`. Changes to `RESET` after completion.                                                                    |
| Physics toggle | Activates simulation           | `◆ PHYSICS`. Amber border when active. Small — it's a flex, not a primary affordance.                                                              |

**The pulse is the most important affordance.** A visitor who scans a QR code at ISTE and sees a dark 3D cone with an amber-pulsing line through it knows exactly what to do — without any instructions. The pulse says "this line moves." That is the entire onboarding.

**Affordance removal:** Once the student has dragged the plane, the pulse stops. Clean state. The experience trusts the student.

---

## Pass 4 — Cognitive Load

**What can be held in working memory simultaneously?**

At any moment, the student sees:

- One solid (3D, rotating)
- One cutting plane (draggable)
- One cross-section shape (illuminated)
- One shape label (or nothing)
- Mode toggle + solid selector (chrome, low attention)

That is the maximum. Nothing else is on screen simultaneously.

**Load-reducing decisions:**

1. **One solid at a time.** No side-by-side comparison. Switching solids is instant — the student builds a mental model of each before comparing.

2. **Label after interaction, not before.** If the label appeared immediately on load, the student reads "circle" and confirms it. Nothing is discovered. The label must be earned — it appears only after the plane has been meaningfully moved (moved more than 0.3 world units from start position, OR tilted more than 10°).

3. **No instructions panel.** There is no "How to use" section. If the experience requires reading before engaging, it has failed cognitive load design.

4. **Connection moment is one sentence.** Not a modal. Not a diagram. One sentence that the student reads in 2 seconds and either nods at or re-reads. It does not interrupt — it confirms.

5. **Physics mode is visually isolated.** Activating physics hides the cutting plane UI. The student cannot be in "cross section mode" and "physics mode" simultaneously. One affordance set at a time.

6. **Cube disables Rotation Mode.** The mode toggle shows `ROTATION` as disabled (muted, non-interactive) when cube is selected. A small muted label explains why: "Not a solid of revolution." This prevents the student from searching for a rotation experience that doesn't exist.

**Load source to watch:** The tilt handle adds a second dimension of interaction (y-drag AND tilt-drag). This doubles the interaction space. Mitigation: the tilt handle is visually distinct from the plane drag handle — different position, different shape. The student who only uses y-drag will still get a complete experience (circles, ellipses, triangles). Tilt is a discovery for the curious student, not a requirement.

---

## Pass 5 — State Design

**All states and transitions:**

```
INITIAL
  mode: 'crossSection'
  solidId: 'cone'
  planeY: 0 (mid-solid)
  tiltAngle: 0
  labelVisible: false
  shapeLabel: null
  physicsMode: false
  rotationAngle: 0
  rotationComplete: false
  completedModes: Set()
  connectionVisible: false

STATE TRANSITIONS — Mode A

  INITIAL → INTERACTING
    Trigger: plane drag begins (planeY delta > 0.05 OR tilt delta > 2°)
    Effect: pulse animation stops; cross-section face opacity animates to 0.85

  INTERACTING → LABEL_REVEALED
    Trigger: plane has moved > 0.3 units from start OR tilt > 10°
    Effect: useShapeClassifier runs on CSG result; shapeLabel set; labelVisible: true
    GSAP: label fades in (opacity 0→1, y: 10→0, 0.4s, power3.out)

  LABEL_REVEALED → LABEL_HIDDEN
    Trigger: solid changes OR mode changes
    Effect: GSAP label fade out (0.2s); shapeLabel: null after transition

  LABEL_REVEALED → MODE_COMPLETE
    Trigger: student has seen at least 3 distinct shape labels in this mode/solid combo
    Effect: MARK_MODE_COMPLETE dispatched; checks for connection

  ANY → PHYSICS_ACTIVE
    Trigger: physics toggle pressed
    Effect: cutting plane hidden; OrbitControls disabled; RigidBody type → 'dynamic'
    Reverse: toggle pressed again; cutting plane shown; RigidBody type → 'fixed'

STATE TRANSITIONS — Mode B

  MODE_B_ENTRY
    Trigger: mode toggle → 'rotation'
    Effect: solid fades out; silhouette fades in; axis line appears; ROTATE button appears
    GSAP: crossfade 0.4s

  ROTATING
    Trigger: ROTATE button pressed
    Effect: GSAP timeline drives rotationAngle 0→360 over 1.8s (power2.inOut first half, power2.in second half)
    LatheGeometry rebuilds every 5° bucket

  ROTATION_COMPLETE
    Trigger: rotationAngle reaches 360
    Effect: rotationComplete: true; silhouette fades out; solid fades in at full opacity; label reveals; ROTATE → RESET
    GSAP: solid material opacity 0→0.85 over 0.5s

  RESET
    Trigger: RESET button pressed
    Effect: rotationAngle → 0; rotationComplete: false; label hidden; solid fades out; silhouette fades in; RESET → ROTATE

STATE TRANSITIONS — Connection

  CONNECTION_CHECK
    Trigger: MARK_MODE_COMPLETE
    Condition: completedModes contains both `${solidId}-crossSection` AND `${solidId}-rotation`
    AND solidId !== 'cube'
    Effect: connectionVisible: true

  CONNECTION_VISIBLE → CONNECTION_HIDDEN
    Trigger: 4 seconds elapsed OR solid changes
    Effect: GSAP fade out (0.4s); connectionVisible: false

GLOBAL TRANSITIONS

  SOLID_CHANGE
    Effect: camera GSAP reset; label hidden; planeY → 0; tiltAngle → 0; rotationAngle → 0;
    rotationComplete: false; connectionVisible: false
    Mode stays unchanged

  MODE_CHANGE
    Effect: label hidden; appropriate scene fades in/out
    Solid stays unchanged — preserves student's place
```

**Error states:**

- CSG computation failure (rare): solid renders without cutting plane; no label. Silent fallback — never show an error to the visitor.
- Rapier WASM load failure: physics toggle is removed from UI silently. Student never sees a broken button.

---

## Pass 6 — Flow Integrity

**Can the student get stuck? Can they reach a dead end?**

Walk through every path:

**Path 1 — Casual visitor, 30 seconds**
Lands on Mode A, cone. Sees the cone with amber cross-section line pulsing. Drags the plane up and down. Sees "circle" appear. Sees the cross-section face change size. Taps cylinder. Sees "circle" again. Taps cube. Drags diagonally. Sees "hexagon." Says "wait, what?" Puts the phone down satisfied.
→ No dead ends. Experience is complete at this path.

**Path 2 — Curious visitor, 2 minutes**
Does Path 1. Discovers tilt handle on the cone. Sees "ellipse." Tilts further. Sees "triangle." Switches to Mode B. Watches cone silhouette rotate. Label "cone" appears. Connection moment fires: "That cross section — it's the shape you started with."
→ No dead ends. Connection moment is the reward for depth.

**Path 3 — Cube in Mode B**
Selects cube. Switches to Mode B. Mode B is disabled. Reads "Not a solid of revolution."
→ Not a dead end. Explains why, invites them to try another solid.

**Path 4 — Physics mode**
Activates ◆ PHYSICS. Taps the solid. It launches and bounces. Taps again mid-air. Deactivates physics. Cross-section plane reappears.
→ Physics mode → deactivate → cross section still there. No state corruption.

**Path 5 — Rapid solid switching**
Switches solids 4 times in 2 seconds. GSAP camera resets queue and only the last one completes. Previous CSG computations are discarded.
→ Use `gsap.killTweensOf(camera)` before each reset. Last-write-wins.

**Path 6 — Mobile, portrait, small screen**
Everything fits. Solid selector is a 4-pill row at bottom (wraps to 2×2 at ≤360px). Mode toggle is full-width. Shape label is legible at 16px minimum. Canvas fills available viewport height after chrome.
→ No content clipped. Touch targets minimum 44px.

**Flow integrity confirmation:**

- Every mode has an exit (mode toggle, solid selector)
- Every animation has a completion state
- No modal dialogs block interaction
- No "correct/incorrect" feedback — the label is neutral, always amber
- Physics mode is fully reversible
- The cube/rotation edge case is handled gracefully with copy, not an error

---

## Visual Specs

### Canvas layout

```
Viewport: full-width, height = viewport height - chrome height
Chrome height: 48px (mode bar, top) + 52px (solid selector, bottom) = 100px
Canvas height: calc(100dvh - 100px)
```

### Camera

```
Type: PerspectiveCamera
Position: [0, 2, 7]
FOV: 45
Near: 0.1, Far: 100
OrbitControls:
  enablePan: false
  minDistance: 4
  maxDistance: 12
  enableDamping: true
  dampingFactor: 0.05
  minPolarAngle: Math.PI * 0.1   (can't go below the floor)
  maxPolarAngle: Math.PI * 0.9
```

### Lighting

```
ambientLight: intensity 0.3, color #ede8e0 (warm white)
directionalLight: position [5, 8, 5], intensity 1.2, color #ede8e0, castShadow: false
pointLight: position [-3, 4, -3], intensity 0.4, color #d4962a (amber fill)
```

### Solid positioning

```
All solids: centered at world origin [0, 0, 0]
Height: 3 world units (fits in camera frustum with room for cutting plane chrome)
Cone: ConeGeometry(1.2, 3, 64, 1, true) — open-ended for interior visibility
Cylinder: CylinderGeometry(1, 1, 3, 64, 1, true)
Cube: BoxGeometry(2.2, 2.2, 2.2)
Sphere: SphereGeometry(1.3, 64, 32)
```

### Materials

```ts
// Defined once in materials.ts, imported by all components
export const solidMaterial = new THREE.MeshStandardMaterial({
  color: 0x232018,
  transparent: true,
  opacity: 0.85,
  roughness: 0.7,
  metalness: 0.1,
  side: THREE.FrontSide,
});
export const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0x7a7268,
  wireframe: true,
  transparent: true,
  opacity: 0.1,
});
export const sectionMaterial = new THREE.MeshStandardMaterial({
  color: 0xd4962a,
  transparent: true,
  opacity: 0.85,
  roughness: 0.3,
  metalness: 0.2,
  side: THREE.DoubleSide,
});
export const silhouetteMaterial = new THREE.LineBasicMaterial({
  color: 0xede8e0,
  transparent: true,
  opacity: 0.75,
});
export const axisLineMaterial = new THREE.LineBasicMaterial({
  color: 0xd4962a,
  transparent: true,
  opacity: 0.5,
});
```

### Cutting plane

```
Geometry: PlaneGeometry(4, 4)
Material: MeshBasicMaterial, color 0x7a7268, transparent, opacity 0.06, DoubleSide
Drag handle: amber line (LineBasicMaterial, color 0xd4962a, opacity 0.7) along front edge
Tilt handle: sphere Mesh(SphereGeometry(0.07), amber material) at right edge midpoint
Pulse GSAP: gsap.to(dragHandle.scale, { x: 1.06, y: 1, z: 1, duration: 1, repeat: -1, yoyo: true, ease: 'sine.inOut' })
```

### HTML chrome

```
Mode bar: height 48px, background --color-surface, border-bottom 1px --color-rule
  Mode segments: height 100%, width 50%, font 11px DM Sans, letter-spacing 0.12em, uppercase
  Active: color --color-amber, background --color-surface-hi
  Inactive: color --color-muted
  No border-radius — sharp edges

Physics button: position absolute, right 12px, height 28px, padding 0 12px
  Border: 1px solid --color-rule (inactive) / 1px solid --color-amber (active)
  Font: 11px, letter-spacing 0.08em
  Color: --color-muted (inactive) / --color-amber (active)

Solid selector: height 52px, background --color-surface, border-top 1px --color-rule
  Four pills: equal width, height 100%
  Active: 3px left border --color-amber, color --color-ink
  Inactive: color --color-muted
  Touch target: minimum 44px height (satisfied by 52px row)

Shape label: position absolute, bottom 68px (above selector), width 100%, text-align center
  Font: Fraunces, italic, font-weight 300, font-size clamp(18px, 3vw, 26px)
  Color: --color-amber
  GSAP entrance: fromTo { opacity: 0, y: 10 } → { opacity: 1, y: 0 }, 0.4s, power3.out

Connection moment: position absolute, bottom 68px (replaces shape label), width 100%, text-align center
  Font: Fraunces, italic, font-weight 300, font-size clamp(14px, 2vw, 18px)
  Color: --color-amber, opacity 0.8
  Auto-dismiss: GSAP fade out after 4s
```

### Mobile breakpoints

```
≤520px:
  Solid selector: 2×2 grid (2 columns, 2 rows), height 88px
  Canvas height: calc(100dvh - 136px)
  Solid geometry segments halved: cone 32, sphere 32×16, cylinder 32
  Mouse parallax: disabled (pointer: coarse)
  PivotControls: touch-friendly drag (drei handles this natively)

≤360px:
  Mode bar: physics button hidden (space constraint)
  Shape label font-size: 16px minimum
```
