import { describe, test, expect } from "vitest";
import * as THREE from "three";
import { classifyShape } from "./classifyShape";

// ─── helpers ────────────────────────────────────────────────────────────────

function circle3D(r: number, n: number, plane: "xz" | "xy" | "yz" = "xz"): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    if (plane === "xz") return new THREE.Vector3(r * Math.cos(t), 0, r * Math.sin(t));
    if (plane === "xy") return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), 0);
    return new THREE.Vector3(0, r * Math.cos(t), r * Math.sin(t));
  });
}

/** Circle lying in a plane tilted θ radians around the X axis */
function tiltedCircle(r: number, n: number, theta: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    // e1 = (1,0,0), e2 = (0, cos θ, sin θ)  →  both in the tilted plane
    return new THREE.Vector3(
      r * Math.cos(t),
      r * Math.sin(t) * Math.cos(theta),
      r * Math.sin(t) * Math.sin(theta),
    );
  });
}

/**
 * Cylinder cross-section: a cylinder of radius r aligned along Y, cut by a
 * plane tilted θ from horizontal (rotated around X). The cross-section is an
 * ellipse with semi-axes r (along X) and r/cos(θ) (in the cut plane along Y/Z).
 */
function cylinderCrossSection(r: number, n: number, theta: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const phi = (i / n) * Math.PI * 2;
    return new THREE.Vector3(
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.tan(theta),
      r * Math.sin(phi),
    );
  });
}

/** Ellipse in the XZ plane */
function ellipseXZ(a: number, b: number, n: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return new THREE.Vector3(a * Math.cos(t), 0, b * Math.sin(t));
  });
}

/** Ellipse in a tilted plane (tilted θ around X axis) */
function tiltedEllipse(a: number, b: number, n: number, theta: number): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return new THREE.Vector3(
      a * Math.cos(t),
      b * Math.sin(t) * Math.cos(theta),
      b * Math.sin(t) * Math.sin(theta),
    );
  });
}

// Hexagon vertices for body-diagonal cut of cube (2.2 × 2.2 × 2.2)
const HEX_VERTS = [
  new THREE.Vector3(0, 1.1, -1.1),
  new THREE.Vector3(0, -1.1, 1.1),
  new THREE.Vector3(1.1, 0, -1.1),
  new THREE.Vector3(-1.1, 0, 1.1),
  new THREE.Vector3(1.1, -1.1, 0),
  new THREE.Vector3(-1.1, 1.1, 0),
];

// ─── cube ────────────────────────────────────────────────────────────────────

describe("cube", () => {
  test("horizontal mid-cut → square", () => {
    const verts = [
      new THREE.Vector3(1.1, 0, 1.1),
      new THREE.Vector3(1.1, 0, -1.1),
      new THREE.Vector3(-1.1, 0, -1.1),
      new THREE.Vector3(-1.1, 0, 1.1),
    ];
    expect(classifyShape(verts, "cube")).toBe("square");
  });

  test("vertical cut (2.2 × 2.2 face) → square", () => {
    const verts = [
      new THREE.Vector3(1.1, 1.1, 0),
      new THREE.Vector3(1.1, -1.1, 0),
      new THREE.Vector3(-1.1, -1.1, 0),
      new THREE.Vector3(-1.1, 1.1, 0),
    ];
    expect(classifyShape(verts, "cube")).toBe("square");
  });

  test("body-diagonal cut → hexagon (exact 6 verts)", () => {
    expect(classifyShape(HEX_VERTS, "cube")).toBe("hexagon");
  });

  test("body-diagonal cut with interior centroid → hexagon (CSG fan triangulation)", () => {
    const verts = [...HEX_VERTS, new THREE.Vector3(0, 0, 0)];
    expect(classifyShape(verts, "cube")).toBe("hexagon");
  });

  test("body-diagonal cut with centroid FIRST → hexagon (real CSG output order)", () => {
    // CSG prepends centroid to each triangle: centroid ends up as unique[0].
    // projectTo2D must not use verts[0] blindly.
    const verts = [new THREE.Vector3(0, 0, 0), ...HEX_VERTS];
    expect(classifyShape(verts, "cube")).toBe("hexagon");
  });

  test("body-diagonal cut with extra spurious vertices → hexagon (CSG artifact at pentagon/hexagon boundary)", () => {
    // At the transition zone, CSG sometimes produces near-coincident vertices that survive
    // deduplication, pushing hullN to 7 or 8. A cube can't have more than 6 sides.
    const extra = new THREE.Vector3(0.05, 1.05, -1.1);  // near an existing hex vert
    const verts = [...HEX_VERTS, extra];
    expect(classifyShape(verts, "cube")).toBe("hexagon");
  });

  test("5-face cut → pentagon", () => {
    // A transitional cut through 5 faces of the cube
    const verts = [
      new THREE.Vector3(1.1, 0.5, 1.1),
      new THREE.Vector3(1.1, -0.5, 1.1),
      new THREE.Vector3(-1.1, -0.5, -1.1),
      new THREE.Vector3(-1.1, 0.5, -1.1),
      new THREE.Vector3(0, 1.1, 0),
    ];
    expect(classifyShape(verts, "cube")).toBe("pentagon");
  });

  test("near-corner cut → triangle", () => {
    const verts = [
      new THREE.Vector3(0.9, 1.1, 1.1),
      new THREE.Vector3(1.1, 0.9, 1.1),
      new THREE.Vector3(1.1, 1.1, 0.9),
    ];
    expect(classifyShape(verts, "cube")).toBe("triangle");
  });

  test("hexagon with near-collinear CSG samples on one edge → hexagon (not 7-gon)", () => {
    // CSG frequently emits 2-3 nearly-collinear samples along one face-plane
    // intersection edge. A strict hullN bucketing was calling these pentagons
    // or heptagons. With cross-product tolerance the extras are removed.
    const verts = [
      new THREE.Vector3(0, 1.1, -1.1),
      new THREE.Vector3(0, -1.1, 1.1),
      new THREE.Vector3(1.1, 0, -1.1),
      new THREE.Vector3(-1.1, 0, 1.1),
      new THREE.Vector3(1.1, -1.1, 0),
      new THREE.Vector3(-1.1, 1.1, 0),
      new THREE.Vector3(1.1, -0.55, -0.55),
      new THREE.Vector3(1.1, -0.05, -1.05),
    ];
    expect(classifyShape(verts, "cube")).toBe("hexagon");
  });

  test("tilted rectangle cut (rhombus projection) → rectangle, not square", () => {
    // A 2.2-wide by 1.0-tall rectangular cut. projectTo2D anchors on a corner,
    // projecting to a rhombus. Naive bbox says "square"; min-area bbox (edge-
    // aligned) recovers true 2.2×1.0 aspect.
    const verts = [
      new THREE.Vector3(1.1, 0.5, 0),
      new THREE.Vector3(1.1, -0.5, 0),
      new THREE.Vector3(-1.1, -0.5, 0),
      new THREE.Vector3(-1.1, 0.5, 0),
    ];
    expect(classifyShape(verts, "cube")).toBe("rectangle");
  });
});

// ─── sphere ──────────────────────────────────────────────────────────────────

describe("sphere", () => {
  test("horizontal cut → circle", () => {
    expect(classifyShape(circle3D(1.0, 64), "sphere")).toBe("circle");
  });

  test("45° tilted cut → circle (not ellipse)", () => {
    // All sphere cross-sections are circles regardless of tilt
    expect(classifyShape(tiltedCircle(1.0, 64, Math.PI / 4), "sphere")).toBe("circle");
  });

  test("70° tilted cut → circle (not ellipse)", () => {
    expect(classifyShape(tiltedCircle(1.0, 64, (70 * Math.PI) / 180), "sphere")).toBe("circle");
  });
});

// ─── cylinder ────────────────────────────────────────────────────────────────

describe("cylinder", () => {
  test("horizontal cut → circle", () => {
    expect(classifyShape(circle3D(1.0, 64), "cylinder")).toBe("circle");
  });

  test("45° tilted cut → ellipse (aspect2d = √2 ≈ 1.41)", () => {
    // 45° tilt: semi-axes 1 and 1/cos(45°) = √2. aspect2d ≈ 1.41 > 1.2
    expect(classifyShape(cylinderCrossSection(1.0, 64, Math.PI / 4), "cylinder")).toBe("ellipse");
  });

  test("60° tilted cut → ellipse (aspect2d = 2.0)", () => {
    // 60° tilt: semi-axes 1 and 1/cos(60°) = 2. aspect2d = 2.0 > 1.2
    expect(classifyShape(cylinderCrossSection(1.0, 64, Math.PI / 3), "cylinder")).toBe("ellipse");
  });

  test("shallow 20° tilted cut → circle (aspect2d ≈ 1.06, visually indistinguishable)", () => {
    // 20° tilt: aspect2d = 1/cos(20°) ≈ 1.06 — below 1.2 threshold, correct
    expect(classifyShape(cylinderCrossSection(1.0, 64, (20 * Math.PI) / 180), "cylinder")).toBe("circle");
  });

  test("sparse axis-aligned cut (12–14 verts, hullN=5) → not a pentagon", () => {
    // Real CSG output for a near-vertical cylinder cut: ~12 verts, 5 hull
    // points, aspect ≈ 1.5. The 5th hull vertex is a near-collinear CSG
    // artifact; after the area-relative collinearity filter it collapses to
    // a rectangle (which is correct: an axis-aligned cylinder cut IS a
    // rectangle). Either "rectangle" (post-filter) or "ellipse" (curve
    // fallback) is acceptable — "pentagon" is the forbidden outcome.
    const verts = [
      new THREE.Vector3(-1.256, 0, -0.506),
      new THREE.Vector3(1.45, 0, -1.802),
      new THREE.Vector3(2.313, 0, 0),
      new THREE.Vector3(-0.351, 0, 1.275),
      new THREE.Vector3(-0.825, 0, 0.395),
    ];
    const label = classifyShape(verts, "cylinder");
    expect(label).not.toBe("pentagon");
    expect(["rectangle", "ellipse"]).toContain(label);
  });
});

// ─── cone ────────────────────────────────────────────────────────────────────

describe("cone", () => {
  test("horizontal cut → circle", () => {
    expect(classifyShape(circle3D(0.6, 64), "cone")).toBe("circle");
  });

  test("mildly tilted cut → ellipse (elongated in XZ)", () => {
    // Ellipse flat in the XZ plane (elongated along X)
    expect(classifyShape(ellipseXZ(1.2, 0.8, 64), "cone")).toBe("ellipse");
  });

  test("steep tilt → parabola (elongated in tilted plane, along XZ)", () => {
    // Very elongated in a tilted plane — NOT elongated in world Y
    // This should fail with the old size.y heuristic
    const verts = tiltedEllipse(2.5, 0.4, 64, Math.PI / 6);
    expect(classifyShape(verts, "cone")).toBe("parabola");
  });

  test("steep tilt → parabola (elongation along world X, not Y)", () => {
    // Elongated entirely in world X — old code checked size.y which would miss this
    const verts = ellipseXZ(3.0, 0.5, 64);
    expect(classifyShape(verts, "cone")).toBe("parabola");
  });

  test("through-apex triangle with near-collinear CSG artifact → triangle (not rectangle)", () => {
    // Real CSG capture: three true triangle corners plus 1–2 artifact samples
    // clustered near one corner (|cross|/hullArea ≈ 0.03). Fixed-scale hull
    // epsilon lets them through; the area-relative second pass drops them.
    const verts = [
      new THREE.Vector3(-0.44, 0, -0.234),
      new THREE.Vector3(-0.402, 0, -0.143),
      new THREE.Vector3(2.733, 0, 0),
      new THREE.Vector3(1.681, 0, 2.155),
    ];
    expect(classifyShape(verts, "cone")).toBe("triangle");
  });

  test("sparse near-apex hullN=4 with non-collinear extra → never rectangle/square", () => {
    // Captured from user's session: cone cross-section with 40 CSG verts,
    // hullN=4, and minCross/area=0.152 — too high for the collinearity filter
    // to drop (threshold is 0.04). Geometrically a cone cannot produce a
    // quadrilateral cross-section, so this must route to the curve branch.
    const verts = [
      new THREE.Vector3(-0.399, 0, -0.337),
      new THREE.Vector3(2.448, 0, 0),
      new THREE.Vector3(1.305, 0, 2.071),
      new THREE.Vector3(-0.119, 0, 0.362),
    ];
    const label = classifyShape(verts, "cone");
    expect(label).not.toBe("rectangle");
    expect(label).not.toBe("square");
  });

  test("near-square hullN=4 on cone → never square", () => {
    // Captured from user's session: hull resembles a square (aspect2d=1.044)
    // but it's a cone cross-section — geometrically impossible. Must route to
    // curve branch (circle/ellipse).
    const verts = [
      new THREE.Vector3(-0.233, 0, -0.389),
      new THREE.Vector3(2.323, 0, 0),
      new THREE.Vector3(1.175, 0, 2.004),
      new THREE.Vector3(-0.413, 0, 0.059),
    ];
    const label = classifyShape(verts, "cone");
    expect(label).not.toBe("rectangle");
    expect(label).not.toBe("square");
  });
});

// ─── sphere geometric invariants ─────────────────────────────────────────────

describe("sphere geometric invariants", () => {
  test("hullN=4 artifact → circle, never quadrilateral", () => {
    // Sphere cross-sections are always circles. A hullN=4 output would be a
    // sparse CSG artifact; the gate must route it to circle regardless.
    const verts = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ];
    const label = classifyShape(verts, "sphere");
    expect(label).not.toBe("rectangle");
    expect(label).not.toBe("square");
    expect(label).toBe("circle");
  });
});
