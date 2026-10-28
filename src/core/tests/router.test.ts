// Pure-logic tests for the route engine. Test names start with the scenario ID
// from devpost/SCENARIOS.md; scenarios that only the Lens can show are listed
// as todo until Prototypes B and C.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASK_STAFF_MESSAGE,
  MAP_LOAD_FAILED,
  Navigator,
  SIGN_NOT_IN_MAP,
  arrivalMessage,
  chooseMap,
  findNode,
  findRoute,
  gateChangeMessage,
  lineAhead,
  locateSign,
  parseMap,
  routePoints,
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

function nodesOf(nav: Navigator): string[] {
  return nav.route.status === "route" ? nav.route.nodes : [];
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

// ---- Scenarios -------------------------------------------------------------

test("S1 Walk: sign at entrance to B12 is the shortest path and uses the escalator", () => {
  const map = loadMap();
  const r = routeOf(map, "sign", "gateB12", "walk");
  assert.deepEqual(r.nodes, ["sign", "hall", "escFoot", "escTop", "concourse", "bJunction", "gateB12"]);
  assert.ok(kinds(r.edges).includes("escalator"));
  assert.ok(Math.abs(r.length - bruteShortest(map, "sign", "gateB12", "walk")) < 1e-6);
});

test("S1 Walk route is the shortest possible, for every pair of nodes", () => {
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

test("S2 Step-Free: same start and gate uses a lift, no stairs or escalator", () => {
  const r = routeOf(loadMap(), "sign", "gateB12", "stepFree");
  assert.ok(r.nodes.includes("lift1G") && r.nodes.includes("lift1U"));
  assert.ok(!kinds(r.edges).includes("stairs") && !kinds(r.edges).includes("escalator"));
});

test("S2 Step-Free never uses stairs or escalators and is the shortest step-free path, for every pair", () => {
  const map = loadMap();
  for (const a of map.nodes) {
    for (const b of map.nodes) {
      if (a.id === b.id) continue;
      const r = findRoute(map, a.id, b.id, "stepFree");
      const best = bruteShortest(map, a.id, b.id, "stepFree");
      if (best === Infinity) {
        assert.equal(r.status, "askStaff", a.id + " -> " + b.id);
        continue;
      }
      assert.equal(r.status, "route", a.id + " -> " + b.id);
      if (r.status !== "route") continue;
      for (const k of kinds(r.edges)) assert.ok(k !== "stairs" && k !== "escalator", a.id + " -> " + b.id + " used " + k);
      assert.ok(Math.abs(r.length - best) < 1e-6, a.id + " -> " + b.id);
    }
  }
});

test("S3 logic: switching mode mid-route re-routes from the current position with the other mode's rules", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const hall = findNode(map, "hall")!;
  assert.equal(nav.updatePosition({ x: hall.x, y: hall.y, z: hall.z + 1 }), "onRoute");
  assert.equal(nav.setProfile("stepFree"), true);
  assert.equal(nodesOf(nav)[0], "hall");
  assert.ok(nodesOf(nav).includes("lift1G"));
  assert.ok(nav.route.status === "route" && !kinds(nav.route.edges).includes("escalator"));
});

test.todo("S3 Lens: line redraws within 1 s of switching mode (Prototype B)");

test("S4 Gate change B12 -> C3 while walking: card text and re-route from current position", () => {
  const map = loadMap();
  assert.equal(gateChangeMessage(map, "gateB12", "gateC3"), "Gate change: B12 → C3");

  const walker = new Navigator(map, "sign", "gateB12", "walk");
  const concourse = findNode(map, "concourse")!;
  walker.updatePosition({ x: concourse.x + 1, y: concourse.y, z: concourse.z });
  assert.equal(walker.setGate("gateC3"), true);
  assert.equal(nodesOf(walker)[0], "concourse");
  assert.equal(nodesOf(walker).at(-1), "gateC3");

  // Hero moment: the Step-Free traveller's line swings from Lift 1 to Lift 2 and the ramp.
  const stepFree = new Navigator(map, "sign", "gateB12", "stepFree");
  assert.equal(stepFree.setGate("gateC3"), true);
  assert.ok(nodesOf(stepFree).includes("lift2G"));
  assert.ok(stepFree.route.status === "route" && kinds(stepFree.route.edges).includes("ramp"));
});

test.todo("S4 Lens: gate-change card shows and the line redraws within 1 s (Prototype B)");

test("S5 Lift out in Step-Free: pinching the red sign closes the lift and the new route avoids stairs/escalators", () => {
  const nav = new Navigator(loadMap(), "sign", "gateB12", "stepFree");
  assert.equal(nav.setEdgeOpen("lift1", false), true);
  assert.ok(nodesOf(nav).includes("lift2G") && !nodesOf(nav).includes("lift1G"));
  assert.ok(nav.route.status === "route" && !kinds(nav.route.edges).some((k) => k === "stairs" || k === "escalator"));
  assert.equal(nav.setEdgeOpen("lift1", true), true);
  assert.ok(nodesOf(nav).includes("lift1G"));
});

test("S6 Arrival: within 3 m of the gate the line stops and the card reads 'Gate C3. Boarding in 6 min.'", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateC3", "walk");
  const gate = findNode(map, "gateC3")!;
  assert.equal(nav.updatePosition({ x: gate.x + 3.5, y: gate.y, z: gate.z }), "onRoute");
  assert.equal(nav.updatePosition({ x: gate.x + 2.9, y: gate.y, z: gate.z }), "arrived");
  assert.equal(nav.route.status, "arrived");
  assert.equal(lineAhead(routePoints(map, nav.route), gate).length, 1, "no line to draw");
  assert.equal(arrivalMessage(map, "gateC3", 6), "Gate C3. Boarding in 6 min.");
  // Lingering at the gate stays arrived.
  assert.equal(nav.updatePosition({ x: gate.x + 4, y: gate.y, z: gate.z }), "arrived");
});

test("S7 Off route: more than 5 m from the line re-routes from the nearest node", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  // 4 m to the side of the sign -> hall leg: still on route.
  assert.equal(nav.updatePosition({ x: 34, y: 0, z: 5 }), "onRoute");
  // Wander off towards Lift 2, well over 5 m from the line.
  const lift2 = findNode(map, "lift2G")!;
  assert.equal(nav.updatePosition({ x: lift2.x + 1, y: 0, z: lift2.z }), "rerouted");
  assert.equal(nodesOf(nav)[0], "lift2G");
  assert.equal(nodesOf(nav).at(-1), "gateB12");
});

test.todo("S8 Lens: edge arrow points toward the next turn when it is out of view (Prototype B)");

test.todo("S9 Lens: map.json downloads from a URL and the 'online map' badge shows (Prototype C)");

test("S9/E1 logic: a valid download is used online; a failed or timed-out download uses the built-in map offline", () => {
  const online = chooseMap(MAP_TEXT, MAP_TEXT);
  assert.equal(online.source, "online");
  assert.equal(online.notice, null);

  const offline = chooseMap(null, MAP_TEXT);
  assert.equal(offline.source, "offline");
  assert.equal(offline.notice, null);
  assert.equal(findRoute(offline.map, "sign", "gateB12", "walk").status, "route");
});

test.todo("E1 Lens: download fails or takes over 5 s -> built-in map, 'offline map' badge, route works (Prototype C)");

test("E2 Invalid map.json: 'Map couldn't load', falls back to the built-in map, no crash", () => {
  const r = chooseMap("{ this is not json", MAP_TEXT);
  assert.equal(r.source, "offline");
  assert.equal(r.notice, MAP_LOAD_FAILED);
  assert.equal(findRoute(r.map, "sign", "gateB12", "walk").status, "route");

  const wrongShape = chooseMap('{"nodes":[]}', MAP_TEXT);
  assert.equal(wrongShape.notice, MAP_LOAD_FAILED);
});

test("E2 parseMap names what is wrong with a broken map file", () => {
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

test("E3 No step-free route (lift + ramp closed): ask-staff message and a line to the nearest assistance point", () => {
  const map = setEdgeOpen(loadMap(), "rampC", false);
  const r = findRoute(map, "sign", "gateC3", "stepFree");
  assert.equal(r.status, "askStaff");
  if (r.status !== "askStaff") return;
  assert.equal(r.message, ASK_STAFF_MESSAGE);
  assert.equal(r.message, "No step-free route. Ask staff at the assistance point.");
  assert.ok(r.assistance);
  assert.deepEqual(r.assistance!.nodes, ["sign", "hall", "assist"]);
  // Walk still gets there by the stairs.
  assert.equal(findRoute(map, "sign", "gateC3", "walk").status, "route");
});

test("E3 Both lifts closed: Step-Free to B12 also asks staff and points to the assistance point", () => {
  const map = setEdgeOpen(setEdgeOpen(loadMap(), "lift1", false), "lift2", false);
  const r = findRoute(map, "sign", "gateB12", "stepFree");
  assert.equal(r.status, "askStaff");
  if (r.status === "askStaff") assert.equal(r.assistance!.nodes.at(-1), "assist");
});

test("E4 Destination = current position: arrival right away, no line", () => {
  const map = loadMap();
  const r = findRoute(map, "gateB12", "gateB12", "walk");
  assert.equal(r.status, "arrived");
  assert.equal(lineAhead(routePoints(map, r), findNode(map, "gateB12")!).length, 1);
  assert.equal(findRoute(map, "sign", "sign", "stepFree").status, "arrived");
});

test("E5 Unknown sign id: 'This sign isn't in the map', nothing drawn", () => {
  const map = loadMap();
  const unknown = locateSign(map, "sign-T9-404");
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.message, SIGN_NOT_IN_MAP);
  // A real node that isn't a sign doesn't count either.
  assert.equal(locateSign(map, "hall").ok, false);
  assert.equal(locateSign(map, "sign").ok, true);
  assert.equal(findRoute(map, "sign-T9-404", "gateB12", "walk").status, "error");
});

test.todo("E6 Lens: line and cards readable and in view at seated eye height, Q key (Prototype B)");

// ---- Supporting checks (not scenarios) -------------------------------------

test("map.json: every edge is at least as long as the straight line; key nodes exist", () => {
  const map = loadMap();
  for (const e of map.edges) {
    const a = findNode(map, e.from)!;
    const b = findNode(map, e.to)!;
    const straight = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    assert.ok(e.length >= straight - 0.1, e.from + " -> " + e.to + " is shorter than the straight line");
  }
  for (const id of ["sign", "gateB12", "gateC3", "assist"]) assert.ok(findNode(map, id), id);
});

test("Escalators are one-way: going down uses the stairs on Walk", () => {
  const r = routeOf(loadMap(), "concourse", "sign", "walk");
  assert.ok(!kinds(r.edges).includes("escalator"));
  assert.ok(kinds(r.edges).includes("stairs"));
});

test("A closed edge in map.json is respected", () => {
  const raw = JSON.parse(MAP_TEXT);
  for (const e of raw.edges) if (e.kind === "escalator") e.open = false;
  const parsed = parseMap(JSON.stringify(raw));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.ok(!kinds(routeOf(parsed.map, "sign", "gateB12", "walk").edges).includes("escalator"));
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
