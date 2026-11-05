// Hands-on polish (Nov 5): mall shops stand flat against the walls, the airport keeps its own look
// (no mall shop walls), and Free walk shows clearly what you picked and what you are looking at.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { placeOf } from "../place.ts";
import { bayCovered, frontTargets, shopFrontPose } from "../freewalk.ts";
import { pickChip } from "../dock.ts";

function load(file: string): MapData {
  const r = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file);
  return r.map;
}

const named = (m: MapData) => m.nodes.filter((n) => n.kind === "place" || n.kind === "destination");
const axisAligned = (f: { x: number; z: number }) =>
  (Math.abs(Math.abs(f.x) - 1) < 1e-9 && Math.abs(f.z) < 1e-9) || (Math.abs(Math.abs(f.z) - 1) < 1e-9 && Math.abs(f.x) < 1e-9);

// ── 1. Mall: every shop parallel to a wall ──────────────────────────────────

test("W1: every named place in the mall faces straight out from a wall", () => {
  const m = load("mall.json");
  for (const n of named(m)) {
    const p = shopFrontPose(m, n.id);
    assert.ok(p, n.id + " has a pose");
    assert.ok(axisAligned(p!.facing), n.id + " faces along an axis, not at an angle: " + JSON.stringify(p!.facing));
  }
});

test("W2: mall shops stand on the outer wall, not out in the hall", () => {
  const m = load("mall.json");
  const fp = m.place!.footprint!;
  for (const n of named(m)) {
    const p = shopFrontPose(m, n.id)!;
    const toWall = Math.min(p.x - fp.minX, fp.maxX - p.x, p.z - fp.minZ, fp.maxZ - p.z);
    assert.ok(toWall <= 0.6, n.id + " front is " + toWall.toFixed(2) + " m from the wall");
    // it faces into the hall: one step along its facing is further from that wall
    const q = { x: p.x + p.facing.x, z: p.z + p.facing.z };
    const qWall = Math.min(q.x - fp.minX, fp.maxX - q.x, q.z - fp.minZ, fp.maxZ - q.z);
    assert.ok(qWall > toWall, n.id + " faces into the hall");
  }
});

test("W3: the look-at front of a mall shop is the wall front you see", () => {
  const m = load("mall.json");
  const p = shopFrontPose(m, "cafe")!;
  const t = frontTargets(m).filter((f) => f.id === "cafe");
  const onWall = t.some((f) => Math.abs((f.z1 + f.z2) / 2 - p.z) < 1e-6 && Math.abs(f.z1 - f.z2) < 1e-6);
  assert.ok(onWall, "a front target lies along the café's wall front");
});

test("W4: a plain wall bay is left out where a named shop already stands", () => {
  const m = load("mall.json");
  const p = shopFrontPose(m, "cafe")!;
  assert.equal(bayCovered([p], p.y, p.x + 1, p.z, p.facing, 3), true);
  assert.equal(bayCovered([p], p.y, p.x + 12, p.z, p.facing, 3), false);
  assert.equal(bayCovered([p], p.y + 5, p.x, p.z, p.facing, 3), false, "another floor");
  assert.equal(bayCovered([p], p.y, p.x, p.z, { x: -p.facing.x, z: -p.facing.z }, 3), false, "the opposite wall");
});

// ── 2. Airport: its own look, not the mall's ────────────────────────────────

test("A1: only the mall asks for shop-lined walls; the airport does not", () => {
  assert.equal(placeOf(load("mall.json")).retail, true);
  assert.equal(placeOf(load("map.json")).retail, false);
  assert.equal(placeOf(load("campus.json")).retail, false);
  assert.equal(placeOf(load("hospital.json")).retail, false);
});

test("A2: airport places also face along the building's axes", () => {
  const m = load("map.json");
  for (const n of named(m)) assert.ok(axisAligned(shopFrontPose(m, n.id)!.facing), n.id);
});

test("A3: a place far from any wall stays where it is (just squared up)", () => {
  const m = load("map.json");
  const n = m.nodes.find((x) => x.id === "juiceG")!;
  const p = shopFrontPose(m, "juiceG")!;
  assert.ok(Math.hypot(p.x - n.x, p.z - n.z) < 2, "juice bar front stays by its node");
});

// ── 3. Free walk: what you picked is plain to see ───────────────────────────

test("S1: a picked interest reads as picked; an unpicked one is dimmed", () => {
  const on = pickChip("Coffee", true);
  const off = pickChip("Coffee", false);
  assert.equal(on.text, "✓ Coffee");
  assert.equal(off.text, "Coffee");
  assert.ok(on.alpha === 1 && off.alpha < 0.6, "unpicked is clearly dimmer");
  assert.ok(on.highlight && !off.highlight);
});

test("A4: a map can say retail itself, either way", () => {
  const base = JSON.parse(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  assert.equal(placeOf({ ...base, place: { ...base.place, retail: true } }).retail, true);
  const mallRaw = JSON.parse(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  assert.equal(placeOf({ ...mallRaw, place: { ...mallRaw.place, retail: false } }).retail, false);
});
