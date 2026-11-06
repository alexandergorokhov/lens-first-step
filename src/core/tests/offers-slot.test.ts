// The offers card never covers an open menu: it takes the first corner slot that is clear of
// every panel in view (head-locked plane, cm at 70 cm), else the one it covers least.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFER_SLOTS, OFFER_VIEW, offersSlot, rectsOverlap, type VRect } from "../view.ts";

// The HUD card: 16 cm wide at panel scale 0.82, 2 offers.
const card = { w: 13.1, h: 7.8 };
const inside = (s: { x: number; y: number }) =>
  Math.abs(s.x) + card.w / 2 <= OFFER_VIEW.w / 2 + 1e-9 && Math.abs(s.y) + card.h / 2 <= OFFER_VIEW.h / 2 + 1e-9;

test("no panel: the card stays top right", () => {
  assert.deepEqual(offersSlot(card, []), OFFER_SLOTS[0]);
  assert.ok(OFFER_SLOTS[0].x > 0 && OFFER_SLOTS[0].y > 0);
});

test("the Nov 6 overlap: menu right of centre -> the card moves left, clear of it", () => {
  // "What would you like to do?" as seen in the preview screenshot: x -4.2..15, y -14..8.7.
  const menu: VRect = { x: 5.4, y: -2.65, w: 19.2, h: 22.7 };
  const s = offersSlot(card, [menu]);
  assert.ok(s.x < 0, "moved to the left: " + JSON.stringify(s));
  assert.equal(rectsOverlap({ x: s.x, y: s.y, w: card.w, h: card.h }, menu), 0);
  assert.ok(inside(s), "inside the view: " + JSON.stringify(s));
});

test("every slot keeps the whole card inside the view (Nov 6: the left slot was cut off)", () => {
  const menus: VRect[][] = [[], [{ x: 5.4, y: -2.65, w: 19.2, h: 22.7 }], [{ x: 0, y: 2, w: 60, h: 30 }]];
  for (const m of menus) assert.ok(inside(offersSlot(card, m)), JSON.stringify(offersSlot(card, m)));
  const wide = { w: 30, h: 7.8 };
  const s = offersSlot(wide, [{ x: -10, y: 0, w: 5, h: 5 }]);
  assert.ok(Math.abs(s.x) + wide.w / 2 <= OFFER_VIEW.w / 2 + 1e-9);
});

test("menu on the left: the card keeps the top right", () => {
  const menu: VRect = { x: -10, y: -3, w: 20, h: 20 };
  assert.deepEqual(offersSlot(card, [menu]), OFFER_SLOTS[0]);
});

test("menus on both sides: a clear higher slot wins", () => {
  const left: VRect = { x: -12, y: 0, w: 14, h: 14 };
  const right: VRect = { x: 12, y: 0, w: 14, h: 14 };
  const s = offersSlot(card, [left, right]);
  assert.equal(rectsOverlap({ x: s.x, y: s.y, w: card.w, h: card.h }, left), 0);
  assert.equal(rectsOverlap({ x: s.x, y: s.y, w: card.w, h: card.h }, right), 0);
});

test("nowhere is clear: the slot with the least overlap, never across the way ahead", () => {
  const huge: VRect = { x: 0, y: 2, w: 60, h: 30 };
  const s = offersSlot(card, [huge]);
  assert.ok(OFFER_SLOTS.some((o) => o.x === s.x && o.y === s.y));
  for (const o of OFFER_SLOTS) assert.ok(o.y > 0, "every slot is above the line of sight");
});

test("rectsOverlap is an area and zero for touching edges", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }), 0);
  assert.equal(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 }), 1);
});
