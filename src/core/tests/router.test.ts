import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASK_STAFF_MESSAGE,
  Navigator,
  findNode,
  findRoute,
  lineAhead,
  parseMap,
  setEdgeOpen,
  type MapData,
  type MapEdge,
  type Profile,
} from "../router.ts";

const MAP_TEXT = readFileSync(new URL("../data/map.json", import.meta.url), "utf8");

function loadMap(): MapData {
  const parsed = parseMap(MAP_TEXT);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.map;
}

function kinds(edges: MapEdge[]): string[] {
  return edges.map((e) => e.kind);
}

function routeOf(map: MapData, from: string, to: string, profile: Profile) {
  const r = findRoute(map, from, to, profile);
  assert.equal(r.status, "route", from + " -> " + to + " (" + profile + ") should have a route");
  if (r.status !== "route") throw new Error("unreachable");
  return r;
}

// Brute force: shortest length over every simple path, honouring escalator direction.
function bruteShortest(map: MapData, from: string, to: string, profile: Profile): number {
  let best = Infinity;
  const seen: { [id: string]: boolean } = { [from]: true };
  function walk(at: string, sofar: number) {
    if (sofar >= best) return;
    if (at === to) {
      best = sofar;
      return;
    }
    for (const e of map.edges) {
      if (!e.open) continue;
      if (profile === "stepFree" && (e.kind === "stairs" || e.kind === "escalator")) continue;
      const next = e.from === at ? e.to : e.to === at && e.kind !== "escalator" ? e.from : null;
      if (next === null || seen[next]) continue;
      seen[next] = true;
      walk(next, sofar + e.length);
      seen[next] = false;
    }
  }
  walk(from, 0);
  return best;
}

test("map.json parses and every edge is at least as long as the straight line", () => {
  const map = loadMap();
  for (const e of map.edges) {
    const a = findNode(map, e.from)!;
    const b = findNode(map, e.to)!;
    const straight = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    assert.ok(e.length >= straight - 0.1, e.from + " -> " + e.to + " is shorter than the straight line");
  }
  assert.ok(findNode(map, "sign"));
  assert.ok(findNode(map, "gateB12"));
  assert.ok(findNode(map, "gateC3"));
});

test("Walk to B12 goes up the escalator (hero moment, traveller 1)", () => {
  const r = routeOf(loadMap(), "sign", "gateB12", "walk");
  assert.ok(kinds(r.edges).includes("escalator"));
  assert.deepEqual(r.nodes, ["sign", "hall", "escFoot", "escTop", "concourse", "bJunction", "gateB12"]);
});

test("Step-Free to B12 takes Lift 1 (hero moment, traveller 2)", () => {
  const r = routeOf(loadMap(), "sign", "gateB12", "stepFree");
  assert.ok(r.nodes.includes("lift1G") && r.nodes.includes("lift1U"));
});

test("Step-Free never uses stairs or escalators, for every pair of nodes", () => {
  const map = loadMap();
  for (const a of map.nodes) {
    for (const b of map.nodes) {
      const r = findRoute(map, a.id, b.id, "stepFree");
      if (r.status !== "route") continue;
      for (const k of kinds(r.edges)) {
        assert.ok(k !== "stairs" && k !== "escalator", a.id + " -> " + b.id + " used " + k);
      }
    }
  }
});

test("Walk route is the shortest possible, for every pair of nodes", () => {
  const map = loadMap();
  for (const a of map.nodes) {
    for (const b of map.nodes) {
      if (a.id === b.id) continue;
      const r = findRoute(map, a.id, b.id, "walk");
      const best = bruteShortest(map, a.id, b.id, "walk");
      if (best === Infinity) {
        assert.equal(r.status, "askStaff", a.id + " -> " + b.id);
        continue;
      }
      assert.equal(r.status, "route", a.id + " -> " + b.id);
      if (r.status === "route") assert.ok(Math.abs(r.length - best) < 1e-6, a.id + " -> " + b.id);
    }
  }
});

test("Step-Free route is the shortest step-free path, for every pair of nodes", () => {
  const map = loadMap();
  for (const a of map.nodes) {
    for (const b of map.nodes) {
      if (a.id === b.id) continue;
      const r = findRoute(map, a.id, b.id, "stepFree");
      const best = bruteShortest(map, a.id, b.id, "stepFree");
      if (best === Infinity) assert.equal(r.status, "askStaff");
      else if (r.status === "route") assert.ok(Math.abs(r.length - best) < 1e-6);
      else assert.fail(a.id + " -> " + b.id + " should have a step-free route");
    }
  }
});

test("Escalators are one-way: going down uses the stairs on Walk", () => {
  const r = routeOf(loadMap(), "concourse", "sign", "walk");
  assert.ok(!kinds(r.edges).includes("escalator"));
  assert.ok(kinds(r.edges).includes("stairs"));
});

test("Lift 1 out of service: Step-Free re-routes to Lift 2", () => {
  const map = setEdgeOpen(loadMap(), "lift1", false);
  const r = routeOf(map, "sign", "gateB12", "stepFree");
  assert.ok(r.nodes.includes("lift2G") && !r.nodes.includes("lift1G"));
});

test("Both lifts out: Step-Free returns a clear ask-staff result", () => {
  let map = setEdgeOpen(loadMap(), "lift1", false);
  map = setEdgeOpen(map, "lift2", false);
  const r = findRoute(map, "sign", "gateB12", "stepFree");
  assert.equal(r.status, "askStaff");
  if (r.status === "askStaff") assert.equal(r.message, ASK_STAFF_MESSAGE);
  // Walk still has the escalator.
  assert.equal(findRoute(map, "sign", "gateB12", "walk").status, "route");
});

test("Destination equal to start returns arrival", () => {
  const r = findRoute(loadMap(), "gateB12", "gateB12", "walk");
  assert.equal(r.status, "arrived");
  assert.equal(findRoute(loadMap(), "sign", "sign", "stepFree").status, "arrived");
});

test("Unknown start or gate returns an error, not a crash", () => {
  assert.equal(findRoute(loadMap(), "nowhere", "gateB12", "walk").status, "error");
  assert.equal(findRoute(loadMap(), "sign", "gateZ99", "walk").status, "error");
});

test("A closed edge in map.json is respected", () => {
  const raw = JSON.parse(MAP_TEXT);
  for (const e of raw.edges) if (e.kind === "escalator") e.open = false;
  const parsed = parseMap(JSON.stringify(raw));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const r = routeOf(parsed.map, "sign", "gateB12", "walk");
  assert.ok(!kinds(r.edges).includes("escalator"));
});

test("Gate change B12 -> C3 re-routes both travellers (hero moment)", () => {
  const walker = new Navigator(loadMap(), "sign", "gateB12", "walk");
  const stepFree = new Navigator(loadMap(), "sign", "gateB12", "stepFree");
  assert.equal(walker.setGate("gateC3"), true);
  assert.equal(stepFree.setGate("gateC3"), true);
  assert.equal(walker.route.status, "route");
  assert.equal(stepFree.route.status, "route");
  if (walker.route.status === "route") assert.equal(walker.route.nodes.at(-1), "gateC3");
  if (stepFree.route.status === "route") {
    assert.ok(stepFree.route.nodes.includes("lift2G"));
    assert.ok(kinds(stepFree.route.edges).includes("ramp"));
  }
});

test("Switching Walk -> Step-Free moves the line from the escalator to the lift", () => {
  const nav = new Navigator(loadMap(), "sign", "gateB12", "walk");
  assert.equal(nav.setProfile("stepFree"), true);
  if (nav.route.status === "route") {
    assert.ok(!kinds(nav.route.edges).includes("escalator"));
    assert.ok(kinds(nav.route.edges).includes("lift"));
  }
});

test("Pinching the red sign on Lift 1 mid-trip re-routes Step-Free", () => {
  const nav = new Navigator(loadMap(), "sign", "gateB12", "stepFree");
  assert.equal(nav.setEdgeOpen("lift1", false), true);
  if (nav.route.status === "route") assert.ok(nav.route.nodes.includes("lift2G"));
  assert.equal(nav.setEdgeOpen("lift1", true), true);
});

test("parseMap rejects broken map files with a readable error", () => {
  const cases: [string, RegExp][] = [
    ["{not json", /not valid JSON/],
    ["[]", /no nodes/],
    ['{"nodes":[{"id":"a","x":0,"y":0,"z":0,"kind":"sign"}]}', /no edges/],
    ['{"nodes":[{"id":"a","x":0,"y":0,"z":0,"kind":"sign"}],"edges":[{"from":"a","to":"b","length":1,"kind":"walk","open":true}]}', /unknown node/],
    ['{"nodes":[{"id":"a","x":0,"y":0,"z":0,"kind":"sign"},{"id":"b","x":1,"y":0,"z":0,"kind":"gate"}],"edges":[{"from":"a","to":"b","length":1,"kind":"teleport","open":true}]}', /unknown kind/],
    ['{"nodes":[{"id":"a","x":0,"y":0,"z":0,"kind":"sign"},{"id":"b","x":1,"y":0,"z":0,"kind":"gate"}],"edges":[{"from":"a","to":"b","length":0,"kind":"walk","open":true}]}', /positive length/],
    ['{"nodes":[{"id":"a","x":"0","y":0,"z":0,"kind":"sign"}],"edges":[]}', /bad x/],
    ['{"nodes":[{"id":"a","x":0,"y":0,"z":0,"kind":"sign"},{"id":"a","x":1,"y":0,"z":0,"kind":"gate"}],"edges":[]}', /duplicate/],
  ];
  for (const [text, err] of cases) {
    const r = parseMap(text);
    assert.equal(r.ok, false, text);
    if (!r.ok) assert.match(r.error, err);
  }
});

test("Floor line is clipped to 10 m ahead of the traveller", () => {
  const pts = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 30 },
  ];
  const line = lineAhead(pts, { x: 0.5, y: 0, z: 5 }, 10);
  assert.deepEqual(line[0], { x: 0, y: 0, z: 5 });
  assert.deepEqual(line.at(-1), { x: 0, y: 0, z: 15 });
});

test("Floor line follows a turn and stops at the gate", () => {
  const pts = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 4 },
    { x: 3, y: 0, z: 4 },
  ];
  const line = lineAhead(pts, { x: 0, y: 0, z: 2 }, 10);
  assert.equal(line.length, 3);
  assert.deepEqual(line.at(-1), { x: 3, y: 0, z: 4 });
});
