// Companion animation: jointed rigs and the pose for each mood. Pure maths, no Lens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOG_STRIDE_M, RIGS, ROBOT_STRIDE_M, WHEEL_RADIUS_CM, poseFor, rigOf, rigHeightCm, COMPANION_ALPHA } from "../anim.ts";
import type { RigMood } from "../anim.ts";

const MOODS: RigMood[] = ["lead", "run", "sit", "wait", "point", "arrived"];
const MODELS = ["dog", "robot", "rover"];
const walking = { mood: "lead" as RigMood, speedMs: 1.4, t: 3 };

test("A1 Every rig joint hangs from a joint that exists, and every part sits on a joint", () => {
  for (const id of MODELS) {
    const rig = rigOf(id);
    const names = rig.joints.map((j) => j.name);
    for (const j of rig.joints) assert.ok(j.parent === null || names.includes(j.parent), id + " " + j.name);
    for (const p of rig.parts) assert.ok(names.includes(p.joint), id + " part on " + p.joint);
  }
});

test("A2 A pose only names joints of its rig, stays finite, in every mood", () => {
  for (const id of MODELS) {
    const names = rigOf(id).joints.map((j) => j.name);
    for (const mood of MOODS) {
      for (const speedMs of [0, 0.7, 1.4, 3, 9]) {
        const p = poseFor(id, { mood, speedMs, travelledM: 12.3, t: 7.7 });
        for (const k of Object.keys(p.joints)) {
          assert.ok(names.includes(k), id + " posed unknown joint " + k);
          for (const a of p.joints[k]) assert.ok(Number.isFinite(a), id + " " + mood + " " + k);
        }
        assert.ok(Number.isFinite(p.liftCm) && Number.isFinite(p.pitchDeg));
      }
    }
  }
});

test("A3 Unknown models fall back to the dog", () => {
  assert.equal(rigOf("cat"), RIGS.dog);
});

test("A4 The dog trots: diagonal legs move together, opposite to the other pair", () => {
  const p = poseFor("dog", { ...walking, travelledM: 0.15 });
  const fl = p.joints.legFL[0], br = p.joints.legBR[0], fr = p.joints.legFR[0], bl = p.joints.legBL[0];
  assert.ok(Math.abs(fl) > 5, "the legs swing: " + fl);
  assert.ok(Math.abs(fl - br) < 1e-6);
  assert.ok(Math.abs(fr - bl) < 1e-6);
  assert.ok(Math.abs(fl + fr) < 1e-6);
});

test("A5 Legs move with distance walked, so they don't slide or run on the spot", () => {
  const still = poseFor("dog", { mood: "lead", speedMs: 0, travelledM: 0.15, t: 3 });
  assert.equal(still.joints.legFL[0], 0);
  const slow = poseFor("dog", { mood: "lead", speedMs: 0.4, travelledM: 0.15, t: 3 });
  const fast = poseFor("dog", { mood: "lead", speedMs: 2.4, travelledM: 0.15, t: 3 });
  assert.ok(Math.abs(fast.joints.legFL[0]) > Math.abs(slow.joints.legFL[0]), "a bigger stride when faster");
  const faster = poseFor("dog", { mood: "lead", speedMs: 9, travelledM: 0.15, t: 3 });
  assert.ok(Math.abs(faster.joints.legFL[0]) <= 50, "the stride is capped");
});

test("A6 The tail wags, harder on arrival", () => {
  const swing = (mood: RigMood): number => {
    let most = 0;
    for (let t = 0; t < 2; t += 0.02) most = Math.max(most, Math.abs(poseFor("dog", { mood, speedMs: 0, travelledM: 0, t }).joints.tail[1]));
    return most;
  };
  assert.ok(swing("lead") > 5);
  assert.ok(swing("arrived") > swing("lead"));
});

test("A7 Sitting: the dog's rear goes down and its front stays up", () => {
  const p = poseFor("dog", { mood: "sit", speedMs: 0, travelledM: 0, t: 1 });
  assert.ok(p.liftCm < -3, "lower: " + p.liftCm);
  assert.ok(p.pitchDeg > 8, "nose up: " + p.pitchDeg);
});

test("A8 Pointing is a clear pose on all three", () => {
  const pose = (id: string) => poseFor(id, { mood: "point", speedMs: 0, travelledM: 0, t: 1 });
  assert.ok(Math.abs(pose("dog").joints.legFR[0]) > 30, "the dog lifts a paw");
  assert.ok(Math.abs(pose("robot").joints.armR[0]) > 60, "the robot raises an arm");
  assert.ok(Math.abs(pose("rover").joints.mast[0]) > 5, "the rover tips its camera");
});

test("A9 The robot walks: arms swing opposite to their legs", () => {
  const p = poseFor("robot", { ...walking, travelledM: 0.15 });
  assert.ok(Math.abs(p.joints.legL[0]) > 5);
  assert.ok(Math.sign(p.joints.armL[0]) === -Math.sign(p.joints.legL[0]));
});

test("A10 Rover wheels roll exactly with the distance, and stop when it stops", () => {
  const round = (2 * Math.PI * WHEEL_RADIUS_CM) / 100;
  const quarter = poseFor("rover", { mood: "lead", speedMs: 1, travelledM: round / 4, t: 1 });
  assert.ok(Math.abs(Math.abs(quarter.joints.wheelFL[0]) - 90) < 1e-6);
  const a = poseFor("rover", { mood: "wait", speedMs: 0, travelledM: 5, t: 1 });
  const b = poseFor("rover", { mood: "wait", speedMs: 0, travelledM: 5, t: 9 });
  assert.equal(a.joints.wheelFL[0], b.joints.wheelFL[0]);
});

test("A11 All three stand on the floor, face -Z and fit the companion's size", () => {
  for (const id of MODELS) {
    const h = rigHeightCm(id);
    assert.ok(h > 35 && h < 80, id + " height " + h);
    const rig = rigOf(id);
    const low = Math.min(...rig.parts.map((p) => worldY(id, p) - p.size[1]));
    assert.ok(Math.abs(low) < 2, id + " feet at " + low);
  }
  const head = rigOf("dog").joints.find((j) => j.name === "head")!;
  assert.ok(head.pivot[2] < 0, "the head is at -Z");
});

// Height of a leg's tip off the floor, turning through the body's pitch and the leg's own swing.
function footY(id: string, leg: string, reach: number, mood: RigMood): number {
  const rig = rigOf(id);
  const pose = poseFor(id, { mood, speedMs: 0, travelledM: 0, t: 1 });
  const j = rig.joints.find((x) => x.name === leg)!;
  const root = rig.joints.find((x) => x.parent === null)!;
  const body = (pose.pitchDeg * Math.PI) / 180;
  const hip = j.pivot[1] * Math.cos(body) - j.pivot[2] * Math.sin(body);
  const swing = body + (pose.joints[leg][0] * Math.PI) / 180;
  return root.pivot[1] + pose.liftCm + hip - reach * Math.cos(swing);
}

test("A12 Sitting keeps the feet on the floor, not floating or sunk", () => {
  for (const leg of ["legFL", "legFR", "legBL", "legBR"]) {
    const y = footY("dog", leg, 20, "sit");
    assert.ok(Math.abs(y) < 1.5, "dog " + leg + " at " + y.toFixed(1));
  }
  for (const leg of ["legL", "legR"]) {
    const y = footY("robot", leg, 22, "sit");
    assert.ok(Math.abs(y) < 1.5, "robot " + leg + " at " + y.toFixed(1));
  }
});

test("A13 Feet don't slide: one swing covers about the ground the body moves in it", () => {
  for (const [id, leg, reach] of [["dog", "legFL", 20], ["robot", "legL", 22]] as [string, string, number][]) {
    const stride = id === "dog" ? DOG_STRIDE_M : ROBOT_STRIDE_M;
    const swing = Math.abs(poseFor(id, { mood: "lead", speedMs: 1.4, travelledM: stride / 4, t: 1 }).joints[leg][0]);
    const foot = (2 * reach * Math.sin((swing * Math.PI) / 180)) / 100;
    assert.ok(Math.abs(foot - stride / 2) < 0.02, id + " foot " + foot.toFixed(3) + " body " + (stride / 2).toFixed(3));
  }
});

function worldY(id: string, p: { joint: string; at: number[] }): number {
  const rig = rigOf(id);
  let y = p.at[1];
  let j = rig.joints.find((x) => x.name === p.joint) || null;
  while (j) {
    y += j.pivot[1];
    j = j.parent ? rig.joints.find((x) => x.name === j!.parent) || null : null;
  }
  return y;
}

test("A14 the companion is see-through enough to show the floor under it", () => {
  assert.ok(COMPANION_ALPHA >= 0.4 && COMPANION_ALPHA <= 0.6, String(COMPANION_ALPHA));
});
