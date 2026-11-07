// The Lens's airport.glb is the concept video's airport (airport.js) merged per material by
// export-airport.mjs. Every mesh must reach the GLB: a floor slab has two materials (tiled top, white
// underside) and once fell out, leaving the Lens airport without its upper floors.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { meshParts } from "../../../tools/demo-video/glb-parts.mjs";

test("GLB1 a two-material floor slab exports as two parts (top, underside), no triangle lost", async () => {
  const { slab } = await import("../../../tools/demo-video/airport.js");
  const root = new THREE.Group();
  const top = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const m = slab(root, [[0, 0], [10, 0], [10, 10], [0, 10]], 6, top, 0.45, [[[4, 4], [6, 4], [6, 6], [4, 6]]]);
  m.updateMatrixWorld(true);
  const parts = meshParts(THREE, m);
  assert.equal(parts.length, 2, "top + underside");
  assert.ok(parts.some((p: any) => p.mat === top), "the tiled top is there");
  const all = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
  assert.equal(parts.reduce((s: number, p: any) => s + p.geo.attributes.position.count, 0), all, "every vertex kept");
  for (const p of parts) for (const k of ["position", "normal", "uv"]) assert.ok(p.geo.attributes[k], k);
});

test("GLB2 the top of a slab sits at the floor height in world space (y = 6), facing up", async () => {
  const { slab } = await import("../../../tools/demo-video/airport.js");
  const root = new THREE.Group();
  const top = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const m = slab(root, [[0, 0], [10, 0], [10, 10], [0, 10]], 6, top);
  root.updateMatrixWorld(true);
  const p = meshParts(THREE, m).find((q: any) => q.mat === top)!;
  const pos = p.geo.attributes.position, nrm = p.geo.attributes.normal;
  let up = 0;
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - 6) < 1e-4 && nrm.getY(i) > 0.9) up++;
  assert.ok(up >= 3, "an upward face at y 6 (" + up + " vertices)");
});
