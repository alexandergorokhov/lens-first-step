// The airport model in the Lens preview is the concept video's terminal (tools/demo-video/airport.js,
// exported by npm run airport:glb). Every demo leg must stay clear of its shops, desks, seats and the
// people standing in it, and go through a lift only by its doors: you never walk through anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Navigator, parseMap, routePoints } from "../router.ts";
import type { MapData, Profile } from "../router.ts";
import { planAsk, sayItPhrase } from "../freewalk.ts";

const BODY = 0.3; // half a wheelchair's width
// A leg ends this far from the door (the Lens demo stops there too): 2.7 m, inside the 3 m arrival radius, so the camera sees the front
// and its sign, not one flat wall (Alex, Nov 7).
const DOOR_STOP_M = 2.7;

function load(): MapData {
  const r = parseMap(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("map");
  return r.map;
}

async function solids(): Promise<{ x0: number; x1: number; z0: number; z1: number; y: number; label: string }[]> {
  const { SHOPS, FURNITURE, SEATS, PEOPLE } = await import("../../../tools/demo-video/layout.mjs");
  const out: any[] = [];
  for (const s of SHOPS) out.push({ x0: s[0], x1: s[1], z0: s[2], z1: s[3], y: s[4], label: s[5] });
  for (const f of FURNITURE) out.push({ x0: f[0], x1: f[1], z0: f[2], z1: f[3], y: f[4], label: f[7] });
  for (const [x0, x1, y, z] of SEATS) out.push({ x0: x0 - 0.3, x1: x1 + 0.3, z0: z - 0.3, z1: z + 0.3, y, label: "seats at z " + z });
  for (const [seed, x, y, z, , , walk] of PEOPLE) if (!walk) out.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y, label: "person " + seed });
  return out;
}

// Points every 0.2 m along a leg, the last DOOR_STOP_M left out.
function samples(pts: { x: number; y: number; z: number }[], fromDoor: boolean = false): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = 0; d < len; d += 0.2) {
      if (walked + d > total - DOOR_STOP_M) return out;
      if (fromDoor && walked + d < DOOR_STOP_M) continue;
      const f = d / len;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
    }
    walked += len;
  }
  return out;
}

const legs = (m: MapData, stops: string[], profile: Profile) => {
  let at = "sign";
  return stops.map((s) => {
    const r = new Navigator(m, at, s, profile).route;
    const fromDoor = at !== "sign";
    at = s;
    return { to: s, pts: routePoints(m, r), fromDoor };
  });
};

test("AM1 the demo's three stops (café, accessible toilet, Gate C12) and the Walk trips to the gates never pass through anything in the airport model", async () => {
  const m = load();
  const all = await solids();
  const d = (a: string, b: string) => { const r = new Navigator(m, a, b, "stepFree").route; return r.status === "route" ? r.length : Infinity; };
  const trips = [
    ...legs(m, planAsk(m, sayItPhrase(m), "sign", true, d), "stepFree"),
    ...legs(m, ["gateC12"], "walk"),
    ...legs(m, ["gateB12"], "walk"),
    ...legs(m, ["gateB12"], "stepFree"),
    ...legs(m, ["gateC3"], "stepFree"),
  ];
  for (const leg of trips) {
    for (const p of samples(leg.pts, leg.fromDoor)) {
      for (const s of all) {
        if (Math.abs(p.y - s.y) > 0.9) continue;
        const inside = p.x > s.x0 - BODY && p.x < s.x1 + BODY && p.z > s.z0 - BODY && p.z < s.z1 + BODY;
        assert.ok(!inside, "to " + leg.to + ": through " + s.label + " at " + p.x.toFixed(1) + "," + p.z.toFixed(1));
      }
    }
  }
});

test("AM2 every lift on those trips is entered and left by its doors, not through its glass", async () => {
  const { LIFTS, LIFT_HALF, doorFace } = await import("../../../tools/demo-video/layout.mjs");
  const m = load();
  const node = (id: string) => m.nodes.filter((n) => n.id === id)[0];
  const d = (a: string, b: string) => { const r = new Navigator(m, a, b, "stepFree").route; return r.status === "route" ? r.length : Infinity; };
  const trips = legs(m, planAsk(m, sayItPhrase(m), "sign", true, d), "stepFree");
  for (const leg of trips) {
    const pts = samples(leg.pts, leg.fromDoor);
    for (let i = 1; i < pts.length; i++) {
      for (const [id, gId, uId, gFrom, uTo] of LIFTS) {
        const g = node(gId);
        if (!g) continue;
        const inside = (p: any) => Math.abs(p.x - g.x) < LIFT_HALF && Math.abs(p.z - g.z) < LIFT_HALF;
        if (inside(pts[i - 1]) === inside(pts[i])) continue;
        const out = inside(pts[i - 1]) ? pts[i] : pts[i - 1];
        const dx = out.x - g.x, dz = out.z - g.z;
        const side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "N" : "S";
        const level = Math.abs(out.y - node(uId).y) < 0.5 ? uId : gId;
        const door = doorFace(node(level), node(level === gId ? gFrom : uTo));
        assert.equal(side, door, "to " + leg.to + ": through " + id + "'s glass");
      }
    }
  }
});

test("AM3 walking by hand stops at the model's solids: the Lens's airport-solids.json is what the layout says today (npm run airport:solids), and no demo leg crosses one", async () => {
  const { airportSolids } = await import("../../../tools/demo-video/airport-solids.mjs");
  const m = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  const stored = JSON.parse(readFileSync(new URL("../data/airport-solids.json", import.meta.url), "utf8"));
  assert.deepEqual(stored, airportSolids(m));
  const map = load();
  const d = (a: string, b: string) => { const r = new Navigator(map, a, b, "stepFree").route; return r.status === "route" ? r.length : Infinity; };
  for (const leg of legs(map, planAsk(map, sayItPhrase(map), "sign", true, d), "stepFree")) {
    for (const p of samples(leg.pts, leg.fromDoor)) {
      for (const [x0, x1, z0, z1, y] of stored) {
        if (Math.abs(p.y - y) > 0.9) continue;
        assert.ok(!(p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1), "to " + leg.to + " through a solid at " + p.x.toFixed(1) + "," + p.z.toFixed(1));
      }
    }
  }
});

test("AM7 the toilet block has a door for Toilets and one for the Accessible toilet, each right where its leg ends", async () => {
  const { SHOPS, TOILET_DOORS } = await import("../../../tools/demo-video/layout.mjs");
  const m = load();
  const block = SHOPS.find((s: any[]) => s[5] === "Toilets");
  assert.ok(block, "the toilet block");
  const [x0, x1, , z1, y, , , face] = block;
  assert.equal(face, 0, "its front faces north (+z)");
  assert.deepEqual(TOILET_DOORS.map((d: any[]) => d[0]).sort(), ["accToiletD", "toiletsD"]);
  for (const [id, label, w] of TOILET_DOORS) {
    const n = m.nodes.find((q) => q.id === id)!;
    assert.ok(label.length > 0, id + " has a sign");
    assert.ok(n.x - w / 2 >= x0 && n.x + w / 2 <= x1, id + ": the door is in the block's front");
    assert.equal(n.y, y, id + ": same floor");
    const out = n.z - z1;
    assert.ok(out > 0 && out < 1, id + ": the node stands just outside its door (" + out.toFixed(2) + " m)");
  }
  const [a, b] = TOILET_DOORS;
  const na = m.nodes.find((q) => q.id === a[0])!, nb = m.nodes.find((q) => q.id === b[0])!;
  assert.ok(Math.abs(na.x - nb.x) >= (a[2] + b[2]) / 2 + 0.3, "the two doors don't overlap");
});

// Round 2 (Alex, Nov 7): "you walk through walls, it feels like you walk over stuff". The demo's trip
// as the take plays it: the three stops, then the gate change on the way to C12 sends you to B14.
const takeLegs = (m: MapData) => {
  const d = (a: string, b: string) => { const r = new Navigator(m, a, b, "stepFree").route; return r.status === "route" ? r.length : Infinity; };
  return legs(m, [...planAsk(m, sayItPhrase(m), "sign", true, d), "gateB14"], "stepFree");
};

function inPoly(x: number, z: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function crosses(a: { x: number; z: number }, b: { x: number; z: number }, c: number[], d: number[]): boolean {
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const A = [a.x, a.z], B = [b.x, b.z];
  return o(A, B, c) * o(A, B, d) < 0 && o(c, d, A) * o(c, d, B) < 0;
}

test("AM8 the demo take never goes through a glass balustrade", async () => {
  const { RAILS } = await import("../../../tools/demo-video/layout.mjs");
  const m = load();
  for (const leg of takeLegs(m)) {
    const pts = leg.pts;
    for (let i = 1; i < pts.length; i++) {
      for (const [ax, az, bx, bz, y] of RAILS) {
        if (Math.abs(pts[i - 1].y - y) > 0.5 || Math.abs(pts[i].y - y) > 0.5) continue;
        assert.ok(!crosses(pts[i - 1], pts[i], [ax, az], [bx, bz]), "to " + leg.to + ": through the rail " + [ax, az, bx, bz].join(","));
      }
    }
  }
});

test("AM9 on an upper floor there is always floor under you (nothing walked over the atrium)", async () => {
  const { UPPER_FLOORS, LIFTS, LIFT_HALF } = await import("../../../tools/demo-video/layout.mjs");
  const m = load();
  const shafts = LIFTS.map((l: string[]) => m.nodes.find((n) => n.id === l[1])!).filter(Boolean);
  for (const leg of takeLegs(m)) {
    for (const p of samples(leg.pts)) {
      if (shafts.some((g) => Math.abs(p.x - g.x) <= LIFT_HALF + 0.05 && Math.abs(p.z - g.z) <= LIFT_HALF + 0.05)) continue; // in the lift
      const level = UPPER_FLOORS.find(([, y]: [number[][], number]) => Math.abs(p.y - y) < 0.01);
      if (!level) continue;
      assert.ok(inPoly(p.x, p.z, level[0]), "to " + leg.to + ": over the void at " + p.x.toFixed(1) + "," + p.z.toFixed(1) + " (y " + p.y + ")");
    }
  }
});

test("AM10 each stop of the take ends at least 2.5 m from the shop's front, so the view isn't one wall", async () => {
  const { SHOPS } = await import("../../../tools/demo-video/layout.mjs");
  const m = load();
  for (const leg of takeLegs(m)) {
    const end = samples(leg.pts).pop()!;
    const goal = leg.pts[leg.pts.length - 1];
    const shop = SHOPS.filter((s: any[]) => Math.abs(s[4] - goal.y) < 0.01)
      .map((s: any[]) => ({ s, d: Math.hypot(Math.max(s[0] - goal.x, 0, goal.x - s[1]), Math.max(s[2] - goal.z, 0, goal.z - s[3])) }))
      .sort((a: any, b: any) => a.d - b.d)[0];
    if (!shop || shop.d > 1) continue; // a gate, not a shop
    const [x0, x1, z0, z1] = shop.s;
    const gap = Math.hypot(Math.max(x0 - end.x, 0, end.x - x1), Math.max(z0 - end.z, 0, end.z - z1));
    assert.ok(gap >= 2.5, "to " + leg.to + " (" + shop.s[5] + "): " + gap.toFixed(2) + " m from its front");
  }
});
