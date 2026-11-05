// Places along the way + the companion pointing them out, the line at
// 50% in every guide mode and swappable companions. Q1-Q8 in
// devpost/SCENARIOS.md. Written before the code (TDD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Navigator, findNode, findRoute, parseMap, routePoints, tripAhead, type MapData, type Profile, type Vec3 } from "../router.ts";
import {
  POINT_GAP_METRES,
  POINT_GAP_SECONDS,
  POINT_SECONDS,
  PointingCoach,
  interestOptions,
  placeTag,
  placesOf,
  visiblePlaces,
} from "../places.ts";
import { COMPANIONS, LINE_OPACITY, PetGuide, companionChoices, companionOf, guideVisuals, treatsText } from "../pet.ts";

const MAP_TEXT = readFileSync(new URL("../data/map.json", import.meta.url), "utf8");
function loadMap(): MapData {
  const parsed = parseMap(MAP_TEXT);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.map;
}
const at = (map: MapData, id: string): Vec3 => {
  const n = findNode(map, id)!;
  return { x: n.x, y: n.y, z: n.z };
};
const d3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a: Vec3, b: Vec3, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const routeOf = (map: MapData, from: string, to: string, p: Profile) => routePoints(map, findRoute(map, from, to, p));

// Walks the route at 1.3 m/s in 0.1 s steps, calling fn(feet, seconds, metres walked).
function walk(route: Vec3[], fn: (feet: Vec3, now: number, travelled: number) => void, speed = 1.3) {
  let now = 0;
  let travelled = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const len = d3(a, b);
    const n = Math.max(1, Math.ceil(len / (speed * 0.1)));
    for (let k = 1; k <= n; k++) {
      now += len / n / speed;
      travelled += len / n;
      fn(lerp(a, b, k / n), now, travelled);
    }
  }
}

function nearestOnRoute(route: Vec3[], p: Vec3): Vec3 {
  let best = route[0];
  let bestD = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y) + (p.z - a.z) * (b.z - a.z)) / len2));
    const q = lerp(a, b, t);
    if (d3(p, q) < bestD) { bestD = d3(p, q); best = q; }
  }
  return best;
}
const distToRoute = (route: Vec3[], p: Vec3) => d3(p, nearestOnRoute(route, p));
// Distance along the route from the traveller to the point nearest p (+ = ahead).
function aheadOf(route: Vec3[], feet: Vec3, p: Vec3): number {
  const along = (q: Vec3) => {
    let acc = 0, best = Infinity, at = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1], len = d3(a, b);
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y) + (q.z - a.z) * (b.z - a.z)) / (len * len)));
      const d = d3(q, lerp(a, b, t));
      if (d < best) { best = d; at = acc + t * len; }
      acc += len;
    }
    return at;
  };
  return along(p) - along(feet);
}

// Every point made on a walk of the route, with when and where.
function pointsOnWalk(map: MapData, route: Vec3[], coach: PointingCoach, card = () => false) {
  const out: { id: string; now: number; travelled: number; feet: Vec3 }[] = [];
  walk(route, (feet, now, travelled) => {
    const p = coach.check(route, feet, now, travelled, card());
    if (p) out.push({ id: p.id, now, travelled, feet });
  });
  return out;
}

// ---- Q1: places come from the map ------------------------------------------------------------

test("Q1 Places are map nodes of kind 'place' with a category; nothing shop-specific in code", () => {
  const map = loadMap();
  const places = placesOf(map);
  assert.ok(places.length >= 6);
  for (const p of places) assert.ok(typeof p.category === "string" && p.category.length > 0, p.id);
  assert.ok(places.some((p) => p.sponsored), "the demo map has a sponsored place");
  const code = readFileSync(new URL("../places.ts", import.meta.url), "utf8");
  for (const p of places) {
    assert.ok(!code.includes(p.id), "places.ts names " + p.id);
    if (p.label) assert.ok(!code.includes(p.label), "places.ts names " + p.label);
  }
});

test("Q1 Adding places never changes a route between the existing nodes", () => {
  const map = loadMap();
  const bare = { ...map, nodes: map.nodes.filter((n) => n.kind !== "place"), edges: map.edges.filter((e) => [e.from, e.to].every((id) => findNode(map, id)!.kind !== "place")) };
  for (const profile of ["walk", "stepFree"] as Profile[]) {
    for (const [a, b] of [["sign", "gateB12"], ["sign", "gateC3"], ["gateB12", "sign"], ["concourse", "gateC3"]]) {
      const r1 = findRoute(map, a, b, profile);
      const r2 = findRoute(bare, a, b, profile);
      assert.deepEqual(r1.status === "route" ? r1.nodes : r1.status, r2.status === "route" ? r2.nodes : r2.status, a + " -> " + b);
    }
  }
});

// ---- Q2: icons along the way ----------------------------------------------------------------

test("Q2 Icons: never more than 3, only on my floor, within 15 m of me and near the route", () => {
  const map = loadMap();
  for (const [from, to, profile] of [["sign", "gateB12", "walk"], ["sign", "gateC3", "stepFree"], ["gateB12", "sign", "walk"]] as [string, string, Profile][]) {
    const route = routeOf(map, from, to, profile);
    walk(route, (feet) => {
      const v = visiblePlaces(map, route, feet, { profile, muted: false });
      assert.ok(v.length <= 3, "more than 3 icons");
      for (const p of v) {
        assert.ok(Math.abs(p.y - feet.y) < 1, p.id + " is on another floor");
        assert.ok(flat(p, feet) <= 15 + 1e-9, p.id + " is more than 15 m away");
      }
    });
  }
});

test("Q2 Mute ('Places off') hides every icon and never changes the route", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const route = routePoints(map, nav.route);
  const before = JSON.stringify(nav.route);
  let shown = 0;
  walk(route, (feet) => {
    shown += visiblePlaces(map, route, feet, { profile: "walk", muted: false }).length;
    assert.equal(visiblePlaces(map, route, feet, { profile: "walk", muted: true }).length, 0);
  });
  assert.ok(shown > 0, "some icons show when not muted");
  assert.equal(JSON.stringify(nav.route), before);
});

test("Q2 Step-Free lists accessible toilets and lifts first", () => {
  const map = loadMap();
  const route = routeOf(map, "sign", "gateB12", "stepFree");
  let checked = false;
  walk(route, (feet) => {
    const v = visiblePlaces(map, route, feet, { profile: "stepFree", muted: false });
    const firstOther = v.findIndex((p) => p.category !== "accessibleToilet" && p.category !== "lift");
    if (firstOther >= 0) for (const p of v.slice(firstOther)) assert.ok(p.category !== "accessibleToilet" && p.category !== "lift", "Step-Free priority order");
    if (v.some((p) => p.category === "accessibleToilet" || p.category === "lift")) checked = true;
  });
  assert.ok(checked, "the route passes an accessible toilet or a lift");
});

// ---- Q3: interests ----------------------------------------------------------------------------

test("Q3 Interests: coffee, food, shopping, toilets, pharmacy; Step-Free adds accessible toilets; none picked by default", () => {
  assert.deepEqual(interestOptions("walk"), ["coffee", "food", "shopping", "toilet", "pharmacy"]);
  assert.deepEqual(interestOptions("stepFree"), ["coffee", "food", "shopping", "toilet", "pharmacy", "accessibleToilet"]);
  assert.equal(new PointingCoach(loadMap()).interests.length, 0);
});

// ---- Q4: pointing rules -----------------------------------------------------------------------

test("Q4 With no interests only sponsored places are pointed at, and they always say 'Sponsored'", () => {
  const map = loadMap();
  const route = routeOf(map, "sign", "gateB12", "walk");
  const pts = pointsOnWalk(map, route, new PointingCoach(map));
  assert.ok(pts.length >= 1, "the sponsored place on the way is pointed at");
  for (const p of pts) {
    const place = placesOf(map).find((x) => x.id === p.id)!;
    assert.ok(place.sponsored, p.id + " is not an interest and not sponsored");
    assert.match(placeTag(place), /Sponsored/);
  }
  for (const place of placesOf(map)) if (!place.sponsored) assert.doesNotMatch(placeTag(place), /Sponsored/);
});

test("Q4 A non-interest, non-sponsored place is never pointed at; an interest one is", () => {
  const map = loadMap();
  const route = routeOf(map, "sign", "gateB12", "walk");
  const coach = new PointingCoach(map);
  coach.interests = ["coffee"];
  const pts = pointsOnWalk(map, route, coach);
  for (const p of pts) {
    const place = placesOf(map).find((x) => x.id === p.id)!;
    assert.ok(place.sponsored || place.category === "coffee", p.id);
  }
  assert.ok(pts.some((p) => placesOf(map).find((x) => x.id === p.id)!.category === "coffee"), "the café on the way is pointed at");
});

test("Q4 Muted: no points at all", () => {
  const map = loadMap();
  const coach = new PointingCoach(map);
  coach.interests = interestOptions("stepFree");
  coach.muted = true;
  assert.equal(pointsOnWalk(map, routeOf(map, "sign", "gateB12", "walk"), coach).length, 0);
});

test("Q4 At most one point per 10 s; never twice for the same place", () => {
  const map = loadMap();
  for (const [from, to] of [["sign", "gateB12"], ["sign", "gateC3"], ["gateB12", "sign"]]) {
    const coach = new PointingCoach(map);
    coach.interests = interestOptions("stepFree");
    const pts = pointsOnWalk(map, routeOf(map, from, to, "walk"), coach);
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i].now - pts[i - 1].now >= POINT_GAP_SECONDS, "two points within 10 s");
      assert.ok(pts[i].travelled - pts[i - 1].travelled >= POINT_GAP_METRES, "the metres gap");
    }
    assert.equal(new Set(pts.map((p) => p.id)).size, pts.length);
  }
  assert.equal(POINT_GAP_SECONDS, 10);
  assert.equal(POINT_GAP_METRES, 0);
});

test("Q4 Never within 10 m of a turn or a floor change, and never while a card is showing", () => {
  const map = loadMap();
  for (const [from, to] of [["sign", "gateB12"], ["sign", "gateC3"], ["gateB12", "sign"]]) {
    const route = routeOf(map, from, to, "walk");
    // Turns (>= 25 degrees) and the ends of floor changes on the route.
    const keys: Vec3[] = [];
    for (let i = 1; i < route.length - 1; i++) {
      const a = route[i - 1], b = route[i], c = route[i + 1];
      const change = Math.abs(c.y - b.y) >= 0.5 || Math.abs(b.y - a.y) >= 0.5;
      const h1 = Math.atan2(b.x - a.x, b.z - a.z), h2 = Math.atan2(c.x - b.x, c.z - b.z);
      let turn = Math.abs(((h2 - h1) * 180) / Math.PI);
      if (turn > 180) turn = 360 - turn;
      if (change || turn >= 25) keys.push(b);
    }
    const coach = new PointingCoach(map);
    coach.interests = interestOptions("stepFree");
    for (const p of pointsOnWalk(map, route, coach)) {
      for (const k of keys) if (Math.abs(k.y - p.feet.y) < 1) assert.ok(flat(k, p.feet) >= 10, p.id + " pointed within 10 m of a turn/floor change");
    }
    const quiet = new PointingCoach(map);
    quiet.interests = interestOptions("stepFree");
    assert.equal(pointsOnWalk(map, route, quiet, () => true).length, 0, "pointed while a card was showing");
  }
});

test("Q4 Never points at a place behind you (more than 2 m back along the route)", () => {
  const map = loadMap();
  let pointed = 0;
  for (const [from, to] of [["sign", "gateB12"], ["sign", "gateC3"], ["gateB12", "sign"], ["sign", "gateB12"]]) {
    const route = routeOf(map, from, to, "walk");
    const coach = new PointingCoach(map);
    coach.interests = interestOptions("stepFree");
    walk(route, (feet, now, travelled) => {
      const p = coach.check(route, feet, now, travelled, false);
      if (!p) return;
      pointed++;
      // Direction of travel here: the end of the route segment the traveller is on.
      let seg = 0;
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i], b = route[i + 1], len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((feet.x - a.x) * (b.x - a.x) + (feet.y - a.y) * (b.y - a.y) + (feet.z - a.z) * (b.z - a.z)) / len2));
        if (d3(feet, lerp(a, b, t)) < 0.05 && t < 1) { seg = i; break; }
      }
      const next = route[seg + 1];
      const dx = next.x - feet.x, dz = next.z - feet.z, len = Math.hypot(dx, dz);
      const along = ((p.x - feet.x) * dx + (p.z - feet.z) * dz) / len;
      assert.ok(along >= -2, p.id + " is " + (-along).toFixed(1) + " m behind");
    });
  }
  assert.ok(pointed > 0, "the coach did point");
});

test("Q4 Pointing never changes the route points, distance or destination", () => {
  const map = loadMap();
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const route = routePoints(map, nav.route);
  const coach = new PointingCoach(map);
  coach.interests = interestOptions("walk");
  const guide = new PetGuide();
  guide.setOn(true, route, route[0], "k");
  walk(route, (feet, now, travelled) => {
    const before = JSON.stringify(routePoints(map, nav.route));
    const dist = tripAhead(map, nav.route, feet)!.metres;
    const p = coach.check(route, feet, now, travelled, false);
    if (p) guide.point(p, now);
    guide.update(route, feet, 0.1, "k", false, now);
    nav.updatePosition(feet);
    if (nav.route.status !== "route") return;
    assert.equal(JSON.stringify(routePoints(map, nav.route)), before);
    assert.equal(tripAhead(map, nav.route, feet)!.metres, dist);
    assert.equal(nav.to, "gateB12");
  });
});

// ---- Q5: the companion points, then carries on ------------------------------------------------

test("Q5 Pointing: the companion steps ~1.2 m off the line toward the place, stays ahead in view, faces it ~3 s, then is back on the line", () => {
  const map = loadMap();
  for (const [from, to, interests] of [["sign", "gateB12", []], ["sign", "gateB12", ["coffee"]]] as [string, string, string[]][]) {
    const route = routeOf(map, from, to, "walk");
    const coach = new PointingCoach(map);
    coach.interests = interests;
    const guide = new PetGuide();
    guide.setOn(true, route, route[0], "k");
    let pointedAt: { id: string; now: number; x: number; z: number } | null = null;
    let during = 0;
    let checkedAfter = false;
    walk(route, (feet, now, travelled) => {
      const p = coach.check(route, feet, now, travelled, false);
      if (p) {
        guide.point(p, now);
        pointedAt = { id: p.id, now, x: p.x, z: p.z };
      }
      guide.update(route, feet, 0.1, "k", false, now);
      if (!pointedAt) return;
      const pet = guide.pet!;
      const since = now - pointedAt.now;
      if (since > 1.0 && since < POINT_SECONDS - 0.2) {
        during++;
        assert.equal(pet.mood, "point");
        // Off the line (not in the way) but only a couple of steps.
        const off = distToRoute(route, pet.pos);
        assert.ok(off >= 0.8 && off <= 1.6, pointedAt.id + ": " + off.toFixed(2) + " m off the line");
        // On the place's side: closer to the place than the line point it stepped from.
        assert.ok(flat(pet.pos, pointedAt) < flat(nearestOnRoute(route, pet.pos), pointedAt), "steps toward the place");
        // Still ahead of the traveller, in view.
        assert.ok(flat(pet.pos, feet) >= 1.2, "not under your feet");
        assert.ok(aheadOf(route, feet, pet.pos) > 0.5, "ahead of you, in view");
        // Facing the place.
        const want = (Math.atan2(pointedAt.x - pet.pos.x, pointedAt.z - pet.pos.z) * 180) / Math.PI;
        let diff = Math.abs(pet.heading - want) % 360;
        if (diff > 180) diff = 360 - diff;
        assert.ok(diff < 12, "faces the place");
      }
      if (since > POINT_SECONDS + 2.5 && since < POINT_SECONDS + 4 && pet.mood === "lead") {
        assert.ok(distToRoute(route, pet.pos) < 0.3, "back on the line");
        const ahead = d3(pet.pos, feet);
        // 2.5 m along the route; the straight line is a little shorter round a corner.
        assert.ok(ahead >= 1.5 && ahead <= 3.05, "back 2-3 m ahead, was " + ahead.toFixed(2));
        checkedAfter = true;
      }
    });
    assert.ok(pointedAt, "a point happened");
    assert.ok(during > 10, "checked the pet while pointing");
    assert.ok(checkedAfter, "checked the pet after the point");
  }
  assert.equal(POINT_SECONDS, 3);
});

// ---- Q6: Go here? ------------------------------------------------------------------------------

test("Q6 'Go here?' makes the place the destination (same re-route as a gate change) and keeps Step-Free rules", () => {
  const map = loadMap();
  for (const profile of ["walk", "stepFree"] as Profile[]) {
    const nav = new Navigator(map, "sign", "gateB12", profile);
    nav.updatePosition(at(map, "hall"));
    const target = placesOf(map).find((p) => p.category === "pharmacy")!;
    nav.setDestination(target.id);
    assert.equal(nav.route.status, "route");
    if (nav.route.status !== "route") return;
    assert.equal(nav.route.nodes.at(-1), target.id);
    if (profile === "stepFree") for (const e of nav.route.edges) assert.ok(e.kind !== "stairs" && e.kind !== "escalator");
  }
});

// ---- Q7: the line stays at 40% opacity (60% see-through) in every guide mode ---------------------------------

test("Q7 The route line is 60% see-through with the pet off and on (Pet + line)", () => {
  assert.equal(LINE_OPACITY, 0.4);
  for (const on of [false, true]) {
    const v = guideVisuals(on);
    assert.equal(v.showLine, true);
    assert.equal(v.lineOpacity, 0.4);
    assert.equal(v.showCompanion, on);
  }
  const g = new PetGuide();
  g.setOn(true, [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }], { x: 0, y: 0, z: 0 }, "k");
  assert.equal(g.showLine, true, "the line stays with the pet on");
  // The Lens line material default and the demo video line both use 50%.
  const lens = readFileSync(new URL("../../../Assets/Scripts/FindYourWayRouteLine.ts", import.meta.url), "utf8");
  assert.match(lens, /lineColor: vec4 = new vec4\([^)]*, 0\.5\)/);
  const video = readFileSync(new URL("../../../tools/demo-video/index.html", import.meta.url), "utf8");
  assert.match(video, /const lineMat = new THREE\.MeshBasicMaterial\(\{[^}]*opacity: LINE_OPACITY/);
});

// ---- Q8: any companion, just a different model -----------------------------------------------

test("Q8 The companion can be a dog, a robot or a rover: same logic, its own name, model and collectible", () => {
  assert.deepEqual(Object.keys(COMPANIONS), ["dog", "robot", "rover"]);
  for (const id of Object.keys(COMPANIONS)) {
    const c = companionOf(id);
    assert.equal(c.id, id);
    assert.ok(c.name && c.model && c.collectible.one && c.collectible.many);
  }
  assert.equal(companionOf("unicorn").id, "dog");
  assert.equal(treatsText(2, 5), "Treats 2 of 5");
  assert.equal(treatsText(2, 5, companionOf("robot")), "Bolts 2 of 5");
  assert.equal(treatsText(1, 4, companionOf("rover")), "Stars 1 of 4");
});

test("Q8b The picker offers every companion once, named for what you see", () => {
  assert.deepEqual(companionChoices(), [
    { id: "dog", label: "Dog" },
    { id: "robot", label: "Robot" },
    { id: "rover", label: "Rover" },
  ]);
  assert.deepEqual(companionChoices().map((c) => c.id), Object.keys(COMPANIONS));
});
