// Peek ahead (Z3 in devpost/SCENARIOS.md): the small model of the route shown in the hand is
// built from the route points alone, never changes them, and puts the "you" dot where you are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findRoute, parseMap, routePoints, type MapData, type Vec3 } from "../router.ts";
import { PEEK_SIZE, peekModel } from "../peek.ts";

const MAP_TEXT = readFileSync(new URL("../data/map.json", import.meta.url), "utf8");
function loadMap(): MapData {
  const parsed = parseMap(MAP_TEXT);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.map;
}
const route = (): Vec3[] => {
  const map = loadMap();
  return routePoints(map, findRoute(map, "sign", "gateB12", "walk"));
};
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

test("Z3 the model fits in a box of `size` (default 0.4 m) centred on the origin", () => {
  const pts = route();
  assert.equal(PEEK_SIZE, 0.4);
  for (const size of [undefined, 0.25]) {
    const m = peekModel(pts, pts[0], size === undefined ? undefined : { size });
    const half = (size ?? 0.4) / 2;
    let maxExtent = 0;
    for (const axis of ["x", "y", "z"] as const) {
      const vs = m.route.map((p) => p[axis]);
      const lo = Math.min(...vs);
      const hi = Math.max(...vs);
      assert.ok(lo >= -half - 1e-9 && hi <= half + 1e-9, axis + " out of the box");
      assert.ok(close(lo + hi, 0, 1e-9), axis + " not centred");
      maxExtent = Math.max(maxExtent, hi - lo);
    }
    // It fills the box along its longest side.
    assert.ok(close(maxExtent, half * 2, 1e-9));
  }
});

test("Z3 the model keeps proportions (one scale for every axis)", () => {
  const pts = route();
  const m = peekModel(pts, pts[0]);
  for (let i = 0; i < pts.length; i++) {
    for (const axis of ["x", "y", "z"] as const) {
      assert.ok(close(m.route[i][axis], (pts[i][axis] - m.centre[axis]) * m.scale, 1e-12));
    }
  }
  // Distances shrink by the same factor in every direction.
  const d = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  for (let i = 1; i < pts.length; i++) assert.ok(close(d(m.route[i], m.route[i - 1]), d(pts[i], pts[i - 1]) * m.scale, 1e-9));
});

test("Z3 the you-dot sits at the scaled user position; done splits walked from ahead", () => {
  const pts = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 10 },
    { x: 20, y: 0, z: 10 },
  ];
  const user = { x: 10, y: 0, z: 4 };
  const m = peekModel(pts, user);
  assert.ok(close(m.scale, 0.4 / 20));
  assert.deepEqual(m.centre, { x: 10, y: 0, z: 5 });
  assert.ok(close(m.you.x, 0) && close(m.you.y, 0) && close(m.you.z, (4 - 5) * m.scale));
  // On the second segment: points 0 and 1 are behind, 2 and 3 ahead.
  assert.equal(m.done, 2);
  assert.equal(peekModel(pts, { x: 1, y: 0, z: 0.5 }).done, 1);
  assert.equal(peekModel(pts, pts[3]).done, 4);
});

test("Z3 building the model never changes the route or the user position", () => {
  const pts = route();
  const user = { ...pts[2] };
  const before = JSON.stringify(pts);
  const userBefore = JSON.stringify(user);
  const m = peekModel(pts, user, { size: 0.3 });
  m.route[0].x = 999;
  m.you.x = 999;
  assert.equal(JSON.stringify(pts), before);
  assert.equal(JSON.stringify(user), userBefore);
});

test("Z3 an empty or one-point route is safe", () => {
  const user = { x: 3, y: 1, z: 2 };
  const empty = peekModel([], user);
  assert.deepEqual(empty.route, []);
  assert.deepEqual(empty.you, { x: 0, y: 0, z: 0 });
  assert.equal(empty.done, 0);
  assert.ok(isFinite(empty.scale) && empty.scale > 0);
  const one = peekModel([{ x: 5, y: 0, z: 5 }], user);
  assert.deepEqual(one.route, [{ x: 0, y: 0, z: 0 }]);
  assert.ok(isFinite(one.scale) && one.scale > 0);
  for (const v of [one.you.x, one.you.y, one.you.z]) assert.ok(isFinite(v));
  // Two identical points: no divide by zero.
  const same = peekModel([{ x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }], user);
  for (const p of same.route) for (const v of [p.x, p.y, p.z]) assert.ok(isFinite(v));
});
