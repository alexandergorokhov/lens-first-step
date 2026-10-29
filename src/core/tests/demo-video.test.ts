// Tests for tools/demo-video/timeline.mjs: the demo video is driven by the real route engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline } from "../../../tools/demo-video/timeline.mjs";

test("demo video: the walk reaches Gate C3 after the gate change, the wheelchair run reaches B12 via Lift 2", () => {
  const { frames, fps } = buildTimeline();
  const arrivals = [...new Set(frames.map((f) => f.arrival).filter(Boolean))];
  assert.deepEqual(arrivals, ["Gate C3. Boarding in 6 min.", "Gate B12. Boarding in 6 min."]);
  const walk = frames.filter((f) => f.mode === "Walk");
  const roll = frames.filter((f) => f.mode === "Step-Free");
  assert.ok(walk.every((f) => !f.seated) && roll.every((f) => f.seated), "the Step-Free run is seated");
  // Lift 1 is reported out before Lift 2 is ridden, and Lift 1 is never ridden.
  const closedAt = frames.findIndex((f) => f.closed.lift1);
  const lift2Up = frames.findIndex((f) => f.lifts.lift2.cab > 0);
  assert.ok(closedAt > 0 && lift2Up > closedAt);
  assert.ok(frames.every((f) => f.lifts.lift1.cab === 0));
  // Step-Free feet never take the stairs or escalator: they only leave the ground in Lift 2.
  for (const f of roll) if (f.feet[1] > 0.01 && f.feet[1] < 5.99) assert.ok(Math.abs(f.feet[0] - 8) < 0.01 && Math.abs(f.feet[2] - 20) < 0.01);
  assert.ok(frames.length / fps < 200, "under about 3 minutes");
});

test("pet clip: Pet toggles on, off (line back, score kept) and on; the pet never goes up before you; all treats by the gate", async () => {
  const { buildPetTimeline } = await import("../../../tools/demo-video/timeline.mjs");
  const { frames } = buildPetTimeline();
  const on = frames.map((f: any) => !!f.pet);
  const firstOn = on.indexOf(true);
  const off = on.indexOf(false, firstOn);
  assert.ok(firstOn > 0 && off > firstOn && on.indexOf(true, off) > off, "on, off, on again");
  assert.ok(frames.slice(0, firstOn).some((f: any) => f.line), "the line shows before the pet");
  assert.ok(frames[off + 5].line, "the line is back with the pet off");
  assert.equal(frames[off + 5].score.text, frames[off - 1].score.text, "score kept while off");
  for (const f of frames) if (f.pet && f.feet[1] === 0) assert.ok(f.pet.pos[1] < 0.5, "pet upstairs before the traveller");
  const last = frames.filter((f: any) => f.score).at(-1);
  const [got, total] = last.score.text.match(/\d+/g).map(Number);
  assert.equal(got, total);
  assert.ok(frames.some((f: any) => f.pet && f.pet.mood === "sit"));
  assert.ok(frames.length / 30 < 75);
});
