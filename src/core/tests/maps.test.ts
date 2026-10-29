// Tests for every bundled map (airport, hospital, campus, preview room): the map file is valid
// and self-consistent, routing follows the Walk / Step-Free rules, closures and destination
// changes re-route, and the Lens copies in Assets/Maps are identical to src/core/data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EDGE_KINDS,
  Navigator,
  findNode,
  findRoute,
  parseMap,
  setEdgeOpen,
  type MapData,
  type MapEdge,
  type Profile,
} from "../router.ts";

const MAPS = [
  { key: "airport", file: "map.json", lens: "airport.json" },
  { key: "hospital", file: "hospital.json", lens: "hospital.json" },
  { key: "campus", file: "campus.json", lens: "campus.json" },
  { key: "room", file: "room.json", lens: "room.json" },
];

function text(file: string): string {
  return readFileSync(new URL("../data/" + file, import.meta.url), "utf8");
}

function load(file: string): MapData {
  const r = parseMap(text(file));
  if (!r.ok) throw new Error(file + ": " + r.error);
  return r.map;
}

function kinds(edges: MapEdge[]): string[] {
  return edges.map((e) => e.kind);
}

function route(map: MapData, from: string, to: string, profile: Profile) {
  const r = findRoute(map, from, to, profile);
  assert.equal(r.status, "route", from + " -> " + to + " (" + profile + ")");
  if (r.status !== "route") throw new Error("unreachable");
  return r;
}

function brute(map: MapData, from: string, to: string, profile: Profile): number {
  let best = Infinity;
  const seen: { [id: string]: boolean } = { [from]: true };
  const walk = (at: string, sofar: number) => {
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
  };
  walk(from, 0);
  return best;
}

for (const m of MAPS) {
  test(`${m.key}: map file is valid and its Lens copy (Assets/Maps/${m.lens}) is identical`, () => {
    load(m.file);
    const lens = readFileSync(new URL("../../../Assets/Maps/" + m.lens, import.meta.url), "utf8");
    assert.equal(lens, text(m.file));
  });

  test(`${m.key}: edges are at least the straight-line distance (to 0.1 m); place, events and destinations point at real nodes`, () => {
    const map = load(m.file);
    for (const e of map.edges) {
      const a = findNode(map, e.from)!;
      const b = findNode(map, e.to)!;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      // lengths are given to 0.1 m, so allow the same 0.1 m rounding as the airport test
      assert.ok(e.length >= d - 0.1, `${e.from} -> ${e.to}: length ${e.length} < straight line ${d.toFixed(2)}`);
      assert.ok(EDGE_KINDS.includes(e.kind));
      if (e.kind === "lift") assert.ok(e.id, `lift ${e.from} -> ${e.to} needs an id (it can be closed)`);
    }
    const place = (map as any).place;
    assert.ok(place, "place block");
    assert.equal(findNode(map, place.start)?.kind, "sign", "start is a sign");
    assert.equal(findNode(map, place.destination)?.kind, "destination", "destination node");
    for (const ev of place.events) {
      if (ev.type === "destinationChanged") assert.equal(findNode(map, ev.to)?.kind, "destination", ev.id);
      if (ev.type === "connectionClosed") {
        assert.ok(map.edges.some((e) => e.id === ev.edge), ev.id + " edge");
        assert.ok(findNode(map, ev.at), ev.id + " sign node");
      }
    }
    for (const n of map.nodes) {
      if (n.kind !== "destination") continue;
      const any = n as any;
      assert.ok(any.label && any.arrivalCard, n.id + " needs a label and an arrival card");
    }
    const ys = new Set(map.nodes.map((n) => n.y));
    for (const y of ys) {
      // every floor used by a node has a level name, except small in-between landings (C pier style)
      if (!place.levels.some((l: any) => l.y === y)) assert.fail(`${m.key}: no level name for y=${y}`);
    }
  });

  test(`${m.key}: Walk is the shortest route and Step-Free never uses stairs or an escalator, for every pair`, () => {
    const map = load(m.file);
    for (const a of map.nodes) {
      for (const b of map.nodes) {
        if (a.id === b.id) continue;
        for (const profile of ["walk", "stepFree"] as Profile[]) {
          const best = brute(map, a.id, b.id, profile);
          const r = findRoute(map, a.id, b.id, profile);
          if (best === Infinity) {
            assert.notEqual(r.status, "route", `${a.id} -> ${b.id} ${profile}`);
            continue;
          }
          assert.equal(r.status, "route", `${a.id} -> ${b.id} ${profile}`);
          if (r.status !== "route") continue;
          assert.ok(Math.abs(r.length - best) < 1e-6, `${a.id} -> ${b.id} ${profile}: ${r.length} vs ${best}`);
          if (profile === "stepFree") {
            for (const k of kinds(r.edges)) assert.ok(k !== "stairs" && k !== "escalator", `${a.id} -> ${b.id} used ${k}`);
          }
        }
      }
    }
  });

  test(`${m.key}: closing each closable connection keeps Step-Free free of stairs and escalators`, () => {
    const map = load(m.file);
    for (const e of map.edges) {
      if (!e.id) continue;
      const closed = setEdgeOpen(map, e.id, false);
      const place = (map as any).place;
      const r = findRoute(closed, place.start, place.destination, "stepFree");
      const edges = r.status === "route" ? r.edges : r.status === "askStaff" && r.assistance ? r.assistance.edges : [];
      for (const k of kinds(edges)) assert.ok(k !== "stairs" && k !== "escalator", `${e.id} closed: used ${k}`);
      if (r.status === "route") assert.ok(!r.edges.some((x) => x.id === e.id), `${e.id} closed but still used`);
    }
  });
}

// ── Hospital ────────────────────────────────────────────────────────────────

test("hospital: Walk to Ward 4 takes the stairs; Step-Free takes Lift A", () => {
  const map = load("hospital.json");
  assert.deepEqual(route(map, "sign", "ward4", "walk").nodes, ["sign", "lobby", "stairsFoot", "stairsTop", "corridor1", "ward4"]);
  const sf = route(map, "sign", "ward4", "stepFree");
  assert.deepEqual(sf.nodes, ["sign", "lobby", "liftAG", "liftAU", "corridor1", "ward4"]);
});

test("hospital: Lift A out of service re-routes Step-Free to Lift B", () => {
  const nav = new Navigator(load("hospital.json"), "sign", "ward4", "stepFree");
  assert.equal(nav.setEdgeOpen("liftA", false), true);
  assert.ok(nav.route.status === "route");
  assert.deepEqual(nav.route.status === "route" ? nav.route.nodes : [], ["sign", "lobby", "liftBG", "liftBU", "corridor1", "ward4"]);
});

test("hospital: room change Ward 4 -> X-ray re-routes on the ground floor", () => {
  const map = load("hospital.json");
  const ev = (map as any).place.events.find((e: any) => e.type === "destinationChanged");
  assert.equal(ev.button, "Room change Ward 4 → X-ray");
  const nav = new Navigator(map, "sign", "ward4", "walk");
  assert.equal(nav.setGate(ev.to), true);
  assert.deepEqual(nav.route.status === "route" ? nav.route.nodes : [], ["sign", "lobby", "xray"]);
});

test("hospital: both lifts out -> Step-Free to Ward 4 asks staff and points to Reception", () => {
  const map = setEdgeOpen(setEdgeOpen(load("hospital.json"), "liftA", false), "liftB", false);
  const r = findRoute(map, "sign", "ward4", "stepFree");
  assert.equal(r.status, "askStaff");
  assert.ok(r.status === "askStaff" && r.assistance && r.assistance.nodes.at(-1) === "reception");
});

// ── Preview room ────────────────────────────────────────────────────────────

test("room: short route on the room floor to the window, and the change to the door", () => {
  const map = load("room.json");
  assert.deepEqual(route(map, "sign", "window", "walk").nodes, ["sign", "mid", "window"]);
  assert.deepEqual(route(map, "sign", "window", "stepFree").nodes, ["sign", "mid", "window"]);
  const nav = new Navigator(map, "sign", "window", "walk");
  assert.equal(nav.setGate("door"), true);
  assert.deepEqual(nav.route.status === "route" ? nav.route.nodes : [], ["sign", "mid", "door"]);
  assert.equal((map as any).place.standInModel, false, "no stand-in model: the line is drawn on the real floor");
});

// ── Campus ──────────────────────────────────────────────────────────────────

test("campus: Walk to Lecture Hall 1 crosses the quad outdoors and takes the Science stairs", () => {
  const map = load("campus.json");
  const r = route(map, "sign", "lectureHall1", "walk");
  assert.deepEqual(r.nodes, ["sign", "quad", "sciDoor", "sciStairsFoot", "sciStairsTop", "sciFirst", "lectureHall1"]);
  assert.ok(r.edges.slice(0, 2).every((e) => (e as any).outdoor === true), "sign -> quad -> Science entrance is outdoors");
});

test("campus: Step-Free to Lecture Hall 1 takes the Science lift; with the lift out it takes the ramp", () => {
  const map = load("campus.json");
  assert.deepEqual(route(map, "sign", "lectureHall1", "stepFree").nodes,
    ["sign", "quad", "sciDoor", "sciLiftG", "sciLiftU", "sciFirst", "lectureHall1"]);
  const nav = new Navigator(map, "sign", "lectureHall1", "stepFree");
  assert.equal(nav.setEdgeOpen("sciLift", false), true);
  assert.ok(nav.route.status === "route" && kinds(nav.route.edges).includes("ramp"));
  assert.ok(nav.route.status === "route" && !kinds(nav.route.edges).some((k) => k === "stairs" || k === "escalator"));
});

test("campus: room change Lecture Hall 1 -> Lab 2 re-routes to the Science ground floor", () => {
  const map = load("campus.json");
  const ev = (map as any).place.events.find((e: any) => e.type === "destinationChanged");
  assert.equal(ev.card, "Room change Lecture Hall 1 → Lab 2");
  for (const profile of ["walk", "stepFree"] as Profile[]) {
    const nav = new Navigator(map, "sign", "lectureHall1", profile);
    assert.equal(nav.setGate(ev.to), true);
    assert.deepEqual(nav.route.status === "route" ? nav.route.nodes : [], ["sign", "quad", "sciDoor", "lab2"]);
  }
});

test("campus: the Library Reading Room is reached by stairs (Walk) or the Library lift (Step-Free)", () => {
  const map = load("campus.json");
  assert.ok(kinds(route(map, "sign", "readingRoom", "walk").edges).includes("stairs"));
  const sf = route(map, "sign", "readingRoom", "stepFree");
  assert.ok(kinds(sf.edges).includes("lift") && sf.nodes.includes("libLiftG"));
});

test("campus: buildings cover their indoor nodes and the destinations have campus icons", () => {
  const map = load("campus.json");
  const place = (map as any).place;
  const inside = (n: any, b: any) => n.x >= b.minX && n.x <= b.maxX && n.z >= b.minZ && n.z <= b.maxZ;
  for (const id of ["libStairsFoot", "libLiftG", "libFirst", "readingRoom"]) {
    assert.ok(inside(findNode(map, id), place.buildings[0]), id + " in the Library");
  }
  for (const id of ["lab2", "sciStairsFoot", "sciLiftG", "sciRampTop", "lectureHall1"]) {
    assert.ok(inside(findNode(map, id), place.buildings[1]), id + " in the Science building");
  }
  for (const id of ["sign", "quad"]) {
    assert.ok(!place.buildings.some((b: any) => inside(findNode(map, id), b)), id + " is outdoors");
  }
  assert.deepEqual(["readingRoom", "lab2", "lectureHall1"].map((id) => (findNode(map, id) as any).icon), ["menu_book", "science", "school"]);
});
