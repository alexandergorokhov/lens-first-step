// Tests for the autoplay demo's pure logic in src/core/demo.ts (byte-identical to
// Assets/Scripts/FindYourWayDemo.ts): the beat sequence and walking along a route polyline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEMO_BEATS,
  PolylineWalker,
  beatIndex,
  polylineLength,
  pointAt,
  walkSeconds,
} from "../demo.ts";

const P = (x: number, y: number, z: number) => ({ x, y, z });

test("demo.ts and its Lens copy are identical", () => {
  const a = readFileSync(new URL("../demo.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../../Assets/Scripts/FindYourWayDemo.ts", import.meta.url), "utf8");
  assert.equal(b, a);
});

test("demo beats follow the brief's video, in order, each with a short caption", () => {
  const ids = DEMO_BEATS.map((b) => b.id);
  const mustAppearInOrder = [
    "walk-choose", "walk-scan", "walk-escalator", "gate-change", "stairs-down", "arrive-c3",
    "restart", "stepfree-choose", "stepfree-scan", "lift1-out", "lift2-ride", "arrive-b12",
    "campus", "campus-lift-out", "campus-ramp", "arrive-lecture-hall", "end",
  ];
  let last = -1;
  for (const id of mustAppearInOrder) {
    const i = ids.indexOf(id);
    assert.ok(i > last, `${id} appears after the previous beat`);
    last = i;
  }
  assert.equal(new Set(ids).size, ids.length, "beat ids are unique");
  for (const b of DEMO_BEATS) {
    assert.ok(b.caption.length > 0 && b.caption.length <= 60, `${b.id}: caption 1..60 chars`);
  }
  assert.equal(beatIndex("walk-scan"), ids.indexOf("walk-scan"));
  assert.equal(beatIndex("nope"), -1);
});

test("polyline length and the point (with heading) at a distance along it", () => {
  const pts = [P(0, 0, 0), P(0, 0, 3), P(4, 0, 3)];
  assert.equal(polylineLength(pts), 7);
  assert.deepEqual(pointAt(pts, 0), { x: 0, y: 0, z: 0, heading: 0 });
  assert.deepEqual(pointAt(pts, 1.5), { x: 0, y: 0, z: 1.5, heading: 0 });
  assert.deepEqual(pointAt(pts, 5), { x: 2, y: 0, z: 3, heading: 90 });
  assert.deepEqual(pointAt(pts, 99), { x: 4, y: 0, z: 3, heading: 90 }, "clamps to the end");
  assert.equal(polylineLength([P(1, 2, 3)]), 0);
  assert.deepEqual(pointAt([P(1, 2, 3)], 5), { x: 1, y: 2, z: 3, heading: 0 });
});

test("walking speed: 1.4 m/s, three times faster along straights longer than 12 m", () => {
  assert.equal(walkSeconds([P(0, 0, 0), P(0, 0, 7)]), 5);
  // 12 m at 1.4 m/s, then the rest of a 40 m straight at 4.2 m/s: 12/1.4 + 28/4.2
  const t = walkSeconds([P(0, 0, 0), P(0, 0, 40)]);
  assert.ok(Math.abs(t - (12 / 1.4 + 28 / 4.2)) < 1e-9, String(t));
  assert.equal(walkSeconds([P(0, 0, 0), P(0, 0, 7)], 2), 2.5, "speed multiplier");
});

test("PolylineWalker advances at the walking speed, keeps the heading and finishes at the end", () => {
  const w = new PolylineWalker([P(0, 0, 0), P(0, 0, 2.8), P(1.4, 0, 2.8)]);
  let s = w.step(1);
  assert.ok(Math.abs(s.z - 1.4) < 1e-9 && s.heading === 0 && !s.done);
  s = w.step(1);
  assert.ok(Math.abs(s.z - 2.8) < 1e-9 && !s.done);
  s = w.step(0.5);
  assert.ok(Math.abs(s.x - 0.7) < 1e-9 && s.heading === 90 && !s.done);
  s = w.step(10);
  assert.deepEqual([s.x, s.z, s.done], [1.4, 2.8, true]);
  assert.equal(w.step(1).done, true, "stays done");

  const fast = new PolylineWalker([P(0, 0, 0), P(0, 0, 10)], 5);
  assert.ok(Math.abs(fast.step(1).z - 7) < 1e-9, "speed multiplier 5 -> 7 m/s");
});
