// Pet guide (P1-P7 in devpost/SCENARIOS.md): a feature the traveller turns on or off;
// the pet walks the same route as the line, waits at floor changes, and the treats game.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Navigator, findNode, findRoute, parseMap, routePoints, type MapData, type Profile, type Vec3 } from "../router.ts";
import { PET_LEAD, PET_WAIT_DISTANCE, PetGuide, newPet, petTarget, stepPet, treatSpots, treatsResult, treatsText } from "../pet.ts";

const MAP_TEXT = readFileSync(new URL("../data/map.json", import.meta.url), "utf8");
function loadMap(text = MAP_TEXT): MapData {
  const parsed = parseMap(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.map;
}
const at = (map: MapData, id: string): Vec3 => {
  const n = findNode(map, id)!;
  return { x: n.x, y: n.y, z: n.z };
};
const pts = (map: MapData, from: string, to: string, profile: Profile) => routePoints(map, findRoute(map, from, to, profile));
const d3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const lerp = (a: Vec3, b: Vec3, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

// Walks the route in 0.1 m steps (lifts in one jump, like the ride button), calling fn(feet).
function walk(route: Vec3[], fn: (feet: Vec3) => void) {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const n = Math.max(1, Math.ceil(d3(a, b) / 0.1));
    for (let k = 1; k <= n; k++) fn(lerp(a, b, k / n));
  }
}

function distToRoute(route: Vec3[], p: Vec3): number {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y) + (p.z - a.z) * (b.z - a.z)) / len2));
    best = Math.min(best, d3(p, lerp(a, b, t)));
  }
  return best;
}

test("P1 Pet on/off: the line shows either way at 50%; toggling never changes the route", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const before = nav.route.status === "route" ? nav.route.nodes.join(">") : "";
  const g = new PetGuide();
  assert.equal(g.showLine, true);
  assert.equal(g.pet, null);
  const r = routePoints(map, nav.route);
  g.setOn(true, r, at(map, "sign"), before);
  assert.equal(g.showLine, true);
  assert.ok(g.pet);
  g.setOn(false, r, at(map, "sign"), before);
  assert.equal(g.showLine, true);
  assert.equal(g.pet, null);
  assert.equal(nav.route.status === "route" ? nav.route.nodes.join(">") : "", before);
});

test("P2 The pet trots ~2.5 m ahead of you along the route, on the route", () => {
  const map = loadMap();
  const route = pts(map, "sign", "gateB12", "walk");
  let pet = newPet(route, route[0]);
  walk(route.slice(0, 3), (feet) => {
    pet = stepPet(pet, route, feet, 0.1);
    assert.ok(distToRoute(route, pet.pos) < 0.3, "pet off the route at " + JSON.stringify(pet.pos));
  });
  // On the long hall corridor it ends up the lead ahead (or waiting at the escalator foot).
  const t = petTarget(route, { x: 30, y: 0, z: 9 });
  assert.ok(Math.abs(d3(t.at, { x: 30, y: 0, z: 9 }) - PET_LEAD) < 0.2);
});

test("P2b A longer lead puts the pet that far ahead, and it only waits past that lead", () => {
  const map = loadMap();
  const route = pts(map, "sign", "gateB12", "walk");
  const feet = { x: 30, y: 0, z: 9 };
  const g = new PetGuide();
  g.lead = 7;
  g.setOn(true, route, feet, "k");
  assert.ok(Math.abs(d3(g.pet!.pos, feet) - 7) < 0.2, "starts 7 m ahead");
  for (let i = 0; i < 30; i++) g.update(route, feet, 0.1, "k");
  assert.equal(g.pet!.mood, "lead", "7 m ahead is not 'you fell behind'");
  assert.ok(Math.abs(d3(g.pet!.pos, feet) - 7) < 0.2, "stays 7 m ahead");
  g.point({ x: 30, y: 0, z: 20 }, 0, 3);
  for (let i = 0; i < 30; i++) g.update(route, feet, 0.1, "k", false, 0);
  assert.ok(d3(g.pet!.pos, feet) > 6, "points from its usual spot ahead, not back at 2.5 m");
});

test("P3 The pet waits at the foot of the escalator and the lift, never on another floor before you", () => {
  const map = loadMap();
  for (const profile of ["walk", "stepFree"] as Profile[]) {
    const route = pts(map, "sign", "gateB12", profile);
    const foot = route.find((p, i) => i < route.length - 1 && Math.abs(route[i + 1].y - p.y) >= 0.5)!;
    const t = petTarget(route, { x: foot.x, y: 0, z: foot.z - 1.5 });
    assert.equal(t.atChange, true, profile);
    assert.deepEqual(t.at, foot, profile);
    let pet = newPet(route, route[0]);
    let lastY = pet.pos.y;
    let sat = false;
    walk(route, (feet) => {
      pet = stepPet(pet, route, feet, 0.1);
      if (pet.mood === "sit") sat = true;
      // Never on a higher floor while you are still on the ground.
      // Never on a higher floor while you are still on the ground floor (not yet on the ride).
      if (feet.y === 0) assert.ok(pet.pos.y < 0.5, profile + ": pet went up first");
      // On an escalator it trots up from the foot; it never jumps partway (review finding 10).
      if (profile === "walk") assert.ok(Math.abs(pet.pos.y - lastY) <= 2.4 * 0.1 + 1e-6, "pet jumped " + (pet.pos.y - lastY).toFixed(2) + " m");
      lastY = pet.pos.y;
    });
    assert.ok(sat, profile + ": the pet sat at the floor change");
  }
});

test("P4 The pet stops and looks back when you fall more than 6 m behind", () => {
  const map = loadMap();
  const route = pts(map, "sign", "gateB12", "walk");
  let pet = newPet(route, at(map, "hall"));
  const away = { x: 20, y: 0, z: 8 }; // 10 m off to the side
  const before = pet.pos;
  pet = stepPet(pet, route, away, 0.5);
  assert.equal(pet.mood, "wait");
  assert.deepEqual(pet.pos, before);
  assert.ok(d3(pet.pos, away) > PET_WAIT_DISTANCE);
  // Facing you: heading from the pet toward you (west = -90).
  assert.ok(Math.abs(pet.heading - -90) < 15, String(pet.heading));
});

test("P5 Step-Free with the pet: it only ever walks the step-free route", () => {
  const map = loadMap();
  const sf = findRoute(map, "sign", "gateC3", "stepFree");
  assert.ok(sf.status === "route" && sf.edges.every((e) => e.kind !== "stairs" && e.kind !== "escalator"));
  const route = routePoints(map, sf);
  const g = new PetGuide();
  g.setOn(true, route, route[0], "k");
  walk(route, (feet) => {
    g.update(route, feet, 0.1, "k");
    assert.ok(distToRoute(route, g.pet!.pos) < 0.3);
  });
  g.update(route, route[route.length - 1], 0.1, "k", true);
  assert.equal(g.pet!.mood, "arrived");
});

test("P6 Treats: one at each turn, each floor-change foot and the gate; walking the route collects each once", () => {
  const map = loadMap();
  const route = pts(map, "sign", "gateB12", "walk");
  const spots = treatSpots(route);
  // escFoot (floor change), concourse (turn), along the long corridors, gateB12 (destination).
  assert.ok(spots.some((s) => d3(s, at(map, "escFoot")) < 0.01));
  assert.ok(spots.some((s) => d3(s, at(map, "concourse")) < 0.01));
  assert.deepEqual(spots.at(-1), at(map, "gateB12"));
  assert.ok(spots.length >= 4 && spots.length <= 8, String(spots.length));
  for (let i = 1; i < spots.length; i++) assert.ok(d3(spots[i], spots[i - 1]) >= 2.9);
  const g = new PetGuide();
  g.setOn(true, route, route[0], "k");
  let collectedEvents = 0;
  walk(route, (feet) => (collectedEvents += g.update(route, feet, 0.1, "k").length));
  assert.equal(g.found, spots.length);
  assert.equal(collectedEvents, spots.length);
  assert.equal(treatsText(g.found, g.total), "Treats " + spots.length + " of " + spots.length);
  assert.equal(treatsResult(4, 4), "All 4 treats found!");
  // Arriving 3 m short of the gate still collects the gate's treat.
  const g2 = new PetGuide();
  g2.setOn(true, route, route[0], "k");
  const end = route.at(-1)!;
  const prev = route.at(-2)!;
  const short = lerp(prev, end, 1 - 3 / d3(prev, end));
  walk([...route.slice(0, -1), short], (feet) => g2.update(route, feet, 0.1, "k"));
  g2.update([end], short, 0.1, "k", true);
  assert.equal(g2.found, spots.length);
  assert.equal(treatsResult(2, 4), "2 of 4 treats found");
});

test("P6 Arrival through a real Navigator never lays new treats or counts one twice (review finding 3)", () => {
  for (const file of ["map.json", "room.json"]) {
    const map = loadMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
    const start = map.place!.start || "sign";
    const dest = map.place!.destination!;
    const nav = new Navigator(map, start, dest, "walk");
    const route = routePoints(map, nav.route);
    const g = new PetGuide();
    g.setOn(true, route, route[0], nav.route.nodes.join(">"));
    const total = g.total;
    let done = false;
    walk(route, (feet) => {
      if (done) return;
      const p = nav.updatePosition(feet);
      g.update(routePoints(map, nav.route), feet, 0.05, nav.route.nodes.join(">"), p === "arrived");
      if (p === "arrived") done = true;
    });
    for (let k = 0; k < 5; k++) g.update(routePoints(map, nav.route), route.at(-1)!, 0.05, nav.route.nodes.join(">"), true);
    assert.ok(done, file + ": arrived");
    assert.equal(g.total, total, file + ": treats re-laid at arrival");
    assert.equal(g.found, total, file + ": all treats, each once");
  }
});

test("P7 Turning the pet off keeps the score; a re-route lays new treats and keeps the ones found", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const g = new PetGuide();
  let r = routePoints(map, nav.route);
  g.setOn(true, r, r[0], "B12");
  walk(r.slice(0, 4), (feet) => g.update(r, feet, 0.1, "B12")); // up to escTop: the escalator treat
  const found = g.found;
  assert.ok(found >= 1);
  g.setOn(false, r, at(map, "escTop"), "B12");
  assert.equal(g.found, found);
  g.setOn(true, r, at(map, "escTop"), "B12");
  assert.equal(g.found, found);
  // Gate change: new route, new treats, same score so far.
  nav.updatePosition(at(map, "concourse"));
  nav.setDestination("gateC3");
  r = routePoints(map, nav.route);
  g.update(r, at(map, "concourse"), 0.1, "C3");
  assert.equal(g.found >= found, true);
  assert.ok(g.total > g.found);
});
