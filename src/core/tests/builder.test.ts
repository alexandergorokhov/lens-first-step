// Map builder (design-brief-3): the walk is traced by itself, floors are detected and confirmed,
// one pinch marks a shop, and the map is handed to a laptop through the log.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRoute, parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { guessConnection, mapLogLines, MapRecorder, parseMapLog, tripAfterSaving, WalkTracer } from "../mapping.ts";
import { peekMap } from "../peek.ts";

type P = { x: number; y: number; z: number };

// Feeds samples walking straight from a to b at 1.3 m/s, 30 frames a second.
function walk(tr: WalkTracer, a: P, b: P, t0: number): number {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.ceil(d / (1.3 / 30));
  let t = t0;
  for (let i = 1; i <= n; i++) {
    t += 1 / 30;
    const k = i / n;
    tr.sample({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }, t);
  }
  return t;
}
function hold(tr: WalkTracer, p: P, t0: number, secs: number): number {
  let t = t0;
  for (let i = 0; i < secs * 30; i++) {
    t += 1 / 30;
    tr.sample(p, t);
  }
  return t;
}
function started(p: P = { x: 0, y: 0, z: 0 }): WalkTracer {
  const tr = new WalkTracer(new MapRecorder());
  tr.start(p, 0);
  return tr;
}
function mustParse(rec: MapRecorder): MapData {
  const r = parseMap(rec.toJson());
  assert.equal(r.ok, true, r.ok ? "" : (r as { ok: false; error: string }).error);
  return (r as { ok: true; map: MapData }).map;
}

test("B1 a straight walk becomes one stretch, however many samples it took", () => {
  const tr = started();
  const end = { x: 0, y: 0, z: 12 };
  walk(tr, { x: 0, y: 0, z: 0 }, end, 0);
  tr.finish(end);
  const m = tr.rec.toMap();
  assert.equal(m.nodes.length, 2);
  assert.ok(Math.abs(m.edges[0].length - 12) < 0.6);
});

test("B2 a corner is kept; wobbles under 1 m are not", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0, z: 5 }, 0);
  t = walk(tr, { x: 0.5, y: 0, z: 5 }, { x: 0, y: 0, z: 10 }, t);
  t = walk(tr, { x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, t);
  tr.finish({ x: 10, y: 0, z: 10 });
  const m = tr.rec.toMap();
  assert.equal(m.nodes.length, 3, m.nodes.map((n) => n.x + "," + n.z).join(" "));
  assert.ok(Math.hypot(m.nodes[1].x - 0, m.nodes[1].z - 10) < 1.2, "the corner");
  mustParse(tr.rec);
});

test("B3 samples are at least 0.5 m apart: standing still adds nothing", () => {
  const tr = started();
  hold(tr, { x: 0, y: 0, z: 0 }, 0, 5);
  hold(tr, { x: 0.2, y: 0, z: 0.2 }, 5, 5);
  tr.finish({ x: 0.2, y: 0, z: 0.2 });
  assert.equal(tr.rec.toMap().nodes.length, 1);
});

test("B4 crossing an old stretch joins it within 1.5 m, so a shortcut exists", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, 0);
  t = walk(tr, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 10 }, t);
  t = walk(tr, { x: 20, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, t);
  t = walk(tr, { x: 10, y: 0, z: 10 }, { x: 10, y: 0, z: 0.8 }, t);
  tr.finish({ x: 10, y: 0, z: 0.8 });
  const m = mustParse(tr.rec);
  const r = findRoute(m, "sign", m.nodes.filter((n) => Math.hypot(n.x - 10, n.z - 10) < 1.5)[0].id, "walk");
  assert.equal(r.status, "route");
  assert.ok((r as { length: number }).length < 25, "through the join, not the long way: " + (r as { length: number }).length);
});

test("B5 Undo removes the last point, and undoes a join's split too", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, 0);
  t = walk(tr, { x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, t);
  tr.finish({ x: 10, y: 0, z: 10 });
  const n = tr.rec.toMap().nodes.length;
  assert.equal(tr.undo(), true);
  assert.equal(tr.rec.toMap().nodes.length, n - 1);
  const u = started();
  t = walk(u, { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, 0);
  t = walk(u, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 8 }, t);
  t = walk(u, { x: 20, y: 0, z: 8 }, { x: 10, y: 0, z: 8 }, t);
  const before = JSON.stringify(u.rec.toMap());
  walk(u, { x: 10, y: 0, z: 8 }, { x: 10, y: 0, z: 1 }, t);
  assert.notEqual(JSON.stringify(u.rec.toMap()), before);
  while (u.rec.toMap().edges.length > JSON.parse(before).edges.length || u.rec.toMap().nodes.length > JSON.parse(before).nodes.length) assert.equal(u.undo(), true);
  assert.equal(u.rec.toMap().edges.reduce((s, e) => s + e.length, 0) > 0, true);
  assert.deepEqual(u.rec.toMap().nodes.map((n) => n.id), JSON.parse(before).nodes.map((n: { id: string }) => n.id));
  assert.deepEqual(u.rec.toMap().edges.map((e) => e.id), JSON.parse(before).edges.map((e: { id: string }) => e.id));
});

test("B6 a rise of 1 m held for 2 s starts a floor; until confirmed it saves as stairs", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  t = walk(tr, { x: 0, y: 0, z: 6 }, { x: 0, y: 5, z: 12 }, t);
  assert.equal(tr.floorPending(), null, "still climbing");
  t = hold(tr, { x: 0, y: 5, z: 12 }, t, 2.1);
  const p = tr.floorPending();
  assert.ok(p, "floor detected");
  const m = mustParse(tr.rec);
  assert.deepEqual(m.place!.levels!.map((l) => l.y), [0, 5]);
  assert.equal(m.edges[m.edges.length - 1].kind, "stairs");
  assert.ok(t > 0);
});

test("B7 confirming the guess takes one pinch, and any other kind can be picked", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  t = walk(tr, { x: 0, y: 0, z: 6 }, { x: 0, y: 4, z: 6.2 }, t);
  hold(tr, { x: 0, y: 4, z: 6.2 }, t, 2.1);
  assert.equal(tr.floorPending(), "lift");
  assert.equal(tr.confirmFloor(), true);
  assert.equal(tr.floorPending(), null);
  const lift = tr.rec.toMap().edges.filter((e) => e.kind === "lift");
  assert.equal(lift.length, 1);
  assert.equal(mustParse(tr.rec).edges.filter((e) => e.kind === "lift")[0].id, lift[0].id);
  const other = started();
  t = walk(other, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, 0);
  t = walk(other, { x: 0, y: 0, z: 2 }, { x: 0, y: 4, z: 8 }, t);
  hold(other, { x: 0, y: 4, z: 8 }, t, 2.1);
  assert.equal(other.confirmFloor("escalator"), true);
  assert.ok(other.rec.toMap().edges.some((e) => e.kind === "escalator"));
});

test("B8 a brief height wobble under 1 m, or under 2 s, is no floor", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0.6, z: 3 }, 0);
  t = hold(tr, { x: 0, y: 0.6, z: 3 }, t, 3);
  t = walk(tr, { x: 0, y: 0.6, z: 3 }, { x: 0, y: 1.5, z: 3.5 }, t);
  t = hold(tr, { x: 0, y: 1.5, z: 3.5 }, t, 1);
  t = walk(tr, { x: 0, y: 1.5, z: 3.5 }, { x: 0, y: 0, z: 5 }, t);
  assert.equal(tr.floorPending(), null);
  assert.equal(tr.rec.toMap().place.levels.length, 1);
  assert.ok(t > 0);
});

test("B9 the guess: lift with no walking, ramp when gentle, escalator when steady, else stairs", () => {
  const a = { x: 0, y: 0, z: 0 };
  assert.equal(guessConnection(a, { x: 0.5, y: 4, z: 0 }, 10, 1), "lift");
  assert.equal(guessConnection(a, { x: 30, y: 4, z: 0 }, 25, 0.3), "ramp");
  assert.equal(guessConnection(a, { x: 7, y: 4, z: 0 }, 12, 0.05), "escalator");
  assert.equal(guessConnection(a, { x: 7, y: 4, z: 0 }, 12, 0.6), "stairs");
});

test("B10 'Next floor' is the fallback when the height doesn't change (a lift on real Specs)", () => {
  const tr = started();
  const a = { x: 0, y: 0, z: 0 };
  let t = walk(tr, a, { x: 0, y: 0, z: 5 }, 0);
  assert.equal(tr.nextFloor({ x: 0, y: 0, z: 5 }, t), true);
  t = walk(tr, { x: 0, y: 0, z: 5 }, { x: 5, y: 0, z: 5 }, t);
  tr.finish({ x: 5, y: 0, z: 5 });
  const m = mustParse(tr.rec);
  assert.equal(m.place!.levels!.length, 2);
  assert.ok(m.nodes[m.nodes.length - 1].y > 2, "the next points are a floor up");
  assert.ok(m.edges.some((e) => e.kind === "stairs"), "unconfirmed: saved as stairs");
  assert.equal(tr.floorPending(), "lift", "still confirmable");
});

test("B11 Mark shop: a node and a 6 m front 1.5 m ahead, square to your facing, named Shop 1", () => {
  const tr = started();
  const t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  const s = tr.markShop({ x: 0, y: 0, z: 6 }, 90)!;
  assert.equal(s.label, "Shop 1");
  const m = mustParse(tr.rec);
  const n = m.nodes.filter((x) => x.label === "Shop 1")[0];
  assert.equal(n.kind, "place");
  assert.deepEqual([n.x, n.z], [1.5, 6]);
  assert.deepEqual(n.front, { x1: 1.5, z1: 9, x2: 1.5, z2: 3 });
  assert.ok(typeof n.category === "string" && n.category !== "");
  assert.ok(m.edges.some((e) => (e.from === n.id || e.to === n.id) && e.kind === "walk"));
  assert.ok(t > 0);
});

test("B12 marking within 2 m of a shop replaces it; further makes Shop 2; Undo puts it back", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  tr.markShop({ x: 0, y: 0, z: 6 }, 90);
  t = walk(tr, { x: 0, y: 0, z: 6 }, { x: 0, y: 0, z: 7 }, t);
  const again = tr.markShop({ x: 0, y: 0, z: 7 }, 90)!;
  assert.equal(again.label, "Shop 1");
  assert.equal(again.replaced, true);
  let shops = tr.rec.toMap().nodes.filter((n) => n.kind === "place");
  assert.equal(shops.length, 1);
  assert.equal(shops[0].z, 7);
  assert.equal(tr.undo(), true);
  shops = tr.rec.toMap().nodes.filter((n) => n.kind === "place");
  assert.deepEqual([shops.length, shops[0].z], [1, 6]);
  t = walk(tr, { x: 0, y: 0, z: 7 }, { x: 0, y: 0, z: 12 }, t);
  assert.equal(tr.markShop({ x: 0, y: 0, z: 12 }, 90)!.label, "Shop 2");
  mustParse(tr.rec);
});

test("B13 the walk goes on from where you stood, not from the shop", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  tr.markShop({ x: 0, y: 0, z: 6 }, 90);
  t = walk(tr, { x: 0, y: 0, z: 6 }, { x: 0, y: 0, z: 12 }, t);
  tr.finish({ x: 0, y: 0, z: 12 });
  const m = mustParse(tr.rec);
  const shop = m.nodes.filter((n) => n.kind === "place")[0];
  assert.equal(m.edges.filter((e) => e.from === shop.id || e.to === shop.id).length, 1);
  assert.ok(t > 0);
});

test("B14 MapRecorder writes and restores place nodes, category, front and offer", () => {
  const tr = started();
  const t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  tr.markShop({ x: 0, y: 0, z: 6 }, 90);
  tr.finish({ x: 0, y: 0, z: 6 });
  const named = JSON.parse(tr.rec.toJson());
  const shop = named.nodes.filter((n: { kind: string }) => n.kind === "place")[0];
  shop.label = "Bolt";
  shop.category = "hardware";
  shop.offer = [{ text: "Drill", price: "$5", image: "drill" }];
  shop.sponsored = true;
  shop.sponsorTag = "demo";
  named.place.interests = [{ id: "hardware", label: "Hardware" }];
  const back = MapRecorder.fromJson(JSON.stringify(named))!;
  const out = back.toMap();
  const n = out.nodes.filter((x) => x.kind === "place")[0];
  assert.deepEqual([n.label, n.category, n.sponsored, n.sponsorTag], ["Bolt", "hardware", true, "demo"]);
  assert.deepEqual(n.front, shop.front);
  assert.deepEqual(n.offer, shop.offer);
  assert.deepEqual(out.place.interests, named.place.interests);
  // The restored recorder goes on walking from the junction, not from inside the shop.
  back.walked({ x: 0, y: 0, z: 6 });
  assert.ok(back.pointHere({ x: 0, y: 0, z: 9 }));
  const last = back.toMap().edges[back.toMap().edges.length - 1];
  assert.notEqual(last.from, n.id);
  assert.ok(t > 0);
});

test("B15 a walked map with shops on two floors routes for both profiles' rules", () => {
  const tr = started();
  let t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  tr.markShop({ x: 0, y: 0, z: 3 }, 90);
  tr.markShop({ x: 0, y: 0, z: 6 }, -90);
  t = walk(tr, { x: 0, y: 0, z: 6 }, { x: 0, y: 3, z: 10 }, t);
  t = hold(tr, { x: 0, y: 3, z: 10 }, t, 2.2);
  t = walk(tr, { x: 0, y: 3, z: 10 }, { x: 8, y: 3, z: 10 }, t);
  tr.markShop({ x: 4, y: 3, z: 10 }, 0);
  tr.markShop({ x: 8, y: 3, z: 10 }, 0);
  tr.finish({ x: 8, y: 3, z: 10 });
  const m = mustParse(tr.rec);
  const shops = m.nodes.filter((n) => n.kind === "place");
  assert.equal(shops.length, 4);
  assert.deepEqual(shops.map((s) => s.label), ["Shop 1", "Shop 2", "Shop 3", "Shop 4"]);
  const trip = tripAfterSaving(tr.rec.toMap(), { x: 8, y: 3, z: 10 });
  const r = findRoute(m, trip.start, shops[0].id, "walk");
  assert.equal(r.status, "route");
  assert.notEqual(findRoute(m, "sign", shops[3].id, "stepFree").status, "route", "unconfirmed: stairs");
  assert.ok(t > 0);
});

test("B16 the whole map shows as a small model: every stretch, every shop and your dot", () => {
  const tr = started();
  const t = walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, 0);
  tr.markShop({ x: 0, y: 0, z: 10 }, 90);
  tr.finish({ x: 0, y: 0, z: 10 });
  const model = peekMap(tr.rec.toMap(), { x: 0, y: 0, z: 10 });
  assert.equal(model.segments.length, tr.rec.toMap().edges.length);
  assert.equal(model.shops.length, 1);
  const size = Math.max(...model.segments.map((s) => Math.max(Math.abs(s.a.z), Math.abs(s.b.z))));
  assert.ok(size <= 0.21, "fits the box: " + size);
  assert.ok(t > 0);
});

test("U1 the upload lines survive the log: chunks, a checksum, the last complete block wins", () => {
  const big = JSON.stringify({ a: "é".repeat(5000), b: "x".repeat(9000) });
  const lines = mapLogLines(big, "mine");
  assert.ok(lines.length > 5);
  assert.ok(lines.every((l) => l.length < 1000), "short lines");
  const log = "12:00 [Preview 1] noise\n" + lines.map((l, i) => "12:00:" + i + " [Script] " + l + "\r").join("\n") + "\nmore noise\n";
  assert.equal(parseMapLog(log)!.text, big);
  assert.equal(parseMapLog(log)!.name, "mine");
  const twice = log + mapLogLines("second", "mine").join("\n") + "\n";
  assert.equal(parseMapLog(twice)!.text, "second");
  // A cut-off log (a lost line) is an error, not a broken map.
  const cut = lines.filter((_, i) => i !== 2).join("\n");
  assert.throws(() => parseMapLog(cut), /missing|checksum/);
  assert.equal(parseMapLog("nothing here"), null);
});

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
function publish(args: string[]): string {
  return execFileSync(process.execPath, [path.join(ROOT, "tools/map-publish.mjs"), ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

test("U2 map:publish --dry-run validates and says what would be published, changing nothing", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fyw-"));
  const tr = started();
  walk(tr, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }, 0);
  tr.markShop({ x: 0, y: 0, z: 6 }, 90);
  tr.finish({ x: 0, y: 0, z: 6 });
  const log = path.join(dir, "lens.log");
  writeFileSync(log, mapLogLines(JSON.stringify(tr.rec.toMap()), "testwalk").join("\n") + "\n");
  const index = readFileSync(path.join(ROOT, "src/core/data/index.json"), "utf8");
  const out = publish(["--log", log, "--name", "testwalk", "--dry-run"]);
  assert.match(out, /Shop 1/);
  assert.match(out, /dry run/i);
  assert.equal(existsSync(path.join(ROOT, "src/core/data/testwalk.json")), false);
  assert.equal(readFileSync(path.join(ROOT, "src/core/data/index.json"), "utf8"), index);
});

test("U3 map:publish refuses a map that doesn't pass parseMap", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fyw-"));
  const log = path.join(dir, "lens.log");
  writeFileSync(log, mapLogLines('{"version":1,"nodes":[]}', "bad").join("\n") + "\n");
  assert.throws(() => publish(["--log", log, "--name", "bad", "--dry-run"]), /no nodes/);
});
