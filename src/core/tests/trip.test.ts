// Multi-stop trips (NEXT-SESSION item 12): pick several shops in the mall, the Lens orders them
// for the shortest total walk and guides stop by stop ("Stop 2 of 4: Pharmacy").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findNode, findRoute, parseMap, type MapData, type Profile } from "../router.ts";
import { MultiStopTrip, orderStops, tripLength } from "../trip.ts";

function loadMall(): MapData {
  const r = parseMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("mall.json: " + (r as { ok: false; error: string }).error);
  return r.map;
}

function distFor(map: MapData, profile: Profile): (a: string, b: string) => number {
  return (a, b) => {
    const r = findRoute(map, a, b, profile);
    if (r.status === "arrived") return 0;
    return r.status === "route" ? r.length : Infinity;
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((x, i) => {
    for (const rest of permutations(items.filter((_, j) => j !== i))) out.push([x, ...rest]);
  });
  return out;
}

const PICKS: string[][] = [
  ["pharmacy", "iceCream", "sushi"],
  ["toiletF", "bakery", "bookshop", "coffeeF"],
  ["supermarket", "fashion", "accToiletG", "cafe", "sushi"],
  ["phoneShop", "iceCream", "pharmacy", "bookshop", "toiletG", "fashion"],
];

test("T1 best order is no longer than the picked order or any other order (mall, Walk and Step-Free)", () => {
  const map = loadMall();
  const start = map.place!.start!;
  for (const profile of ["walk", "stepFree"] as Profile[]) {
    const dist = distFor(map, profile);
    for (const picked of PICKS) {
      const order = orderStops(start, picked, dist);
      assert.deepEqual(order.slice().sort(), picked.slice().sort(), "same stops, each once");
      const best = tripLength(start, order, dist);
      assert.ok(isFinite(best), profile + " " + picked.join(","));
      assert.ok(best <= tripLength(start, picked, dist) + 1e-9, "beats or equals the picked order");
      for (const p of permutations(picked)) {
        assert.ok(best <= tripLength(start, p, dist) + 1e-9, profile + ": " + order.join(">") + " vs " + p.join(">"));
      }
    }
  }
  // More than 6 stops: nearest-neighbour, still every stop exactly once and a finite trip.
  const many = ["pharmacy", "cafe", "supermarket", "phoneShop", "bakery", "bookshop", "fashion", "sushi"];
  const dist = distFor(map, "walk");
  const order = orderStops(start, many, dist);
  assert.deepEqual(order.slice().sort(), many.slice().sort());
  let at = start;
  for (const s of order) {
    const left = many.filter((x) => order.indexOf(x) >= order.indexOf(s));
    const nearest = Math.min(...left.map((x) => dist(at, x)));
    assert.equal(dist(at, s), nearest, "nearest-neighbour step to " + s);
    at = s;
  }
  // Small cases and an injected toy distance.
  assert.deepEqual(orderStops(start, [], dist), []);
  assert.deepEqual(orderStops(start, ["cafe"], dist), ["cafe"]);
  const line = (a: string, b: string) => Math.abs(Number(a) - Number(b));
  assert.deepEqual(orderStops("0", ["9", "3", "6"], line), ["3", "6", "9"]);
  assert.deepEqual(orderStops("0", ["3", "3", "6"], line), ["3", "6"], "duplicates are visited once");
});

test("T2 every leg of a Step-Free trip avoids stairs and escalators", () => {
  const map = loadMall();
  const start = map.place!.start!;
  const dist = distFor(map, "stepFree");
  for (const picked of PICKS) {
    const order = orderStops(start, picked, dist);
    let at = start;
    for (const stop of order) {
      const r = findRoute(map, at, stop, "stepFree");
      assert.equal(r.status, "route", at + " -> " + stop);
      if (r.status !== "route") continue;
      for (const e of r.edges) assert.ok(e.kind !== "stairs" && e.kind !== "escalator", at + " -> " + stop + " used " + e.kind);
      at = stop;
    }
  }
  // The Walk trip to the first floor does use them (so the Step-Free check means something).
  const walk = findRoute(map, start, "iceCream", "walk");
  assert.ok(walk.status === "route" && walk.edges.some((e) => e.kind === "escalator" || e.kind === "stairs"));
});

test("T3 arriving and pressing Next advances stop by stop and then ends", () => {
  const trip = new MultiStopTrip(["pharmacy", "iceCream", "sushi"]);
  assert.equal(trip.total, 3);
  assert.equal(trip.index, 0);
  assert.equal(trip.done, false);
  assert.equal(trip.current(), "pharmacy");
  assert.equal(trip.next(), true);
  assert.equal(trip.index, 1);
  assert.equal(trip.current(), "iceCream");
  assert.equal(trip.next(), true);
  assert.equal(trip.current(), "sushi");
  assert.equal(trip.done, false);
  assert.equal(trip.next(), false, "past the last stop");
  assert.equal(trip.done, true);
  assert.equal(trip.current(), null);
  assert.equal(trip.next(), false, "stays done");
  assert.equal(trip.index, 3);
  const empty = new MultiStopTrip([]);
  assert.equal(empty.done, true);
  assert.equal(empty.current(), null);
  // The trip keeps its own copy of the stops.
  const stops = ["a", "b"];
  const t = new MultiStopTrip(stops);
  stops[0] = "z";
  assert.equal(t.current(), "a");
});

test("T4 labels read 'Stop 2 of 4: Pharmacy' from the map's shop names", () => {
  const map = loadMall();
  const name = (id: string) => findNode(map, id)?.label || id;
  const trip = new MultiStopTrip(["bakery", "pharmacy", "iceCream", "sushi"]);
  assert.equal(trip.label(name), "Stop 1 of 4: " + name("bakery"));
  trip.next();
  assert.equal(name("pharmacy"), "Pharmacy");
  assert.equal(trip.label(name), "Stop 2 of 4: Pharmacy");
  trip.next();
  trip.next();
  assert.equal(trip.label(name), "Stop 4 of 4: " + name("sushi"));
  trip.next();
  assert.equal(trip.label(name), "All stops done");
});
