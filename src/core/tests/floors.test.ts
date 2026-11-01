// Floors and distance. Scenario ids
// S10+ are in devpost/SCENARIOS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feetOnSlope } from "../geometry.ts";
import {
  FLOOR_CUE_DISTANCE,
  Navigator,
  STEP_FREE_SPEED,
  WALK_SPEED,
  findNode,
  findRoute,
  parseMap,
  routePoints,
  tripAhead,
  tripSettings,
  type MapData,
  type Profile,
  type Vec3,
} from "../router.ts";
import { lineOnLevel } from "../geometry.ts";
import { destinationFloorText, distancePill, floorCue, floorCueFor, floorsText, levelName, minutesText, placeOf, tripPill } from "../place.ts";

const MAP_TEXT = readFileSync(new URL("../data/map.json", import.meta.url), "utf8");

function loadMap(text = MAP_TEXT): MapData {
  const parsed = parseMap(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.map;
}

function at(map: MapData, id: string): Vec3 {
  const n = findNode(map, id)!;
  return { x: n.x, y: n.y, z: n.z };
}

function route(map: MapData, from: string, to: string, profile: Profile) {
  const r = findRoute(map, from, to, profile);
  assert.equal(r.status, "route", from + " -> " + to);
  return r as Extract<typeof r, { status: "route" }>;
}

// ---- d / feature 1: distance, floors and time ---------------------------------------------

test("S10 Distance: at the start the pill distance equals the route length", () => {
  const map = loadMap();
  for (const profile of ["walk", "stepFree"] as Profile[]) {
    const r = route(map, "sign", "gateC3", profile);
    const t = tripAhead(map, r, at(map, "sign"))!;
    assert.ok(Math.abs(t.metres - r.length) < 1e-6, profile + ": " + t.metres + " vs " + r.length);
  }
});

test("S10 Distance drops as you walk along the line (every 0.25 m, not just at nodes) and is 0 at the gate", () => {
  const map = loadMap();
  const r = route(map, "sign", "gateB12", "walk");
  const pts = routePoints(map, r);
  let last = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.ceil(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y, pts[i + 1].z - pts[i].z) / 0.25);
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const p = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
      const m = tripAhead(map, r, p)!.metres;
      assert.ok(m <= last + 1e-9, r.nodes[i] + " +" + t.toFixed(2) + ": " + m + " went up from " + last);
      last = m;
    }
  }
  assert.ok(Math.abs(last) < 1e-9);
  // Halfway along the first corridor: half of that edge is left on top of the rest.
  const mid = { x: 30, y: 0, z: 5 };
  assert.ok(Math.abs(tripAhead(map, r, mid)!.metres - (r.length - 3)) < 0.01);
});

test("S10 Distance updates after a re-route (gate change B12 -> C3)", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const pos = at(map, "concourse");
  nav.updatePosition(pos);
  const before = tripAhead(map, nav.route, pos)!.metres;
  nav.setDestination("gateC3");
  const after = tripAhead(map, nav.route, pos)!;
  assert.notEqual(after.metres, before);
  assert.ok(Math.abs(after.metres - (nav.route as { length: number }).length) < 1e-6);
});

test("S11 Floors: counted in storeys (a level's 'floor' in the map, else its order), not levels by height", () => {
  const map = loadMap();
  // C pier (5 m) is a 1 m-lower part of the Departures storey: Ground -> Departures and
  // Ground -> C pier are both one floor up (review finding 1: was "2 floors up").
  assert.equal(tripAhead(map, route(map, "sign", "gateB12", "walk"), at(map, "sign"))!.floors, 1);
  assert.equal(tripAhead(map, route(map, "sign", "gateB12", "stepFree"), at(map, "sign"))!.floors, 1);
  assert.equal(tripAhead(map, route(map, "sign", "gateC3", "walk"), at(map, "sign"))!.floors, 1);
  assert.equal(tripAhead(map, route(map, "concourse", "gateC3", "walk"), at(map, "concourse"))!.floors, 0);
  assert.equal(tripAhead(map, route(map, "gateB12", "sign", "walk"), at(map, "gateB12"))!.floors, -1);
  // A map without storey numbers counts levels in height order (hospital: ground + level 1).
  const hosp = loadMap(readFileSync(new URL("../data/hospital.json", import.meta.url), "utf8"));
  const h = findRoute(hosp, "sign", "ward4", "walk");
  assert.equal(tripAhead(hosp, h, at(hosp, "sign"))!.floors, 1);
});

test("S11 Stairs add 15 s per storey climbed, not per level passed (review finding 2)", () => {
  const raw = JSON.parse(MAP_TEXT);
  for (const e of raw.edges) if (e.kind === "escalator") e.open = false;
  const map = loadMap(JSON.stringify(raw));
  const r = route(map, "sign", "gateB12", "walk");
  assert.ok(r.edges.some((e) => e.kind === "stairs"));
  assert.ok(Math.abs(tripAhead(map, r, at(map, "sign"))!.seconds - (r.length / WALK_SPEED + 15)) < 1e-6);
});

test("S10/S13 Pill and cue rules live in core: no pill at arrival; the cue only within 15 m", () => {
  const map = loadMap();
  const place = placeOf(map);
  const r = route(map, "sign", "gateB12", "walk");
  const far = tripAhead(map, r, at(map, "sign"))!; // escalator 16 m ahead
  assert.equal(floorCueFor(place, map, far), null);
  const near = tripAhead(map, r, at(map, "hall"))!; // 10 m ahead
  assert.equal(floorCueFor(place, map, near), "In 10 m: escalator up to Departures");
  assert.equal(tripPill("Gate B12", far), "Gate B12 · " + Math.round(far.metres) + " m · 1 floor up · " + minutesText(far.seconds));
  const done = findRoute(map, "gateB12", "gateB12", "walk");
  assert.equal(tripPill("Gate B12", tripAhead(map, done, at(map, "gateB12"))), null);
  assert.equal(tripPill("Gate B12", null), null);
});

test("S11 Time: walking at 1.3 m/s (Step-Free 1.0 m/s) plus 20 s per escalator, 45 s per lift, 15 s per floor of stairs", () => {
  const map = loadMap();
  const walk = route(map, "sign", "gateB12", "walk"); // has the up escalator
  const esc = walk.edges.find((e) => e.kind === "escalator")!;
  const tw = tripAhead(map, walk, at(map, "sign"))!;
  assert.ok(Math.abs(tw.seconds - ((walk.length - esc.length) / WALK_SPEED + 20)) < 1e-6);

  const free = route(map, "sign", "gateB12", "stepFree"); // has a lift
  const lift = free.edges.find((e) => e.kind === "lift")!;
  const tf = tripAhead(map, free, at(map, "sign"))!;
  assert.ok(Math.abs(tf.seconds - ((free.length - lift.length) / STEP_FREE_SPEED + 45)) < 1e-6);

  const stairs = route(map, "concourse", "gateC3", "walk"); // C pier stairs, one floor
  const ts = tripAhead(map, stairs, at(map, "concourse"))!;
  assert.ok(stairs.edges.some((e) => e.kind === "stairs"));
  assert.ok(Math.abs(ts.seconds - (stairs.length / WALK_SPEED + 15)) < 1e-6);
});

test("S11 A map can override the speeds and the floor-change times", () => {
  const raw = JSON.parse(MAP_TEXT);
  raw.place.speeds = { walk: 2 };
  raw.place.rideTimes = { escalator: 50 };
  const map = loadMap(JSON.stringify(raw));
  assert.equal(tripSettings(map).speeds.walk, 2);
  assert.equal(tripSettings(map).speeds.stepFree, STEP_FREE_SPEED);
  const r = route(map, "sign", "gateB12", "walk");
  const esc = r.edges.find((e) => e.kind === "escalator")!;
  assert.ok(Math.abs(tripAhead(map, r, at(map, "sign"))!.seconds - ((r.length - esc.length) / 2 + 50)) < 1e-6);
});

test("S10 Pill text: 'Gate C3 · 140 m · 1 floor down · 3 min'", () => {
  assert.equal(distancePill("Gate C3", 140.4, -1, 150), "Gate C3 · 140 m · 1 floor down · 3 min");
  assert.equal(distancePill("Gate B12", 61.6, 2, 59), "Gate B12 · 62 m · 2 floors up · 1 min");
  assert.equal(distancePill("Gate B12", 12, 0, 9), "Gate B12 · 12 m · 1 min");
  assert.equal(floorsText(0), "");
  assert.equal(floorsText(1), "1 floor up");
  assert.equal(minutesText(0), "1 min");
  assert.equal(minutesText(61), "2 min");
});

// ---- a / b: floor badge and the cue ahead of a floor change ---------------------------------

test("S12 Floor badge: names the floor under your feet and changes when a ride ends", () => {
  const map = loadMap();
  const place = placeOf(map);
  assert.equal(levelName(place, at(map, "lift2G").y), "Ground floor");
  assert.equal(levelName(place, at(map, "lift2U").y), "Departures");
  assert.equal(levelName(place, at(map, "gateC3").y), "C pier");
  // Seated feet sit below the floor; still the same floor.
  assert.equal(levelName(place, at(map, "lift2U").y - 0.45), "Departures");
  // On the escalator the badge keeps the floor you left until past the middle, then names the
  // floor you ride to (never C pier, 1 m below Departures).
  const r = route(map, "sign", "gateB12", "walk");
  const badge = (p: Vec3) => levelName(place, tripAhead(map, r, p)!.floorY);
  assert.equal(badge({ x: 30, y: 1.5, z: 20.5 }), "Ground floor");
  assert.equal(badge({ x: 30, y: 4.5, z: 25.5 }), "Departures");
  assert.equal(badge(at(map, "escTop")), "Departures");
  // Seated feet (0.45 m low) in Lift 2 at the top.
  const s = route(map, "sign", "gateB12", "stepFree");
  const top = at(map, "lift2U");
  assert.equal(levelName(place, tripAhead(map, s, { ...top, y: top.y - 0.45 })!.floorY), "Departures");
});

test("S11 Halfway up the escalator the pill still counts floors from the floor you left", () => {
  const map = loadMap();
  const r = route(map, "sign", "gateB12", "walk");
  const low = tripAhead(map, r, { x: 30, y: 1.5, z: 20.5 })!; // a quarter of the way up
  assert.equal(low.floors, 1);
  assert.equal(low.next!.change.edge.kind, "escalator");
  const high = tripAhead(map, r, { x: 30, y: 4.5, z: 25.5 })!; // three quarters up
  assert.equal(high.floors, 0);
  assert.equal(high.next, null);
});

test("S13 Floor-change cue: the next change ahead, how far it is and which way it goes", () => {
  const map = loadMap();
  const r = route(map, "sign", "gateB12", "walk");
  const t = tripAhead(map, r, at(map, "sign"))!;
  assert.ok(t.next);
  assert.equal(t.next!.change.edge.kind, "escalator");
  assert.equal(t.next!.change.up, true);
  assert.equal(t.next!.change.from, "escFoot");
  assert.ok(Math.abs(t.next!.metres - 16) < 1e-6, String(t.next!.metres)); // sign -> hall 6 + hall -> foot 10
  // Past the change, nothing is ahead.
  assert.equal(tripAhead(map, r, at(map, "concourse"))!.next, null);
  assert.equal(FLOOR_CUE_DISTANCE, 15);
});

test("S13 Cue texts say up or down and name the floor: 'In 15 m: lift down to Ground floor'", () => {
  assert.equal(floorCue("lift", false, "Ground floor", 14.6), "In 15 m: lift down to Ground floor");
  assert.equal(floorCue("escalator", true, "Departures", 9.2), "In 9 m: escalator up to Departures");
  assert.equal(floorCue("stairs", false, "C pier", 1.2), "Now: stairs down to C pier");
  assert.equal(destinationFloorText("Gate C3", "C pier", -1), "Gate C3 is on C pier, 1 floor down");
  assert.equal(destinationFloorText("Gate B12", "Departures", 0), "Gate B12 is on this floor");
});

test("S13 Step-Free cues are only ever a lift or a ramp", () => {
  const map = loadMap();
  let cues = 0;
  for (const to of ["gateB12", "gateC3", "sign"]) {
    for (const from of ["sign", "concourse", "gateC3", "gateB12"]) {
      if (from === to) continue;
      const r = findRoute(map, from, to, "stepFree");
      if (r.status !== "route") continue;
      for (const c of tripAhead(map, r, at(map, from))!.changes) {
        cues++;
        assert.ok(c.edge.kind === "lift" || c.edge.kind === "ramp", from + " -> " + to + " cue " + c.edge.kind);
      }
    }
  }
  assert.ok(cues > 0, "some cue was checked");
});

// ---- c: the line stays on your floor ------------------------------------------------------

test("S14 Line on your floor: cut at the foot of the next level change, with an up/down marker there", () => {
  const P = (x: number, y: number, z: number) => ({ x, y, z });
  const esc = [P(0, 0, 0), P(0, 0, 4), P(0, 6, 14), P(0, 6, 18)];
  const a = lineOnLevel(esc);
  assert.deepEqual(a.line, [P(0, 0, 0), P(0, 0, 4)]);
  assert.deepEqual(a.marker, { at: P(0, 0, 4), up: true });
  const lift = [P(0, 6, 0), P(0, 6, 4), P(0, 0, 4), P(3, 0, 4)];
  assert.deepEqual(lineOnLevel(lift).marker, { at: P(0, 6, 4), up: false });
  assert.deepEqual(lineOnLevel(lift).line, [P(0, 6, 0), P(0, 6, 4)]);
  // 0.3 m past the foot, still on the ground (projected 0.18 m up the slope): not riding yet, so
  // no line up the escalator, just the marker (review finding 6).
  const justPast = lineOnLevel([P(0, 0.18, 4.3), P(0, 6, 14), P(0, 6, 18)], 0);
  assert.equal(justPast.line.length, 1);
  assert.deepEqual(justPast.marker, { at: P(0, 0.18, 4.3), up: true });
  // Standing on the escalator (first segment slopes): it is drawn to the top and on.
  const riding = [P(0, 3, 9), P(0, 6, 14), P(0, 6, 18)];
  assert.deepEqual(lineOnLevel(riding), { line: riding, marker: null });
  assert.deepEqual(lineOnLevel(riding, 0), { line: riding, marker: null });
  // Almost at the top (0.1 m below Departures): still drawn, not cut.
  const nearTop = [P(0, 5.9, 13.8), P(0, 6, 14), P(0, 6, 18)];
  assert.deepEqual(lineOnLevel(nearTop, 6), { line: nearTop, marker: null });
  // Halfway up, level with another floor's height (the airport's C pier at 5 m): still drawn.
  const midway = [P(0, 5, 12.3), P(0, 6, 14), P(0, 6, 18)];
  assert.deepEqual(lineOnLevel(midway, 6), { line: midway, marker: null });
  // Standing in a lift (first segment vertical): no line, just the marker.
  assert.deepEqual(lineOnLevel([P(0, 0, 4), P(0, 6, 4), P(3, 6, 4)]), { line: [P(0, 0, 4)], marker: { at: P(0, 0, 4), up: true } });
  // A flat route has no marker.
  assert.deepEqual(lineOnLevel([P(0, 0, 0), P(5, 0, 0)]).marker, null);
});

// ---- g: going down works as well as going up ----------------------------------------------

test("S15 Re-routing at the foot of the up escalator never sends you back through the hall (review finding 5)", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  nav.updatePosition({ x: 28.6, y: 0, z: 18.5 });
  nav.setDestination("gateC3");
  assert.equal(nav.route.status, "route");
  if (nav.route.status === "route") assert.ok(!nav.route.nodes.includes("hall"), nav.route.nodes.join(">"));
});

test("S15 Going down on Walk rides the down escalator; with it closed, the stairs", () => {
  const map = loadMap();
  const r = route(map, "concourse", "sign", "walk");
  const esc = r.edges.filter((e) => e.kind === "escalator");
  assert.equal(esc.length, 1);
  assert.equal(at(map, esc[0].from).y, 6, "the escalator ridden runs from the top");
  assert.equal(at(map, esc[0].to).y, 0);
  const closed = JSON.parse(MAP_TEXT);
  for (const e of closed.edges) if (e.kind === "escalator") e.open = false;
  const r2 = route(loadMap(JSON.stringify(closed)), "concourse", "sign", "walk");
  assert.ok(r2.edges.some((e) => e.kind === "stairs"));
  // Both directions are cued as such.
  const t = tripAhead(map, r, at(map, "concourse"))!;
  assert.equal(t.next!.change.edge.kind, "escalator");
  assert.equal(t.next!.change.up, false);
  assert.equal(t.floors, -1);
});

test("S15 The up escalator is never ridden down and the down one never up", () => {
  const map = loadMap();
  for (const e of map.edges.filter((x) => x.kind === "escalator")) {
    const up = at(map, e.to).y > at(map, e.from).y;
    const r = route(map, up ? "sign" : "concourse", up ? "concourse" : "sign", "walk");
    assert.ok(r.edges.includes(e), (up ? "up" : "down") + " escalator " + e.from + " used going " + (up ? "up" : "down"));
    // And against its direction no route rides it: the way back is another connection.
    const back = findRoute(map, e.to, e.from, "walk");
    if (back.status === "route") {
      back.edges.forEach((x, i) => assert.ok(!(x === e && back.nodes[i] === e.to), "rode " + e.from + " backwards"));
    }
  }
});

test("S16 Riding a lift down: Step-Free from Departures to the entrance takes a lift down, never stairs or escalators", () => {
  const map = loadMap();
  const r = route(map, "gateB12", "sign", "stepFree");
  assert.ok(r.edges.every((e) => e.kind !== "stairs" && e.kind !== "escalator"));
  const t = tripAhead(map, r, at(map, "gateB12"))!;
  assert.equal(t.changes.length, 1);
  assert.equal(t.changes[0].edge.kind, "lift");
  assert.equal(t.changes[0].up, false);
  assert.equal(t.floors, -1);
});

test("S16 Stairs down on Walk: Departures to C pier takes the stairs down, Step-Free the ramp down", () => {
  const map = loadMap();
  const w = tripAhead(map, route(map, "concourse", "gateC3", "walk"), at(map, "concourse"))!;
  assert.deepEqual(w.changes.map((c) => c.edge.kind + (c.up ? " up" : " down")), ["stairs down"]);
  const s = tripAhead(map, route(map, "concourse", "gateC3", "stepFree"), at(map, "concourse"))!;
  assert.deepEqual(s.changes.map((c) => c.edge.kind + (c.up ? " up" : " down")), ["ramp down"]);
});

test("S17 Three levels: ground -> Departures -> C pier is cued up, then down", () => {
  const map = loadMap();
  const w = tripAhead(map, route(map, "sign", "gateC3", "walk"), at(map, "sign"))!;
  assert.deepEqual(w.changes.map((c) => c.up), [true, false]);
  assert.equal(w.floors, 1);
  assert.equal(destinationFloorText("Gate C3", "C pier", w.floors), "Gate C3 is on C pier, 1 floor up");
  const s = tripAhead(map, route(map, "sign", "gateC3", "stepFree"), at(map, "sign"))!;
  assert.deepEqual(s.changes.map((c) => c.edge.kind + (c.up ? " up" : " down")), ["lift up", "ramp down"]);
});

test("S17 A trip that starts upstairs and ends downstairs: the cue counts down to the change and then moves on", () => {
  const map = loadMap();
  const nav = new Navigator(map, "gateB12", "sign", "walk");
  const pts = routePoints(map, nav.route);
  let seenDown = false;
  for (const p of pts) {
    nav.updatePosition(p);
    const t = tripAhead(map, nav.route, p);
    if (!t) break;
    if (t.next && !t.next.change.up) seenDown = true;
  }
  assert.ok(seenDown);
  assert.equal(nav.route.status, "arrived");
});

// ---- S18: walking up stairs, ramps and escalators in the preview -----------------------------

const SLOPE_MAP = {
  nodes: [
    { id: "a", x: 0, y: 0, z: 0 },
    { id: "b", x: 0, y: 5, z: 10 },
    { id: "c", x: 20, y: 5, z: 10 },
    { id: "d", x: 20, y: 0, z: 0 },
  ],
  edges: [
    { from: "a", to: "b", kind: "stairs", open: true },
    { from: "b", to: "c", kind: "walk", open: true },
    { from: "c", to: "d", kind: "escalator", open: true },
  ],
};

test("S18 Walking along stairs lifts the feet to the slope's height, up to the top", () => {
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0, y: 0, z: 0.5 }), 0.25);
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0, y: 2.3, z: 5 }), 2.5);
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0.8, y: 4.8, z: 10 }), 5);
});

test("S18 Stairs also work going down", () => {
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0, y: 5, z: 9 }), 4.5);
});

test("S18 Beside the stairs, past either end or under them, nothing changes", () => {
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 3, y: 0, z: 1 }), null);
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0, y: 0, z: -1 }), null);
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0, y: 5, z: 11 }), null);
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 0, y: 0, z: 5 }), null, "walking underneath stays on the floor below");
});

test("S18 A closed connection and a flat walk edge are not slopes", () => {
  const closed = { nodes: SLOPE_MAP.nodes, edges: [{ from: "a", to: "b", kind: "stairs", open: false }] };
  assert.equal(feetOnSlope(closed, { x: 0, y: 0, z: 0.5 }), null);
  const flat = { nodes: SLOPE_MAP.nodes, edges: [{ from: "a", to: "b", kind: "walk", open: true }] };
  assert.equal(feetOnSlope(flat, { x: 0, y: 0, z: 0.5 }), null);
});

test("S18 An escalator only carries you its own way", () => {
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 20, y: 5, z: 9.5 }), 4.75, "the down escalator takes you down");
  assert.equal(feetOnSlope(SLOPE_MAP, { x: 20, y: 0, z: 0.5 }), null, "and never up");
});

test("S18 Every stairs, ramp and escalator in the mall can be walked from end to end", () => {
  const map = JSON.parse(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  const slopes = map.edges.filter((e: any) => ["stairs", "ramp", "escalator"].includes(e.kind));
  assert.ok(slopes.length >= 6);
  for (const e of slopes) {
    const from = map.nodes.find((n: any) => n.id === e.from), to = map.nodes.find((n: any) => n.id === e.to);
    let y = from.y;
    for (let i = 1; i < 100; i++) {
      const t = i / 100;
      const next = feetOnSlope(map, { x: from.x + (to.x - from.x) * t, y, z: from.z + (to.z - from.z) * t });
      assert.notEqual(next, null, e.from + " to " + e.to + " at " + t);
      y = next as number;
    }
    assert.ok(Math.abs(y - to.y) < 0.1, e.from + " reaches " + e.to);
  }
});

test("S10b Sitting down at a lift or stairs changes neither the distance nor the floor", () => {
  const mall = loadMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  for (const [from, to, profile] of [["fBM", "supermarket", "stepFree"], ["fBM", "boltHardware", "walk"], ["fE", "glowBeauty", "walk"]] as [string, string, Profile][]) {
    const r = route(mall, from, to, profile);
    const pts = routePoints(mall, r);
    const along = pts.slice(0, -1).flatMap((p, i) => {
      const q = pts[i + 1];
      return Math.abs(p.y - q.y) < 0.5 ? [0, 0.3, 0.7].map((t) => ({ x: p.x + (q.x - p.x) * t, y: p.y, z: p.z + (q.z - p.z) * t })) : [p];
    });
    for (const p of along) {
      const standing = tripAhead(mall, r, p)!;
      const seated = tripAhead(mall, r, { x: p.x, y: p.y - 0.6, z: p.z })!;
      assert.ok(Math.abs(seated.metres - standing.metres) < 1e-6, from + " at " + p.x + "," + p.y + "," + p.z + ": " + seated.metres + " vs " + standing.metres);
      assert.equal(seated.floorY, standing.floorY);
    }
  }
});
