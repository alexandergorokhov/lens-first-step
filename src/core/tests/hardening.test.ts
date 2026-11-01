// What the adversarial review found (openspec/specs/hardening): hostile maps, the floor you are
// really on, closures in Free walk, shops marked in Map builder and edge values in every module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chooseMap, findRoute, LevelTracker, loadMapWithTimeout, logSafe, mapDownloadUrl, MAX_BUILDINGS, MAX_LEVELS,
  Navigator, parseMap, setEdgeOpen, snapToLevel, tripSettings,
} from "../router.ts";
import type { MapData } from "../router.ts";
import { FreeWalk, matchDestination, offerView } from "../freewalk.ts";
import type { FwMap } from "../freewalk.ts";
import { interestList } from "../freewalk.ts";
import { mapLogLines, MapRecorder, parseMapLog, WalkTracer } from "../mapping.ts";
import { tourStops, mapLevels, pickMapLayout } from "../tour.ts";
import { orderStops } from "../trip.ts";
import { companionOf, PetGuide } from "../pet.ts";
import { rigHeightCm, rigOf } from "../anim.ts";
import { wrap } from "../geometry.ts";
import { pointAt } from "../demo.ts";
import { cardClock, CARD_MAX_STEP } from "../place.ts";
import { startMapServer } from "../../../tools/serve-maps.mjs";
import { plan } from "../../../tools/reel-edit.mjs";
import { buildMap } from "../../../tools/map-from-plan.mjs";
import { esc } from "../../../tools/draw-maps.mjs";

const data = (f: string) => readFileSync(new URL("../data/" + f, import.meta.url), "utf8");
const mall = (): MapData => {
  const r = parseMap(data("mall.json"));
  if (!r.ok) throw new Error("mall");
  return r.map;
};

// Two nodes joined by a walk, plus whatever a test changes.
function small(change: (m: any) => void = () => {}): string {
  const m: any = {
    version: 1,
    nodes: [
      { id: "a", x: 0, y: 0, z: 0, kind: "sign" },
      { id: "b", x: 10, y: 0, z: 0, kind: "place" },
    ],
    edges: [{ from: "a", to: "b", length: 10, kind: "walk", open: true }],
  };
  change(m);
  return JSON.stringify(m);
}

const TRICK = { toString: 0, valueOf: 0 }; // string concatenation on this throws

test("H1 an object that cannot become text is refused, never thrown", () => {
  const cases: ((m: any) => void)[] = [
    (m) => { m.version = TRICK; },
    (m) => { m.edges[0].from = TRICK; },
    (m) => { m.edges[0].id = TRICK; },
    (m) => { m.place = { start: TRICK }; },
    (m) => { m.place = { events: [{ id: TRICK }] }; },
    (m) => { m.edges[0].kind = TRICK; },
  ];
  for (const c of cases) assert.equal(parseMap(small(c)).ok, false);
});

test("H2 an edge's ends must be text, not something that turns into a node id", () => {
  assert.equal(parseMap(small((m) => { m.edges[0].from = ["a"]; })).ok, false);
  assert.equal(parseMap(small((m) => { m.edges[0].to = ["b"]; })).ok, false);
});

test("H3 a hostile or empty download falls back to the built-in map", async () => {
  const built = small();
  const hostile = await loadMapWithTimeout(async () => small((m) => { m.version = TRICK; }), "u", built, 100);
  assert.equal(hostile.source, "offline");
  const nothing = await loadMapWithTimeout((() => undefined) as any, "u", built, 100);
  assert.equal(nothing.source, "offline");
});

test("H4 place fields the stand-in builds from are checked", () => {
  const bad: ((p: any) => void)[] = [
    (p) => { p.buildings = [{}]; },
    (p) => { p.buildings = [null]; },
    (p) => { p.buildings = "x"; },
    (p) => { p.buildings = [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1, levels: new Array(MAX_LEVELS + 1).fill(0) }]; },
    (p) => { p.buildings = new Array(MAX_BUILDINGS + 1).fill({ minX: 0, maxX: 1, minZ: 0, maxZ: 1, levels: [0] }); },
    (p) => { p.footprint = 5; },
    (p) => { p.footprint = { minX: "a", maxX: 1, minZ: 0, maxZ: 1 }; },
    (p) => { p.standInLabel = 5; },
    (p) => { p.standInLabel = "x".repeat(200000); },
    (p) => { p.levels = new Array(MAX_LEVELS + 1).fill({ y: 0, name: "L" }); },
    (p) => { p.events = [{ id: "x".repeat(500), type: "destinationChanged", to: "b" }]; },
  ];
  for (const b of bad) assert.equal(parseMap(small((m) => { m.place = {}; b(m.place); })).ok, false, JSON.stringify(b.toString()));
});

test("H5 every shown string is bounded: map name, node kind, building name", () => {
  assert.equal(parseMap(small((m) => { m.name = "x".repeat(200000); })).ok, false);
  assert.equal(parseMap(small((m) => { m.nodes[0].kind = "x".repeat(100000); })).ok, false);
  const b = { name: "x".repeat(500), minX: 0, maxX: 1, minZ: 0, maxZ: 1, levels: [0] };
  assert.equal(parseMap(small((m) => { m.place = { buildings: [b] }; })).ok, false);
});

test("H6 names of object internals can't be an edge id or an icon", () => {
  assert.equal(parseMap(small((m) => { m.edges[0].id = "toString"; })).ok, false);
  assert.equal(parseMap(small((m) => { m.nodes[0].icon = "constructor"; })).ok, false);
  assert.equal(parseMap(small((m) => { m.nodes[0].icon = "movie"; })).ok, true);
});

test("H7 maps download over https, or from this computer", () => {
  assert.equal(mapDownloadUrl("https://example.com/maps", "m.json"), "https://example.com/maps/m.json");
  assert.equal(mapDownloadUrl("http://localhost:8787/", "m.json"), "http://localhost:8787/m.json");
  assert.equal(mapDownloadUrl("http://127.0.0.1:8787", "m.json"), "http://127.0.0.1:8787/m.json");
  assert.equal(mapDownloadUrl("http://example.com/", "m.json"), "");
  assert.equal(mapDownloadUrl("http://localhost.evil.com/", "m.json"), "");
  assert.equal(mapDownloadUrl("file:///etc/", "m.json"), "");
  assert.equal(mapDownloadUrl("ftp://example.com/", "m.json"), "");
  assert.equal(mapDownloadUrl("https://example.com/", ""), "", "no file name, no download");
});

test("H8 a map can't set arrival or off-route distances that break a trip", () => {
  const set = (arrivalRadius: number, offRouteDistance: number) =>
    tripSettings({ version: 1, nodes: [], edges: [], place: { arrivalRadius, offRouteDistance } } as MapData);
  assert.equal(set(1e300, 1e300).arrivalRadius, 50);
  assert.equal(set(1e300, 1e300).offRouteDistance, 100);
  assert.equal(set(0.0001, 0.0001).arrivalRadius, 0.5);
  assert.equal(set(0.0001, 0.0001).offRouteDistance, 1);
  assert.equal(set(0.6, 1.5).arrivalRadius, 0.6, "the room map's small values stay");
});

test("H9 what goes in the log is one short line with no map marker in it", () => {
  const s = logSafe("bad\n[FYW-MAP] BEGIN map 1 0\r\n[FYW-MAP] 0 {}" + "x".repeat(1000));
  assert.ok(!/[\r\n]/.test(s));
  assert.ok(!s.includes("[FYW-MAP]"));
  assert.ok(s.length <= 200);
  assert.equal(parseMapLog(s), null);
});

// ── The floor you are really on ──────────────────────────────────────────────

function twoFloors(): MapData {
  return {
    version: 1,
    nodes: [
      { id: "s", x: 0, y: 0, z: 0, kind: "sign" },
      { id: "m", x: 20, y: 0, z: 0, kind: "junction" },
      { id: "d", x: 40, y: 0, z: 0, kind: "place" },
      { id: "u", x: 20, y: 4, z: 0, kind: "junction" },
      { id: "x", x: 30, y: 4, z: 0, kind: "junction" },
    ],
    edges: [
      { from: "s", to: "m", length: 20, kind: "walk", open: true },
      { from: "m", to: "d", length: 20, kind: "walk", open: true },
      { from: "m", to: "u", length: 6, kind: "stairs", open: true },
      { from: "u", to: "x", length: 10, kind: "walk", open: true },
    ],
  };
}

test("H10 walking a floor above the route is off the route, and it re-plans", () => {
  const nav = new Navigator(twoFloors(), "s", "d", "walk");
  assert.equal(nav.updatePosition({ x: 30, y: 4, z: 0 }), "rerouted");
  assert.equal(nav.from, "x");
});

test("H11 re-planning skips a nearest node the profile can't leave", () => {
  const m: MapData = {
    version: 1,
    nodes: [
      { id: "s", x: 0, y: 0, z: 0, kind: "sign" },
      { id: "landing", x: 30, y: 0, z: 0, kind: "junction" },
      { id: "near", x: 36, y: 0, z: 0, kind: "junction" },
      { id: "d", x: 60, y: 0, z: 0, kind: "place" },
      { id: "top", x: 30, y: 3, z: 5, kind: "junction" },
    ],
    edges: [
      { from: "s", to: "near", length: 40, kind: "walk", open: true },
      { from: "near", to: "d", length: 30, kind: "walk", open: true },
      { from: "landing", to: "top", length: 6, kind: "stairs", open: true },
      { from: "top", to: "near", length: 9, kind: "stairs", open: true },
    ],
  };
  const nav = new Navigator(m, "s", "d", "stepFree");
  nav.updatePosition({ x: 30.1, y: 0, z: 8 });
  assert.equal(nav.route.status, "route");
  assert.equal(nav.from, "near");
});

test("H11b re-planning never jumps to another floor to find a way through", () => {
  const m = twoFloors();
  m.nodes.push({ id: "d2", x: 30, y: 4, z: 4, kind: "place" });
  m.edges.push({ from: "x", to: "d2", length: 4, kind: "walk", open: true });
  const nav = new Navigator(m, "s", "d2", "stepFree");
  nav.updatePosition({ x: 30, y: 0, z: 9 });
  assert.equal(nav.route.status, "askStaff");
  assert.notEqual(nav.from, "x");
  assert.notEqual(nav.from, "u");
});

test("H12 with no assistance point a stuck route still re-plans as you walk", () => {
  const m: MapData = {
    version: 1,
    nodes: [
      { id: "s", x: 0, y: 0, z: 0, kind: "sign" },
      { id: "e", x: 2, y: 0, z: 0, kind: "junction" },
      { id: "c", x: 30, y: 0, z: 0, kind: "junction" },
      { id: "d", x: 40, y: 0, z: 0, kind: "place" },
    ],
    edges: [
      { from: "s", to: "e", length: 2, kind: "walk", open: true },
      { from: "c", to: "d", length: 10, kind: "walk", open: true },
    ],
  };
  const nav = new Navigator(m, "s", "d", "walk");
  assert.equal(nav.route.status, "askStaff");
  assert.equal(nav.updatePosition({ x: 30, y: 0, z: 0 }), "rerouted");
  assert.equal(nav.route.status, "route");
});

test("H13 sitting down on a floor 1 m above another keeps you on your floor", () => {
  const t = new LevelTracker([5, 6], 6);
  assert.equal(t.snap(6), 6);
  assert.equal(t.snap(5.45), 6, "0.55 m low is still floor 6");
  assert.equal(t.snap(5.1), 5, "really at floor 5 now");
  assert.equal(t.snap(5.45), 5, "and it holds there too");
  assert.equal(t.snap(5.9), 6);
});

test("H14 a tracker follows the same rules as snapToLevel away from any level", () => {
  const t = new LevelTracker([0, 5], 0);
  assert.equal(t.snap(2.5), 2.5, "halfway up stays raw");
  assert.equal(snapToLevel(2.5, [0, 5]), 2.5);
  assert.equal(t.snap(4.5), 5, "a whole floor away it moves");
  assert.equal(new LevelTracker([], 0).snap(3), 3, "no levels: unchanged");
});

test("H15 seated 0.55 m low at the top of two close floors you still arrive", () => {
  const m: MapData = {
    version: 1,
    nodes: [
      { id: "s", x: 0, y: 6, z: 0, kind: "sign" },
      { id: "d", x: 20, y: 6, z: 0, kind: "place" },
      { id: "low", x: 0, y: 5, z: 3, kind: "junction" },
    ],
    edges: [
      { from: "s", to: "d", length: 20, kind: "walk", open: true },
      { from: "s", to: "low", length: 4, kind: "stairs", open: true },
    ],
  };
  const nav = new Navigator(m, "s", "d", "walk");
  nav.updatePosition({ x: 1, y: 5.45, z: 0 });
  assert.equal(nav.updatePosition({ x: 20, y: 5.45, z: 0 }), "arrived");
});

// ── Free walk and Map builder ────────────────────────────────────────────────

const PICKS = ["coffee", "food", "clothes", "sport", "hardware", "books"];

test("H16 a closed connection gives no floor hint and no picks", () => {
  let m = mall();
  assert.ok(offerView(m as FwMap, "liftAG", PICKS, 0)!.rows.length > 0);
  m = setEdgeOpen(m, "liftA", false);
  assert.equal(offerView(m as FwMap, "liftAG", PICKS, 0)!.rows.length, 0);
  assert.equal(offerView(m as FwMap, "liftAG", PICKS, 0)!.title, "Lift A (ground)");
});

// Walks north through the centre court past the escalators, counting the floor hints.
function floorBubbles(fw: FreeWalk): number {
  let n = 0;
  let last: string | null = null;
  let t = 0;
  fw.setCompanion(true, { x: 30, y: 0, z: 1 }, 0);
  for (let z = 1; z < 24; z += 0.05) {
    t += 0.1;
    const r = fw.update({ x: 30, y: 0, z }, 0, 0.1, t);
    if (r.bubble && r.bubble !== last && /upstairs|downstairs/.test(r.bubble)) n++;
    last = r.bubble;
  }
  return n;
}

test("H17 FreeWalk takes a new map, so a closure reaches it", () => {
  const m = mall();
  const fw = new FreeWalk(m as FwMap, ["books"]);
  const all: MapData = { ...m, edges: m.edges.map((e) => (e.kind === "walk" ? e : { ...e, open: false })) };
  fw.setMap(all as FwMap);
  assert.equal(floorBubbles(fw), 0);
  assert.ok(floorBubbles(new FreeWalk(m as FwMap, ["books"])) > 0, "the same walk hints with it open");
});

test("H18 connections with nothing on the other floor open as an empty view of the place", () => {
  const v = offerView(mall() as FwMap, "stairsFoot", ["nothing-here"], 0)!;
  assert.equal(v.rows.length, 0);
  assert.equal(v.title, "Stairs (ground)");
});

test("H19 a shop marked in Map builder can be picked in Free walk and Tour", () => {
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  rec.pointHere({ x: 0, y: 0, z: 10 });
  rec.markShop({ x: 2, y: 0, z: 10 }, 90);
  const m = rec.toMap();
  const ids = interestList(m as unknown as FwMap).map((i) => i.id);
  assert.ok(ids.includes("shop"));
  assert.deepEqual(tourStops(m as any, "sign", ids, () => 1, orderStops), ["shop1"]);
});

test("H20 a map with its own interests keeps them when shops are marked", () => {
  const rec = MapRecorder.fromJson(JSON.stringify({
    version: 1, name: "x", units: "m",
    nodes: [{ id: "sign", x: 0, y: 0, z: 0, kind: "sign" }, { id: "p1", x: 0, y: 0, z: 10, kind: "junction" }],
    edges: [{ id: "e1", from: "sign", to: "p1", length: 10, kind: "walk", open: true }],
    place: { title: "x", levels: [{ y: 0, name: "Floor 0" }], interests: [{ id: "coffee", label: "Coffee" }] },
  }))!;
  rec.markShop({ x: 2, y: 0, z: 10 }, 90);
  assert.deepEqual(rec.toMap().place.interests!.map((i) => i.id).sort(), ["coffee", "shop"]);
});

test("H21 undoing Next floor really cancels the floor", () => {
  const rec = new MapRecorder();
  const tr = new WalkTracer(rec);
  tr.start({ x: 0, y: 0, z: 0 }, 0);
  let t = 0;
  const go = (from: number, to: number) => {
    for (let z = from; z <= to; z += 0.05) tr.sample({ x: 0, y: 0, z }, (t += 1 / 30));
  };
  go(0, 6);
  tr.nextFloor({ x: 0, y: 0, z: 6 }, t);
  tr.undo();
  go(6, 12);
  tr.finish({ x: 0, y: 0, z: 12 });
  const m = rec.toMap();
  assert.deepEqual(m.place.levels.map((l) => l.y), [0]);
  assert.ok(m.nodes.every((n) => n.y === 0));
});

test("H22 a restored map with junk fields is refused, not thrown", () => {
  const base = (n: object) => JSON.stringify({
    version: 1, name: "x", units: "m",
    nodes: [{ id: "sign", x: 0, y: 0, z: 0, kind: "sign" }, { id: "shop1", x: 0, y: 0, z: 10, kind: "place", ...n }],
    edges: [{ id: "e1", from: "sign", to: "shop1", length: 10, kind: "walk", open: true }],
    place: { title: "x", levels: [{ y: 0, name: "Floor 0" }] },
  });
  assert.equal(MapRecorder.fromJson(base({ front: null })), null);
  assert.equal(MapRecorder.fromJson(base({ offer: 5 })), null);
  assert.equal(MapRecorder.fromJson(base({ offer: null })), null);
});

test("H23 a walk can't be undone past its sign", () => {
  const rec = new MapRecorder();
  const tr = new WalkTracer(rec);
  tr.start({ x: 0, y: 0, z: 0 }, 0);
  assert.equal(rec.canUndo(), false);
  assert.equal(tr.undo(), false);
  assert.equal(rec.toMap().nodes.length, 1);
});

test("H24 a replaced shop with no stretch of its own leaves the other stretches alone", () => {
  const rec = MapRecorder.fromJson(JSON.stringify({
    version: 1, name: "x", units: "m",
    nodes: [
      { id: "sign", x: 0, y: 0, z: 0, kind: "sign" },
      { id: "p1", x: 0, y: 0, z: 10, kind: "junction" },
      { id: "p2", x: 0, y: 0, z: 20, kind: "junction" },
      { id: "shop1", x: 1, y: 0, z: 10, kind: "place", label: "Shop 1", category: "shop" },
    ],
    edges: [
      { id: "e1", from: "sign", to: "p1", length: 10, kind: "walk", open: true },
      { id: "e2", from: "p1", to: "p2", length: 10, kind: "walk", open: true },
    ],
    place: { title: "x", levels: [{ y: 0, name: "Floor 0" }] },
  }))!;
  rec.markShop({ x: 1, y: 0, z: 10 }, 90);
  const m = rec.toMap();
  assert.ok(m.edges.some((e) => e.from === "sign" && e.to === "p1"));
  assert.ok(m.edges.some((e) => e.from === "p1" && e.to === "p2"));
});

test("H25 a shop's name said exactly wins over filler-word rules", () => {
  const m: FwMap = {
    nodes: [
      { id: "g1", x: 0, y: 0, z: 0, kind: "place", label: "Gate 1" },
      { id: "ga", x: 1, y: 0, z: 0, kind: "place", label: "Gate A" },
      { id: "show", x: 2, y: 0, z: 0, kind: "place", label: "The Show" },
    ],
    edges: [],
  };
  assert.equal(matchDestination(m, "gate a"), "ga");
  assert.equal(matchDestination(m, "take me to the show"), "show");
  assert.equal(matchDestination(m, "gate 1"), "g1");
});

test("H26 a floor hint comes once even if your feet sway across a rounding edge", () => {
  const m: FwMap = {
    nodes: [
      { id: "foot", x: 0, y: 5.5, z: 0, kind: "junction", label: "Stairs" },
      { id: "top", x: 0, y: 9.5, z: 6, kind: "junction" },
      { id: "shop", x: 5, y: 9.5, z: 6, kind: "place", label: "Shop", category: "coffee" },
    ],
    edges: [
      { from: "foot", to: "top", kind: "stairs" },
      { from: "top", to: "shop", kind: "walk" },
    ],
  };
  const fw = new FreeWalk(m, ["coffee"], { maxStops: 0 });
  fw.setCompanion(true, { x: 0, y: 5.5, z: -2 }, 0);
  let hints = 0;
  let last: string | null = null;
  let t = 0;
  for (let i = 0; i < 400; i++) {
    t += 0.1;
    const r = fw.update({ x: 0, y: i % 2 ? 5.49 : 5.51, z: -2 }, 0, 0.1, t);
    if (r.bubble && r.bubble !== last) hints++;
    last = r.bubble;
  }
  assert.equal(hints, 1);
});

// ── Edge values ──────────────────────────────────────────────────────────────

test("H27 turning the companion off and on at arrival keeps the score", () => {
  const route = [{ x: 0, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }];
  const g = new PetGuide();
  g.setOn(true, route, route[0], "r1");
  const total = g.total;
  assert.ok(total > 1);
  g.setOn(false, [], route[1], "arrived");
  g.setOn(true, [], route[1], "arrived");
  assert.equal(g.total, total);
});

test("H28 odd ids give the default companion", () => {
  assert.equal(companionOf("constructor").id, companionOf("dog").id);
  assert.equal(rigOf("constructor"), rigOf("dog"));
  assert.equal(rigHeightCm("toString"), rigHeightCm("dog"));
});

test("H29 wrap never hangs and stays in range", () => {
  assert.equal(wrap(540), 180);
  assert.equal(wrap(-540), -180);
  assert.ok(Math.abs(wrap(1e20)) <= 180);
  assert.equal(wrap(Infinity), 0);
  assert.equal(wrap(NaN), 0);
});

test("H30 a NaN distance stands at the start of the walk", () => {
  const p = pointAt([{ x: 1, y: 0, z: 2 }, { x: 5, y: 0, z: 2 }], NaN);
  assert.equal(p.x, 1);
  assert.equal(p.z, 2);
});

test("H31 floors count by height whatever order the map lists them", () => {
  const m = { nodes: [], edges: [], place: { levels: [{ y: 5, name: "Up" }, { y: 0, name: "Down" }] } };
  assert.deepEqual(mapLevels(m as any).map((l) => [l.label, l.floor]), [["Down", 0], ["Up", 1]]);
  const raw = { nodes: [{ id: "a", x: 0, y: 0, z: 0, kind: "x" }, { id: "b", x: 0, y: 0.2, z: 0, kind: "x" }], edges: [] };
  assert.equal(mapLevels(raw as any).length, 1, "0.2 m apart is one level");
});

test("H32 a stop you can't reach goes last", () => {
  const d = (a: string, b: string) => (a === "x" || b === "x" ? Infinity : 1);
  assert.deepEqual(orderStops("s", ["x", "a"], d), ["a", "x"]);
});

test("H33 thousands of shops lay out on the panel without freezing a frame", () => {
  const nodes = [];
  for (let i = 0; i < 2000; i++) nodes.push({ id: "n" + i, x: i % 50, y: 0, z: Math.floor(i / 50), kind: "place", label: "S" + i });
  const t0 = Date.now();
  const dots = pickMapLayout({ nodes, edges: [] } as any, 0, 40, 30, 2);
  assert.ok(Date.now() - t0 < 500, "took " + (Date.now() - t0) + " ms");
  assert.ok(dots.length > 0);
});

test("H34 a long frame next to a card can't eat its life", () => {
  assert.equal(cardClock(0, 6), CARD_MAX_STEP);
  assert.equal(cardClock(1, 0.016), 1.016);
  assert.equal(cardClock(1, NaN), 1);
  assert.equal(cardClock(1, -1), 1);
});

test("H35 a walked map's log block round-trips", () => {
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  rec.pointHere({ x: 0, y: 0, z: 10 });
  const text = rec.toJson();
  const back = parseMapLog(mapLogLines(text, "mine").join("\n"));
  assert.equal(back!.text, text);
});

test("H36 single-node maps, NaN positions and arrivals stay stable", () => {
  const one = parseMap(JSON.stringify({ version: 1, nodes: [{ id: "a", x: 0, y: 0, z: 0, kind: "sign" }], edges: [] }));
  assert.ok(one.ok);
  const nav = new Navigator((one as any).map, "a", "a", "walk");
  assert.equal(nav.route.status, "arrived");
  assert.equal(nav.updatePosition({ x: 50, y: 0, z: 0 }), "onRoute");
  const m = twoFloors();
  const n = new Navigator(m, "s", "d", "walk");
  const before = n.from;
  assert.equal(n.updatePosition({ x: NaN, y: 0, z: 0 }), "onRoute");
  assert.equal(n.from, before);
  assert.equal(findRoute(m, "nope", "d", "walk").status, "error");
  assert.equal(chooseMap(null, small()).source, "offline");
});

// ── Tools, and what goes public ──────────────────────────────────────────────

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const tracked = () => execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

test("T1 the map server only listens on this computer unless asked", async () => {
  const s = await startMapServer({ port: 0 });
  assert.equal(s.host, "127.0.0.1");
  await s.close();
});

function publish(args: string[]) {
  const dir = mkdtempSync(path.join(tmpdir(), "fyw-"));
  const log = path.join(dir, "log.txt");
  const rec = new MapRecorder();
  rec.start({ x: 0, y: 0, z: 0 });
  writeFileSync(log, mapLogLines(rec.toJson(), "mine").join("\n"));
  // No PATH, so `gh` can't be found: whatever this tool does, a test can never upload.
  return spawnSync(process.execPath, [path.join(ROOT, "tools/map-publish.mjs"), "--log", log, ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, PATH: "", Path: "" } });
}

test("T2 map:publish can't overwrite a bundled map", () => {
  for (const name of ["map", "mall", "index", "campus"]) {
    const r = publish(["--name", name, "--dry-run"]);
    assert.notEqual(r.status, 0, name);
    assert.match(r.stderr, /bundled/);
  }
});

test("T3 map:publish needs a name when --name is given", () => {
  assert.notEqual(publish(["--dry-run", "--name"]).status, 0);
});

test("T4 map:publish without --yes writes and uploads nothing", () => {
  const name = "fyw-test-" + process.pid;
  const r = publish(["--name", name]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /--yes/);
  assert.equal(existsSync(path.join(ROOT, "src/core/data", name + ".json")), false);
});

test("T5 map names can't break out of the HTML page", () => {
  assert.ok(!esc('x" onerror="y').includes('"'));
  assert.ok(!esc("<b>").includes("<"));
  assert.ok(!esc("'").includes("'"));
});

const LOG = (lines: string[]) => lines.join("\n");

test("T6 reel: two CUT-TOs in a row keep the first stretch", () => {
  const p = plan(LOG(["00:00:10.0 0 CUT-TO", "00:00:20.0 0 CUT-TO", "00:00:30.0 0 CUT-FROM"]), 0, 40);
  assert.equal(p.kept.length, 2);
  assert.ok(p.kept.every(([a, b]: number[]) => b > a));
});

test("T7 reel: a CUT-TO after the end never makes a backward stretch", () => {
  const p = plan(LOG(["00:00:10.0 0 CUT-TO", "00:00:20.0 0 hello", "00:00:25.0 0 (no caption)", "00:00:40.0 0 CUT-TO"]), 0, 60);
  assert.ok(p.kept.every(([a, b]: number[]) => b > a));
  assert.ok(p.length > 0);
});

test("T8 reel: a log crossing midnight keeps its times positive", () => {
  const p = plan(LOG(["00:00:10.0 0 CUT-TO", "00:00:30.0 0 CUT-FROM"]), 23 * 3600 + 59 * 60 + 50, 60);
  assert.ok(p.kept[0][0] > 0);
  assert.ok(p.kept[0][1] > p.kept[0][0]);
});

const sampleDraft = () => JSON.parse(readFileSync(path.join(ROOT, "tools/examples/plan-draft.sample.json"), "utf8"));

test("T9 plan: floors number by height, whatever order the draft lists them", () => {
  const d = sampleDraft();
  assert.ok(d.floors.length >= 2);
  d.floors.forEach((f: any, i: number) => { f.height = i * 4; });
  d.floors.reverse();
  const levels = buildMap(d).map.place.levels.slice().sort((a: any, b: any) => a.y - b.y);
  assert.deepEqual(levels.map((l: any) => l.floor), levels.map((_: any, i: number) => i));
});

test("T10 plan: floors under 0.5 m apart are refused", () => {
  const d = sampleDraft();
  d.floors.forEach((f: any, i: number) => { f.height = i * 0.3; });
  const out = (() => { try { return buildMap(d); } catch (e) { return { errors: [String(e)] }; } })() as any;
  assert.match(JSON.stringify(out.errors || []), /apart/);
});

test("T11 keys and private files stay ignored even if Lens Studio rewrites its block", () => {
  const ignored = (f: string) => spawnSync("git", ["check-ignore", "-q", "--no-index", f], { cwd: ROOT }).status === 0;
  for (const f of [".mcp.json", ".cursor/mcp.json", ".vscode/mcp.json", ".codex/config.toml", "spk_debug_key.pem", "x.pem", "ls-live-instance.json"]) {
    assert.ok(ignored(f), f + " is not ignored");
  }
  const own = readFileSync(path.join(ROOT, ".gitignore"), "utf8").split("# END Lens Studio managed Agents-Docs block").pop()!;
  for (const line of [".mcp.json", "*.pem", "ls-live-instance.json"]) assert.ok(own.includes(line), line + " outside the managed block");
});

test("T12 no tracked file holds a bearer token, a private key or a home path", () => {
  const self = "src/core/tests/hardening.test.ts";
  const secret = new RegExp("Bearer [A-Za-z0-9._-]{16}|BEGIN [A-Z ]*PRIVATE" + " KEY|ghp_[A-Za-z0-9]{20}");
  const home = new RegExp("C:" + "[\\\\/]Sasha|C:" + "[\\\\/]Users");
  for (const f of tracked()) {
    if (f === self || !/\.(md|json|ts|mjs|js|txt|toml|yml|yaml|esproj)$/.test(f)) continue;
    if (!existsSync(path.join(ROOT, f))) continue;
    const text = readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!secret.test(text), f + " looks like it holds a secret");
    if (f.endsWith(".md")) assert.ok(!home.test(text), f + " has a local path");
  }
});

test("T13 what you say and what a download says are not logged raw", () => {
  const main = readFileSync(path.join(ROOT, "Assets/Scripts/FindYourWayMain.ts"), "utf8");
  assert.match(main, /downloaded map rejected: " \+ logSafe\(res\.error\)/);
  assert.match(main, /\[FYW\] heard: " \+ text\.length/);
});

test("H37 no two buttons share a name, or one would press the other's panel", () => {
  const dir = new URL("../../../Assets/Scripts/", import.meta.url);
  const names = readdirSync(dir).filter((f) => f.endsWith("UI.ts"))
    .flatMap((f) => [...readFileSync(new URL(f, dir), "utf8").matchAll(/addButton\([^,]+,\s*"([^"]+)"/g)].map((m) => m[1]));
  assert.ok(names.length > 10, "found the buttons");
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});
