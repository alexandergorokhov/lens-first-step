// Tests for the independent review's findings (C1–C13, spec gaps, A2). Each was written
// before its fix and seen to fail. New APIs are loaded with dynamic import inside each test so
// a missing export only fails that test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASK_STAFF_MESSAGE,
  NO_ROUTE_MESSAGE,
  Navigator,
  findNode,
  findRoute,
  parseMap,
  setEdgeOpen,
  type MapData,
} from "../router.ts";

function load(file: string): MapData {
  const r = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file + ": " + r.error);
  return r.map;
}
const P = (x: number, y: number, z: number) => ({ x, y, z });
function nodesOf(nav: Navigator): string[] {
  return nav.route.status === "route" ? nav.route.nodes : [];
}

// ── C1 seated traveller ─────────────────────────────────────────────────────

test("C1 ride reach: seated traveller (feet −0.45 m) 0.5 m from lift2G can ride", async () => {
  const { withinReach, levelsOf, tripSettings } = (await import("../router.ts")) as any;
  const map = load("map.json");
  const lift = findNode(map, "lift2G")!;
  const reach = tripSettings(map).rideReach.lift;
  assert.equal(withinReach(P(lift.x + 0.5, -0.45, lift.z), lift, reach, levelsOf(map)), true);
  assert.equal(withinReach(P(lift.x + 3, -0.45, lift.z), lift, reach, levelsOf(map)), false, "3 m away is too far");
  assert.equal(withinReach(P(lift.x, 6, lift.z), lift, reach, levelsOf(map)), false, "on another level");
});

test("C1 level snap: feet within 1 m of a level snap to it; in between they don't", async () => {
  const { snapToLevel } = (await import("../router.ts")) as any;
  assert.equal(snapToLevel(-0.45, [0, 5, 6]), 0);
  assert.equal(snapToLevel(5.7, [0, 5, 6]), 6);
  assert.equal(snapToLevel(2.9, [0, 6]), 2.9);
});

// ── C2 per-map distances ────────────────────────────────────────────────────

test("C2 tripSettings: defaults 3 m arrival / 5 m off-route / rides 2.5 m lift, 3.5 m others; a map can override", async () => {
  const { tripSettings } = (await import("../router.ts")) as any;
  assert.deepEqual(tripSettings(load("map.json")), {
    arrivalRadius: 3, offRouteDistance: 5, rideReach: { lift: 2.5, other: 3.5 },
    speeds: { walk: 1.3, stepFree: 1 }, rideTimes: { lift: 45, escalator: 20, stairs: 15, ramp: 0 },
  });
  const room = tripSettings(load("room.json"));
  assert.ok(room.arrivalRadius < 1 && room.offRouteDistance < 2, JSON.stringify(room));
});

test("C2 room: one metre past the sign is still onRoute", () => {
  const nav = new Navigator(load("room.json"), "sign", "window", "walk");
  assert.equal(nav.updatePosition(P(0, 0, 1)), "onRoute");
  assert.equal(nav.route.status, "route");
});

test("C2 room: change to the door from mid-room gives a route", () => {
  const nav = new Navigator(load("room.json"), "sign", "window", "walk");
  nav.updatePosition(P(0, 0, 2.5));
  (nav as any).setDestination ? (nav as any).setDestination("door") : nav.setGate("door");
  assert.equal(nav.updatePosition(P(0, 0, 2.5)), "onRoute");
  assert.deepEqual(nodesOf(nav), ["mid", "door"]);
});

// ── C3 leaving the destination ──────────────────────────────────────────────

test("S6b after arriving, 5.5 m from B12 does not report rerouted on consecutive frames and is not stuck", () => {
  const map = load("map.json");
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const gate = findNode(map, "gateB12")!;
  const bj = findNode(map, "bJunction")!;
  assert.equal(nav.updatePosition(P(gate.x, gate.y, gate.z)), "arrived");
  // Walk on past the gate, away from the B-gates junction, so the gate stays the nearest node.
  const d = Math.hypot(bj.x - gate.x, bj.z - gate.z);
  const away = P(gate.x - ((bj.x - gate.x) / d) * 5.5, gate.y, gate.z - ((bj.z - gate.z) / d) * 5.5);
  assert.equal(nav.updatePosition(away), "rerouted");
  assert.equal(nav.route.status, "route", "not stuck in 'arrived'");
  assert.equal(nodesOf(nav).at(-1), "gateB12");
  assert.equal(nav.updatePosition(away), "onRoute", "second frame is not another re-route");
});

// ── C5 notices ──────────────────────────────────────────────────────────────

test("C5 noticeFor: askStaff on Walk says NO_ROUTE_MESSAGE, on Step-Free ASK_STAFF_MESSAGE; error has text; a route has none", async () => {
  const { noticeFor } = (await import("../router.ts")) as any;
  const closed = setEdgeOpen(setEdgeOpen(setEdgeOpen(load("map.json"), "lift1", false), "lift2", false), "rampC", false);
  const walkNoWay = findRoute(setEdgeOpen(closed, "lift1", false), "gateC3", "sign", "walk");
  // From C3 back to the sign on Walk with the lifts closed there is still a way (stairs), so build a dead end:
  const island: MapData = { version: 1, nodes: [P(0, 0, 0), P(1, 0, 0), P(5, 0, 0)].map((p, i) => ({ id: "n" + i, kind: i === 1 ? "assistance" : "junction", ...p })), edges: [{ from: "n0", to: "n1", length: 1, kind: "walk", open: true }] };
  assert.equal(noticeFor(findRoute(island, "n0", "n2", "walk")), NO_ROUTE_MESSAGE);
  assert.equal(noticeFor(findRoute(closed, "sign", "gateB12", "stepFree")), ASK_STAFF_MESSAGE);
  assert.ok((noticeFor(findRoute(closed, "nowhere", "gateB12", "walk")) || "").length > 0, "error has text");
  assert.equal(noticeFor(walkNoWay), null, "a route has no notice");
});

// ── C6 frame origin height ──────────────────────────────────────────────────

test("C6 map frame: start node is the local origin even at y=4; round trip exact", async () => {
  const { mapToLocalCm, localCmToMap } = (await import("../geometry.ts")) as any;
  const origin = P(15, 4, 2);
  assert.deepEqual(mapToLocalCm(P(15, 4, 2), origin), P(0, 0, -0));
  assert.deepEqual(mapToLocalCm(P(16, 6, 5), origin, 1), P(100, 201, -300));
  const eyes = P(250, 380, -1200);
  const feet = localCmToMap(eyes, origin, 180);
  assert.deepEqual(feet, P(17.5, 6, 14));
  assert.deepEqual(mapToLocalCm(feet, origin, 180), eyes);
});

// ── C7 validate the place block ─────────────────────────────────────────────

test("E2b parseMap rejects place/event refs to unknown nodes/edges and unsupported version", () => {
  const good = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  const bad = (mut: (m: any) => void, why: RegExp) => {
    const m = structuredClone(good);
    mut(m);
    const r = parseMap(JSON.stringify(m));
    assert.equal(r.ok, false, "should reject: " + why);
    if (!r.ok) assert.match(r.error, why);
  };
  bad((m) => (m.place.start = "nope"), /start/);
  bad((m) => (m.place.start = "hall"), /start/);
  bad((m) => (m.place.destination = "nope"), /destination/);
  bad((m) => (m.place.events[0].to = "nope"), /event/);
  bad((m) => (m.place.events[1].edge = "nope"), /event/);
  bad((m) => (m.place.events[1].at = "nope"), /event/);
  bad((m) => delete m.edges.find((e: any) => e.kind === "lift").id, /lift/);
  bad((m) => (m.version = 2), /version/);
  assert.equal(parseMap(JSON.stringify(good)).ok, true);
});

// ── C8 prototype-safe lookups ───────────────────────────────────────────────

const tiny = (ids: string[], edges: [string, string][]) =>
  JSON.stringify({ version: 1, nodes: ids.map((id, i) => ({ id, x: i, y: 0, z: 0, kind: i === 0 ? "sign" : "junction" })), edges: edges.map(([from, to]) => ({ from, to, length: 20, kind: "walk", open: true })) });

test("C8 parseMap rejects an edge to 'toString'", () => {
  const r = parseMap(tiny(["a", "b"], [["a", "toString"]]));
  assert.equal(r.ok, false);
});

test("C8 parseMap rejects the reserved id 'constructor' but routes a node called 'toString'", () => {
  assert.equal(parseMap(tiny(["a", "constructor"], [["a", "constructor"]])).ok, false);
  const r = parseMap(tiny(["a", "toString"], [["a", "toString"]]));
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  if (r.ok) assert.equal(findRoute(r.map, "a", "toString", "walk").status, "route");
});

test("C8 findRoute never throws for any map parseMap accepts", () => {
  // Reserved ids (constructor, __proto__, prototype) are always rejected: see security.test.ts R2.
  const names = ["a", "b", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf", "0", ""];
  let checked = 0;
  for (let s = 0; s < 200; s++) {
    const ids = names.filter((_, i) => (s >> i) % 2 === 1 || i < 2);
    const edges: [string, string][] = [];
    // Edge ends come from all names, so some point at names that aren't nodes ("toString"...).
    for (let i = 0; i < ids.length; i++) edges.push([ids[i], names[(i * 7 + s) % names.length]]);
    const r = parseMap(tiny(ids, edges));
    if (!r.ok) continue;
    for (const a of ids) for (const b of ids) {
      assert.doesNotThrow(() => findRoute(r.map, a, b, "walk"), `${a} -> ${b}`);
      checked++;
    }
  }
  assert.ok(checked > 50);
});

// ── C9 arrival on the same level ────────────────────────────────────────────

test("C9 arrival needs the same level: standing under a mezzanine destination is not arrival", () => {
  const mezz: MapData = {
    version: 1,
    nodes: [
      { id: "s", x: 0, y: 0, z: 0, kind: "sign" },
      { id: "foot", x: 10, y: 0, z: 0, kind: "junction" },
      { id: "top", x: 14, y: 2.8, z: 0, kind: "junction" },
      { id: "desk", x: 4, y: 2.8, z: 0, kind: "destination" },
    ],
    edges: [
      { from: "s", to: "foot", length: 10, kind: "walk", open: true },
      { from: "foot", to: "top", length: 5, kind: "stairs", open: true },
      { from: "top", to: "desk", length: 10, kind: "walk", open: true },
    ],
  };
  const nav = new Navigator(mezz, "s", "desk", "walk");
  assert.notEqual(nav.updatePosition(P(4, 0, 0)), "arrived", "right under the desk, one floor down");
  assert.equal(nav.updatePosition(P(4, 2.8, 0.5)), "arrived");
});

// ── C10 edge-aware change detection ─────────────────────────────────────────

test("C10 setProfile reports a change when only the connection kind changes", () => {
  const nav = new Navigator(load("map.json"), "cTop", "gateC3", "walk");
  assert.deepEqual(nodesOf(nav), ["cTop", "cJunction", "gateC3"]);
  assert.equal(nav.setProfile("stepFree"), true, "stairs -> ramp between the same nodes");
  assert.ok(nav.route.status === "route" && nav.route.edges[0].kind === "ramp");
});

// ── C11 ask-staff guidance follows the traveller ────────────────────────────

function askStaffNav(): { nav: Navigator; map: MapData } {
  const map = setEdgeOpen(setEdgeOpen(load("map.json"), "lift1", false), "lift2", false);
  return { nav: new Navigator(map, "sign", "gateB12", "stepFree"), map };
}

test("C11 askStaff: walking off the assistance line re-plans from the nearest node", () => {
  const { nav, map } = askStaffNav();
  assert.equal(nav.route.status, "askStaff");
  const lift1 = findNode(map, "lift1G")!;
  assert.equal(nav.updatePosition(P(lift1.x, 0, lift1.z)), "rerouted");
  assert.ok(nav.route.status === "askStaff" && nav.route.assistance && nav.route.assistance.nodes[0] === "lift1G");
});

test("C11 askStaff: reaching the assistance point counts as arrival", () => {
  const { nav, map } = askStaffNav();
  const assist = findNode(map, "assist")!;
  assert.equal(nav.updatePosition(P(assist.x + 1, 0, assist.z)), "arrived");
  assert.equal(nav.route.status, "arrived");
  assert.deepEqual(nav.route.status === "arrived" ? nav.route.nodes : [], ["assist"]);
});

// ── C13 / spec gaps: pure helpers ───────────────────────────────────────────

test("C13 yaw: looking straight down keeps the last valid yaw", async () => {
  const { yawFromForward } = (await import("../geometry.ts")) as any;
  assert.equal(yawFromForward(0, -1, 0.3), 0, "facing -Z: yaw 0");
  assert.ok(Math.abs(yawFromForward(-1, 0, 0) - Math.PI / 2) < 1e-9, "facing -X: +90 degrees");
  assert.equal(yawFromForward(0.001, -0.002, 0.7), 0.7, "straight down: keep the last yaw");
});

test("C13 closure card only says 'Re-routing' when the route used that connection", async () => {
  const { closureNotice } = (await import("../place.ts")) as any;
  const ev = { id: "lift1Out", type: "connectionClosed", edge: "lift1", at: "lift1G", sign: "Lift 1 out of service", card: "Lift 1 out of service. Re-routing." };
  assert.equal(closureNotice(ev, true), "Lift 1 out of service. Re-routing.");
  assert.equal(closureNotice(ev, false), "Lift 1 out of service");
});

test("Spec gap: the ride card names the level once", async () => {
  const { rideCard } = (await import("../place.ts")) as any;
  assert.equal(rideCard("lift", true, "Departures"), "Lift up to Departures");
  assert.equal(rideCard("escalator", true, "Departures"), "Escalator up to Departures");
  assert.equal(rideCard("stairs", false, "C pier"), "Stairs down to C pier");
  assert.equal(rideCard("ramp", true, "First floor"), "Ramp up to First floor");
});

test("Spec gap: every closable lift has its own red out-of-service sign in the map", () => {
  for (const f of ["map.json", "hospital.json", "campus.json"]) {
    const map: any = load(f);
    for (const e of map.edges) {
      if (e.kind !== "lift") continue;
      const ev = map.place.events.find((x: any) => x.type === "connectionClosed" && x.edge === e.id);
      assert.ok(ev, `${f}: lift ${e.id} has no red sign event`);
      assert.ok(ev.at === e.from || ev.at === e.to, `${f}: ${e.id} sign hangs at one of the lift's nodes`);
    }
  }
});

// ── A2 place helpers in a pure core module ──────────────────────────────────

test("A2 place.ts: placeOf defaults, levelName, approachDir, arrivalText", async () => {
  const { placeOf, levelName, approachDir, arrivalText } = (await import("../place.ts")) as any;
  const map = load("map.json");
  const place = placeOf(map);
  assert.equal(place.start, "sign");
  assert.equal(place.destination, "gateB12");
  assert.equal(levelName(place, 5.6), "Departures");
  assert.equal(arrivalText(map, "gateC3"), "Gate C3. Boarding in 6 min.");
  assert.equal(arrivalText(map, "assist"), "Assistance point");
  const d = approachDir(map, "lift1G");
  assert.ok(d.x < -0.9, "Lift 1 is entered from the hall to its west");
  const bare = placeOf({ version: 1, nodes: [{ id: "s", x: 0, y: 0, z: 0, kind: "sign" }, { id: "d", x: 1, y: 0, z: 0, kind: "destination" }], edges: [] });
  assert.deepEqual([bare.start, bare.destination, bare.scanSign.button], ["s", "d", "Scan sign"]);
});
