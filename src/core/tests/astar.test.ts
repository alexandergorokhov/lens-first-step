// A* (NEXT-SESSION item 11) must give exactly the same route length as the plain Dijkstra in
// router.ts for every pair of nodes on every map, under both profiles, with closures respected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { edgeAllowed, findRoute, parseMap, setEdgeOpen, type MapData, type MapEdge, type Profile } from "../router.ts";
import { aStar } from "../astar.ts";

const FILES: string[] = JSON.parse(readFileSync(new URL("../data/index.json", import.meta.url), "utf8"))
  .maps.map((m: { file: string }) => m.file);
if (FILES.indexOf("mall.json") < 0) FILES.push("mall.json");

function load(file: string): MapData {
  const r = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(file + ": " + (r as { ok: false; error: string }).error);
  return r.map;
}

// Same answer as findRoute, and the path itself is a real, allowed walk of that length.
function check(map: MapData, from: string, to: string, profile: Profile, label: string) {
  const r = findRoute(map, from, to, profile);
  const a = aStar(map, from, to, (e: MapEdge) => edgeAllowed(e, profile));
  if (r.status !== "route" && r.status !== "arrived") {
    assert.equal(a, null, label + ": findRoute found no route, A* did");
    return;
  }
  assert.ok(a, label + ": A* found no route");
  if (!a) return;
  assert.ok(Math.abs(a.length - r.length) < 1e-9, label + ": A* " + a.length + " vs Dijkstra " + r.length);
  assert.equal(a.nodes[0], from);
  assert.equal(a.nodes[a.nodes.length - 1], to);
  assert.equal(a.edges.length, a.nodes.length - 1);
  let sum = 0;
  a.edges.forEach((e, i) => {
    assert.ok(edgeAllowed(e, profile), label + ": uses a disallowed edge");
    const u = a.nodes[i];
    const v = a.nodes[i + 1];
    const forward = e.from === u && e.to === v;
    const backward = e.to === u && e.from === v && e.kind !== "escalator";
    assert.ok(forward || backward, label + ": edge " + e.from + "->" + e.to + " does not join " + u + "->" + v);
    sum += e.length;
  });
  assert.ok(Math.abs(Math.round(sum * 1000) / 1000 - a.length) < 1e-9, label + ": edges add up");
}

test("A1 A* length equals Dijkstra for every pair on every map (incl. mall), Walk and Step-Free", () => {
  for (const file of FILES) {
    const map = load(file);
    for (const a of map.nodes) {
      for (const b of map.nodes) {
        for (const profile of ["walk", "stepFree"] as Profile[]) check(map, a.id, b.id, profile, file + " " + a.id + "->" + b.id + " " + profile);
      }
    }
  }
});

test("A2 closed connections are respected: every closable edge closed, and all lifts closed at once", () => {
  for (const file of FILES) {
    const map = load(file);
    const ids = Array.from(new Set(map.edges.filter((e) => typeof e.id === "string").map((e) => e.id as string)));
    const variants: [string, MapData][] = ids.map((id) => [id + " closed", setEdgeOpen(map, id, false)] as [string, MapData]);
    let noLifts = map;
    for (const e of map.edges) if (e.kind === "lift" && e.id) noLifts = setEdgeOpen(noLifts, e.id, false);
    variants.push(["all lifts closed", noLifts]);
    const start = map.place && map.place.start ? map.place.start : map.nodes[0].id;
    for (const [name, m] of variants) {
      for (const b of m.nodes) {
        for (const profile of ["walk", "stepFree"] as Profile[]) {
          check(m, start, b.id, profile, file + " (" + name + ") " + start + "->" + b.id + " " + profile);
          const r = aStar(m, start, b.id, (e) => edgeAllowed(e, profile));
          if (r) for (const e of r.edges) assert.ok(e.open, name + ": used a closed edge");
        }
      }
    }
  }
});

test("A3 one-way escalators, unknown nodes and an always-false predicate", () => {
  const map = load("mall.json");
  // The up escalator only runs up: with nothing but escalators allowed, down is impossible.
  const up = map.edges.find((e) => e.kind === "escalator" && e.from === "escUpFoot")!;
  assert.ok(up, "mall has an up escalator from escUpFoot");
  const onlyUp = (e: MapEdge) => e === up;
  assert.ok(aStar(map, up.from, up.to, onlyUp));
  assert.equal(aStar(map, up.to, up.from, onlyUp), null);
  assert.equal(aStar(map, "sign", "nowhere", () => true), null);
  assert.equal(aStar(map, "nowhere", "sign", () => true), null);
  assert.equal(aStar(map, "sign", "cinema", () => false), null);
  assert.deepEqual(aStar(map, "sign", "sign", () => true), { nodes: ["sign"], edges: [], length: 0 });
});
