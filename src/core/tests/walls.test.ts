// The preview's keys move you anywhere, so the walls of the stand-in have to stop you there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feetOnSlope, isClear, walkStep, type WallMap } from "../geometry.ts";

const load = (f: string): WallMap => JSON.parse(readFileSync(new URL("../data/" + f, import.meta.url), "utf8"));
const mall = load("mall.json");
const MAPS = ["map.json", "hospital.json", "campus.json", "room.json", "mall.json"];

// Walks in small steps, as frames do.
function walk(map: WallMap, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
  let p = from;
  const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.1);
  for (let i = 0; i < n; i++) p = walkStep(map, p, { x: p.x + (to.x - from.x) / n, y: p.y, z: p.z + (to.z - from.z) / n });
  return p;
}

test("W1 every node of every map is clear, so nobody starts inside a wall", () => {
  for (const f of MAPS) {
    const map = load(f);
    for (const n of map.nodes) assert.ok(isClear(map, n), f + ": " + n.id);
  }
});

test("W2 every walkway of every map can be walked end to end", () => {
  for (const f of MAPS) {
    const map = load(f);
    for (const e of map.edges) {
      const a = map.nodes.filter((n) => n.id === e.from)[0];
      const b = map.nodes.filter((n) => n.id === e.to)[0];
      if (!a || !b || Math.abs(a.y - b.y) > 0.01) continue;
      const end = walk(map, a, b);
      assert.ok(Math.hypot(end.x - b.x, end.z - b.z) < 1e-3, f + ": " + e.from + " -> " + e.to + " stopped at " + end.x + "," + end.z);
    }
  }
});

test("W2b every open stairs, ramp and escalator can be walked its way, with or against a wall beside it", () => {
  for (const f of MAPS) {
    const map = load(f);
    for (const e of map.edges) {
      if (!e.open || (e.kind !== "stairs" && e.kind !== "ramp" && e.kind !== "escalator")) continue;
      const a = map.nodes.filter((n) => n.id === e.from)[0];
      const b = map.nodes.filter((n) => n.id === e.to)[0];
      for (const [from, to] of e.kind === "escalator" ? [[a, b]] : [[a, b], [b, a]]) {
        let p = { x: from.x, y: from.y, z: from.z };
        const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.05);
        for (let i = 0; i < n; i++) {
          p = walkStep(map, p, { x: p.x + (to.x - from.x) / n, y: p.y, z: p.z + (to.z - from.z) / n });
          const h = feetOnSlope(map, p);
          if (h !== null) p = { x: p.x, y: h, z: p.z };
        }
        assert.ok(Math.hypot(p.x - to.x, p.z - to.z) < 1e-3, f + ": " + from.id + " -> " + to.id + " stopped at " + p.x + "," + p.y + "," + p.z);
      }
    }
  }
});

test("W3 the outer wall stops you", () => {
  const end = walk(mall, { x: 26, y: 0, z: 10 }, { x: 26, y: 0, z: -5 });
  assert.ok(end.z > 1 && end.z < 1.3, String(end.z));
});

test("W4 a shop front stops you, and you slide along it", () => {
  // Bolt Hardware's front stands 1.7 m behind its node, across the way in.
  const end = walk(mall, { x: 30, y: 0, z: 26 }, { x: 30, y: 0, z: 29.5 });
  assert.ok(end.z < 27.6, "panels 1 m ahead stay in front of the wall: " + end.z);
  const slid = walk(mall, { x: 30, y: 0, z: 27 }, { x: 28, y: 0, z: 30 });
  assert.ok(slid.x < 29, "it slides: " + slid.x);
});

test("W5 a stairs' side is solid, and its foot is the way on", () => {
  const side = walk(mall, { x: 52, y: 0, z: 17 }, { x: 60, y: 0, z: 17 });
  assert.ok(side.x < 56, "stopped at the side: " + side.x);
  const foot = { x: 57, y: 0, z: 14.6 };
  assert.ok(isClear(mall, foot));
  assert.ok(walkStep(mall, foot, { x: 57, y: 0, z: 15.2 }).z > 15, "steps on at the foot");
});

test("W6 you can walk under the high end of an escalator", () => {
  assert.ok(isClear(mall, { x: 24, y: 0, z: 22.5 }));
});

test("W7 once on the stairs the rail keeps you there", () => {
  const on = { x: 57, y: 2.5, z: 19.5 };
  const end = walkStep(mall, on, { x: 59, y: 2.5, z: 19.5 });
  assert.ok(end.x < 58.3, String(end.x));
});

test("W8 a rail stops you part-way, but the far end still lets you off", () => {
  const top = { x: 57, y: 5, z: 24 };
  assert.ok(isClear(mall, top));
  assert.ok(walkStep(mall, top, { x: 56.5, y: 5, z: 24.4 }).z > 24.1);
});

test("W9 a ride or a jump to a new place is never held back", () => {
  const far = { x: 3, y: 5, z: 16 };
  assert.deepEqual(walkStep(mall, { x: 3, y: 0, z: 16 }, far), far);
  const across = { x: 30, y: 0, z: 22 };
  assert.deepEqual(walkStep(mall, { x: 10, y: 0, z: 10 }, across), across);
});

test("W10 inside a wall already, you can always walk out", () => {
  const stuck = { x: 30, y: 0, z: 28.5 };
  assert.equal(isClear(mall, stuck), false);
  assert.equal(walkStep(mall, stuck, { x: 30, y: 0, z: 28.3 }).z, 28.3);
});

test("W11 a map with no footprint and no shops has no walls", () => {
  const open: WallMap = { nodes: [{ id: "a", kind: "junction", x: 0, y: 0, z: 0 }], edges: [] };
  assert.equal(isClear(open, { x: 500, y: 0, z: 500 }), true);
});
