// Tour mode (NEXT-SESSION 24): after "You are here" it walks you through the places matching your
// preferences, in the shortest order (trip.ts), and "Pick a place on a map" is the no-voice
// fallback to Where to?. Tested on the real maps; nothing here reads or changes the route.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findRoute, parseMap, type MapData, type Profile } from "../router.ts";
import { MAX_EXACT_STOPS, MultiStopTrip, orderStops } from "../trip.ts";
import { destinationsOf } from "../freewalk.ts";
import { MAP_DOT_MIN_CM, TOUR_MAX_STOPS, mapLevels, pickMapLayout, tourStops } from "../tour.ts";

const text = (f: string) => readFileSync(new URL("../data/" + f, import.meta.url), "utf8");
const mall = JSON.parse(text("mall.json"));
const airport = JSON.parse(text("map.json"));

function distFor(file: string, profile: Profile = "walk") {
  const r = parseMap(text(file));
  if (!r.ok) throw new Error(file);
  const map: MapData = r.map;
  return (a: string, b: string) => {
    const x = findRoute(map, a, b, profile);
    if (x.status === "arrived") return 0;
    return x.status === "route" ? x.length : Infinity;
  };
}
const idsOf = (m: any, kind: string, prefs?: string[]) =>
  m.nodes.filter((n: any) => n.kind === kind && (!prefs || prefs.includes(n.category))).map((n: any) => n.id);

test("U1 the cap is trip.ts's MAX_EXACT_STOPS", () => {
  assert.equal(TOUR_MAX_STOPS, MAX_EXACT_STOPS);
});

test("U2 tour stops are the places whose category is picked, ordered by orderStops", () => {
  const dist = distFor("mall.json");
  const prefs = ["coffee", "books", "hardware"];
  const stops = tourStops(mall, "sign", prefs, dist, orderStops);
  assert.deepEqual([...stops].sort(), idsOf(mall, "place", prefs).sort());
  assert.ok(stops.length >= 2);
  assert.deepEqual(stops, orderStops("sign", idsOf(mall, "place", prefs), dist));
  // Feeds straight into MultiStopTrip.
  const trip = new MultiStopTrip(stops);
  assert.equal(trip.total, stops.length);
  assert.equal(trip.current(), stops[0]);
});

test("U3 no match returns nothing; non-place nodes never count", () => {
  const dist = distFor("mall.json");
  assert.deepEqual(tourStops(mall, "sign", [], dist, orderStops), []);
  assert.deepEqual(tourStops(mall, "sign", ["nonsense"], dist, orderStops), []);
  const stray = { ...mall, nodes: mall.nodes.map((n: any) => (n.kind === "lift" ? { ...n, category: "coffee" } : n)) };
  const stops = tourStops(stray, "sign", ["coffee"], dist, orderStops);
  assert.ok(stops.length >= 1);
  for (const s of stops) assert.equal(stray.nodes.find((n: any) => n.id === s).kind, "place");
});

test("U4 sponsored never changes whether a shop is on the tour or where", () => {
  const dist = distFor("mall.json");
  const prefs = ["coffee", "food", "clothes", "sport", "hardware", "books"];
  const base = tourStops(mall, "sign", prefs, dist, orderStops);
  const strip = { ...mall, nodes: mall.nodes.map((n: any) => ({ ...n, sponsored: undefined, sponsorTag: undefined })) };
  const all = { ...mall, nodes: mall.nodes.map((n: any) => (n.kind === "place" ? { ...n, sponsored: true } : n)) };
  assert.deepEqual(tourStops(strip, "sign", prefs, dist, orderStops), base);
  assert.deepEqual(tourStops(all, "sign", prefs, dist, orderStops), base);
  assert.ok(mall.nodes.some((n: any) => n.sponsored && prefs.includes(n.category)), "the real map has a sponsored match");
});

test("U5 more matches than the cap keep the nearest ones, still ordered", () => {
  const dist = distFor("mall.json");
  const prefs = [...new Set(mall.nodes.filter((n: any) => n.kind === "place").map((n: any) => n.category))] as string[];
  const all = idsOf(mall, "place", prefs);
  assert.ok(all.length > TOUR_MAX_STOPS, "mall has more than the cap: " + all.length);
  const stops = tourStops(mall, "sign", prefs, dist, orderStops);
  assert.equal(stops.length, TOUR_MAX_STOPS);
  const kept = [...all].sort((a, b) => dist("sign", a) - dist("sign", b)).slice(0, TOUR_MAX_STOPS);
  assert.deepEqual([...stops].sort(), kept.sort());
});

test("U6 the start itself and places with no route are skipped; Step-Free routes work", () => {
  const real = distFor("mall.json");
  const dist = (a: string, b: string) => (b === "pharmacy" ? Infinity : real(a, b));
  const stops = tourStops(mall, "pharmacy", ["pharmacy", "coffee"], dist, orderStops);
  assert.ok(!stops.includes("pharmacy"));
  assert.ok(stops.includes("cafe"));
  assert.ok(!tourStops(mall, "cafe", ["coffee"], real, orderStops).includes("cafe"), "never the start");
  const step = distFor("mall.json", "stepFree");
  assert.ok(tourStops(mall, "sign", ["coffee", "books"], step, orderStops).length >= 1);
});

test("U7 the airport has a tour too", () => {
  const dist = distFor("map.json");
  const cats = [...new Set(airport.nodes.filter((n: any) => n.kind === "place").map((n: any) => n.category))] as string[];
  const stops = tourStops(airport, "sign", cats, dist, orderStops);
  assert.ok(stops.length >= 1 && stops.length <= TOUR_MAX_STOPS);
});

// ---- Pick a place on a map ----

const PANEL = { w: 60, h: 40, margin: 4 };
function check(map: any, y: number) {
  const dots = pickMapLayout(map, y, PANEL.w, PANEL.h, PANEL.margin);
  for (const d of dots) {
    assert.ok(
      Math.abs(d.x) <= PANEL.w / 2 - PANEL.margin + 1e-9 && Math.abs(d.y) <= PANEL.h / 2 - PANEL.margin + 1e-9,
      "inside the margin: " + JSON.stringify(d),
    );
  }
  for (let i = 0; i < dots.length; i++)
    for (let j = i + 1; j < dots.length; j++) {
      const gap = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
      assert.ok(gap >= MAP_DOT_MIN_CM - 1e-6, dots[i].id + "/" + dots[j].id + " " + gap);
    }
  return dots;
}

test("U8 mall ground floor: every labelled destination, gate and place, inside the margin, apart", () => {
  const dots = check(mall, 0);
  const want = mall.nodes.filter((n: any) => ["place", "destination", "gate"].includes(n.kind) && n.label && n.y === 0).map((n: any) => n.id);
  assert.deepEqual(dots.map((d) => d.id).sort(), want.sort());
  assert.ok(dots.every((d) => d.label.length > 0));
  const ok = new Set(destinationsOf(mall).map((d) => d.id));
  assert.ok(dots.every((d) => ok.has(d.id)), "a tap picks something Where to? also offers");
  assert.ok(dots.length >= 5);
});

test("U9 mall first floor, and every airport floor, lay out the same way", () => {
  assert.ok(check(mall, 5).length >= 2);
  for (const l of mapLevels(airport)) check(airport, l.y);
  assert.ok(check(airport, 0).length >= 1);
});

test("U10 aspect ratio is kept (uniform scale) and the layout is centred", () => {
  const nodes = [
    { id: "a", kind: "place", label: "A", x: 0, y: 0, z: 0 },
    { id: "b", kind: "place", label: "B", x: 100, y: 0, z: 0 },
    { id: "c", kind: "place", label: "C", x: 50, y: 0, z: 50 },
  ];
  const d = Object.fromEntries(pickMapLayout({ nodes }, 0, 60, 40, 4).map((p) => [p.id, p]));
  // 100 x 50 m into 52 x 32: limited by width, so 0.52 cm per m on both axes.
  assert.ok(Math.abs(d.b.x - d.a.x - 52) < 1e-9);
  assert.ok(Math.abs(d.c.y - d.a.y - 26) < 1e-9, "z scaled by the same factor");
  assert.ok(Math.abs(d.a.x + d.b.x) < 1e-9, "centred in x");
  assert.ok(Math.abs(d.a.y + d.c.y) < 1e-9, "centred in y");
  assert.ok(d.c.y > d.a.y, "north is up");
});

test("U11 one point, no points, stacked points and tiny panels do not divide by zero", () => {
  const one = pickMapLayout({ nodes: [{ id: "a", kind: "place", label: "A", x: 3, y: 0, z: 9 }] }, 0, 60, 40, 4);
  assert.deepEqual(one, [{ id: "a", label: "A", x: 0, y: 0 }]);
  assert.deepEqual(pickMapLayout({ nodes: [] }, 0, 60, 40, 4), []);
  const stack = pickMapLayout(
    { nodes: [0, 1, 2, 3].map((i) => ({ id: "n" + i, kind: "place", label: "N" + i, x: 5, y: 0, z: 5 })) },
    0, 60, 40, 4,
  );
  assert.equal(stack.length, 4);
  for (const p of stack) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  for (let i = 0; i < stack.length; i++)
    for (let j = i + 1; j < stack.length; j++)
      assert.ok(Math.hypot(stack[i].x - stack[j].x, stack[i].y - stack[j].y) >= MAP_DOT_MIN_CM - 1e-6);
  for (const p of pickMapLayout(mall, 0, 6, 6, 5)) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test("U12 the layout is deterministic and skips unlabelled and other-floor nodes", () => {
  assert.deepEqual(pickMapLayout(mall, 0, 60, 40, 4), pickMapLayout(mall, 0, 60, 40, 4));
  const ids = new Set(pickMapLayout(mall, 0, 60, 40, 4).map((d) => d.id));
  assert.ok(!ids.has("cinema"), "cinema is on the first floor");
  assert.ok(!ids.has("sign") && !ids.has("gW"), "signs and junctions are not destinations");
  const unl = pickMapLayout(
    { nodes: [{ id: "x", kind: "place", x: 0, y: 0, z: 0 }, { id: "y", kind: "place", label: "Y", x: 1, y: 0, z: 1 }] },
    0, 60, 40, 4,
  );
  assert.deepEqual(unl.map((d) => d.id), ["y"]);
});

test("U13 mapLevels lists the floors with labels, lowest first", () => {
  assert.deepEqual(mapLevels(mall), [
    { y: 0, label: "Ground floor", floor: 0 },
    { y: 5, label: "First floor", floor: 1 },
  ]);
  assert.deepEqual(mapLevels(airport).map((l) => l.label), ["Ground floor", "C pier", "Departures", "Sky Lounge"]);
  const bare = mapLevels({
    nodes: [{ id: "a", kind: "place", label: "A", x: 0, y: 3, z: 0 }, { id: "b", kind: "place", label: "B", x: 0, y: 0, z: 0 }],
  });
  assert.deepEqual(bare.map((l) => l.y), [0, 3]);
  assert.ok(bare.every((l) => l.label.length > 0));
});
