// Companion polish: the 6 m lead, never through a shop door or wall, the Options panel folding to a
// small tab once a trip starts, and a short offer card when you look at a shop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { petTarget } from "../pet.ts";
import { clampToPaths, FreeWalk, insideShop, offerBoxes, OfferDismissals, offerPeek, shopLabelSpot, ShopLook, walkableRoute } from "../freewalk.ts";
import { COMPANION_LEAD_M, OptionsDock, walkingHud, routeLineAheadM } from "../dock.ts";
import { COMPANION_ALPHA } from "../anim.ts";
import { chevronMarks } from "../geometry.ts";
import { LINE_STYLE } from "../pet.ts";

function mall(): MapData {
  const r = parseMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("mall");
  return r.map;
}

const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// ── 1. Lead distance ────────────────────────────────────────────────────────

test("L1: the companion leads 7 m ahead", () => {
  assert.equal(COMPANION_LEAD_M, 7);
});

test("L2: on a guided route the pet's target is 7 m ahead along the line", () => {
  const route = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }];
  const t = petTarget(route, { x: 0, y: 0, z: 2 }, COMPANION_LEAD_M);
  assert.ok(Math.abs(t.at.z - 9) < 1e-6, "at z " + t.at.z);
});

test("L3: in Free walk the companion settles about 7 m ahead in the hall", () => {
  const map = mall() as any;
  const fw = new FreeWalk(map, ["coffee"], { aheadM: COMPANION_LEAD_M });
  const pos = { x: 30, y: 0, z: 10 };
  fw.setCompanion(true, pos, 90);
  let f = fw.update(pos, 90, 0.05, 0);
  for (let i = 1; i < 200; i++) f = fw.update(pos, 90, 0.05, i * 0.05);
  assert.ok(f.pet, "a companion");
  const d = flat(f.pet!.pos, pos);
  assert.ok(d > 6.5 && d < 7.5, "lead " + d.toFixed(2));
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
  // 7 m ahead from 2 m before the turn, the companion waits at the door, not in the shop.
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
  // 7 m ahead of (16,0,11) looking south is inside the café.
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

// ── 5. Following the companion: the full line, a solid companion, a clear view ──

test("F1: with the companion on, the whole route line is drawn; without it, the usual stretch ahead", () => {
  assert.equal(routeLineAheadM(true, 10), Infinity);
  assert.equal(routeLineAheadM(false, 10), 10);
});

test("F2: the companion reads solid (alpha at least 0.8)", () => {
  assert.ok(COMPANION_ALPHA >= 0.8 && COMPANION_ALPHA <= 1, String(COMPANION_ALPHA));
});

test("C1: walking a trip, nothing in front but the line and companion: no pill, cue, badge, score or hint", () => {
  assert.deepEqual(walkingHud(true, false, false), { pill: false, cue: false, badge: false, score: false, playLine: false });
});

test("C2: standing still on a trip brings back only the score and the play hint; arrival shows the score", () => {
  assert.deepEqual(walkingHud(true, true, false), { pill: false, cue: false, badge: false, score: true, playLine: true });
  assert.deepEqual(walkingHud(true, false, true), { pill: false, cue: false, badge: false, score: true, playLine: false });
});

test("C3: off a trip (sign, choices) nothing is hidden", () => {
  assert.deepEqual(walkingHud(false, false, false), { pill: true, cue: true, badge: true, score: true, playLine: true });
});

test("D1: the one panel is called Control and folds to its tab when the trip starts", () => {
  const d = new OptionsDock();
  assert.equal(OptionsDock.TITLE, "Control");
  d.update(true, false);
  assert.equal(d.isCollapsed(), true);
});

// ── 6. Looking at a shop: two small offer boxes at the shop, each with a close button ──

test("B1: looking at Bean There Café gives exactly two boxes, Sponsored on it", () => {
  const map = mall() as any;
  const b = offerBoxes(map, "cafe", [], 0)!;
  assert.equal(b.title, "Bean There Café");
  assert.ok(b.tag.indexOf("Sponsored") === 0, b.tag);
  assert.deepEqual(b.boxes, ["Flat white · $3.50", "Cake of the day · $4"]);
});

test("B2: a shop with one offer gives one box; no offers, no boxes", () => {
  const map = mall() as any;
  const one = map.nodes.filter((n: any) => n.front && n.offer && n.offer.length === 1)[0];
  if (one) assert.equal(offerBoxes(map, one.id, [], one.y)!.boxes.length, 1);
  assert.equal(offerBoxes(map, "nowhere", [], 0), null);
});

test("B3: closing the boxes dismisses them for that shop only", () => {
  const d = new OfferDismissals();
  assert.equal(d.visible("cafe"), true);
  d.dismiss("cafe");
  assert.equal(d.visible("cafe"), false);
  assert.equal(d.visible("threads"), true);
  assert.equal(d.visible(null), false);
});

test("B4: the boxes stand at the shop's front, on your side of it, not inside the shop", () => {
  const map = mall() as any;
  const user = { x: 16, y: 0, z: 11 };
  const p = shopLabelSpot(map, "cafe", user)!;
  assert.ok(p, "a spot");
  assert.equal(insideShop(map, p), false, JSON.stringify(p));
  assert.ok(Math.abs(p.x - 16) < 3.5 && p.z > 6 && p.z < 9.5, JSON.stringify(p));
});

test("S1: on a guided trip too, looking at a shop gives its card; looking away clears it", () => {
  const map = mall() as any;
  const look = new ShopLook(map);
  const pos = { x: 16, y: 0, z: 11 };
  look.update(pos, 180, 0);
  look.update(pos, 180, 1);
  assert.equal(look.dot(), "cafe");
  assert.equal(look.peek(pos)!.title, "Bean There Café");
  assert.ok(look.label(pos).indexOf("Bean There Café") >= 0, look.label(pos));
  for (let i = 0; i < 80; i++) look.update(pos, 0, 2 + i * 0.05);
  assert.equal(look.dot(), null);
  assert.equal(look.peek(pos), null);
});

test("B5: Free walk and guided trips give the boxes and their spot for the shop you look at", () => {
  const map = mall() as any;
  const pos = { x: 16, y: 0, z: 11 };
  for (const look of [new FreeWalk(map, [], {}), new ShopLook(map)]) {
    look.update(pos, 180, 0.05, 0);
    look.update(pos, 180, 0.05, 1);
    const b = look.lookBoxes(pos)!;
    assert.equal(b.id, "cafe");
    assert.equal(b.boxes.length, 2);
    assert.equal(insideShop(map, b.spot), false);
  }
});

// ── 7. The floor line of the first airport videos: a wide band, white chevrons, a soft glow ──

test("LS1: the line is the airport-video band (34 cm, ~80 cm with its glow), 20% more see-through", () => {
  assert.equal(LINE_STYLE.widthCm, 34);
  assert.ok(LINE_STYLE.widthCm + 2 * LINE_STYLE.glowCm >= 75 && LINE_STYLE.widthCm + 2 * LINE_STYLE.glowCm <= 85);
  assert.equal(LINE_STYLE.opacity, 0.4);
});

test("CH1: chevrons every 70 cm along the line, each pointing the way you go", () => {
  const marks = chevronMarks([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 300 }], LINE_STYLE.chevronSpacingCm, LINE_STYLE.chevronCm);
  assert.equal(marks.length, 4);
  for (const m of marks) {
    assert.ok(m.apex.z > m.left.z && m.apex.z > m.right.z, "apex ahead");
    assert.ok(Math.abs(m.left.x + m.right.x) < 1e-6 && m.left.x !== m.right.x, "arms either side");
    assert.ok(Math.abs(m.apex.x) < 1e-6, "apex on the line");
  }
  assert.ok(marks[1].apex.z - marks[0].apex.z > 69 && marks[1].apex.z - marks[0].apex.z < 71);
});

test("CH2: round a corner the chevrons follow the new direction; a short line has none", () => {
  const marks = chevronMarks([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 100 }, { x: 200, y: 0, z: 100 }], 70, 22);
  const last = marks[marks.length - 1];
  assert.ok(last.apex.x > last.left.x && last.apex.x > last.right.x, "points along +x after the corner");
  assert.equal(chevronMarks([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 }], 70, 22).length, 0);
});

test("B6: the boxes stand ~1.5 m in front of the shop, clear of plants and props at its door", () => {
  const map = mall() as any;
  const pos = { x: 16, y: 0, z: 11 };
  const look = new ShopLook(map);
  look.update(pos, 180, 0.05, 0);
  look.update(pos, 180, 0.05, 1);
  const b = look.lookBoxes(pos)!;
  assert.ok(b.spot.z >= 8.3 && b.spot.z <= 8.7, "1.5 m out from the café front (z 7): " + b.spot.z);
});
