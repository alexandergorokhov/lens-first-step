// Companion polish: the 6 m lead, never through a shop door or wall, the Options panel folding to a
// small tab once a trip starts, and a short offer card when you look at a shop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { petTarget } from "../pet.ts";
import { clampToPaths, FreeWalk, insideShop, offerPeek, walkableRoute } from "../freewalk.ts";
import { COMPANION_LEAD_M, OptionsDock } from "../dock.ts";

function mall(): MapData {
  const r = parseMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("mall");
  return r.map;
}

const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// ── 1. Lead distance ────────────────────────────────────────────────────────

test("L1: the companion leads 6 m ahead", () => {
  assert.equal(COMPANION_LEAD_M, 6);
});

test("L2: on a guided route the pet's target is 6 m ahead along the line", () => {
  const route = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }];
  const t = petTarget(route, { x: 0, y: 0, z: 2 }, COMPANION_LEAD_M);
  assert.ok(Math.abs(t.at.z - 8) < 1e-6, "at z " + t.at.z);
});

test("L3: in Free walk the companion settles about 6 m ahead in the hall", () => {
  const map = mall() as any;
  const fw = new FreeWalk(map, ["coffee"], { aheadM: COMPANION_LEAD_M });
  const pos = { x: 30, y: 0, z: 10 };
  fw.setCompanion(true, pos, 90);
  let f = fw.update(pos, 90, 0.05, 0);
  for (let i = 1; i < 200; i++) f = fw.update(pos, 90, 0.05, i * 0.05);
  assert.ok(f.pet, "a companion");
  const d = flat(f.pet!.pos, pos);
  assert.ok(d > 5.5 && d < 6.5, "lead " + d.toFixed(2));
});

// ── 2. Never through a shop door or wall ────────────────────────────────────

test("W1: a point inside Bean There Café is inside a shop; the hall is not", () => {
  const map = mall() as any;
  assert.equal(insideShop(map, { x: 16, y: 0, z: 5 }), true);
  assert.equal(insideShop(map, { x: 16, y: 0, z: 10 }), false);
  assert.equal(insideShop(map, { x: 30, y: 0, z: 10 }), false);
});

test("W2: the route given to the companion stops short of the shop door", () => {
  const map = mall() as any;
  const route = [{ x: 8, y: 0, z: 10 }, { x: 16, y: 0, z: 10 }, { x: 16, y: 0, z: 5 }];
  const r = walkableRoute(map, route);
  for (const p of r) assert.equal(insideShop(map, p), false, "inside at " + JSON.stringify(p));
  const end = r[r.length - 1];
  assert.ok(end.z > 7 && end.z < 8.5, "ends just outside the door, z " + end.z);
  // 6 m ahead from 2 m before the turn, the companion waits at the door, not in the shop.
  const t = petTarget(r, { x: 14, y: 0, z: 10 }, COMPANION_LEAD_M);
  assert.equal(insideShop(map, t.at), false);
});

test("W3: a route with no shop at its end is unchanged", () => {
  const map = mall() as any;
  const route = [{ x: 30, y: 0, z: 1 }, { x: 30, y: 0, z: 10 }, { x: 8, y: 0, z: 10 }];
  assert.deepEqual(walkableRoute(map, route), route);
});

test("W4: Free walk's lead spot is pulled back out of a shop onto walkable space", () => {
  const map = mall() as any;
  // 6 m ahead of (16,0,11) looking south is inside the café.
  const q = clampToPaths(map, { x: 16, z: 5 }, 0)!;
  assert.ok(q, "a spot");
  assert.equal(insideShop(map, q), false, "spot " + JSON.stringify(q));
});

test("W5: walking toward the café, the Free-walk companion never stands inside it", () => {
  const map = mall() as any;
  const fw = new FreeWalk(map, [], { aheadM: COMPANION_LEAD_M });
  let pos = { x: 16, y: 0, z: 12 };
  fw.setCompanion(true, pos, 180);
  for (let i = 0; i < 120; i++) {
    pos = { x: 16, y: 0, z: Math.max(9.5, 12 - i * 0.05) };
    const f = fw.update(pos, 180, 0.05, i * 0.05);
    if (f.pet) assert.equal(insideShop(map, f.pet.pos), false, "pet at " + JSON.stringify(f.pet.pos));
  }
});

// ── 3. The Options panel folds away once a trip starts ──────────────────────

test("P1: open before a trip; folded to a tab when the trip or walk starts", () => {
  const d = new OptionsDock();
  d.update(false, false);
  assert.equal(d.isCollapsed(), false);
  d.update(true, false);
  assert.equal(d.isCollapsed(), true);
});

test("P2: tapping the tab opens it, tapping Hide folds it again", () => {
  const d = new OptionsDock();
  d.update(true, false);
  d.toggle();
  assert.equal(d.isCollapsed(), false);
  d.update(true, false);
  assert.equal(d.isCollapsed(), false, "stays open while the trip goes on");
  d.toggle();
  assert.equal(d.isCollapsed(), true);
});

test("P3: a button you need now (Next stop, playing) opens it; after, it folds back", () => {
  const d = new OptionsDock();
  d.update(true, false);
  d.update(true, true);
  assert.equal(d.isCollapsed(), false);
  d.update(true, false);
  assert.equal(d.isCollapsed(), true);
});

test("P4: a new trip folds it again; no trip, nothing folded; toggle off-trip does nothing", () => {
  const d = new OptionsDock();
  d.update(true, false);
  d.toggle();
  d.update(false, false);
  assert.equal(d.isCollapsed(), false);
  d.toggle();
  assert.equal(d.isCollapsed(), false);
  d.update(true, false);
  assert.equal(d.isCollapsed(), true);
});

// ── 4. Looking at a shop shows some of its offers ──────────────────────────

test("O1: the look-at card shows the shop, up to 2 offers with prices, and Sponsored", () => {
  const map = mall() as any;
  const p = offerPeek(map, "cafe", [], 0)!;
  assert.equal(p.title, "Bean There Café");
  assert.ok(p.tag.indexOf("Sponsored") === 0, "tag " + p.tag);
  assert.deepEqual(p.lines, ["Flat white · $3.50", "Cake of the day · $4"]);
});

test("O2: a shop with no offers gives no card", () => {
  const map = mall() as any;
  const none = map.nodes.filter((n: any) => n.front && (!n.offer || n.offer.length === 0))[0];
  if (none) assert.equal(offerPeek(map, none.id, [], none.y), null);
  assert.equal(offerPeek(map, "nowhere", [], 0), null);
});

test("O3: looking at the café front from the hall gives its card; looking away clears it", () => {
  const map = mall() as any;
  const fw = new FreeWalk(map, [], {});
  const pos = { x: 16, y: 0, z: 11 };
  fw.update(pos, 180, 0.05, 0);
  fw.update(pos, 180, 0.05, 1);
  const peek = fw.peek(pos);
  assert.ok(peek && peek.title === "Bean There Café", "card " + JSON.stringify(peek));
  for (let i = 0; i < 80; i++) fw.update(pos, 0, 0.05, 2 + i * 0.05);
  assert.equal(fw.peek(pos), null);
});
