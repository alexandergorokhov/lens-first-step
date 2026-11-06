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
const DOOR_STOP_M = 1.8; // a leg ends at the door, this far out (the Lens demo stops there too)

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
