// Play mode (proposed G1-G9 in devpost/SCENARIOS.md): while you stand still, the companion plays a
// jump game on a short lane in front of you, seen from behind: obstacles come from the far end and
// raising a hand makes it jump; a hit makes it shake, then you can play again. And play catch
// (P8-P9): throw a treat, it fetches. Neither ever touches the route.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CatchGame,
  HOP_LANE,
  HopGame,
  JUMP_SPEED,
  PlayGate,
  RaiseDetector,
  SHAKE_SECONDS,
  THROW_MAX,
  canThrow,
  hopText,
  landingSpot,
  seededRandom,
} from "../play.ts";
import { COMPANIONS } from "../pet.ts";

const DT = 1 / 30;

// Plays a game until it crashes or `seconds` pass; `jumpWhen(game)` decides when to raise a hand.
function play(game: HopGame, seconds: number, jumpWhen: (g: HopGame) => boolean): number {
  let t = 0;
  for (; t < seconds && game.phase !== "crashed"; t += DT) {
    if (jumpWhen(game)) game.jump();
    game.update(DT);
  }
  return t;
}

// A good player: jumps when the next obstacle is about to reach the companion.
const goodPlayer = (g: HopGame) => {
  const o = g.obstacles.find((x) => x.d > 0);
  return !!o && o.d < g.speed * 0.3 + 0.05;
};

test("G1 Play is offered only while you stand still with the companion on, and ends when you walk", () => {
  const gate = new PlayGate();
  const here = { x: 0, y: 0, z: 0 };
  // Companion off: never.
  for (let t = 0; t < 5; t += DT) gate.update(here, DT, { companionOn: false, cardShowing: false });
  assert.equal(gate.canPlay, false);
  // On, but walking: never.
  let p = { x: 0, y: 0, z: 0 };
  for (let t = 0; t < 5; t += DT) {
    p = { x: p.x + 1.2 * DT, y: 0, z: 0 };
    gate.update(p, DT, { companionOn: true, cardShowing: false });
  }
  assert.equal(gate.canPlay, false);
  // Standing still for 2 s: offered.
  for (let t = 0; t < 2.1; t += DT) gate.update(p, DT, { companionOn: true, cardShowing: false });
  assert.equal(gate.canPlay, true);
  // Small sway (head bob, a step on the spot) keeps it.
  gate.update({ x: p.x + 0.2, y: 0, z: 0.1 }, DT, { companionOn: true, cardShowing: false });
  assert.equal(gate.canPlay, true);
  // A card showing: not offered.
  gate.update(p, DT, { companionOn: true, cardShowing: true });
  assert.equal(gate.canPlay, false);
  gate.update(p, DT, { companionOn: true, cardShowing: false });
  assert.equal(gate.canPlay, true);
  // Walking off (> 1 m): ends at once.
  gate.update({ x: p.x + 1.1, y: 0, z: 0 }, DT, { companionOn: true, cardShowing: false });
  assert.equal(gate.canPlay, false);
  // Turning the companion off ends it too.
  const g2 = new PlayGate();
  for (let t = 0; t < 2.1; t += DT) g2.update(here, DT, { companionOn: true, cardShowing: false });
  assert.equal(g2.canPlay, true);
  g2.update(here, DT, { companionOn: false, cardShowing: false });
  assert.equal(g2.canPlay, false);
});

test("G2 Raising a hand is one jump: it fires once per raise and re-arms only after the hand comes down", () => {
  const r = new RaiseDetector();
  // Heights relative to the head, metres: the hand hangs ~0.7 m below, raised is near head height.
  assert.equal(r.update(-0.7), false);
  assert.equal(r.update(-0.1), true);
  assert.equal(r.update(0.05), false); // still up: no second jump
  assert.equal(r.update(-0.3), false); // halfway down: not re-armed yet
  assert.equal(r.update(-0.1), false);
  assert.equal(r.update(-0.6), false); // down
  assert.equal(r.update(0.0), true); // a new raise
  // No hand tracked: nothing.
  assert.equal(r.update(null), false);
  assert.equal(r.update(0.0), false); // a hand that appears already raised doesn't fire
  r.update(-0.7);
  assert.equal(r.update(0.0), true);
});

test("G2 A jump goes up and comes back down; you can't jump again in the air", () => {
  const g = new HopGame(seededRandom(1));
  g.start();
  assert.equal(g.petY, 0);
  assert.equal(g.jump(), true);
  g.update(0.1);
  assert.ok(g.petY > 0.2);
  assert.equal(g.jump(), false, "no double jump");
  let peak = 0;
  for (let t = 0; t < 2; t += DT) {
    g.update(DT);
    peak = Math.max(peak, g.petY);
  }
  assert.equal(g.petY, 0);
  assert.ok(peak > 0.45 && peak < 1, "peak " + peak);
  assert.equal(g.jump(), true, "on the ground again");
  assert.equal(JUMP_SPEED > 0, true);
});

test("G3 Obstacles appear at the far end of the lane and come toward the companion", () => {
  const g = new HopGame(seededRandom(2));
  g.start();
  for (let t = 0; t < 3 && g.obstacles.length === 0; t += DT) g.update(DT);
  assert.ok(g.obstacles.length > 0);
  const o = g.obstacles[0];
  assert.ok(o.d <= HOP_LANE && o.d > HOP_LANE - 1, "spawned far away: " + o.d);
  const before = o.d;
  g.update(0.2);
  assert.ok(Math.abs(before - o.d - g.speed * 0.2) < 1e-6, "moves toward the companion at the game speed");
  assert.ok(o.h > 0.1 && o.h < 0.45, "low enough to jump");
});

test("G4 Not jumping hits the first obstacle; a well-timed jump clears it", () => {
  const lazy = new HopGame(seededRandom(3));
  lazy.start();
  const t = play(lazy, 30, () => false);
  assert.equal(lazy.phase, "crashed");
  assert.ok(t < 10);
  assert.equal(lazy.score, 0);

  const good = new HopGame(seededRandom(3));
  good.start();
  play(good, 20, goodPlayer);
  assert.equal(good.phase, "running", "a good player is still going");
  assert.ok(good.score >= 5, "cleared " + good.score);
});

test("G5 A hit: the companion shakes, the game stops; then raise a hand (or Play again) to restart", () => {
  const g = new HopGame(seededRandom(4));
  g.start();
  play(g, 30, () => false);
  assert.equal(g.phase, "crashed");
  assert.equal(g.shaking, true);
  const frozen = g.obstacles.map((o) => o.d);
  g.update(0.3);
  assert.deepEqual(g.obstacles.map((o) => o.d), frozen, "obstacles stop");
  assert.equal(g.jump(), false, "raising a hand while it shakes does nothing");
  g.update(SHAKE_SECONDS);
  assert.equal(g.shaking, false);
  assert.equal(g.phase, "crashed");
  // Raising a hand after the shake starts again.
  assert.equal(g.jump(), true);
  assert.equal(g.phase, "running");
  assert.equal(g.score, 0);
  assert.equal(g.obstacles.length, 0);
});

test("G5 Restart keeps the best score", () => {
  const g = new HopGame(seededRandom(5));
  g.start();
  play(g, 15, goodPlayer);
  const s = g.score;
  assert.ok(s > 0);
  play(g, 60, () => false);
  assert.equal(g.phase, "crashed");
  assert.equal(g.best, s);
  g.restart();
  assert.equal(g.phase, "running");
  assert.equal(g.score, 0);
  assert.equal(g.best, s);
});

test("G6 Every obstacle can be jumped: a good player never crashes in 2 minutes, for many seeds", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const g = new HopGame(seededRandom(seed));
    g.start();
    play(g, 120, goodPlayer);
    assert.equal(g.phase, "running", "seed " + seed + " crashed at score " + g.score);
  }
});

test("G7 The score counts obstacles cleared; it speeds up a little, up to a cap", () => {
  const g = new HopGame(seededRandom(6));
  g.start();
  const s0 = g.speed;
  play(g, 100, goodPlayer);
  assert.ok(g.speed > s0);
  assert.ok(g.speed <= g.maxSpeed + 1e-9);
  assert.ok(g.score >= 20);
  // Each obstacle counts once.
  const cleared = g.score;
  g.update(DT);
  assert.ok(g.score - cleared <= 1);
});

test("G8 The game never runs before start or after stop; stop clears it", () => {
  const g = new HopGame(seededRandom(7));
  assert.equal(g.phase, "idle");
  g.update(5);
  assert.equal(g.obstacles.length, 0);
  assert.equal(g.jump(), false);
  g.start();
  g.update(3);
  g.stop();
  assert.equal(g.phase, "idle");
  assert.equal(g.obstacles.length, 0);
  assert.equal(g.petY, 0);
});

test("G9 Any companion plays: the same game, its own words", () => {
  const g = new HopGame(seededRandom(8));
  assert.equal(hopText(g, COMPANIONS.dog), "Raise your hand: Pet jumps");
  assert.equal(hopText(g, COMPANIONS.rover), "Raise your hand: Rover jumps");
  g.start();
  assert.equal(hopText(g, COMPANIONS.robot), "Jumps 0 · best 0");
  play(g, 30, () => false);
  assert.equal(hopText(g, COMPANIONS.robot), "Bump! Raise your hand to play again");
});

test("P8 A throw lands on your floor, at most ~5 m from you", () => {
  const user = { x: 10, y: 6, z: 4 };
  // A soft throw ahead.
  const a = landingSpot(user, { x: 0, y: 2, z: 3 }, user.y);
  assert.equal(a.y, 6);
  assert.ok(Math.hypot(a.x - user.x, a.z - user.z) > 0.5);
  // A huge throw is clamped to THROW_MAX.
  const b = landingSpot(user, { x: 30, y: 10, z: 0 }, user.y);
  assert.ok(Math.abs(Math.hypot(b.x - user.x, b.z - user.z) - THROW_MAX) < 1e-6);
  assert.equal(b.y, 6);
  // A drop at your feet lands just in front of the release point, still on the floor.
  const c = landingSpot(user, { x: 0, y: -1, z: 0 }, user.y);
  assert.equal(c.y, 6);
  assert.ok(Math.hypot(c.x - user.x, c.z - user.z) <= 0.5);
});

test("P8 No throw while walking, near a turn or floor change, or while a card shows", () => {
  assert.equal(canThrow({ moving: false, nearChange: false, cardShowing: false, companionOn: true }), true);
  assert.equal(canThrow({ moving: true, nearChange: false, cardShowing: false, companionOn: true }), false);
  assert.equal(canThrow({ moving: false, nearChange: true, cardShowing: false, companionOn: true }), false);
  assert.equal(canThrow({ moving: false, nearChange: false, cardShowing: true, companionOn: true }), false);
  assert.equal(canThrow({ moving: false, nearChange: false, cardShowing: false, companionOn: false }), false);
});

test("P9 Fetch: the companion runs to the landing spot, catches, brings it back, then is free", () => {
  const c = new CatchGame();
  const home = { x: 0, y: 0, z: 2.5 };
  const user = { x: 0, y: 0, z: 0 };
  assert.equal(c.throwTo({ x: 3, y: 0, z: 3 }, home), true);
  assert.equal(c.throwTo({ x: 1, y: 0, z: 1 }, home), false, "one throw at a time");
  let caught = 0;
  let pos = home;
  for (let t = 0; t < 10 && c.phase !== "idle"; t += DT) {
    const r = c.update(DT, user);
    pos = r.pos;
    if (r.caught) caught++;
  }
  assert.equal(caught, 1);
  assert.equal(c.phase, "idle");
  assert.equal(c.catches, 1);
  // It dropped the treat by you (within 1 m), then the guide takes over again.
  assert.ok(Math.hypot(pos.x - user.x, pos.z - user.z) <= 1.0, "brought back: " + JSON.stringify(pos));
  // Another throw works.
  assert.equal(c.throwTo({ x: -2, y: 0, z: 2 }, pos), true);
  c.cancel();
  assert.equal(c.phase, "idle");
});
