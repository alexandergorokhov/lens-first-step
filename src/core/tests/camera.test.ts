// The demo take's camera (ROUND2.md R2-13): smooth and elegant. Rounded corners, eased starts and stops,
// a steady look ahead with a capped turn rate, escalators ridden straight along their axis.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAM, planWalk, rideLine, liftApproach, type CamPose } from "../camera.ts";

const DT = 1 / 30;
const turn = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180);

function check(poses: CamPose[], maxSpeed: number, label: string) {
  assert.ok(poses.length > 2, label + ": poses");
  for (let i = 1; i < poses.length; i++) {
    const a = poses[i - 1], b = poses[i];
    const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    assert.ok(step <= maxSpeed * DT + 1e-6, label + ": jump of " + step.toFixed(3) + " m at " + i);
    assert.ok(turn(a.heading, b.heading) <= CAM.maxTurnDegS * DT + 1e-6, label + ": turn of " + turn(a.heading, b.heading).toFixed(2) + " deg at " + i);
  }
}

test("CAM1 a walk with a sharp corner: no jumps, turns at most CAM.maxTurnDegS, starts and ends at rest", () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { x: 8, y: 0, z: 10 }];
  const poses = planWalk(pts, 0);
  check(poses, CAM.walkSpeed, "corner");
  const v0 = Math.hypot(poses[1].x - poses[0].x, poses[1].z - poses[0].z) / DT;
  const n = poses.length;
  const v1 = Math.hypot(poses[n - 1].x - poses[n - 2].x, poses[n - 1].z - poses[n - 2].z) / DT;
  assert.ok(v0 < 0.2 && v1 < 0.2, "eased: " + v0.toFixed(2) + ", " + v1.toFixed(2));
  // It ends where the route ends, and cuts the corner by at most CAM.cornerM.
  assert.ok(Math.hypot(poses[n - 1].x - 8, poses[n - 1].z - 10) < 0.05);
  const near = Math.min(...poses.map((p) => Math.hypot(p.x - 0, p.z - 10)));
  assert.ok(near <= CAM.cornerM, "corner cut " + near.toFixed(2));
});

test("CAM2 the heading looks along the way, settling to the last leg's direction", () => {
  const poses = planWalk([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, { x: 8, y: 0, z: 10 }], 0);
  assert.ok(turn(poses[poses.length - 1].heading, 90) < 3, "faces east at the end: " + poses[poses.length - 1].heading.toFixed(1));
  // From a start heading pointing the other way it turns round gently first.
  const back = planWalk([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 6 }], 180);
  check(back, CAM.walkSpeed, "turn round");
});

test("CAM3 an escalator is ridden straight along its axis, at ride pace, stepping on and off in line", () => {
  const foot = { x: 10, y: 0, z: 0 }, top = { x: 10, y: 5, z: 10 };
  const line = rideLine(foot, top);
  // On before the foot and off after the top, in line with the escalator.
  assert.ok(Math.abs(line[0].x - 10) < 1e-9 && line[0].z < foot.z - CAM.rideRunM + 1e-9);
  assert.ok(Math.abs(line[line.length - 1].x - 10) < 1e-9 && line[line.length - 1].z > top.z + CAM.rideRunM - 1e-9);
  const poses = planWalk(line, 0, { rideFrom: 1, rideTo: 2 });
  check(poses, CAM.walkSpeed, "escalator");
  const onIt = poses.filter((p) => p.y > 0.2 && p.y < 4.8);
  assert.ok(onIt.length > 0);
  for (const p of onIt) {
    assert.ok(Math.abs(p.x - 10) < 0.02, "in line: x " + p.x);
    assert.ok(turn(p.heading, 0) < 2, "looks up the escalator");
  }
  for (let i = 1; i < poses.length; i++) {
    const a = poses[i - 1], b = poses[i];
    if (a.y > 0.2 && b.y < 4.8) assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / DT <= CAM.rideSpeed + 1e-6, "ride pace");
  }
});

test("CAM4 a lift: stop in front of its doors, facing them", () => {
  const lift = { x: 5, y: 0, z: 5 };
  const from = { x: 5, y: 0, z: 0 };
  const a = liftApproach(lift, from);
  assert.ok(Math.abs(Math.hypot(a.x - lift.x, a.z - lift.z) - CAM.liftStandM) < 1e-9);
  assert.ok(turn(a.heading, 0) < 1e-6, "faces the doors (north)");
});
