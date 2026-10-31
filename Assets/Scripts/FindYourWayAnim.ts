// Companion animation: the jointed dog, robot and rover, and their pose for a mood. No imports and
// no Lens globals, so the same file runs in Node tests and in the Lens (byte-identical copy at
// Assets/Scripts/FindYourWayAnim.ts). Sizes in cm, facing -Z, angles in degrees: +x tips a leg forward
// and a nose up, +y turns left.

export type RigMood = "lead" | "run" | "sit" | "wait" | "point" | "arrived";

export interface RigJoint {
  name: string;
  parent: string | null;
  pivot: number[]; // relative to the parent, or to the floor for the root
}

// A rounded part on a joint. "wheel" is a disc turning about x; size is half the width, height, depth.
export interface RigPart {
  joint: string;
  shape: "ball" | "wheel";
  color: number[];
  at: number[];
  size: number[];
}

export interface Rig {
  joints: RigJoint[];
  parts: RigPart[];
}

export interface RigState {
  mood: RigMood;
  speedMs: number;
  travelledM?: number; // total distance moved, so feet and wheels keep time with the floor
  t: number; // seconds, for the idle moves
}

export interface RigPose {
  joints: { [name: string]: number[] };
  liftCm: number;
  pitchDeg: number;
}

export const WHEEL_RADIUS_CM = 9;
const EASE_IN_SPEED = 0.6; // m/s: the swing grows to full by this speed
export const DOG_STRIDE_M = 0.4;
export const ROBOT_STRIDE_M = 0.5;
const DOG_LEG_CM = 20;
const ROBOT_LEG_CM = 22;

const GOLD = [0.93, 0.68, 0.34];
const CREAM = [1, 0.9, 0.72];
const BROWN = [0.66, 0.42, 0.2];
const INK = [0.14, 0.12, 0.13];
const RED = [0.86, 0.22, 0.2];
const WHITE = [0.96, 0.97, 1];
const STEEL = [0.5, 0.62, 0.78];
const SLATE = [0.2, 0.25, 0.34];
const CYAN = [0.35, 0.95, 1];
const SAND = [0.97, 0.88, 0.7];
const ORANGE = [0.95, 0.5, 0.2];
const TYRE = [0.2, 0.2, 0.23];

const ball = (joint: string, color: number[], at: number[], size: number[]): RigPart => ({ joint, shape: "ball", color, at, size });

function dogLeg(joint: string): RigPart[] {
  return [ball(joint, GOLD, [0, -9, 0], [3.6, 11, 3.8]), ball(joint, CREAM, [0, -17.5, -1], [4, 2.7, 5])];
}

function robotLimbs(arm: string, leg: string): RigPart[] {
  return [
    ball(arm, STEEL, [0, -9, 0], [3, 10, 3]), ball(arm, WHITE, [0, -19, 0], [3.5, 3.5, 3.5]),
    ball(leg, STEEL, [0, -9, 0], [4, 10, 4.2]), ball(leg, WHITE, [0, -19.5, -2], [5, 2.6, 7]),
  ];
}

const WHEELS = ["wheelFL", "wheelFR", "wheelML", "wheelMR", "wheelBL", "wheelBR"];

export const RIGS: { [id: string]: Rig } = {
  dog: {
    joints: [
      { name: "body", parent: null, pivot: [0, 26, 0] },
      { name: "head", parent: "body", pivot: [0, 10, -16] },
      { name: "earL", parent: "head", pivot: [-8, 7, 0] },
      { name: "earR", parent: "head", pivot: [8, 7, 0] },
      { name: "tail", parent: "body", pivot: [0, 5, 17] },
      { name: "legFL", parent: "body", pivot: [-6, -6, -11] },
      { name: "legFR", parent: "body", pivot: [6, -6, -11] },
      { name: "legBL", parent: "body", pivot: [-6, -6, 12] },
      { name: "legBR", parent: "body", pivot: [6, -6, 12] },
    ],
    parts: [
      ball("body", GOLD, [0, 0, 0], [10, 10.5, 18]),
      ball("body", CREAM, [0, -1, -12.5], [8.6, 9, 8]),
      ball("body", RED, [0, 7, -13], [7, 2.5, 6]),
      ball("head", GOLD, [0, 5, -4], [9.5, 9, 9.5]),
      ball("head", CREAM, [0, 2, -13], [5, 4, 5.5]),
      ball("head", INK, [0, 4, -18], [1.8, 1.5, 1.4]),
      ball("head", INK, [-4, 7.5, -11.5], [1.6, 1.8, 1.2]),
      ball("head", INK, [4, 7.5, -11.5], [1.6, 1.8, 1.2]),
      ball("earL", BROWN, [-2.5, -5, 0], [3.5, 7, 4.5]),
      ball("earR", BROWN, [2.5, -5, 0], [3.5, 7, 4.5]),
      ball("tail", GOLD, [0, 3, 8], [2.6, 2.6, 9]),
      ...dogLeg("legFL"), ...dogLeg("legFR"), ...dogLeg("legBL"), ...dogLeg("legBR"),
    ],
  },
  robot: {
    joints: [
      { name: "torso", parent: null, pivot: [0, 34, 0] },
      { name: "head", parent: "torso", pivot: [0, 18, 0] },
      { name: "armL", parent: "torso", pivot: [-16, 13, 0] },
      { name: "armR", parent: "torso", pivot: [16, 13, 0] },
      { name: "legL", parent: "torso", pivot: [-7, -12, 0] },
      { name: "legR", parent: "torso", pivot: [7, -12, 0] },
    ],
    parts: [
      ball("torso", WHITE, [0, 2, 0], [13, 16, 10]),
      ball("torso", STEEL, [0, 2, -8.5], [7, 7, 2]),
      ball("head", WHITE, [0, 8, 0], [11, 10, 10]),
      ball("head", SLATE, [0, 8, -7], [8, 6, 4]),
      ball("head", CYAN, [-3.5, 9, -10], [1.8, 2, 1]),
      ball("head", CYAN, [3.5, 9, -10], [1.8, 2, 1]),
      ball("head", SLATE, [0, 20, 0], [1, 3, 1]),
      ball("head", CYAN, [0, 23, 0], [1.6, 1.6, 1.6]),
      ...robotLimbs("armL", "legL"), ...robotLimbs("armR", "legR"),
    ],
  },
  rover: {
    joints: [
      { name: "chassis", parent: null, pivot: [0, 16, 0] },
      { name: "mast", parent: "chassis", pivot: [0, 8, -8] },
      { name: "wheelFL", parent: "chassis", pivot: [-17, -7, -12] },
      { name: "wheelFR", parent: "chassis", pivot: [17, -7, -12] },
      { name: "wheelML", parent: "chassis", pivot: [-17, -7, 0] },
      { name: "wheelMR", parent: "chassis", pivot: [17, -7, 0] },
      { name: "wheelBL", parent: "chassis", pivot: [-17, -7, 12] },
      { name: "wheelBR", parent: "chassis", pivot: [17, -7, 12] },
    ],
    parts: [
      ball("chassis", SAND, [0, 2, 0], [13, 6, 19]),
      ball("chassis", ORANGE, [0, 7, 2], [10, 3, 13]),
      ball("mast", SLATE, [0, 10, 0], [1.6, 11, 1.6]),
      ball("mast", SAND, [0, 22, -1], [7, 5, 6]),
      ball("mast", CYAN, [0, 22, -7], [3, 3, 1.4]),
      ...WHEELS.map((joint): RigPart => ({ joint, shape: "wheel", color: TYRE, at: [0, 0, 0], size: [3.5, WHEEL_RADIUS_CM, WHEEL_RADIUS_CM] })),
      ...WHEELS.map((joint) => ball(joint, ORANGE, [0, 0, -5], [4, 1.6, 3])), // shows the wheel turning
    ],
  },
};

export function rigOf(id: string): Rig {
  return RIGS[id] || RIGS.dog;
}

function jointY(rig: Rig, name: string): number {
  const j = rig.joints.find((x) => x.name === name);
  if (!j) return 0;
  return j.pivot[1] + (j.parent ? jointY(rig, j.parent) : 0);
}

export function rigHeightCm(id: string): number {
  const rig = rigOf(id);
  return Math.max(...rig.parts.map((p) => jointY(rig, p.joint) + p.at[1] + p.size[1]));
}

// How far a leg swings, in degrees: nothing when still, then just enough for the foot to cover the
// ground the body moves in one swing, so it doesn't slide.
function stride(speedMs: number, strideM: number, legCm: number): number {
  const full = (Math.asin(Math.min(1, (strideM * 100) / (4 * legCm))) * 180) / Math.PI;
  return full * Math.min(1, Math.max(0, speedMs) / EASE_IN_SPEED);
}

function dogPose(s: RigState, travelled: number): RigPose {
  const amp = stride(s.speedMs, DOG_STRIDE_M, DOG_LEG_CM);
  const step = (travelled / DOG_STRIDE_M) * 2 * Math.PI;
  const a = amp * Math.sin(step);
  const j: { [name: string]: number[] } = {
    legFL: [a, 0, 0], legBR: [a, 0, 0], legFR: [-a, 0, 0], legBL: [-a, 0, 0],
    head: [(amp / 12) * Math.sin(step * 2), 4 * Math.sin(s.t * 0.7), 0],
    earL: [0, 0, -4 - (amp / 6) * Math.abs(Math.sin(step))],
    earR: [0, 0, 4 + (amp / 6) * Math.abs(Math.sin(step))],
    tail: [12, 14 * Math.sin(s.t * 7), 0],
  };
  let liftCm = (amp / 30) * 1.6 * Math.abs(Math.sin(step));
  let pitchDeg = 0;
  if (s.mood === "sit") {
    liftCm = -6.3;
    pitchDeg = 30;
    j.legBL = [35, 0, 0];
    j.legBR = [35, 0, 0];
    j.legFL = [-30, 0, 0];
    j.legFR = [-30, 0, 0];
    j.head = [-24, 8 * Math.sin(s.t * 0.9), 0];
    j.tail = [-6, 16 * Math.sin(s.t * 6), 0];
  } else if (s.mood === "point") {
    j.legFR = [55, 0, 0];
    j.head = [6, 0, 0];
    j.tail = [-14, 0, 0];
  } else if (s.mood === "wait") {
    j.head = [0, 6 * Math.sin(s.t * 1.4), 8 * Math.sin(s.t * 0.8)];
    j.tail = [8, 10 * Math.sin(s.t * 5), 0];
  } else if (s.mood === "arrived") {
    liftCm = 3 * Math.abs(Math.sin(s.t * 7));
    j.tail = [14, 32 * Math.sin(s.t * 14), 0];
  } else if (s.mood === "run") {
    j.tail = [14, 18 * Math.sin(s.t * 10), 0];
  }
  return { joints: j, liftCm, pitchDeg };
}

function robotPose(s: RigState, travelled: number): RigPose {
  const amp = stride(s.speedMs, ROBOT_STRIDE_M, ROBOT_LEG_CM);
  const step = (travelled / ROBOT_STRIDE_M) * 2 * Math.PI;
  const a = amp * Math.sin(step);
  const j: { [name: string]: number[] } = {
    legL: [a, 0, 0], legR: [-a, 0, 0], armL: [-a * 0.8, 0, -4], armR: [a * 0.8, 0, 4],
    head: [0, 12 * Math.sin(s.t * 0.8), 0],
  };
  let liftCm = (amp / 35) * 1.5 * Math.abs(Math.sin(step));
  if (s.mood === "point") {
    j.armR = [85, 0, 0];
    j.head = [0, 0, 0];
  } else if (s.mood === "sit") {
    liftCm = -2; // a low stance: the legs have no knees to fold
    j.legL = [24, 0, 0];
    j.legR = [-24, 0, 0];
    j.head = [-8, 6 * Math.sin(s.t * 0.8), 0];
  } else if (s.mood === "wait") {
    j.head = [6 * Math.sin(s.t * 1.2), 18 * Math.sin(s.t * 0.9), 0];
  } else if (s.mood === "arrived") {
    j.armL = [0, 0, -150 - 12 * Math.sin(s.t * 8)];
    j.armR = [0, 0, 150 + 12 * Math.sin(s.t * 8)];
    liftCm = 2 * Math.abs(Math.sin(s.t * 8));
  }
  return { joints: j, liftCm, pitchDeg: 0 };
}

function roverPose(s: RigState, travelled: number): RigPose {
  const roll = -(((travelled * 100) / WHEEL_RADIUS_CM) * (180 / Math.PI)) % 360; // -x rolls toward -Z
  const j: { [name: string]: number[] } = {};
  for (const w of WHEELS) j[w] = [roll, 0, 0];
  j.mast = [0, 22 * Math.sin(s.t * 0.9), 0];
  if (s.mood === "point") j.mast = [12, 0, 0];
  else if (s.mood === "wait" || s.mood === "sit") j.mast = [0, 35 * Math.sin(s.t * 1.1), 0];
  else if (s.mood === "arrived") j.mast = [-8, (s.t * 120) % 360, 0];
  const liftCm = s.speedMs > 0 ? 0.5 * Math.sin(travelled * 9) : 0;
  return { joints: j, liftCm, pitchDeg: 0 };
}

export function poseFor(id: string, s: RigState): RigPose {
  const travelled = s.travelledM || 0;
  const key = RIGS[id] ? id : "dog";
  if (key === "robot") return robotPose(s, travelled);
  if (key === "rover") return roverPose(s, travelled);
  return dogPose(s, travelled);
}
