// Tests for the shared Lens maths in src/core/geometry.ts (byte-identical to
// Assets/Scripts/FindYourWayGeometry.ts): headings, next turn, turn-arrow visibility,
// map-metres <-> building-cm conversion, and stopping the line at a lift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  flatDistance,
  headingOf,
  localCmToMap,
  mapToLocalCm,
  nextTurnAlong,
  stopAtLift,
  turnOutOfView,
  wrap,
  yawTo,
} from "../geometry.ts";
import { findNode, lineAhead, parseMap, routePoints, findRoute } from "../router.ts";

const P = (x: number, y: number, z: number) => ({ x, y, z });

test("geometry.ts and its Lens copy are identical", () => {
  const a = readFileSync(new URL("../geometry.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../../Assets/Scripts/FindYourWayGeometry.ts", import.meta.url), "utf8");
  assert.equal(b, a);
});

test("router.ts and its Lens copy are identical", () => {
  const a = readFileSync(new URL("../router.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../../Assets/Scripts/FindYourWayRouter.ts", import.meta.url), "utf8");
  assert.equal(b, a);
});

test("headings are clockwise from north; wrap keeps angles in -180..180", () => {
  assert.equal(headingOf(P(0, 0, 0), P(0, 0, 5)), 0);
  assert.equal(headingOf(P(0, 0, 0), P(5, 0, 0)), 90);
  assert.equal(headingOf(P(0, 0, 0), P(-5, 0, 0)), -90);
  assert.equal(Math.abs(headingOf(P(0, 0, 0), P(0, 0, -5))!), 180);
  assert.equal(headingOf(P(1, 0, 1), P(1, 3, 1)), null, "straight up has no heading");
  assert.equal(wrap(270), -90);
  assert.equal(wrap(-190), 170);
});

test("yawTo is + to the right of the viewer and - to the left", () => {
  assert.equal(yawTo(P(0, 0, 0), 0, P(5, 0, 5)), 45);
  assert.equal(yawTo(P(0, 0, 0), 0, P(-5, 0, 5)), -45);
  assert.equal(yawTo(P(0, 0, 0), 90, P(0, 0, 5)), -90);
  assert.equal(flatDistance(P(0, 3, 0), P(3, 0, 4)), 5);
});

test("next turn: the first bend of 25 degrees or more, else the end of the route", () => {
  assert.deepEqual(nextTurnAlong([P(0, 0, 0), P(0, 0, 4), P(0, 0, 8), P(6, 0, 8)]), P(0, 0, 8));
  assert.deepEqual(nextTurnAlong([P(0, 0, 0), P(0, 0, 4), P(1, 0, 8)]), P(1, 0, 8), "a 14 degree kink is not a turn");
  assert.equal(nextTurnAlong([P(0, 0, 0)]), null);
});

test("turn arrow: shows only when the next turn is outside the view and not right under you", () => {
  const turn = P(0, 0, 10);
  assert.equal(turnOutOfView(P(0, 0, 0), 0, turn, 16), false, "straight ahead");
  assert.equal(turnOutOfView(P(0, 0, 0), 180, turn, 16), true, "behind");
  assert.equal(turnOutOfView(P(0, 0, 0), 30, turn, 16), true, "30 degrees off");
  assert.equal(turnOutOfView(P(0, 0, 9), 180, turn, 16), false, "within 1.5 m");
  assert.equal(turnOutOfView(P(0, 0, 0), 0, null, 16), false);
});

test("S8 on the airport: at the escalator top facing back, the concourse turn is out of view", () => {
  const r = parseMap(readFileSync(new URL("../data/map.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error(r.error);
  const route = findRoute(r.map, "sign", "gateB12", "walk");
  const pts = routePoints(r.map, route);
  const escTop = findNode(r.map, "escTop")!;
  const user = P(escTop.x, escTop.y, escTop.z + 0.5);
  const turn = nextTurnAlong(lineAhead(pts, user, 100000));
  const concourse = findNode(r.map, "concourse")!;
  assert.deepEqual(turn, P(concourse.x, concourse.y, concourse.z));
  assert.equal(turnOutOfView(user, 180, turn, 16), true);
  assert.equal(turnOutOfView(user, 0, turn, 16), false);
});

test("map metres <-> building cm: the sign is the origin, north is -Z, round trip is exact", () => {
  const origin = { x: 30, z: 2 };
  assert.deepEqual(mapToLocalCm(P(30, 0, 2), origin.x, origin.z), P(0, 0, -0));
  assert.deepEqual(mapToLocalCm(P(31, 6, 5), origin.x, origin.z, 1), P(100, 601, -300));
  const eyes = { x: 250, y: 780, z: -1200 };
  const feet = localCmToMap(eyes, origin.x, origin.z, 180);
  assert.deepEqual(feet, P(32.5, 6, 14));
  const back = mapToLocalCm(P(feet.x, feet.y, feet.z), origin.x, origin.z, 180);
  assert.deepEqual(back, eyes);
});

test("the drawn line stops at the foot of a lift (vertical segment) but follows an escalator", () => {
  const lift = [P(0, 0, 0), P(5, 0, 0), P(5, 6, 0), P(9, 6, 0)];
  assert.deepEqual(stopAtLift(lift), [P(0, 0, 0), P(5, 0, 0)]);
  const escalator = [P(0, 0, 0), P(0, 0, 4), P(0, 6, 14)];
  assert.deepEqual(stopAtLift(escalator), escalator);
});
