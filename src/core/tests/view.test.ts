// The companion points at shops but stays in view: the view-cone clamp, the aside spot, the
// lead → aside → point → return → lead machine with its cooldown, and the floor arrow shown
// when the companion has been out of view for a while.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARROW_OPACITY,
  asideSpot,
  clampToView,
  COOLDOWN_S,
  inView,
  OutOfViewTimer,
  OUT_OF_VIEW_S,
  PointMachine,
  shopTrigger,
  VIEW_FAR_M,
  VIEW_HALF_DEG,
  VIEW_NEAR_M,
  FOV_HALF_DEG,
} from "../view.ts";

const me = { x: 0, y: 0, z: 0 };
// heading 0 = looking along +z (the same convention as freewalk.ts and pet.ts).
const angleOff = (p: { x: number; z: number }, heading: number) => {
  const a = (Math.atan2(p.x - me.x, p.z - me.z) * 180) / Math.PI;
  let d = a - heading;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
};
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test("V1 a spot already in view stays where it is", () => {
  const p = { x: 0.5, y: 0, z: 4 };
  assert.deepEqual(clampToView(me, 0, p), p);
  assert.equal(inView(me, 0, p), true);
});

test("V2 a spot off to the side is pulled into the ±15° cone, keeping its distance", () => {
  const p = { x: 4, y: 0, z: 2 }; // ~63° right
  const c = clampToView(me, 0, p);
  assert.ok(angleOff(c, 0) <= VIEW_HALF_DEG + 1e-6);
  assert.ok(Math.abs(dist(c, me) - dist(p, me)) < 1e-6);
  assert.ok(c.x > 0, "it stays on the side it was on");
  assert.equal(inView(me, 0, p), false);
  assert.equal(inView(me, 0, c), true);
});

test("V3 never behind: a spot behind you comes to the front edge of the cone", () => {
  for (const heading of [0, 90, -135, 180]) {
    const rad = (heading * Math.PI) / 180;
    const behind = { x: -Math.sin(rad) * 3 + 0.2, y: 0, z: -Math.cos(rad) * 3 };
    const c = clampToView(me, heading, behind);
    assert.ok(angleOff(c, heading) <= VIEW_HALF_DEG + 1e-6, "in the cone at heading " + heading);
    const fwd = (c.x - me.x) * Math.sin(rad) + (c.z - me.z) * Math.cos(rad);
    assert.ok(fwd > 0, "ahead of you at heading " + heading);
  }
});

test("V4 too close or too far is moved to 1.5 m or 6 m", () => {
  const near = clampToView(me, 0, { x: 0, y: 0, z: 0.4 });
  assert.ok(Math.abs(dist(near, me) - VIEW_NEAR_M) < 1e-6);
  const far = clampToView(me, 0, { x: 0, y: 0, z: 20 });
  assert.ok(Math.abs(dist(far, me) - VIEW_FAR_M) < 1e-6);
  const onMe = clampToView(me, 90, me);
  assert.ok(Math.abs(dist(onMe, me) - VIEW_NEAR_M) < 1e-6 && onMe.x > 0, "straight ahead when it is on you");
  assert.equal(clampToView(me, 0, { x: 0, y: 4, z: 3 }).y, 4, "the height is kept");
});

test("V5 the aside spot steps at most ~1.2 m toward the shop, then is clamped to the view", () => {
  const lead = { x: 0, y: 0, z: 3 };
  const shop = { x: 6, y: 0, z: 5 };
  const a = asideSpot(me, 0, lead, shop);
  assert.ok(dist(a, lead) <= 1.5 + 1e-6, "no more than 1.5 m off the lead spot");
  assert.ok(a.x > lead.x, "toward the shop");
  assert.ok(inView(me, 0, a));
  // A shop right next to the lead spot: it just goes there (less than the step).
  const close = asideSpot(me, 0, lead, { x: 0.5, y: 0, z: 3 });
  assert.ok(dist(close, { x: 0.5, y: 0, z: 3 }) < 1e-6);
  // A shop behind you: still in front of you.
  const back = asideSpot(me, 0, lead, { x: 2, y: 0, z: -8 });
  assert.ok(inView(me, 0, back) && back.z > 0);
});

test("V6 the floor arrow shows after 2 s out of view and hides once it is back", () => {
  const t = new OutOfViewTimer();
  assert.equal(ARROW_OPACITY, 0.2);
  assert.equal(OUT_OF_VIEW_S, 2);
  assert.equal(t.update(false, 1.0), false);
  assert.equal(t.update(false, 0.9), false);
  assert.equal(t.update(false, 0.2), true, "past 2 s");
  assert.equal(t.update(false, 5), true);
  assert.equal(t.update(true, 0.016), false, "back in view hides it at once");
  assert.equal(t.update(false, 1.5), false, "the clock starts over");
  assert.equal(t.update(true, 0.1), false);
  t.reset();
  assert.equal(t.update(false, 2.1), true);
});

test("V7 the machine goes lead → aside → point → return → lead", () => {
  const m = new PointMachine();
  assert.equal(m.state, "lead");
  assert.equal(m.trigger("cafe", 0), true);
  assert.equal(m.state, "aside");
  assert.equal(m.shop, "cafe");
  m.update(0.5, false); // still walking aside
  assert.equal(m.state, "aside");
  m.update(0.8, true); // reached the aside spot
  assert.equal(m.state, "point");
  m.update(2.0, false);
  assert.equal(m.state, "point");
  m.update(0.8 + m.pointSeconds + 0.01, false);
  assert.equal(m.state, "return");
  m.update(4.0, false);
  assert.equal(m.state, "return");
  m.update(4.5, true); // back on the lead spot
  assert.equal(m.state, "lead");
  assert.equal(m.shop, null);
  assert.ok(m.pointSeconds >= 2 && m.pointSeconds <= 3);
});

test("V8 aside gives up after a few seconds and points from where it is", () => {
  const m = new PointMachine();
  m.trigger("cafe", 10);
  m.update(13.1, false);
  assert.equal(m.state, "point");
});

test("V9 once per shop, and ~10 s between points", () => {
  const m = new PointMachine();
  assert.equal(COOLDOWN_S, 10);
  m.trigger("cafe", 0);
  assert.equal(m.trigger("books", 1), false, "busy pointing");
  m.update(0.5, true);
  m.update(4, false);
  m.update(4.5, true);
  assert.equal(m.state, "lead");
  assert.equal(m.trigger("books", 6), false, "within the cooldown");
  assert.equal(m.trigger("cafe", 30), false, "the same shop never again");
  assert.equal(m.trigger("books", 10.1), true, "after the cooldown");
  m.reset();
  assert.equal(m.trigger("cafe", 0), true, "a new walk starts fresh");
});

test("V10 a stop() mid-point (a card, arrival) sends it back to lead", () => {
  const m = new PointMachine();
  m.trigger("cafe", 0);
  m.update(0.5, true);
  m.stop();
  assert.equal(m.state, "return");
  m.update(1, true);
  assert.equal(m.state, "lead");
});

test("V11 the trigger: a matching shop within 8 m, near the path, ahead, same floor", () => {
  const shops = [
    { id: "far", x: 0, y: 0, z: 12, match: true },
    { id: "offpath", x: 7, y: 0, z: 3, match: true },
    { id: "behind", x: 0.5, y: 0, z: -4, match: true },
    { id: "upstairs", x: 0, y: 4, z: 4, match: true },
    { id: "nomatch", x: 0.5, y: 0, z: 3, match: false },
    { id: "cafe", x: 1.5, y: 0, z: 5, match: true },
    { id: "books", x: -1.5, y: 0, z: 6, match: true },
  ];
  const path = [me, { x: 0, y: 0, z: 20 }];
  const pick = shopTrigger(shops, me, path, () => false);
  assert.equal(pick && pick.id, "cafe", "the nearest that qualifies");
  assert.equal(shopTrigger(shops, me, path, (id) => id === "cafe")?.id, "books", "skips ones already done");
  // Free walk: no route, the path is the line ahead of you.
  const ahead = [me, { x: 0, y: 0, z: 8 }];
  assert.equal(shopTrigger(shops, me, ahead, () => false)?.id, "cafe");
  assert.equal(shopTrigger([], me, path, () => false), null);
});

// ---- In the guide modes (Go to a place and Tour) and in Free walk -----------------------------

import { readFileSync } from "node:fs";
import { Navigator, findRoute, parseMap, routePoints, tripAhead, type MapData, type Vec3 } from "../router.ts";
import { POINT_GAP_SECONDS, POINT_RADIUS, PointingCoach, interestOptions } from "../places.ts";
import { PetGuide, petTarget } from "../pet.ts";
import { FreeWalk, FREE_DEFAULTS } from "../freewalk.ts";
import { tourStops } from "../tour.ts";

function load(file: string): MapData {
  const parsed = parseMap(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.map;
}
const lerp = (a: Vec3, b: Vec3, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const headingAlong = (a: Vec3, b: Vec3) => (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI;
// Walks the route at 1.3 m/s in 0.1 s steps: fn(feet, look heading, seconds, metres walked).
function walkRoute(route: Vec3[], fn: (feet: Vec3, look: number, now: number, travelled: number) => void) {
  let now = 0;
  let travelled = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 0.13));
    const look = Math.hypot(b.x - a.x, b.z - a.z) > 1e-3 ? headingAlong(a, b) : NaN;
    for (let k = 1; k <= n; k++) {
      now += len / n / 1.3;
      travelled += len / n;
      fn(lerp(a, b, k / n), look, now, travelled);
    }
  }
}

// Runs a guided walk with the coach and the guide wired as the Lens does; checks every point.
function guidedWalk(map: MapData, route: Vec3[], interests: string[], label: string): { points: number; backToLead: number } {
  const coach = new PointingCoach(map);
  coach.interests = interests;
  const guide = new PetGuide();
  guide.keepInView = (spot, user, look) => clampToView(user, look, spot, VIEW_HALF_DEG, Math.max(VIEW_FAR_M, guide.lead + 1.5));
  guide.setOn(true, route, route[0], "k");
  let points = 0;
  let backToLead = 0;
  let lastLook = 0;
  let pointedAt = -1;
  walkRoute(route, (feet, look, now, travelled) => {
    if (!isNaN(look)) lastLook = look;
    guide.look = lastLook;
    const p = coach.check(route, feet, now, travelled, false);
    if (p) {
      guide.point(p, now);
      pointedAt = now;
      points++;
    }
    guide.update(route, feet, 0.1, "k", false, now);
    const pet = guide.pet!;
    if (pet.mood === "point" && now - pointedAt > 1.0 && Math.abs(pet.pos.y - feet.y) < 0.5) {
      assert.ok(inView(feet, lastLook, pet.pos, FOV_HALF_DEG), label + ": out of view while pointing at " + now.toFixed(1) + " feet " + JSON.stringify(feet) + " pet " + JSON.stringify(pet.pos) + " look " + lastLook.toFixed(0) + " state " + guide.pointState);
      const rad = (lastLook * Math.PI) / 180;
      assert.ok((pet.pos.x - feet.x) * Math.sin(rad) + (pet.pos.z - feet.z) * Math.cos(rad) > 0, label + ": behind you");
    }
    if (pointedAt >= 0 && now - pointedAt > 6 && guide.pointState === "lead") {
      if (Math.hypot(pet.pos.x - petTarget(route, feet, guide.lead).at.x, pet.pos.z - petTarget(route, feet, guide.lead).at.z) < 0.5) backToLead++;
      pointedAt = -1;
    }
  });
  return { points, backToLead };
}

test("V12 Go to a place: it points within 8 m, stays in view, and is back in the lead after", () => {
  assert.equal(POINT_RADIUS, 8);
  assert.equal(POINT_GAP_SECONDS, 10);
  const map = load("map.json");
  let total = 0;
  for (const [from, to] of [["sign", "gateB12"], ["sign", "gateC3"]]) {
    const route = routePoints(map, findRoute(map, from, to, "walk"));
    const r = guidedWalk(map, route, interestOptions("walk"), from + ">" + to);
    total += r.points;
    assert.ok(r.backToLead >= Math.max(0, r.points - 1), "back to lead after each point: " + JSON.stringify(r));
  }
  assert.ok(total > 0, "it pointed");
});

test("V13 Tour: the same on each leg of a mall tour", () => {
  const map = load("mall.json");
  const dist = (a: string, b: string) => {
    const r = findRoute(map, a, b, "walk");
    return r.status === "route" ? r.length : Infinity;
  };
  const stops = tourStops(map as never, "sign", ["clothes", "food"], dist, (_s, ids) => ids);
  assert.ok(stops.length >= 2);
  let from = "sign";
  let total = 0;
  for (const to of stops.slice(0, 3)) {
    const route = routePoints(map, findRoute(map, from, to, "walk"));
    total += guidedWalk(map, route, ["coffee", "food", "shopping"], "tour " + from + ">" + to).points;
    from = to;
  }
  assert.ok(total > 0, "it pointed on the tour");
});

test("V14 pointing never changes the route, distance or destination (and the arrow logic is apart)", () => {
  const map = load("map.json");
  const nav = new Navigator(map, "sign", "gateB12", "walk");
  const route = routePoints(map, nav.route);
  const coach = new PointingCoach(map);
  coach.interests = interestOptions("walk");
  const guide = new PetGuide();
  guide.keepInView = (spot, user, look) => clampToView(user, look, spot);
  guide.setOn(true, route, route[0], "k");
  const timer = new OutOfViewTimer();
  walkRoute(route, (feet, look, now, travelled) => {
    if (!isNaN(look)) guide.look = look;
    const before = JSON.stringify(routePoints(map, nav.route));
    const dist = tripAhead(map, nav.route, feet)!.metres;
    const p = coach.check(route, feet, now, travelled, false);
    if (p) guide.point(p, now);
    guide.update(route, feet, 0.1, "k", false, now);
    timer.update(inView(feet, guide.look ?? 0, guide.pet!.pos, FOV_HALF_DEG), 0.1);
    nav.updatePosition(feet);
    if (nav.route.status !== "route") return;
    assert.equal(JSON.stringify(routePoints(map, nav.route)), before);
    assert.equal(tripAhead(map, nav.route, feet)!.metres, dist);
    assert.equal(nav.to, "gateB12");
  });
});

test("V15 Free walk: it steps at most ~1.5 m aside from its lead spot, points in view, ~10 s apart", () => {
  const map = load("mall.json");
  assert.equal(FREE_DEFAULTS.pointRadiusM, 8);
  assert.equal(FREE_DEFAULTS.cooldownSeconds, 10);
  const fw = new FreeWalk(map as never, ["coffee", "food", "clothes", "shopping", "hardware", "sport", "kids", "beauty", "pharmacy"]);
  fw.keepInView = (spot, user, look) => clampToView(user, look, spot, VIEW_HALF_DEG, Math.max(VIEW_FAR_M, fw.settings.aheadM + 1.5));
  const start = { x: 4, y: 0, z: 10 };
  fw.setCompanion(true, start, 90);
  const dt = 1 / 30;
  let t = 0;
  const stopsAt: number[] = [];
  let checked = 0;
  // Along the ground floor corridor, east, then north up the east side.
  const legs: [Vec3, Vec3][] = [[start, { x: 56, y: 0, z: 10 }]];
  for (const [a, b] of legs) {
    const h = headingAlong(a, b);
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (1.3 * dt));
    for (let i = 1; i <= n; i++) {
      t += dt;
      const pos = lerp(a, b, i / n);
      const f = fw.update(pos, h, dt, t);
      if (f.stopped) stopsAt.push(t);
      if (f.pet && f.pet.mood === "point" && fw.pointState === "point") {
        checked++;
        assert.ok(inView(pos, h, f.pet.pos, FOV_HALF_DEG), "out of view while pointing at t=" + t.toFixed(1) + " " + JSON.stringify(f.pet.pos));
        const lead = { x: pos.x + Math.sin((h * Math.PI) / 180) * fw.settings.aheadM, z: pos.z + Math.cos((h * Math.PI) / 180) * fw.settings.aheadM };
        assert.ok(Math.hypot(f.pet.pos.x - lead.x, f.pet.pos.z - lead.z) <= 1.5 + 1.3 * 3 + 0.2, "near its lead spot");
      }
    }
  }
  assert.ok(stopsAt.length >= 2, "stops: " + stopsAt.length);
  assert.ok(checked > 0);
  for (let i = 1; i < stopsAt.length; i++) assert.ok(stopsAt[i] - stopsAt[i - 1] >= 10 - 1e-6, "10 s apart: " + stopsAt.join());
});

test("V16 walking fast, it still points: stepping aside gives up after ~1 s and it points from there", () => {
  const map = load("map.json");
  const route = routePoints(map, findRoute(map, "sign", "gateB12", "walk"));
  const guide = new PetGuide();
  guide.lead = 5;
  guide.keepInView = (spot, user, look) => clampToView(user, look, spot, VIEW_HALF_DEG, Math.max(VIEW_FAR_M, guide.lead + 1.5));
  guide.setOn(true, route, route[0], "k");
  // 5.8 m/s along the first stretch: the aside spot moves faster than the companion walks.
  const a = route[0], b = route[1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  guide.look = headingAlong(a, b);
  const place = { x: (a.x + b.x) / 2 + 3, y: a.y, z: (a.z + b.z) / 2 };
  guide.point(place, 0, 3);
  const states: string[] = [];
  for (let t = 0.05; t <= 2.5; t += 0.05) {
    const k = Math.min(1, (5.8 * t) / len);
    guide.update(route, lerp(a, b, k), 0.05, "k", false, t);
    states.push(guide.pointState);
  }
  assert.ok(states.includes("point"), "it points: " + [...new Set(states)].join(","));
});
