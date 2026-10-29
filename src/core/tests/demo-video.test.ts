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

test("demo videos never walk or roll through a shop, a kiosk or a lift's glass (only through its doors)", async () => {
  const { buildPetTimeline } = await import("../../../tools/demo-video/timeline.mjs");
  const { SHOPS, LIFTS, LIFT_HALF, doorFace } = await import("../../../tools/demo-video/layout.mjs");
  const main = buildTimeline();
  const node = (id: string) => main.map.nodes.find((n: any) => n.id === id);
  const BODY = 0.3; // wheelchair / shoulder half-width
  for (const [name, tl] of [["main", main], ["pet", buildPetTimeline()]] as [string, any][]) {
    let prev: number[] | null = null;
    tl.frames.forEach((f: any, i: number) => {
      const [x, y, z] = f.feet;
      for (const [x0, x1, z0, z1, sy, label] of SHOPS) {
        if (Math.abs(y - sy) < 1 && x > x0 - BODY && x < x1 + BODY && z > z0 - BODY && z < z1 + BODY) {
          assert.fail(`${name} @${(i / 30).toFixed(1)}s: inside ${label} at ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
      if (prev) {
        for (const [id, gId, uId, gFrom, uTo] of LIFTS) {
          const g = node(gId);
          const inside = (p: number[]) => Math.abs(p[0] - g.x) < LIFT_HALF && Math.abs(p[2] - g.z) < LIFT_HALF;
          if (inside(prev) === inside(f.feet)) continue;
          // Crossing the shaft wall: the side crossed must be the door at this level.
          const out = inside(prev) ? f.feet : prev;
          const dx = out[0] - g.x, dz = out[2] - g.z;
          const side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "N" : "S";
          const level = Math.abs(out[1] - node(uId).y) < 1 ? uId : gId;
          const door = doorFace(node(level), node(level === gId ? gFrom : uTo));
          assert.equal(side, door, `${name} @${(i / 30).toFixed(1)}s: through ${id}'s glass (${side} side, door is ${door})`);
        }
      }
      prev = f.feet;
    });
  }
});

// Hospital and campus scenario videos: what happens, and that nobody walks through the stand-in.
async function scenarios() {
  const m = await import("../../../tools/demo-video/scenarios.mjs");
  return { hospital: m.buildHospitalTimeline(), campus: m.buildCampusTimeline() };
}

function between(frames: any[], from: number, to: number) {
  return frames.slice(from, to);
}

test("hospital video: stairs up, room change back down the stairs to X-ray; wheelchair: Lift A out, Lift B out, ask staff at Reception", async () => {
  const { hospital } = await scenarios();
  const f = hospital.frames;
  const arrivals = [...new Set(f.map((x: any) => x.arrival).filter(Boolean))];
  assert.equal(arrivals.length, 2);
  assert.match(arrivals[0] as string, /X-ray/);
  assert.match(arrivals[1] as string, /Reception/);
  const walk = f.filter((x: any) => x.mode === "Walk");
  const roll = f.filter((x: any) => x.mode === "Step-Free");
  assert.ok(walk.some((x: any) => x.feet[1] > 3.9), "walked up to Level 1");
  assert.ok(walk.every((x: any) => !x.seated) && roll.every((x: any) => x.seated));
  // Step-Free never leaves the ground floor (both lifts end up closed).
  assert.ok(roll.every((x: any) => x.feet[1] < 0.01), "the wheelchair stayed on the ground floor");
  assert.ok(f.some((x: any) => x.card && /Ask staff/.test(x.card.text)), "ask-staff notice shown");
  assert.ok(f.some((x: any) => x.closed && x.closed.liftA) && f.some((x: any) => x.closed && x.closed.liftB));
});

test("campus video: rover on, points at the coffee cart, off the line re-routes, room change down the stairs; wheelchair takes the ramp when the lift is out", async () => {
  const { campus } = await scenarios();
  const f = campus.frames;
  assert.equal(campus.offRouteRerouted, true, "walking off the line re-routed");
  assert.ok(f.some((x: any) => x.pet && x.pet.mood === "point"), "the rover pointed");
  assert.ok(f.some((x: any) => x.companion === "rover"));
  const stars = f.filter((x: any) => x.score).at(-1).score.text.match(/\d+/g).map(Number);
  assert.equal(stars[0], stars[1], "all stars found");
  const roll = f.filter((x: any) => x.mode === "Step-Free");
  // On the ramp: between floors, along the ramp's line (x = 46).
  assert.ok(roll.some((x: any) => x.feet[1] > 0.5 && x.feet[1] < 3.5 && Math.abs(x.feet[0] - 46) < 0.3), "rolled up the ramp");
  assert.ok(roll.every((x: any) => !(x.feet[1] > 0.5 && x.feet[1] < 3.5 && Math.abs(x.feet[0] - 54) < 0.3)), "never on the stairs");
  assert.ok([...new Set(f.map((x: any) => x.arrival).filter(Boolean))].length === 2);
});

for (const key of ["hospital", "campus"]) {
  test(`${key} video: never walks or rolls through a wall, room, desk or a lift's glass`, async () => {
    const t = (await scenarios())[key as "hospital" | "campus"];
    const L = t.layout;
    const BODY = 0.3;
    let prev: number[] | null = null;
    t.frames.forEach((fr: any, i: number) => {
      const [x, y, z] = fr.feet;
      for (const s of L.solids) {
        if (Math.abs(y - s.y) < 1 && x > s.x0 - BODY && x < s.x1 + BODY && z > s.z0 - BODY && z < s.z1 + BODY) {
          assert.fail(`${key} @${(i / 30).toFixed(1)}s: inside ${s.label} at ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
      if (prev) for (const l of L.lifts) {
        const inside = (p: number[]) => Math.abs(p[0] - l.x) < 1.25 && Math.abs(p[2] - l.z) < 1.25;
        if (inside(prev) === inside(fr.feet)) continue;
        const out = inside(prev) ? fr.feet : prev;
        const dx = out[0] - l.x, dz = out[2] - l.z;
        const side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "N" : "S";
        const door = Math.abs(out[1] - l.hi) < 1 ? l.doors[1] : l.doors[0];
        assert.equal(side, door, `${key} @${(i / 30).toFixed(1)}s: through ${l.id}'s glass`);
      }
      prev = fr.feet;
    });
  });
}
