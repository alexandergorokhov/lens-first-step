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

test("R32 Hop's lane starts well ahead (about 5 m, R2-38), so the game shows whole in the view", () => {
  assert.ok(HOP_AHEAD_M >= 4.5 && HOP_AHEAD_M <= 6, "lane starts " + HOP_AHEAD_M + " m ahead");
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
  // About 8 m out (R2-39): you see the robot and the shop it points at together.
  assert.ok(FREE_DEFAULTS.pointNearM >= 7.5, "pointNearM " + FREE_DEFAULTS.pointNearM);
  assert.ok(pointing.length > 30, "it pointed (" + pointing.length + " frames)");
  const near = Math.min(...pointing.map((p) => p.d));
  // It counts as there from 1 m short, then keeps easing out to the spot.
  assert.ok(near >= FREE_DEFAULTS.pointNearM - 1.05, "nearest while pointing " + near.toFixed(2) + " m");
});

test("R35 the reason card over the pointer is big enough to read from where it points", () => {
  // Twice the v7 card (R2-40): read from about 8 m.
  assert.ok(REASON_CARD.wCm >= 150 && REASON_CARD.hCm >= 26, JSON.stringify(REASON_CARD));
  assert.equal(REASON_CARD.role, "Headline1");
  // Read from where it stands: at least as far as it points from.
  assert.ok(REASON_CARD.distanceCm >= FREE_DEFAULTS.pointNearM * 100);
});

test("R37 no ring: the chime (notices, stops, catches) is off", async () => {
  const { CHIME_ON } = await import("../dock.ts");
  assert.equal(CHIME_ON, false);
});

test("R41 a place off a corridor: the route leaves the corridor beside it, never runs past and doubles back", async () => {
  const { findRoute, routePoints, cutEndDetour, findNode } = await import("../router.ts");
  const m = mall();
  // The Bakery (x 15) hangs off the far-west junction gBW (x 8) on the back corridor (z 22).
  const r = findRoute(m, "sign", "bakery", "walk");
  assert.ok(r.status === "route" && r.nodes.indexOf("gBW") >= 0, "the map's route goes via gBW");
  assert.equal(findNode(m, "gBW")!.x, 8);
  const pts = routePoints(m, r);
  assert.ok(!pts.some((p) => p.x < 14), "no detour west of the Bakery: " + JSON.stringify(pts));
  const last = pts[pts.length - 1], turn = pts[pts.length - 2];
  assert.deepEqual([last.x, last.z], [15, 27]);
  assert.ok(Math.hypot(turn.x - 15, turn.z - 22) < 1e-6, "turns off the corridor right in front of it: " + JSON.stringify(turn));
  // A route with no detour is left as it is.
  const straight = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 5 }];
  assert.deepEqual(cutEndDetour(straight), straight);
});

test("R45 the folded Control tab's label is big enough to read (Headline1 on a wider tab), still in the corner", async () => {
  const { CONTROL_TAB_SIZE, CONTROL_TAB_CORNER } = await import("../dock.ts");
  assert.equal(CONTROL_TAB_SIZE.role, "Headline1");
  assert.ok(CONTROL_TAB_SIZE.wCm >= 16 && CONTROL_TAB_SIZE.hCm >= 5.5, JSON.stringify(CONTROL_TAB_SIZE));
  // The tab's left edge stays inside the preview's view (about 16° to the left at 1 m).
  const left = (Math.atan2(-(CONTROL_TAB_CORNER.x - CONTROL_TAB_SIZE.wCm / 2), -CONTROL_TAB_CORNER.z) * 180) / Math.PI;
  assert.ok(left <= 15.5, "left edge at " + left.toFixed(1) + " deg");
});
