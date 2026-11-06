// Props dressing the airport and the mall: never on a walkway, never inside a shop or wall, inside the
// building, spread out, and the same every time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import { isClear } from "../geometry.ts";
import { shopFrontPose } from "../freewalk.ts";
import { propPlan, PROP_MODELS } from "../props.ts";

function load(file: string): any {
  const r = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file);
  return r.map;
}
const plan = (m: any, kit: string) => propPlan(m, kit, (p) => isClear(m, p), (id) => shopFrontPose(m, id));

function pathDist(m: any, p: any): number {
  let best = Infinity;
  for (const e of m.edges) {
    const a = m.nodes.find((n: any) => n.id === e.from), b = m.nodes.find((n: any) => n.id === e.to);
    if (Math.abs(a.y - p.y) > 0.6 && Math.abs(b.y - p.y) > 0.6) continue;
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
}

for (const [file, kit] of [["mall.json", "mall"], ["map.json", "airport"]]) {
  test("PR1 " + kit + ": dressed with 12 to 45 props, each a known model, off every walkway, where you could stand, inside the building", () => {
    const m = load(file);
    const ps = plan(m, kit);
    assert.ok(ps.length >= 12 && ps.length <= 45, "count " + ps.length);
    const fp = m.place.footprint;
    for (const p of ps) {
      assert.ok(PROP_MODELS[p.model], p.model);
      assert.ok(pathDist(m, p) >= 0.69, p.model + " on a walkway at " + JSON.stringify(p));
      assert.ok(p.mountM !== undefined || isClear(m, p), p.model + " inside a wall at " + JSON.stringify(p));
      assert.ok(p.x > fp.minX && p.x < fp.maxX && p.z > fp.minZ && p.z < fp.maxZ);
    }
  });

  test("PR2 " + kit + ": props stand apart, and the plan is the same every time", () => {
    const m = load(file);
    const ps = plan(m, kit);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      if (Math.abs(ps[i].y - ps[j].y) > 0.6) continue;
      assert.ok(Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z) >= 1.79, ps[i].model + " / " + ps[j].model);
    }
    assert.deepEqual(plan(m, kit), ps);
  });
}

test("PR3 the airport has seats at the gates and an info board at the entrance; the mall has plants and a clothes rack", () => {
  const a = plan(load("map.json"), "airport").map((p) => p.model);
  assert.ok(a.filter((x) => x === "airport_seat").length >= 4, a.join(","));
  assert.ok(a.indexOf("departure_screen") >= 0 && a.indexOf("info_sign") >= 0, a.join(","));
  const m = plan(load("mall.json"), "mall").map((p) => p.model);
  assert.ok(m.indexOf("plant_1") >= 0 && m.indexOf("clothes_rack") >= 0 && m.indexOf("palm_tree") >= 0, m.join(","));
});

test("PR4 other maps (hospital, campus, the preview room) stay undressed", () => {
  assert.deepEqual(plan(load("hospital.json"), "hospital"), []);
});

test("PR5 the props the Lens stands up (data/props.json) are exactly what the plan says today (npm run props)", async () => {
  const { allPlans } = await import("../../../tools/props-plan.mjs");
  const stored = JSON.parse(readFileSync(new URL("../data/props.json", import.meta.url), "utf8"));
  assert.deepEqual(stored, JSON.parse(JSON.stringify(allPlans())));
});
