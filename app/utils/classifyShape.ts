import * as THREE from "three";
import type { SolidId } from "~/types";

export function deduplicateVerts(
  raw: Float32Array | ArrayLike<number>,
  count: number,
  epsilon = 0.001,
): THREE.Vector3[] {
  const unique: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const x = raw[i * 3];
    const y = raw[i * 3 + 1];
    const z = raw[i * 3 + 2];
    const isDup = unique.some(
      (v) =>
        Math.abs(v.x - x) < epsilon &&
        Math.abs(v.y - y) < epsilon &&
        Math.abs(v.z - z) < epsilon,
    );
    if (!isDup) unique.push(new THREE.Vector3(x, y, z));
  }
  return unique;
}

function projectTo2D(verts: THREE.Vector3[]): { x: number; y: number }[] {
  if (verts.length < 2) return [];
  const centroid = verts
    .reduce((acc, v) => acc.add(v), new THREE.Vector3())
    .divideScalar(verts.length);

  // Use the farthest vertex from centroid as the first basis direction.
  // CSG fan-triangulation prepends the centroid vertex (distance ≈ 0) to
  // every triangle, so it ends up as unique[0]. Using verts[0] directly
  // would normalize a zero-vector → NaN, corrupting all projections.
  let farthestDist = -1;
  let anchor = verts[0];
  for (const v of verts) {
    const d = v.distanceTo(centroid);
    if (d > farthestDist) { farthestDist = d; anchor = v; }
  }

  const u = anchor.clone().sub(centroid).normalize();
  let v = new THREE.Vector3();
  for (const vert of verts) {
    if (vert === anchor) continue;
    const diff = vert.clone().sub(centroid);
    if (diff.length() < 1e-6) continue;
    const d = diff.normalize();
    if (Math.abs(d.dot(u)) < 0.99) {
      const n = u.clone().cross(d).normalize();
      v = n.clone().cross(u).normalize();
      break;
    }
  }
  return verts.map((vert) => {
    const r = vert.clone().sub(centroid);
    return { x: r.dot(u), y: r.dot(v) };
  });
}

/**
 * Convex hull with a cross-product tolerance. A strict `cross <= 0` test keeps
 * nearly-collinear CSG triangulation points whose cross is +1e-4 (FP noise)
 * and drops them in the other direction — producing asymmetric, inflated hulls.
 * Using a relative tolerance reliably removes straight-edge samples.
 */
function convexHull2D(
  pts: { x: number; y: number }[],
  epsilon = 0,
): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o: (typeof pts)[0], a: (typeof pts)[0], b: (typeof pts)[0]) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof pts = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= epsilon)
      lower.pop();
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= epsilon)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function dedupe2D(pts: { x: number; y: number }[], epsilon: number) {
  const out: { x: number; y: number }[] = [];
  for (const p of pts) {
    if (!out.some((q) => Math.abs(q.x - p.x) < epsilon && Math.abs(q.y - p.y) < epsilon)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Remove hull vertices whose cross product with their neighbors is small
 * relative to the hull's overall area. Fixed-scale collinearity tolerances
 * (like our `hullEps`) catch samples that are microscopically off a straight
 * edge but miss samples that are visibly off in absolute terms yet tiny
 * compared to the shape (e.g. a cone triangle with a CSG artifact vertex
 * whose cross=0.10 against a hull area of 3.6 → ratio 0.03). Using an
 * area-relative threshold removes these consistently regardless of scale.
 */
function dropNearCollinear(
  hull: { x: number; y: number }[],
  relTol: number,
): { x: number; y: number }[] {
  if (hull.length < 4) return hull;
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    area += a.x * b.y - b.x * a.y;
  }
  area = Math.abs(area) / 2;
  if (area < 1e-9) return hull;
  const absTol = area * relTol;
  const pts = [...hull];
  // Iteratively drop the vertex with the smallest cross. After each removal
  // the neighbours of the removed vertex may become true corners (their cross
  // grows), so we keep going until the minimum is above threshold or we hit
  // the triangle floor.
  while (pts.length >= 4) {
    let minIdx = -1;
    let minCross = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const cx = Math.abs(
        (curr.x - prev.x) * (next.y - prev.y) -
          (curr.y - prev.y) * (next.x - prev.x),
      );
      if (cx < minCross) {
        minCross = cx;
        minIdx = i;
      }
    }
    if (minCross < absTol && minIdx >= 0) {
      pts.splice(minIdx, 1);
    } else {
      break;
    }
  }
  return pts;
}

/**
 * Minimum-area bounding box via rotating calipers. Returns {w, h} with w >= h.
 * For a rectangle this yields the true edge lengths; for a square it yields
 * equal sides. Fixes the "projectTo2D picks a diagonal, every rectangle looks
 * like a rhombus" bug where naive bbox of the projected points conflated
 * rectangles with squares.
 */
function minAreaBBox(hull: { x: number; y: number }[]): { w: number; h: number } {
  if (hull.length < 2) return { w: 0, h: 0 };
  let best = { w: Infinity, h: Infinity, area: Infinity };
  const len = hull.length;
  for (let i = 0; i < len; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % len];
    const ex = b.x - a.x, ey = b.y - a.y;
    const elen = Math.hypot(ex, ey) || 1e-12;
    const ux = ex / elen, uy = ey / elen;
    // perpendicular basis
    const vx = -uy, vy = ux;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const pu = p.x * ux + p.y * uy;
      const pv = p.x * vx + p.y * vy;
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv;
      if (pv > maxV) maxV = pv;
    }
    const w0 = maxU - minU;
    const h0 = maxV - minV;
    const area = w0 * h0;
    if (area < best.area) {
      best = { w: Math.max(w0, h0), h: Math.min(w0, h0), area };
    }
  }
  return { w: best.w, h: best.h };
}

export function classifyShape(verts: THREE.Vector3[], solidId: SolidId): string {
  if (verts.length === 0) return "";

  const box = new THREE.Box3().setFromPoints(verts);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.x < 0.05 && size.y < 0.05 && size.z < 0.05) return "point";

  const pts2dRaw = projectTo2D(verts);
  // See H1: CSG fan-triangulation produces near-coincident 3D verts (~0.0016
  // apart) that survive the 0.001 3D dedup. Collapse them in 2D with a
  // size-relative epsilon.
  const maxSize = Math.max(size.x, size.y, size.z);
  const eps2d = Math.max(0.02, maxSize * 0.015);
  const pts2d = dedupe2D(pts2dRaw, eps2d);

  // Cross-product tolerance scales with shape area. A straight-edge sample
  // three pixels off a true edge has cross ≈ (sample_noise) × (edge_length).
  // Scaling with size keeps the filter effective regardless of cube/cone scale.
  const hullEps = maxSize * maxSize * 0.0005;
  const rawHull = convexHull2D(pts2d, hullEps);
  // Second-pass area-relative cleanup: the hull's fixed-size epsilon misses
  // artifact vertices whose cross is tiny compared to the overall hull area
  // (e.g. ~3% of area → visibly collinear but >>hullEps).
  const hull = dropNearCollinear(rawHull, 0.04);
  const hullN = hull.length;

  const { w, h } = minAreaBBox(hull);
  const aspect2d = h > 1e-9 ? w / h : 1;

  let label: string;

  // Geometric invariants per solid type — any polygon label outside a solid's
  // reachable set is necessarily a CSG sampling artifact and must fall through
  // to the curve branch:
  //   cube:     triangle, square, rectangle, pentagon, hexagon
  //   cylinder: rectangle (axis-aligned cut) + curves
  //   cone:     triangle (through apex) + curves (circle/ellipse/parabola)
  //   sphere:   curves only
  const isPrism = solidId === "cube";
  const canQuad = solidId === "cube" || solidId === "cylinder";
  const canTriangle = solidId === "cube" || solidId === "cone";

  if (hullN <= 2) {
    label = "point";
  } else if (hullN === 3 && canTriangle) {
    label = "triangle";
  } else if (hullN === 4 && canQuad) {
    label = aspect2d < 1.15 ? "square" : "rectangle";
  } else if (hullN === 5 && isPrism) {
    label = "pentagon";
  } else if ((hullN === 6 || hullN > 6) && isPrism) {
    label = "hexagon";
  } else {
    if (solidId === "cone" && aspect2d > 2.5) label = "parabola";
    else label = aspect2d < 1.2 ? "circle" : "ellipse";
  }

  return label;
}
