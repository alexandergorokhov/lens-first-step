// Play with the companion while you wait (part of the companion feature: only when it is on).
// - Hop: while you stand still, a short lane appears on the floor in front of you with the
//   companion at the near end, seen from behind. Obstacles come from the far end; raise a hand
//   and it jumps. A hit makes it shake; raise a hand again (or Play again) to restart.
// - Catch: throw a treat; the companion runs to where it lands, catches it and brings it back.
// Neither game reads or changes the route. Walking off ends play and the companion goes back to
// guiding.
// Pure logic shared by the Lens and the Node tests: no imports and no Lens globals; the Lens
// keeps a byte-identical copy at Assets/Scripts/FindYourWayPlay.ts.
//
// Map metres: x east, y up, z north. Hop distances are metres along the lane, ahead of the
// companion (0 = the companion, HOP_LANE = the far end).

export interface PlayXYZ {
  x: number;
  y: number;
  z: number;
}

export interface PlayCompanion {
  name: string;
}

// A small repeatable random source (mulberry32), so a seed replays the same game.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Standing still ----

// How long you stand still before play is offered (s), and how far you may sway (m).
export const STILL_SECONDS = 2;
export const STILL_RADIUS = 0.6;

// Offers play while you stand still with the companion on and no card showing; walking off
// (beyond STILL_RADIUS) or turning the companion off ends it at once.
export class PlayGate {
  canPlay = false;
  private anchor: PlayXYZ | null = null;
  private still = 0;

  update(feet: PlayXYZ, dt: number, opts: { companionOn: boolean; cardShowing: boolean }): boolean {
    const moved = this.anchor === null ? Infinity : Math.hypot(feet.x - this.anchor.x, feet.z - this.anchor.z);
    if (moved > STILL_RADIUS || Math.abs(feet.y - (this.anchor ? this.anchor.y : feet.y)) > 0.5) {
      this.anchor = { x: feet.x, y: feet.y, z: feet.z };
      this.still = 0;
    } else this.still += dt;
    this.canPlay = opts.companionOn && !opts.cardShowing && this.still >= STILL_SECONDS;
    return this.canPlay;
  }

  reset(): void {
    this.anchor = null;
    this.still = 0;
    this.canPlay = false;
  }
}

// ---- Raising a hand ----

// Hand height relative to the head (m, + up). Above RAISE_UP counts as raised; it must come back
// below RAISE_DOWN before the next raise counts (so holding the hand up is one jump).
export const RAISE_UP = -0.2;
export const RAISE_DOWN = -0.45;

export class RaiseDetector {
  private armed = false;

  // handMinusHead: the wrist's height above the head (m), or null when no hand is tracked.
  // Returns true once per raise.
  update(handMinusHead: number | null): boolean {
    if (handMinusHead === null) {
      this.armed = false;
      return false;
    }
    if (handMinusHead < RAISE_DOWN) {
      this.armed = true;
      return false;
    }
    if (this.armed && handMinusHead > RAISE_UP) {
      this.armed = false;
      return true;
    }
    return false;
  }
}

// ---- Hop: the jump game ----

export const HOP_LANE = 6; // lane length (m)
// The lane starts this far ahead of you (m): a couple of steps, so the whole game shows in the view (R2-32).
export const HOP_AHEAD_M = 3;
export const JUMP_SPEED = 4.2; // m/s up: ~0.63 m high, ~0.6 s in the air
export const HOP_GRAVITY = 14; // m/s²
export const SHAKE_SECONDS = 1.2;
export const HOP_START_SPEED = 3; // m/s the obstacles come at
export const HOP_MAX_SPEED = 5;
export const HOP_SPEED_UP = 0.05; // m/s faster per obstacle cleared
const BODY_HALF = 0.2; // half the companion's length along the lane (m)
const OBSTACLE_WIDTH = 0.3;
const FIRST_OBSTACLE_S = 1;
const MAX_STEP = 1 / 60;

export type HopPhase = "idle" | "running" | "crashed";

export interface Obstacle {
  d: number; // metres ahead of the companion
  h: number; // height (m)
  w: number; // length along the lane (m)
  passed: boolean;
}

export class HopGame {
  phase: HopPhase = "idle";
  petY = 0; // the companion's jump height (m)
  obstacles: Obstacle[] = [];
  score = 0;
  best = 0;
  speed = HOP_START_SPEED;
  readonly maxSpeed = HOP_MAX_SPEED;
  private vy = 0;
  private shakeLeft = 0;
  private untilFirst = 0;
  private nextGap = 0;
  private rand: () => number;

  // laneM: the lane length (m); the standing lane by default, SEATED_LANE when seated.
  readonly lane: number;

  constructor(rand: () => number = Math.random, laneM: number = HOP_LANE) {
    this.rand = rand;
    this.lane = laneM;
  }

  get shaking(): boolean {
    return this.shakeLeft > 0;
  }

  start(): void {
    this.phase = "running";
    this.petY = 0;
    this.vy = 0;
    this.obstacles = [];
    this.score = 0;
    this.speed = HOP_START_SPEED;
    this.shakeLeft = 0;
    this.untilFirst = FIRST_OBSTACLE_S;
    this.nextGap = this.gap();
  }

  restart(): void {
    this.start();
  }

  stop(): void {
    this.phase = "idle";
    this.petY = 0;
    this.vy = 0;
    this.obstacles = [];
    this.shakeLeft = 0;
  }

  // A raised hand: jump while running and on the ground; after a crash (once the shake is over)
  // it starts a new game. Returns whether it did anything.
  jump(): boolean {
    if (this.phase === "crashed") {
      if (this.shaking) return false;
      this.restart();
      return true;
    }
    if (this.phase !== "running" || this.petY > 0) return false;
    this.vy = JUMP_SPEED;
    this.petY = 1e-6;
    return true;
  }

  update(dt: number): void {
    if (this.phase === "crashed") {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt);
      return;
    }
    if (this.phase !== "running") return;
    // Small steps, so a big frame never skips through an obstacle.
    let left = dt;
    while (left > 0 && this.phase === "running") {
      const step = Math.min(MAX_STEP, left);
      this.tick(step);
      left -= step;
    }
  }

  // The gap to the next obstacle (m): always long enough to land and jump again.
  private gap(): number {
    const min = this.speed * 0.75 + 1.2 + BODY_HALF * 2 + OBSTACLE_WIDTH;
    return min + this.rand() * 4;
  }

  private tick(dt: number): void {
    if (this.petY > 0) {
      this.vy -= HOP_GRAVITY * dt;
      this.petY = Math.max(0, this.petY + this.vy * dt);
      if (this.petY === 0) this.vy = 0;
    }
    for (const o of this.obstacles) o.d -= this.speed * dt;
    // Spawn at the far end once the last one is a gap away (the first after FIRST_OBSTACLE_S).
    const last = this.obstacles[this.obstacles.length - 1];
    if (!last) {
      this.untilFirst -= dt;
      if (this.untilFirst <= 0) this.spawn();
    } else if (this.lane - last.d >= this.nextGap) this.spawn();
    for (const o of this.obstacles) {
      const reach = BODY_HALF + o.w / 2;
      if (Math.abs(o.d) < reach && this.petY < o.h) {
        this.crash();
        return;
      }
      if (!o.passed && o.d < -reach) {
        o.passed = true;
        this.score++;
        this.best = Math.max(this.best, this.score);
        this.speed = Math.min(HOP_MAX_SPEED, this.speed + HOP_SPEED_UP);
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.d > -1);
  }

  private spawn(): void {
    this.obstacles.push({ d: this.lane, h: 0.2 + this.rand() * 0.15, w: OBSTACLE_WIDTH, passed: false });
    this.nextGap = this.gap();
  }

  private crash(): void {
    this.phase = "crashed";
    this.shakeLeft = SHAKE_SECONDS;
    this.best = Math.max(this.best, this.score);
  }
}

export function hopText(game: HopGame, companion: PlayCompanion): string {
  if (game.phase === "idle") return "Raise your hand: " + companion.name + " jumps";
  if (game.phase === "crashed") return "Bump! Raise your hand to play again";
  return "Jumps " + game.score + " · best " + game.best;
}

// ---- Catch: throw a treat ----

export const THROW_MAX = 5; // m from you
const THROW_GRAVITY = 9.8;
export const FETCH_SPEED = 3; // m/s
export const DROP_DISTANCE = 0.7; // where it drops the treat, from you (m)

export function canThrow(s: { moving: boolean; nearChange: boolean; cardShowing: boolean; companionOn: boolean }): boolean {
  return s.companionOn && !s.moving && !s.nearChange && !s.cardShowing;
}

// Where a treat released at `hand` with velocity `v` (m/s) lands on the floor at height floorY:
// always on your floor, at most maxM away horizontally.
// maxM caps the distance (THROW_MAX; SEATED_THROW_MAX when seated).
export function landingSpot(hand: PlayXYZ, v: PlayXYZ, floorY: number, maxM: number = THROW_MAX): PlayXYZ {
  const h = Math.max(0, hand.y - floorY);
  // Time to fall from h with upward speed v.y: h + v.y t - g t²/2 = 0.
  const t = (v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * THROW_GRAVITY * h))) / THROW_GRAVITY;
  let dx = v.x * t;
  let dz = v.z * t;
  const d = Math.hypot(dx, dz);
  if (d > maxM) {
    dx *= maxM / d;
    dz *= maxM / d;
  }
  return { x: hand.x + dx, y: floorY, z: hand.z + dz };
}

// A throw by hand: the treat's velocity over the last RELEASE_WINDOW seconds of the swing. Slower
// than THROW_MIN_SPEED (m/s) you only let go of it, so there is no throw (null).
export const RELEASE_WINDOW = 0.15;
export const THROW_MIN_SPEED = 0.5;

export function releaseVelocity(samples: { t: number; x: number; y: number; z: number }[]): PlayXYZ | null {
  if (samples.length < 2) return null;
  const last = samples[samples.length - 1];
  // The oldest sample in the window; at a low frame rate, at least the one before the last.
  let i = samples.length - 2;
  while (i > 0 && last.t - samples[i - 1].t <= RELEASE_WINDOW) i--;
  const first = samples[i];
  const dt = last.t - first.t;
  if (dt <= 0) return null;
  const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt, z: (last.z - first.z) / dt };
  return Math.hypot(v.x, v.y, v.z) < THROW_MIN_SPEED ? null : v;
}

export type CatchPhase = "idle" | "fetch" | "return";

export class CatchGame {
  phase: CatchPhase = "idle";
  catches = 0;
  pos: PlayXYZ = { x: 0, y: 0, z: 0 };
  private target: PlayXYZ = { x: 0, y: 0, z: 0 };

  // Starts a fetch from the companion's position `from`; one throw at a time.
  throwTo(spot: PlayXYZ, from: PlayXYZ): boolean {
    if (this.phase !== "idle") return false;
    this.pos = { x: from.x, y: from.y, z: from.z };
    this.target = { x: spot.x, y: spot.y, z: spot.z };
    this.phase = "fetch";
    return true;
  }

  cancel(): void {
    this.phase = "idle";
  }

  // Moves the companion; `caught` is true on the frame it catches the treat.
  update(dt: number, user: PlayXYZ): { pos: PlayXYZ; phase: CatchPhase; caught: boolean } {
    let caught = false;
    if (this.phase === "return") {
      const dx = this.pos.x - user.x;
      const dz = this.pos.z - user.z;
      const d = Math.hypot(dx, dz) || 1;
      this.target = { x: user.x + (dx / d) * DROP_DISTANCE, y: user.y, z: user.z + (dz / d) * DROP_DISTANCE };
    }
    if (this.phase !== "idle") {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const step = FETCH_SPEED * dt;
      if (d <= step) {
        this.pos = { x: this.target.x, y: this.target.y, z: this.target.z };
        if (this.phase === "fetch") {
          this.phase = "return";
          caught = true;
        } else {
          this.phase = "idle";
          this.catches++;
        }
      } else this.pos = { x: this.pos.x + (dx / d) * step, y: this.target.y, z: this.pos.z + (dz / d) * step };
    }
    return { pos: this.pos, phase: this.phase, caught };
  }
}

// ---- Seated play ----
// Sitting down (a bench at the gate) the same games play on a small patch of floor in front of
// the seat, all inside the ~37 degree tall view from seated eye height, so there is nothing to
// look up at or turn for. Nothing here reads or changes the route, the distance or the destination.

// Seated = the head stays SEATED_DROP below the standing height, or under SEATED_HEAD_MAX above
// the floor, for SEATED_SECONDS. Standing up ends it on that frame.
export const SEATED_DROP = 0.4; // m below the standing height
export const SEATED_HEAD_MAX = 1.3; // m above the floor
export const SEATED_SECONDS = 2;

export class SeatedDetector {
  seated = false;
  private low = 0;

  // headHeight: head above the floor (m); standingHeight: your measured standing head height (m).
  update(headHeight: number, standingHeight: number, dt: number): boolean {
    const isLow = headHeight <= standingHeight - SEATED_DROP || headHeight < SEATED_HEAD_MAX;
    if (!isLow) {
      this.low = 0;
      this.seated = false;
    } else {
      this.low += dt;
      if (this.low >= SEATED_SECONDS) this.seated = true;
    }
    return this.seated;
  }

  reset(): void {
    this.low = 0;
    this.seated = false;
  }
}

export const SEATED_NEAR = 1.0; // the companion's spot: this far ahead of the seat, on the floor (m)
export const SEATED_LANE = 3; // Hop lane length when seated (m)
export const SEATED_THROW_MAX = 3; // treats land at most this far from you when seated (m)
export const SEATED_VIEW_DEG = 37; // the tall field of view (degrees)
export const SEATED_EYE_MAX = SEATED_HEAD_MAX; // seated eye height is at most this above the floor (m)

export interface SeatedSpot {
  start: PlayXYZ; // the companion's end of the lane, on the floor
  far: PlayXYZ; // the far end of the lane, on the floor
  laneM: number; // lane length for new HopGame(rand, laneM)
  gazePitchDeg: number; // the pitch that centres the play area in the view (negative = down)
  spanDeg: number; // vertical angle from the near end to the far end; below SEATED_VIEW_DEG
}

// Where seated play happens: SEATED_NEAR straight ahead of `head` along `facing` (x, z; any
// length, north if it is zero), the lane running on away from you on floor height floorY.
export function seatedPlaySpot(head: PlayXYZ, facing: { x: number; z: number }, floorY: number): SeatedSpot {
  let fx = facing.x;
  let fz = facing.z;
  const len = Math.hypot(fx, fz);
  if (len < 1e-6) {
    fx = 0;
    fz = 1;
  } else {
    fx /= len;
    fz /= len;
  }
  const eye = Math.max(0.1, head.y - floorY);
  const at = (m: number): PlayXYZ => ({ x: head.x + fx * m, y: floorY, z: head.z + fz * m });
  const nearDown = (Math.atan2(eye, SEATED_NEAR) * 180) / Math.PI;
  const farDown = (Math.atan2(eye, SEATED_NEAR + SEATED_LANE) * 180) / Math.PI;
  return {
    start: at(SEATED_NEAR),
    far: at(SEATED_NEAR + SEATED_LANE),
    laneM: SEATED_LANE,
    gazePitchDeg: -(nearDown + farDown) / 2,
    spanDeg: nearDown - farDown,
  };
}

// Seated play runs only while you are seated with the companion on and no card showing. A card
// (gate change, boarding, lift out) or standing up ends it, so you never miss the flight.
export function seatedPlayAllowed(s: { seated: boolean; companionOn: boolean; cardShowing: boolean }): boolean {
  return s.seated && s.companionOn && !s.cardShowing;
}
