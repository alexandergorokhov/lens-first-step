// Round 2 (Alex, Nov 7): "the café needs more details". The demo stops 2.7 m from the café; from there
// you see into it, past the glass: a counter, an espresso machine, a menu board, someone serving, and
// tables outside. Built in Node with a stub canvas (textures don't matter for these checks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

const noop: any = new Proxy(function () {}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : noop), apply: () => noop, set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };
(globalThis as any).AIRPORT_EXPORT = true;

async function airport(): Promise<THREE.Scene> {
  const { buildAirport } = await import("../../../tools/demo-video/airport.js");
  const map = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  const scene = new THREE.Scene();
  buildAirport(scene, map);
  scene.updateMatrixWorld(true);
  return scene;
}

// What a ray from (x, eyeY, z) toward (tx, ty, tz) hits first, glass left out (you see through it).
function firstHit(scene: THREE.Scene, from: number[], to: number[]): THREE.Intersection | null {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, -z);
  const a = V(from[0], from[1], from[2]), b = V(to[0], to[1], to[2]);
  const ray = new THREE.Raycaster(a, b.clone().sub(a).normalize(), 0, 30);
  const hits = ray.intersectObjects(scene.children, true).filter((h) => {
    const m = (h.object as THREE.Mesh).material as any;
    return !(m && m.transparent && m.opacity < 0.5);
  });
  return hits[0] || null;
}

const CAFE = { x0: 39, x1: 47, z0: 37.5, z1: 40, y: 6 }; // its front faces south (z0)
const STOP = [43.9, 6 + 1.15, 35.0]; // where the take stops, seated eyes

test("CF1 from the take's stop you see into the café: rays to its middle go past the front, not onto a wall", async () => {
  const scene = await airport();
  let inside = 0;
  for (const tx of [40.5, 42, 43.5, 45, 46]) {
    for (const ty of [6.6, 7.2, 7.8]) {
      const h = firstHit(scene, STOP, [tx, ty, 39]);
      if (h && -h.point.z > CAFE.z0 + 0.3) inside++;
    }
  }
  assert.ok(inside >= 12, "most rays (15) reach inside the café (" + inside + ")");
});

test("CF2 the café has a counter, an espresso machine, a menu board and a barista, named for the checks", async () => {
  const scene = await airport();
  const names: string[] = [];
  scene.traverse((o) => { if (o.name) names.push(o.name); });
  for (const n of ["cafe counter", "cafe espresso machine", "cafe menu board", "cafe pastry case", "cafe barista"]) {
    assert.ok(names.includes(n), n);
  }
});

test("CF3 tables and chairs stand outside the café as furniture the routes keep clear of", async () => {
  const { FURNITURE } = await import("../../../tools/demo-video/layout.mjs");
  const tables = FURNITURE.filter((f: any[]) => /café table/.test(f[7]));
  assert.ok(tables.length >= 2, "at least two tables");
  for (const t of tables) assert.ok(t[3] <= CAFE.z0 - 0.4 && t[0] >= CAFE.x0 - 1 && t[1] <= CAFE.x1 + 1, "in front of the café: " + t.join(","));
});
