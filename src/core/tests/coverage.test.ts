// Coverage and robustness: hostile or broken map files (a downloaded map is untrusted), optional
// settings that fall back to defaults, map-event validation, and the new features (distance,
// floors, companion, places) run on every bundled map in both profiles, not just the airport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_LABEL_LENGTH,
  MAX_MAP_COORD,
  MAX_MAP_EDGES,
  MAX_MAP_NODES,
  Navigator,
  RIDE_SECONDS,
  STEP_FREE_SPEED,
  WALK_SPEED,
  findNode,
  findRoute,
  nearestNode,
  parseMap,
  routePoints,
  tripAhead,
  tripSettings,
  type MapData,
  type Profile,
  type Vec3,
} from "../router.ts";
import { lineOnLevel } from "../geometry.ts";
import { approachDir, floorCueFor, placeOf } from "../place.ts";
import { PetGuide, sideStepSpot } from "../pet.ts";
import { PointingCoach, interestOptions, placesOf, visiblePlaces } from "../places.ts";

const DATA = new URL("../data/", import.meta.url);
const FILES: string[] = JSON.parse(readFileSync(new URL("index.json", DATA), "utf8")).maps.map((m: { file: string }) => m.file);
const text = (f: string) => readFileSync(new URL(f, DATA), "utf8");
function load(f: string): MapData {
  const r = parseMap(text(f));
  if (!r.ok) throw new Error(f + ": " + r.error);
  return r.map;
}
const d3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const lerp = (a: Vec3, b: Vec3, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function steps(route: Vec3[], each: number, fn: (p: Vec3) => void) {
  for (let i = 0; i < route.length - 1; i++) {
    const n = Math.max(1, Math.ceil(d3(route[i], route[i + 1]) / each));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) fn(lerp(route[i], route[i + 1], k / n));
  }
}
function mutate(f: string, fn: (m: any) => void): string {
  const m = JSON.parse(text(f));
  fn(m);
  return JSON.stringify(m);
}
// Pairs worth routing on a map: its start to every destination and place, and back.
function pairs(map: MapData): [string, string][] {
  const start = (map.place && map.place.start) || "sign";
  const ends = map.nodes.filter((n) => n.kind === "destination" || n.kind === "place").map((n) => n.id);
  return ends.flatMap((e) => [[start, e], [e, start]] as [string, string][]);
}

// ---- hostile / broken map files ------------------------------------------------------------------

test("C1 A map with an infinite edge length (1e999 in JSON) is rejected", () => {
  const t = text("room.json").replace(/"length":\s*[0-9.]+/, '"length": 1e999');
  const r = parseMap(t);
  assert.equal(r.ok, false);
});

test("C1 Coordinates beyond " + "the map size limit are rejected (no Infinity distances)", () => {
  const r = parseMap(mutate("room.json", (m) => (m.nodes[0].x = 1e308)));
  assert.equal(r.ok, false);
  assert.ok(MAX_MAP_COORD >= 10000);
});

test("C1 Over-long labels are rejected (they would overflow the cards)", () => {
  const r = parseMap(mutate("room.json", (m) => (m.nodes[0].label = "A".repeat(MAX_LABEL_LENGTH + 1))));
  assert.equal(r.ok, false);
  assert.ok(parseMap(mutate("room.json", (m) => (m.nodes[0].label = "A".repeat(MAX_LABEL_LENGTH)))).ok);
});

test("C1 Maps over the node or edge limit are rejected (per-frame work on the glasses)", () => {
  const big = mutate("room.json", (m) => {
    for (let i = 0; i < MAX_MAP_NODES; i++) m.nodes.push({ id: "n" + i, x: i % 100, y: 0, z: Math.floor(i / 100), kind: "junction" });
  });
  assert.equal(parseMap(big).ok, false);
  const edges = mutate("room.json", (m) => {
    const e = m.edges[0];
    for (let i = 0; i < MAX_MAP_EDGES; i++) m.edges.push({ ...e });
  });
  assert.equal(parseMap(edges).ok, false);
});

test("C1 A __proto__ node id is rejected and pollutes nothing (see R2)", () => {
  const t = mutate("room.json", (m) => {
    const old = m.nodes[1].id;
    m.nodes[1].id = "__proto__";
    for (const e of m.edges) {
      if (e.from === old) e.from = "__proto__";
      if (e.to === old) e.to = "__proto__";
    }
  });
  assert.equal(parseMap(t).ok, false);
  assert.equal(({} as any).x, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, "x"), false);
});

// ---- optional settings fall back -----------------------------------------------------------------

test("C2 Bad speeds, ride times and storey numbers fall back to the defaults", () => {
  const map = load("map.json");
  const bad = parseMap(mutate("map.json", (m) => {
    m.place.speeds = { walk: -1, stepFree: "fast" };
    m.place.rideTimes = { lift: -3, escalator: "x", stairs: null };
    for (const l of m.place.levels) l.floor = "one";
  }));
  assert.ok(bad.ok);
  if (!bad.ok) return;
  const s = tripSettings(bad.map);
  assert.deepEqual(s.speeds, { walk: WALK_SPEED, stepFree: STEP_FREE_SPEED });
  assert.deepEqual(s.rideTimes, RIDE_SECONDS);
  // Without usable storey numbers, levels count in height order (0, 5, 6): Ground -> B12 is 2.
  const r = findRoute(bad.map, "sign", "gateB12", "walk");
  assert.equal(tripAhead(bad.map, r, findNode(map, "sign")!)!.floors, 2);
  // A ramp may cost 0 s extra.
  const zero = parseMap(mutate("map.json", (m) => (m.place.rideTimes = { ramp: 0 })));
  assert.ok(zero.ok && tripSettings(zero.map).rideTimes.ramp === 0);
});

test("C2 A place with no category is not a place; a map without places has no icons or points", () => {
  const r = parseMap(mutate("room.json", (m) => m.nodes.push({ id: "p1", x: 0.5, y: 0, z: 0.5, kind: "place" })));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(placesOf(r.map).length, 0);
  const route = routePoints(r.map, findRoute(r.map, "sign", r.map.place!.destination!, "walk"));
  assert.equal(visiblePlaces(r.map, route, route[0], { profile: "walk", muted: false }).length, 0);
  const coach = new PointingCoach(r.map);
  coach.interests = interestOptions("stepFree");
  assert.equal(coach.check(route, route[0], 100, 100, false), null);
});

// ---- map event validation --------------------------------------------------------------------------

test("C3 Map events must name real nodes and edges and a known type", () => {
  const cases: [string, (m: any) => void, RegExp][] = [
    ["unknown type", (m) => m.place.events.push({ id: "x", type: "explode" }), /unknown type/],
    ["gate change to nowhere", (m) => m.place.events.push({ id: "x", type: "destinationChanged", to: "nowhere" }), /unknown node/],
    ["closes unknown edge", (m) => m.place.events.push({ id: "x", type: "connectionClosed", edge: "nope", at: "sign" }), /unknown edge/],
    ["sign at unknown node", (m) => m.place.events.push({ id: "x", type: "connectionClosed", edge: "lift1", at: "nowhere" }), /unknown node/],
  ];
  for (const [name, fn, re] of cases) {
    const r = parseMap(mutate("map.json", fn));
    assert.equal(r.ok, false, name);
    if (!r.ok) assert.match(r.error, re, name);
  }
});

// ---- the new features on every map, both profiles ---------------------------------------------------

for (const f of FILES) {
  test("C4 " + f + ": distance and time are finite, never negative, and never go up as you walk; Step-Free cues are lifts or ramps", () => {
    const map = load(f);
    const place = placeOf(map);
    for (const profile of ["walk", "stepFree"] as Profile[]) {
      for (const [a, b] of pairs(map)) {
        const r = findRoute(map, a, b, profile);
        if (r.status !== "route") continue;
        let last = Infinity;
        steps(routePoints(map, r), 0.5, (p) => {
          const t = tripAhead(map, r, p)!;
          assert.ok(isFinite(t.metres) && isFinite(t.seconds) && t.metres >= -1e-9 && t.seconds >= -1e-9, a + "->" + b);
          assert.ok(Number.isInteger(t.floors));
          assert.ok(t.metres <= last + 1e-9, a + "->" + b + " distance went up");
          last = t.metres;
          const cue = floorCueFor(place, map, t);
          if (cue && profile === "stepFree") assert.match(cue, /lift|ramp/i, a + "->" + b + ": " + cue);
        });
      }
    }
  });

  test("C4 " + f + ": the companion stays on the route, waits at floor changes and finds every treat once on arrival", () => {
    const map = load(f);
    for (const profile of ["walk", "stepFree"] as Profile[]) {
      for (const [a, b] of pairs(map).slice(0, 6)) {
        const nav = new Navigator(map, a, b, profile);
        if (nav.route.status !== "route") continue;
        const route = routePoints(map, nav.route);
        const g = new PetGuide();
        g.setOn(true, route, route[0], nav.route.nodes.join(">"));
        const total = g.total;
        let arrived = false;
        let now = 0;
        steps(route, 0.1, (p) => {
          if (arrived) return;
          now += 0.08;
          const progress = nav.updatePosition(p);
          arrived = progress === "arrived";
          g.update(routePoints(map, nav.route), p, 0.08, nav.route.nodes.join(">"), arrived, now);
          if (!arrived) {
            const near = Math.min(...route.map((_, i) => (i < route.length - 1 ? segDist(route[i], route[i + 1], g.pet!.pos) : Infinity)));
            assert.ok(near < 0.35, f + " " + a + "->" + b + ": companion " + near.toFixed(2) + " m off the route");
          }
        });
        for (let k = 0; k < 3; k++) g.update(routePoints(map, nav.route), route.at(-1)!, 0.08, nav.route.nodes.join(">"), true, now);
        assert.ok(arrived, f + " " + a + "->" + b + " arrived");
        assert.equal(g.total, total, f + " " + a + "->" + b + ": treats re-laid");
        assert.equal(g.found, total, f + " " + a + "->" + b + ": treats found");
      }
    }
  });
}

function segDist(a: Vec3, b: Vec3, p: Vec3): number {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y) + (p.z - a.z) * (b.z - a.z)) / len2));
  return d3(p, lerp(a, b, t));
}

// ---- small functions with no other test -------------------------------------------------------------

test("C5 nearestNode prefers your own level (never the node overhead)", () => {
  const map = load("map.json");
  const under = findNode(map, "lift2U")!; // on Departures, 6 m up
  assert.equal(nearestNode(map, { x: under.x, y: 0, z: under.z }).y, 0);
});

test("C5 Changing the destination to where you stand arrives at once", () => {
  const map = load("map.json");
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const hall = findNode(map, "hall")!;
  nav.updatePosition(hall);
  nav.setDestination("hall");
  assert.equal(nav.route.status, "arrived");
});

test("C5 sideStepSpot on a route with no flat stretch (just a lift) stays on the line", () => {
  const lift = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 6, z: 0 }];
  const s = sideStepSpot(lift, { x: 0, y: 0, z: -1 }, { x: 3, y: 0, z: 0 });
  assert.equal(s.x, 0);
  assert.equal(s.z, 0);
});

test("C5 approachDir falls back to facing -Z for a node reached only by lift", () => {
  const map = load("map.json");
  const solo = { ...map, edges: map.edges.filter((e) => e.from !== "lift2U" && e.to !== "lift2U" || e.kind === "lift") };
  assert.deepEqual(approachDir(solo, "lift2U"), { x: 0, z: -1 });
});

test("C5 lineOnLevel with a single point draws nothing and has no marker", () => {
  const one = [{ x: 0, y: 0, z: 0 }];
  assert.deepEqual(lineOnLevel(one, 0), { line: one, marker: null });
});
