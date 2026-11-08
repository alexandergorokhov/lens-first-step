// Alex's review of v6 (ROUND2.md, Nov 8): the play moment from a couple of steps back, in the mall with
// the dog (R2-32); the Control tab in the upper-left corner, more see-through (R2-33); in Free walk the
// companion points from farther ahead, so you see what it points at (R2-34); a bigger reason card (R2-35).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap } from "../router.ts";
import type { MapData } from "../router.ts";
import { CONTROL_TAB_CORNER, CONTROL_TAB_OPACITY } from "../dock.ts";
import { HOP_AHEAD_M } from "../play.ts";
import { clampToView, REASON_CARD } from "../view.ts";
import { FreeWalk, FREE_DEFAULTS } from "../freewalk.ts";
import { NARRATION } from "../narration.ts";

function mall(): MapData {
  const r = parseMap(readFileSync(new URL("../data/mall.json", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("mall");
  return r.map;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test("R32 Hop's lane starts a couple of steps ahead, so the game shows whole in the view", () => {
  assert.ok(HOP_AHEAD_M >= 2.8 && HOP_AHEAD_M <= 4, "lane starts " + HOP_AHEAD_M + " m ahead");
});

test("R32b the play moment is in the mall, with the dog, after the Bakery", () => {
  const beats = NARRATION.map((n) => n.beat);
  const play = beats.indexOf("play");
  assert.ok(play > beats.indexOf("demo 2: mall, follow the dog"), "after demo 2 starts");
  assert.ok(play < beats.indexOf("demo 3: Free walk with the robot"), "before demo 3");
  assert.equal(beats[play - 1], "arrived", "right after the Bakery arrival");
  assert.ok(/dog/.test(NARRATION[play].line), NARRATION[play].line);
});

test("R33 the folded Control tab sits in the upper-left corner, see-through", () => {
  assert.ok(CONTROL_TAB_OPACITY >= 0.15 && CONTROL_TAB_OPACITY <= 0.3, "opacity " + CONTROL_TAB_OPACITY);
  const c = CONTROL_TAB_CORNER;
  assert.ok(c.z < 0, "in front");
  // Left and up, by angle from the view's centre, still inside the preview's view (about ±16° each way).
  const across = (Math.atan2(-c.x, -c.z) * 180) / Math.PI;
  const up = (Math.atan2(c.y, -c.z) * 180) / Math.PI;
  assert.ok(across >= 9 && across <= 14, "left by " + across.toFixed(1) + " deg");
  assert.ok(up >= 9 && up <= 14, "up by " + up.toFixed(1) + " deg");
});

test("R34 Free walk: it points from at least FREE_DEFAULTS.pointNearM ahead, in view", () => {
  const m = mall();
  const fw = new FreeWalk(m, ["coffee"], { aheadM: 7 });
  fw.keepInView = (s, u, l) => clampToView(u, l, s, 15, 8.5);
  const dt = 1 / 30;
  let user = { x: 26, y: 0, z: 10.5 };
  fw.setCompanion(true, user, 270);
  let t = 0;
  const pointing: { d: number }[] = [];
  const step = (heading: number, speed: number, s: number) => {
    for (let i = 0; i < Math.round(s / dt); i++) {
      t += dt;
      const r = (heading * Math.PI) / 180;
      user = { x: user.x + Math.sin(r) * speed * dt, y: 0, z: user.z + Math.cos(r) * speed * dt };
      const f = fw.update(user, heading, dt, t);
      if (fw.pointState === "point" && f.pet) pointing.push({ d: dist(f.pet.pos, user) });
    }
  };
  step(270, 1.3, 7); // west along the hall, past the café
  step(200, 0, 6); // stand and look at it
  assert.ok(FREE_DEFAULTS.pointNearM >= 3, "pointNearM " + FREE_DEFAULTS.pointNearM);
  assert.ok(pointing.length > 30, "it pointed (" + pointing.length + " frames)");
  const near = Math.min(...pointing.map((p) => p.d));
  assert.ok(near >= FREE_DEFAULTS.pointNearM - 0.3, "nearest while pointing " + near.toFixed(2) + " m");
});

test("R35 the reason card over the pointer is big enough to read from where it points", () => {
  assert.ok(REASON_CARD.wCm >= 75 && REASON_CARD.hCm >= 13, JSON.stringify(REASON_CARD));
  assert.equal(REASON_CARD.role, "Headline1");
  // Read from where it stands: at least as far as it points from.
  assert.ok(REASON_CARD.distanceCm >= FREE_DEFAULTS.pointNearM * 100);
});
