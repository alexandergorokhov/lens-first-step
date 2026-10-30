// Brief 3 map format: "front", "offer", place.interests and place.sayIt, checked by parseMap; the
// mall's shops, and a stale online copy never replacing a newer built-in map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseMap, parseMap } from "../router.ts";
import type { MapData } from "../router.ts";

const mallText = readFileSync(new URL("../data/mall.json", import.meta.url), "utf8");
function mall(): MapData {
  const r = parseMap(mallText);
  if (!r.ok) throw new Error((r as { ok: false; error: string }).error);
  return r.map;
}

function small(node: object, place: object = {}): string {
  return JSON.stringify({
    version: 1,
    nodes: [{ id: "a", x: 0, y: 0, z: 0, kind: "sign" }, { id: "b", x: 0, y: 0, z: 5, kind: "place", category: "food", ...node }],
    edges: [{ from: "a", to: "b", length: 5, kind: "walk", open: true }],
    place,
  });
}
const bad = (text: string, word: string) => {
  const r = parseMap(text);
  assert.equal(r.ok, false, "should be rejected: " + text.slice(0, 120));
  assert.match((r as { ok: false; error: string }).error, new RegExp(word));
};

test("MF1 a node may have a front line; a bad one is refused", () => {
  assert.equal(parseMap(small({ front: { x1: -3, z1: 4, x2: 3, z2: 4 } })).ok, true);
  bad(small({ front: { x1: -3, z1: 4, x2: 3 } }), "front");
  bad(small({ front: { x1: "a", z1: 4, x2: 3, z2: 4 } }), "front");
  bad(small({ front: { x1: 1e7, z1: 4, x2: 3, z2: 4 } }), "front");
  bad(small({ front: { x1: 1, z1: 4, x2: 1, z2: 4 } }), "front");
  bad(small({ front: [1, 2, 3, 4] }), "front");
});

test("MF2 an offer has at most 3 items of short text, a price and an optional picture", () => {
  const one = { text: "Cordless drill", price: "$59", image: "drill" };
  assert.equal(parseMap(small({ offer: [one, { text: "Paint weekend", price: "-20%" }] })).ok, true);
  bad(small({ offer: [one, one, one, one] }), "offer");
  bad(small({ offer: "drill" }), "offer");
  bad(small({ offer: [{ price: "$1" }] }), "offer");
  bad(small({ offer: [{ text: "x" }] }), "offer");
  bad(small({ offer: [{ text: "x".repeat(81), price: "$1" }] }), "offer");
  bad(small({ offer: [{ text: "x", price: "$1", image: 3 }] }), "offer");
});

test("MF3 place.interests is the checkbox list; place.sayIt is short text", () => {
  assert.equal(parseMap(small({}, { interests: [{ id: "food", label: "Food" }], sayIt: "Take me to b" })).ok, true);
  bad(small({}, { interests: "food" }), "interests");
  bad(small({}, { interests: [{ id: "food" }] }), "interests");
  bad(small({}, { interests: [{ id: 3, label: "Food" }] }), "interests");
  bad(small({}, { interests: Array.from({ length: 13 }, (_, i) => ({ id: "c" + i, label: "L" })) }), "interests");
  bad(small({}, { sayIt: 4 }), "sayIt");
});

test("MF4 the mall offers the 6 categories of the brief, from the map", () => {
  const p = mall().place!;
  assert.deepEqual(p.interests!.map((i) => i.label), ["Café", "Food", "Clothes", "Sport", "Hardware", "Books"]);
  assert.equal(p.sayIt, "Take me to Bolt Hardware");
});

test("MF5 the mall has the new shops and categories", () => {
  const m = mall();
  const at = (id: string) => m.nodes.filter((n) => n.id === id)[0];
  assert.deepEqual([at("boltHardware").y, at("boltHardware").category], [0, "hardware"]);
  assert.deepEqual([at("threads").y, at("threads").category], [0, "clothes"]);
  assert.deepEqual([at("auroraSport").y, at("auroraSport").category], [0, "sport"]);
  assert.deepEqual([at("anvilTools").y, at("anvilTools").category], [5, "hardware"]);
  assert.deepEqual([at("secondSkin").y, at("secondSkin").category], [5, "clothes"]);
  assert.equal(at("fashion").category, "clothes");
  assert.equal(at("bookshop").category, "books");
  // The demo preset (Café, Clothes, Hardware) has at least 4 upstairs, so "and more" appears.
  const upstairs = m.nodes.filter((n) => n.kind === "place" && n.y === 5 && ["coffee", "clothes", "hardware"].indexOf(n.category || "") >= 0);
  assert.ok(upstairs.length >= 4, upstairs.map((n) => n.id).join());
});

test("MF6 every shop and every floor connection on the mall has a front, on the node's floor", () => {
  const m = mall();
  const walkable = m.nodes.filter((n) => n.kind === "place" && n.category !== "toilet" && n.category !== "accessibleToilet");
  for (const n of walkable) assert.ok(n.front, n.id + " has no front");
  const feet = new Set<string>();
  for (const e of m.edges) if (e.kind !== "walk") { feet.add(e.from); feet.add(e.to); }
  for (const id of feet) assert.ok(m.nodes.filter((n) => n.id === id)[0].front, id + " has no front");
});

test("MF7 the shops in the demo carry offers of at most 3 items", () => {
  const m = mall();
  for (const id of ["boltHardware", "threads", "cafe", "anvilTools", "secondSkin"]) {
    const n = m.nodes.filter((x) => x.id === id)[0];
    assert.ok(n.offer && n.offer.length >= 1 && n.offer.length <= 3, id);
  }
});

test("MF8 an online map older than the built-in one never replaces it (stale gist)", () => {
  const builtIn = JSON.stringify({ ...JSON.parse(small({})), revision: 3 });
  const older = JSON.stringify({ ...JSON.parse(small({})), revision: 2 });
  const same = JSON.stringify({ ...JSON.parse(small({})), revision: 3, name: "online" });
  const none = small({});
  assert.equal(chooseMap(older, builtIn).source, "offline");
  assert.match(chooseMap(older, builtIn).error as string, /older/);
  assert.equal(chooseMap(older, builtIn).notice, null);
  assert.equal(chooseMap(none, builtIn).source, "offline");
  assert.equal(chooseMap(same, builtIn).source, "online");
  assert.equal(chooseMap(small({}), small({})).source, "online");
});

test("MF9 a revision must be a whole number", () => {
  bad(JSON.stringify({ ...JSON.parse(small({})), revision: "3" }), "revision");
  bad(JSON.stringify({ ...JSON.parse(small({})), revision: 1.5 }), "revision");
});
