// Free walk: looking at a shop's front, the dot and the offer list, the companion
// walking ahead with no route, turning around, stopping at matches, the floor hint, and the
// "Say it" / "Where to?" matcher of Go to a place.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import {
  dotLabel,
  AheadTracker,
  clampToPaths,
  destinationsOf,
  DotTracker,
  floorBubble,
  FreeWalk,
  frontTargets,
  interestList,
  lookTarget,
  matchDestination,
  offerView,
  otherFloorPicks,
  sayItPhrase,
} from "../freewalk.ts";

function mall(): MapData {
  const r = parseMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("mall");
  return r.map;
}
const PRESET = ["coffee", "clothes", "hardware"];
const at = (m: MapData, id: string) => m.nodes.filter((n) => n.id === id)[0];
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test("L1 looking across a front from outside hits it; from inside, or looking away, does not", () => {
  const t = frontTargets(mall());
  // Bolt Hardware: front z=26, x 27..33; outside is south (the walk edge arrives from gBM, z=22).
  assert.equal(lookTarget(t, { x: 30, y: 0, z: 22 }, 0, 12), "boltHardware");
  assert.equal(lookTarget(t, { x: 30, y: 0, z: 22 }, 180, 12) === "boltHardware", false);
  assert.equal(lookTarget(t, { x: 30, y: 0, z: 27 }, 180, 12), null, "from inside the shop");
  assert.equal(lookTarget(t, { x: 30, y: 5, z: 22 }, 0, 12), null, "the floor above has no such front");
});

test("L2 a front further than the range is not looked at; the nearest front wins", () => {
  const t = frontTargets(mall());
  assert.equal(lookTarget(t, { x: 30, y: 0, z: 10 }, 0, 12), null, "16 m away");
  assert.equal(lookTarget(t, { x: 30, y: 0, z: 10 }, 0, 20), "boltHardware");
  // Looking south-east from the centre court across Threads' front.
  assert.equal(lookTarget(t, { x: 34, y: 0, z: 10 }, 170, 12), "threads");
});

test("L3 a node with no front gets no dot; stairs and lifts do", () => {
  const ids = frontTargets(mall()).map((t) => t.id);
  assert.ok(ids.indexOf("cinema") < 0);
  assert.ok(ids.indexOf("stairsFoot") >= 0 && ids.indexOf("liftBG") >= 0);
});

test("D1 the dot shows after 0.5 s of looking and hides 2 s after looking away", () => {
  const d = new DotTracker();
  const p = { x: 0, y: 0, z: 0 };
  d.update("a", 0, p);
  assert.equal(d.dot, null);
  d.update("a", 0.4, p);
  assert.equal(d.dot, null);
  d.update("a", 0.51, p);
  assert.equal(d.dot, "a");
  d.update(null, 1, p);
  d.update(null, 2.9, p);
  assert.equal(d.dot, "a", "still there 1.9 s after looking away");
  d.update(null, 3.1, p);
  assert.equal(d.dot, null);
});

test("D2 a glance shorter than 0.5 s shows nothing; looking back keeps the dot", () => {
  const d = new DotTracker();
  const p = { x: 0, y: 0, z: 0 };
  d.update("a", 0, p);
  d.update(null, 0.3, p);
  d.update("a", 0.4, p);
  d.update("a", 0.8, p);
  assert.equal(d.dot, null);
  d.update("a", 0.95, p);
  assert.equal(d.dot, "a");
  d.update(null, 1, p);
  d.update("a", 2, p);
  d.update(null, 3.5, p);
  assert.equal(d.dot, "a");
});

test("D3 opening shows the list; it hides on close or after walking 5 m; ignoring changes nothing", () => {
  const d = new DotTracker();
  const p = { x: 0, y: 0, z: 0 };
  assert.equal(d.openDot(p), null, "no dot, nothing to open");
  d.update("a", 0, p);
  d.update("a", 0.6, p);
  assert.equal(d.openDot(p), "a");
  assert.equal(d.open, "a");
  assert.equal(d.dot, null);
  d.update(null, 5, { x: 4.9, y: 0, z: 0 });
  assert.equal(d.open, "a");
  d.update(null, 5.1, { x: 5.1, y: 0, z: 0 });
  assert.equal(d.open, null);
  d.update("b", 6, p);
  d.update("b", 6.6, p);
  d.openDot(p);
  d.closeList();
  assert.equal(d.open, null);
});

test("O1 a shop's list has its name and at most 3 rows; a sponsored shop always shows its tag", () => {
  const m = mall();
  const v = offerView(m, "anvilTools", PRESET, 5)!;
  assert.equal(v.title, "Anvil Tools");
  assert.equal(v.rows.length, 3);
  assert.equal(v.tag, "");
  assert.deepEqual(v.rows[0], { text: "Tool set", price: "$120", image: "drill" });
  assert.equal(v.more, false);
  assert.match(offerView(m, "secondSkin", [], 5)!.tag, /^Sponsored/);
  assert.equal(offerView(m, "nowhere", [], 0), null);
});

test("O2 a shop with no offer still opens, with no rows", () => {
  const m = mall();
  delete at(m, "threads").offer;
  assert.deepEqual(offerView(m, "threads", PRESET, 0)!.rows, []);
});

test("F1 other-floor picks: matching shops only, paid ones first", () => {
  const picks = otherFloorPicks(mall(), PRESET, 0, true);
  assert.deepEqual(picks.map((p) => p.id).sort(), ["anvilTools", "coffeeF", "fashion", "secondSkin", "terrace"]);
  assert.equal(picks[0].id, "secondSkin");
  assert.deepEqual(otherFloorPicks(mall(), PRESET, 5, true).map((p) => p.id), ["terrace"]);
  assert.deepEqual(otherFloorPicks(mall(), PRESET, 10, true), []);
  assert.ok(otherFloorPicks(mall(), PRESET, 5, false).length >= 3);
});

test("F2 the stairs' list shows the first 3 picks and 'and more'; paid first with its tag", () => {
  const v = offerView(mall(), "stairsFoot", PRESET, 0)!;
  assert.equal(v.rows.length, 3);
  assert.equal(v.more, true);
  assert.match(v.rows[0].text, /^Second Skin · Sponsored/);
  assert.match(v.title, /upstairs/i);
});

test("F3 the bubble: '3 picks upstairs' / '1 pick downstairs'", () => {
  assert.equal(floorBubble(3, true), "3 picks upstairs");
  assert.equal(floorBubble(1, false), "1 pick downstairs");
});

test("A1 ahead is your walking direction while walking, your head direction after 1 s still", () => {
  const a = new AheadTracker();
  let dir = a.update({ x: 0, y: 0, z: 0 }, 90, 0.1);
  assert.ok(Math.abs(dir.x - 1) < 1e-6, "starts with the head direction");
  // Walking north with the head turned east: ahead stays north.
  for (let i = 1; i <= 10; i++) dir = a.update({ x: 0, y: 0, z: i * 0.15 }, 90, 0.1);
  assert.ok(dir.z > 0.99, JSON.stringify(dir));
  // Standing still less than 1 s: still north; after: east.
  for (let i = 0; i < 8; i++) dir = a.update({ x: 0, y: 0, z: 1.5 }, 90, 0.1);
  assert.ok(dir.z > 0.99);
  for (let i = 0; i < 4; i++) dir = a.update({ x: 0, y: 0, z: 1.5 }, 90, 0.1);
  assert.ok(dir.x > 0.99);
});

test("A2 the spot is clamped to the walkable paths of your floor", () => {
  const m = mall();
  const c = clampToPaths(m, { x: 30, y: 0, z: 12.5 + 0.7 }, 0)!;
  assert.ok(Math.abs(c.x - 30) < 0.8);
  const c2 = clampToPaths(m, { x: 45, y: 0, z: 14 }, 0)!;
  assert.ok(Math.abs(c2.z - 10) < 0.01 || Math.abs(c2.x - 52) < 0.01, JSON.stringify(c2));
  assert.equal(c2.y, 0);
  assert.equal(clampToPaths(m, { x: 30, y: 2.5, z: 10 }, 2.5), null, "no paths between floors");
});

type P = { x: number; y: number; z: number };
type Frame = ReturnType<FreeWalk["update"]>;

// Walks the traveller along a straight stretch at 1.3 m/s, calling on() every frame.
function walk(fw: FreeWalk, from: P, to: P, t0: number, on: (f: Frame, t: number, pos: P) => void): number {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const h = (Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI;
  const dt = 1 / 30;
  const n = Math.ceil(d / (1.3 * dt));
  let t = t0;
  for (let i = 1; i <= n; i++) {
    t += dt;
    const k = i / n;
    const pos = { x: from.x + (to.x - from.x) * k, y: from.y, z: from.z + (to.z - from.z) * k };
    on(fw.update(pos, h, dt, t), t, pos);
  }
  return t;
}
function stand(fw: FreeWalk, pos: P, heading: number, t0: number, secs: number, on?: (f: Frame, t: number) => void): number {
  const dt = 1 / 30;
  let t = t0;
  for (let i = 0; i < secs * 30; i++) {
    t += dt;
    const f = fw.update(pos, heading, dt, t);
    if (on) on(f, t);
  }
  return t;
}

test("C1 the companion stops at a matching shop, points for 3 s, and walks past others", () => {
  const m = mall();
  const fw = new FreeWalk(m, ["hardware"]);
  const start = { x: 30, y: 0, z: 10 };
  fw.setCompanion(true, start, 0);
  const stops: string[] = [];
  let t = walk(fw, start, { x: 30, y: 0, z: 22 }, 0, (f) => { if (f.stopped) stops.push(f.stopped); });
  t = stand(fw, { x: 30, y: 0, z: 22 }, 0, t, 6, (f) => { if (f.stopped) stops.push(f.stopped); });
  // The up escalator is the floor hint (Anvil Tools is upstairs); among the shops, only the match.
  assert.deepEqual(stops.filter((id) => at(m, id).kind === "place"), ["boltHardware"], "only the match");
  assert.equal(fw.pointingAt(), null, "done pointing");
});

test("C2 pointing lasts the Inspector's seconds, and each shop is pointed at once per walk", () => {
  const m = mall();
  const fw = new FreeWalk(m, ["hardware"], { pointSeconds: 1 });
  const spot = { x: 30, y: 0, z: 22 };
  fw.setCompanion(true, spot, 0);
  const stopsAt: number[] = [];
  let pointingFrames = 0;
  let t = stand(fw, spot, 0, 0, 5, (f, now) => { if (f.stopped) stopsAt.push(now); if (f.pointing) pointingFrames++; });
  t = walk(fw, spot, { x: 30, y: 0, z: 12 }, t, () => {});
  walk(fw, { x: 30, y: 0, z: 12 }, spot, t, (f) => { if (f.stopped) stopsAt.push(1e9); });
  assert.equal(stopsAt.length, 1);
  assert.ok(pointingFrames < 3.5 * 30, "not 3 s: " + pointingFrames);
});

test("C3 paying never makes it stop; maxStops limits the stops", () => {
  const m = mall();
  // Bean There Café is sponsored; with only hardware picked the walk past it has no stop.
  const fw = new FreeWalk(m, ["hardware"]);
  const a = { x: 8, y: 0, z: 10 };
  fw.setCompanion(true, a, 90);
  const seen: string[] = [];
  walk(fw, a, { x: 22, y: 0, z: 10 }, 0, (f) => { if (f.stopped) seen.push(f.stopped); });
  assert.ok(seen.indexOf("cafe") < 0, seen.join());
  const lim = new FreeWalk(m, ["coffee", "hardware", "clothes"], { maxStops: 1 });
  const b = { x: 30, y: 0, z: 10 };
  lim.setCompanion(true, b, 0);
  const got: string[] = [];
  walk(lim, b, { x: 30, y: 0, z: 22 }, 0, (f) => { if (f.stopped) got.push(f.stopped); });
  assert.equal(got.length, 1);
});

test("C4 with the companion off nothing is pointed at, and dots still come", () => {
  const m = mall();
  const fw = new FreeWalk(m, PRESET);
  const pos = { x: 30, y: 0, z: 22 };
  let dot: string | null = null;
  const t = stand(fw, pos, 0, 0, 1, (f) => { assert.equal(f.pointing, null); assert.equal(f.pet, null); dot = f.dot; });
  assert.equal(dot, "boltHardware");
  assert.ok(t > 0);
});

test("C5 turning around: it runs around you, never closer than 1 m, and ends ahead", () => {
  const m = mall();
  const fw = new FreeWalk(m, []);
  const pos = { x: 30, y: 0, z: 16 };
  fw.setCompanion(true, pos, 0);
  let t = stand(fw, pos, 0, 0, 2);
  assert.ok(fw.pet!.pos.z > 17.5, "ahead (north): " + JSON.stringify(fw.pet));
  let closest = Infinity;
  let ran = false;
  t = stand(fw, pos, 180, t, 5, (f) => {
    closest = Math.min(closest, dist(f.pet!.pos, pos));
    if (f.pet!.mood === "run") ran = true;
  });
  assert.ok(closest >= 1 - 1e-6, "closest " + closest);
  assert.ok(ran, "it ran");
  assert.ok(fw.pet!.pos.z < 14.5, "ahead (south): " + JSON.stringify(fw.pet));
  assert.ok(Math.abs(fw.pet!.pos.x - 30) < 0.5, "back on the path");
});

test("C6 a glance while walking doesn't swing it; it stays ahead of the walking direction", () => {
  const m = mall();
  const fw = new FreeWalk(m, []);
  const a = { x: 12, y: 0, z: 10 };
  fw.setCompanion(true, a, 90);
  let t = stand(fw, a, 90, 0, 2);
  const dt = 1 / 30;
  for (let i = 1; i <= 120; i++) {
    t += dt;
    fw.update({ x: 12 + i * 1.3 * dt, y: 0, z: 10 }, 0 /* head turned north */, dt, t);
  }
  assert.ok(fw.pet!.pos.x > 12 + 2.6 + 1, "ahead along the corridor: " + JSON.stringify(fw.pet));
});

test("C7 a floor change: it joins you on the new floor", () => {
  const m = mall();
  const fw = new FreeWalk(m, []);
  const a = { x: 30, y: 0, z: 16 };
  fw.setCompanion(true, a, 0);
  const t = stand(fw, a, 0, 0, 1);
  const up = { x: 30, y: 5, z: 16 };
  stand(fw, up, 0, t, 1);
  assert.equal(fw.pet!.pos.y, 5);
});

test("H1 at a floor connection with matches on the other floor it stops, points and shows the bubble", () => {
  const m = mall();
  const fw = new FreeWalk(m, PRESET);
  fw.markDone(["threads", "cafe", "boltHardware"]);
  const a = { x: 52, y: 0, z: 10 };
  fw.setCompanion(true, a, 30);
  let stop: string | null = null;
  let bubble: string | null = null;
  const t = stand(fw, a, 30, 0, 3, (f) => { if (f.stopped) stop = f.stopped; if (f.bubble) bubble = f.bubble; });
  assert.equal(stop, "stairsFoot");
  assert.equal(bubble, "5 picks upstairs");
  let end: string | null = "x";
  stand(fw, a, 30, t, 5, (f) => { end = f.bubble; });
  assert.equal(end, null, "the bubble hides (up to 5 s)");
});

test("H1b arriving on a floor, it never hints back the way you came, and the next match is free to stop", () => {
  const m = mall();
  const fw = new FreeWalk(m, PRESET);
  fw.markDone(["threads", "cafe", "boltHardware"]);
  const foot = { x: 57, y: 0, z: 15 };
  fw.setCompanion(true, foot, 0);
  let t = stand(fw, foot, 0, 0, 7);
  const top = { x: 57, y: 5, z: 24 };
  const seen: (string | null)[] = [];
  t = stand(fw, top, 0, t, 1, (f) => { seen.push(f.pointing); });
  // The next flight up may hint; the flight you came up never does.
  assert.ok(!seen.includes("stairsTop"), "no 'picks downstairs' at the top of the stairs");
  const stops: string[] = [];
  stand(fw, { x: 50, y: 5, z: 22 }, 0, t, 8, (f) => { if (f.stopped) stops.push(f.stopped); });
  assert.ok(stops.includes("secondSkin"), stops.join());
});

test("H2 no bubble and no stop with no matches on the other floor; or at a down-only escalator", () => {
  const m = mall();
  const fw = new FreeWalk(m, ["beauty"]);
  const a = { x: 52, y: 0, z: 10 };
  fw.setCompanion(true, a, 0);
  stand(fw, a, 0, 0, 3, (f) => { assert.equal(f.bubble, null); assert.equal(f.stopped, null); });
  const g = new FreeWalk(m, PRESET);
  g.markDone(["threads", "cafe", "boltHardware", "escUpFoot"]);
  const b = { x: 36, y: 0, z: 12 };
  g.setCompanion(true, b, 0);
  stand(g, b, 0, 0, 3, (f) => { assert.notEqual(f.stopped, "escDownFoot"); });
});

test("H3 the stairs dot and list also work with the companion off", () => {
  const m = mall();
  const fw = new FreeWalk(m, PRESET);
  const pos = { x: 57, y: 0, z: 13 };
  stand(fw, pos, 0, 0, 1);
  assert.equal(fw.dot(), "stairsFoot");
  fw.openDot(pos);
  const v = fw.list(pos)!;
  assert.equal(v.rows.length, 3);
  assert.equal(v.more, true);
});

test("I1 the checkbox list comes from the map; maps without one keep today's interests", () => {
  assert.deepEqual(interestList(mall()).map((i) => i.id), ["coffee", "food", "clothes", "sport", "hardware", "books", "kids", "beauty"]);
  const plain = interestList({ nodes: [], edges: [] });
  assert.deepEqual(plain.map((i) => i.id), ["coffee", "food", "shopping", "toilet", "pharmacy"]);
});

test("G1 'Say it' runs the matcher against the map's names", () => {
  const m = mall();
  assert.equal(sayItPhrase(m), "Take me to Bolt Hardware");
  assert.equal(matchDestination(m, "Take me to Bolt Hardware"), "boltHardware");
  assert.equal(matchDestination(m, "bolt hardware please"), "boltHardware");
  assert.equal(matchDestination(m, "where is the cinema"), "cinema");
  assert.equal(matchDestination(m, "BEAN THERE CAFE"), "cafe");
  assert.equal(matchDestination(m, "second skin"), "secondSkin");
  assert.equal(matchDestination(m, "the moon"), null);
  assert.equal(matchDestination(m, ""), null);
  assert.equal(matchDestination(m, "take me to"), null);
});

test("G2 a map with no sayIt says the name of its default destination", () => {
  const m = mall();
  delete m.place!.sayIt;
  assert.equal(sayItPhrase(m), "Take me to Cinema");
  assert.equal(sayItPhrase({ nodes: [], edges: [] }), "");
});

test("G3 'Where to?' lists the map's places and destinations by name, not lifts or junctions", () => {
  const list = destinationsOf(mall());
  const names = list.map((d) => d.label);
  assert.ok(names.indexOf("Bolt Hardware") >= 0 && names.indexOf("Cinema") >= 0);
  assert.ok(names.indexOf("Lift A (ground)") < 0 && names.indexOf("Centre court (ground)") < 0);
  assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b)));
});

test("D4 the button says what a pinch will open", () => {
  const mall = JSON.parse(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  assert.equal(dotLabel(mall, "boltHardware", [], 0), "Offers: Bolt Hardware");
  assert.equal(dotLabel(mall, "stairsFoot", ["clothes"], 0), "Your picks upstairs");
  assert.equal(dotLabel(mall, "stairsFoot", [], 0), "Stairs (ground)");
  assert.equal(dotLabel(mall, "cashMachine", [], 0), "Cash machine");
  assert.equal(dotLabel(mall, "nowhere", [], 0), "");
});

test("L4 the companion only stops for a shop ahead of you, so you can see it point", () => {
  const map = mall();
  const walk = new FreeWalk(map, ["clothes", "hardware", "coffee"]);
  walk.setCompanion(true, { x: 30, y: 0, z: 1 }, 0);
  let now = 0;
  let first: string | null = null;
  for (let z = 1; z <= 18 && first === null; z += 0.5) {
    now += 0.25;
    walk.update({ x: 30, y: 0, z }, 0, 0.25, now);
    first = walk.pointingAt();
    if (z === 1) assert.equal(first, null, "Threads is 60 degrees to your right at the start");
  }
  assert.equal(first, "escUpFoot", "the first thing ahead of you");
});

test("L5 looking at the front you can see counts, not only the map's line", () => {
  const map = mall();
  const targets = frontTargets(map);
  for (const id of ["cafe", "iceCream", "secondSkin"]) {
    const n = map.nodes.filter((m: { id: string }) => m.id === id)[0];
    const e = map.edges.filter((k: { from: string; to: string; kind: string }) => k.kind === "walk" && (k.from === id || k.to === id))[0];
    const o = map.nodes.filter((m: { id: string }) => m.id === (e.from === id ? e.to : e.from))[0];
    const l = Math.hypot(o.x - n.x, o.z - n.z);
    const d = { x: (o.x - n.x) / l, z: (o.z - n.z) / l };
    const mid = { x: n.x - d.x * 1.7, z: n.z - d.z * 1.7 };
    // From along the way in, looking at each part of the drawn front.
    let hits = 0, tries = 0;
    for (const out of [1, 3, 5, 7]) {
      for (const along of [-2.4, -1.2, 0, 1.2, 2.4]) {
        const at = { x: n.x + d.x * out, y: n.y, z: n.z + d.z * out };
        const look = { x: mid.x - d.z * along, z: mid.z + d.x * along };
        tries++;
        if (lookTarget(targets, at, (Math.atan2(look.x - at.x, look.z - at.z) * 180) / Math.PI, 12) === id) hits++;
      }
    }
    assert.ok(hits / tries >= 0.9, id + ": " + hits + " of " + tries);
  }
});

test("D5 a promoted shop's button says so", () => {
  const mall = JSON.parse(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  assert.equal(dotLabel(mall, "cafe", [], 0), "Sponsored: Bean There Café");
  const airport = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  assert.equal(dotLabel(airport, "juiceG", [], 0), "Sponsored: Juice bar", "with no priced offer too");
});
