// Pure-logic tests for the route engine. Test names start with the scenario ID
// from devpost/SCENARIOS.md. What only the running Lens can show is covered by
// the LEAF scenarios in Assets/Tests (ids noted next to each scenario below).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASK_STAFF_MESSAGE,
  DOWNLOAD_TIMEOUT_MS,
  MAP_LOAD_FAILED,
  Navigator,
  SIGN_NOT_IN_MAP,
  chooseMap,
  findNode,
  findRoute,
  lineAhead,
  loadMapWithTimeout,
  mapDownloadUrl,
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

// S3 Lens part removed: the Lens chooses the mode once per trip (brief: switching mode
// mid-trip is out of scope). The routing logic test above is kept.

test("S4 Gate change B12 -> C3 while walking: card text and re-route from current position", () => {
  const map = loadMap();
  // The card text comes from the map's destinationChanged event (no airport wording in code).
  const ev = (map.place?.events || []).find((e) => e.type === "destinationChanged")!;
  assert.equal(ev.to, "gateC3");
  assert.equal(ev.card, "Gate change B12 → C3");

  const walker = new Navigator(map, "sign", "gateB12", "walk");
  const concourse = findNode(map, "concourse")!;
  walker.updatePosition({ x: concourse.x + 1, y: concourse.y, z: concourse.z });
  assert.equal(walker.setDestination("gateC3"), true);
  assert.equal(nodesOf(walker)[0], "concourse");
  assert.equal(nodesOf(walker).at(-1), "gateC3");

  // Hero moment: the Step-Free traveller's line swings from Lift 1 to Lift 2 and the ramp.
  const stepFree = new Navigator(map, "sign", "gateB12", "stepFree");
  assert.equal(stepFree.setDestination("gateC3"), true);
  assert.ok(nodesOf(stepFree).includes("lift2G"));
  assert.ok(stepFree.route.status === "route" && kinds(stepFree.route.edges).includes("ramp"));
});

// S4 Lens part: LEAF dc4-gate-change-stairs-and-ramp (card text, line swing, new route).

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
  assert.equal(gate.arrivalCard, "Gate C3. Boarding in 6 min.", "arrival card comes from the map");
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

// S8 Lens part: LEAF dc2-walk-escalator-corners-arrow (arrow shown/hidden); the maths is
// tested in geometry.test.ts.

// S9 real download: the Lens's default mapBaseUrl is a public https copy of src/core/data (a gist,
// since the repo is private). Needs internet; set OFFLINE=1 to skip.
const ONLINE_BASE = "https://gist.githubusercontent.com/alexandergorokhov/ac59c2c8d02687651f256b320fff27b8/raw/";

test("S9 Lens default mapBaseUrl is the public https map copy", () => {
  const main = readFileSync(new URL("../../../Assets/Scripts/FindYourWayMain.ts", import.meta.url), "utf8");
  assert.ok(main.includes(`mapBaseUrl: string = "${ONLINE_BASE}"`));
  const scene = readFileSync(new URL("../../../Assets/Scene.scene", import.meta.url), "utf8");
  assert.deepEqual([...scene.matchAll(/mapBaseUrl: "([^"]*)"/g)].map((m) => m[1]), [ONLINE_BASE], "FindYourWay in Scene.scene");
});

test("S9 real download: every map downloads from the public URL, matches src/core/data and loads online", { skip: !!process.env.OFFLINE }, async () => {
  for (const file of ["map.json", "hospital.json", "campus.json", "room.json", "mall.json"]) {
    const builtIn = readFileSync(new URL("../data/" + file, import.meta.url), "utf8");
    const fetchText = async (u: string) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error(u + " -> " + r.status);
      return r.text();
    };
    const url = mapDownloadUrl(ONLINE_BASE, file);
    assert.equal(await fetchText(url), builtIn, file + ": online copy differs from src/core/data (update the gist)");
    const r = await loadMapWithTimeout(fetchText, url, builtIn);
    assert.equal(r.source, "online", file);
  }
});

test("S9/E1 logic: a valid download is used online; a failed or timed-out download uses the built-in map offline", () => {
  const online = chooseMap(MAP_TEXT, MAP_TEXT);
  assert.equal(online.source, "online");
  assert.equal(online.notice, null);

  const offline = chooseMap(null, MAP_TEXT);
  assert.equal(offline.source, "offline");
  assert.equal(offline.notice, null);
  assert.equal(findRoute(offline.map, "sign", "gateB12", "walk").status, "route");
});

test("S9/E1 logic: loadMapWithTimeout uses the download when it arrives in time", async () => {
  const r = await loadMapWithTimeout(async () => MAP_TEXT, "https://example.test/map.json", MAP_TEXT, 50);
  assert.equal(r.source, "online");
});

test("E1 logic: a download slower than the timeout falls back to the built-in map", async () => {
  // The download would take 5 s; the 50 ms timeout must win. A flag, not the wall clock, so a
  // busy machine can't make this fail.
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = () => new Promise<string>((res) => (timer = setTimeout(() => ((finished = true), res(MAP_TEXT)), 5000)));
  const r = await loadMapWithTimeout(slow, "https://example.test/map.json", MAP_TEXT, 50);
  clearTimeout(timer);
  assert.equal(r.source, "offline");
  assert.equal(r.notice, null);
  assert.equal(finished, false, "should not wait for the slow download");
  assert.equal(findRoute(r.map, "sign", "gateB12", "walk").status, "route");
  assert.equal(DOWNLOAD_TIMEOUT_MS, 5000);
});

test("E1 logic: a failed or throwing download falls back to the built-in map", async () => {
  const rejected = await loadMapWithTimeout(() => Promise.reject(new Error("offline")), "u", MAP_TEXT, 50);
  assert.equal(rejected.source, "offline");
  const thrown = await loadMapWithTimeout(() => {
    throw new Error("no InternetModule");
  }, "u", MAP_TEXT, 50);
  assert.equal(thrown.source, "offline");
});

test("E2 logic: an invalid download in time still falls back with 'Map couldn't load'", async () => {
  const r = await loadMapWithTimeout(async () => "<html>404</html>", "u", MAP_TEXT, 50);
  assert.equal(r.source, "offline");
  assert.equal(r.notice, MAP_LOAD_FAILED);
});

// E1 Lens part: LEAF dc1-scan-sign-line-appears (the download returns 404 -> 'offline map'
// badge and the route works).

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

// E6 Lens part: LEAF dc3-stepfree-seated-lift-reroute (seated eye height: line on the floor
// and within 25 degrees below the eyes).

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

test("Escalators are one-way: going down never rides the up escalator (it takes the down one)", () => {
  const map = loadMap();
  const r = routeOf(map, "concourse", "sign", "walk");
  assert.ok(!r.edges.some((e) => e.from === "escFoot" && e.to === "escTop"));
  assert.ok(r.edges.some((e) => e.from === "escDownTop" && e.to === "escDownFoot"));
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

test("S7b Off route: staying off the line with an unchanged plan reports onRoute, not rerouted every frame", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const lift2 = findNode(map, "lift2G")!;
  const off = { x: lift2.x + 1, y: 0, z: lift2.z };
  assert.equal(nav.updatePosition(off), "rerouted");
  const before = nodesOf(nav).join(">");
  // Same spot again (next frame): the plan is unchanged, so it is not a new re-route.
  assert.equal(nav.updatePosition(off), "onRoute");
  assert.equal(nodesOf(nav).join(">"), before);
});

test("S7c Off route: the nearest node is on the traveller's own level, not the one overhead", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  // On the ground floor, just past the escalator, under the top landing (escTop is 6 m up).
  assert.equal(nav.updatePosition({ x: 30, y: 0, z: 30 }), "rerouted");
  assert.equal(nodesOf(nav)[0], "escFoot");
  assert.ok(nav.route.status === "route" && nav.route.edges.some((e) => e.kind === "escalator"));
});

test("S9 map URL: the map server base folder + the map's file name; no base -> no download", async () => {
  const { mapDownloadUrl } = await import("../router.ts");
  assert.equal(mapDownloadUrl("http://localhost:8787/", "map.json"), "http://localhost:8787/map.json");
  assert.equal(mapDownloadUrl("http://localhost:8787", "campus.json"), "http://localhost:8787/campus.json");
  assert.equal(mapDownloadUrl("  https://raw.githubusercontent.com/alexandergorokhov/lens-first-step/master/src/core/data/ ", "hospital.json"),
    "https://raw.githubusercontent.com/alexandergorokhov/lens-first-step/master/src/core/data/hospital.json");
  assert.equal(mapDownloadUrl("", "map.json"), "");
  assert.equal(mapDownloadUrl("   ", "map.json"), "");
});
