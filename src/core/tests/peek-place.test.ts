// The mini mall (Peek ahead, "See map") and the "You are here" board: what each draws from a map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boardModel, peekPlace, placeGroup, PEEK_FLOOR_GAP, PEEK_SIZE } from "../peek.ts";
import { findRoute, parseMap, routePoints, setEdgeOpen } from "../router.ts";
import type { MapData } from "../router.ts";

const load = (f: string): MapData => {
  const r = parseMap(readFileSync(new URL("../data/" + f, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(f);
  return r.map;
};

// Three floors, two connections, a shop on each.
function tower(): any {
  const n = (id: string, x: number, y: number, z: number, kind = "junction", extra = {}) => ({ id, x, y, z, kind, ...extra });
  return {
    version: 1,
    nodes: [
      n("a", 0, 0, 0, "sign"), n("b", 20, 0, 0), n("c", 20, 5, 0), n("d", 0, 5, 0), n("e", 0, 10, 0), n("f", 20, 10, 0),
      n("s1", 10, 0, 4, "place", { category: "coffee" }),
      n("s2", 10, 5, 4, "place", { category: "toilet" }),
      n("s3", 10, 10, 4, "destination", { label: "Roof" }),
    ],
    edges: [
      { from: "a", to: "b", length: 20, kind: "walk", open: true },
      { from: "b", to: "c", length: 5, kind: "lift", id: "l1", open: true },
      { from: "c", to: "d", length: 20, kind: "walk", open: true },
      { from: "d", to: "e", length: 5, kind: "stairs", open: true },
      { from: "e", to: "f", length: 20, kind: "walk", open: true },
      { from: "a", to: "s1", length: 11, kind: "walk", open: true },
    ],
  };
}

const allPoints = (m: ReturnType<typeof peekPlace>) => m.floors.flatMap((f) => f.segments.flatMap((s) => [s.a, s.b]).concat(f.places.map((p) => p.at)))
  .concat(m.links.flatMap((l) => [l.a, l.b]), m.route, [m.you]);

test("PM1 floors stack evenly apart however close they are in the building", () => {
  const m = peekPlace(tower(), [], { x: 0, y: 0, z: 0 });
  assert.equal(m.floors.length, 3);
  const ys = m.floors.map((f) => f.y);
  assert.ok(Math.abs(ys[1] - ys[0] - PEEK_FLOOR_GAP) < 1e-9);
  assert.ok(Math.abs(ys[2] - ys[1] - PEEK_FLOOR_GAP) < 1e-9);
  assert.ok(Math.abs(ys[0] + ys[2]) < 1e-9, "centred on the origin");
});

test("PM2 the whole place fits the box, north to south and east to west", () => {
  const m = peekPlace(load("mall.json"), [], { x: 30, y: 0, z: 1 });
  for (const p of allPoints(m)) {
    assert.ok(Math.abs(p.x) <= PEEK_SIZE / 2 + 1e-9, "x " + p.x);
    assert.ok(Math.abs(p.z) <= PEEK_SIZE / 2 + 1e-9, "z " + p.z);
  }
});

test("PM3 corridors stay on their floor and connections join two floors", () => {
  const m = peekPlace(tower(), [], { x: 0, y: 0, z: 0 });
  assert.equal(m.floors[0].segments.length, 2);
  assert.equal(m.floors[1].segments.length, 1);
  assert.equal(m.links.length, 2);
  assert.ok(m.links.every((l) => Math.abs(l.a.y - l.b.y) > 0.01));
  assert.equal(m.links.find((l) => l.kind === "lift")!.open, true);
});

test("PM4 a closed connection shows as closed", () => {
  const m = peekPlace(setEdgeOpen(tower(), "l1", false), [], { x: 0, y: 0, z: 0 });
  assert.equal(m.links.find((l) => l.kind === "lift")!.open, false);
});

test("PM5 the route and your dot use the same stacked heights as the floors", () => {
  const map = tower();
  const route = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 5, z: 0 }];
  const m = peekPlace(map, route, { x: 20, y: 5, z: 0 });
  assert.ok(Math.abs(m.route[0].y - m.floors[0].y) < 1e-9);
  assert.ok(Math.abs(m.route[2].y - m.floors[1].y) < 1e-9);
  assert.ok(Math.abs(m.you.y - m.floors[1].y) < 1e-9);
  assert.equal(m.done, route.length, "standing at the end, all walked");
  assert.deepEqual(m.target, m.route[2]);
});

test("PM6 halfway up the stairs you are halfway between the floors", () => {
  const m = peekPlace(tower(), [], { x: 0, y: 2.5, z: 0 });
  assert.ok(Math.abs(m.you.y - (m.floors[0].y + m.floors[1].y) / 2) < 1e-9);
});

test("PM7 the floor you are on is marked, by the nearest level", () => {
  assert.equal(peekPlace(tower(), [], { x: 0, y: 5.4, z: 0 }).current, 1);
  assert.equal(peekPlace(tower(), [], { x: 0, y: 9.9, z: 0 }).current, 2);
  assert.equal(peekPlace(tower(), [], { x: 0, y: -3, z: 0 }).current, 0);
});

test("PM8 with no route you still see the place, and no target", () => {
  const m = peekPlace(tower(), [], { x: 0, y: 0, z: 0 });
  assert.deepEqual(m.route, []);
  assert.equal(m.target, null);
  assert.equal(m.done, 0);
});

test("PM9 one floor sits at the origin", () => {
  const map = tower();
  map.nodes = map.nodes.filter((n: any) => n.y === 0);
  map.edges = map.edges.filter((e: any) => e.kind === "walk" && !["c", "d", "e", "f"].includes(e.from));
  const m = peekPlace(map, [], { x: 0, y: 0, z: 0 });
  assert.equal(m.floors.length, 1);
  assert.equal(m.floors[0].y, 0);
});

test("PM10 a single node or a place with no extent gives finite numbers", () => {
  const map = { nodes: [{ id: "a", x: 3, y: 2, z: 1, kind: "sign" }], edges: [] };
  const m = peekPlace(map, [], { x: 3, y: 2, z: 1 });
  assert.ok(Number.isFinite(m.scale) && m.scale > 0);
  assert.ok(Number.isFinite(m.you.x + m.you.y + m.you.z));
});

test("PM11 places fall into a few colours; anything else is a shop", () => {
  assert.equal(placeGroup("coffee"), "food");
  assert.equal(placeGroup("food"), "food");
  assert.equal(placeGroup("toilet"), "service");
  assert.equal(placeGroup("accessibleToilet"), "service");
  assert.equal(placeGroup("cash"), "service");
  assert.equal(placeGroup("kids"), "fun");
  assert.equal(placeGroup("sport"), "fun");
  assert.equal(placeGroup("clothes"), "shop");
  assert.equal(placeGroup(undefined), "shop");
  assert.equal(placeGroup("constructor"), "shop");
});

test("PM12 only named places and destinations get a dot", () => {
  const m = peekPlace(tower(), [], { x: 0, y: 0, z: 0 });
  assert.deepEqual(m.floors.map((f) => f.places.map((p) => p.group)), [["food"], ["service"], ["shop"]]);
});

test("PM13 building the model changes neither the map nor the route", () => {
  const map = tower();
  const route = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }];
  const before = JSON.stringify([map, route]);
  peekPlace(map, route, { x: 1, y: 0, z: 0 });
  assert.equal(JSON.stringify([map, route]), before);
});

test("PM14 every floor of the mall shows, with a real route from the sign to the top", () => {
  const map = load("mall.json");
  const r = findRoute(map, "sign", "skyGarden", "walk");
  const m = peekPlace(map, routePoints(map, r), { x: 30, y: 0, z: 1 });
  assert.equal(m.floors.length, 3);
  assert.ok(m.floors.every((f) => f.places.length >= 8), "each floor is full of shops");
  assert.ok(m.route[m.route.length - 1].y > m.route[0].y);
});

test("PM15 the static part keeps its key while only the route moves", () => {
  const map = tower();
  const a = peekPlace(map, [], { x: 0, y: 0, z: 0 });
  const b = peekPlace(map, [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }], { x: 5, y: 0, z: 0 });
  const c = peekPlace(setEdgeOpen(map, "l1", false), [], { x: 0, y: 0, z: 0 });
  assert.equal(a.key, b.key);
  assert.notEqual(a.key, c.key);
});

// ── The "You are here" board ─────────────────────────────────────────────────

test("BM1 the board shows only your floor, fitted to the panel", () => {
  const map = load("mall.json");
  const b = boardModel(map, "sign", 56, 34)!;
  for (const p of b.places.map((x) => x.at).concat(b.paths.flatMap((s) => [s.a, s.b]), [b.you])) {
    assert.ok(Math.abs(p.x) <= 28 + 1e-9 && Math.abs(p.y) <= 17 + 1e-9, JSON.stringify(p));
  }
  assert.ok(b.places.length >= 10);
  assert.ok(!b.places.some((p) => p.id === "cinema"), "upstairs isn't on it");
});

test("BM2 places on the board carry their colour group", () => {
  const b = boardModel(load("mall.json"), "sign", 56, 34)!;
  assert.equal(b.places.find((p) => p.id === "cafe")!.group, "food");
  assert.equal(b.places.find((p) => p.id === "toiletG")!.group, "service");
});

test("BM3 north is up on the board and you are at the entrance, south", () => {
  const b = boardModel(load("mall.json"), "sign", 56, 34)!;
  assert.ok(b.you.y < 0);
  assert.ok(b.places.find((p) => p.id === "boltHardware")!.at.y > b.you.y);
});

test("BM4 an unknown start gives no board, and a lone sign gives a finite one", () => {
  assert.equal(boardModel(tower(), "nope", 56, 34), null);
  const b = boardModel({ nodes: [{ id: "a", x: 1, y: 0, z: 1, kind: "sign" }], edges: [] }, "a", 56, 34)!;
  assert.ok(Number.isFinite(b.you.x + b.you.y));
  assert.deepEqual(b.paths, []);
});

test("BM5 stretches of no length draw nothing", () => {
  const map = tower();
  map.nodes.push({ id: "a2", x: 0, y: 0, z: 0, kind: "junction" });
  map.edges.push({ from: "a", to: "a2", length: 1, kind: "walk", open: true });
  assert.equal(boardModel(map, "a", 56, 34)!.paths.length, 2);
});
