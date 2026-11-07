// The companion speaks (add-on A in POLISH-PLAN.md): short lines made beforehand with an open TTS
// model (Kokoro, voice af_heart; tools/voice/make-clips.py) and played one at a time, with the same
// words as a small caption under the companion. Pure logic shared by the Lens and the Node tests: no
// imports and no Lens globals; the Lens keeps a byte-identical copy at Assets/Scripts/FindYourWaySpeech.ts.

// Every line the companion can say, by clip key (Assets/Voice/<key>.wav).
export const SPEECH_LINES: { [key: string]: string } = {
  start: "Found you. Where to?",
  step_free: "Step-free route, no stairs.",
  lift_left: "Lift on your left.",
  lift_right: "Lift on your right.",
  lift_ahead: "Lift ahead.",
  hold_lift: "Wait here, I'll hold the lift.",
  up_floor: "Up one floor.",
  down_floor: "Down one floor.",
  coffee_left: "Coffee on your left.",
  coffee_right: "Coffee on your right.",
  clothes_left: "Clothes on your left.",
  clothes_right: "Clothes on your right.",
  gate_moved: "Your gate moved. New route.",
  arrived: "You're here.",
};

// The same line is never said again within this many seconds.
export const SPEECH_REPEAT_S = 8;
// A lift is named once it is this close (m); "I'll hold the lift" once you are this close.
export const SPEECH_LIFT_M = 12;
export const SPEECH_HOLD_M = 3;
// Within this angle (degrees) either side of straight ahead, a thing is "ahead".
export const SPEECH_AHEAD_DEG = 25;

export type Side = "left" | "right" | "ahead";

export type SpeechEvent =
  | { kind: "found" }
  | { kind: "tripStart"; stepFree: boolean }
  | { kind: "rideAhead"; ride: string; metres: number; side: Side }
  | { kind: "floorChanged"; up: boolean; floors: number }
  | { kind: "passing"; category: string; side: Side }
  | { kind: "gateMoved" }
  | { kind: "arrived" };

// Which side of you a point is, facing along (hx, hz) on the floor. Lens Studio is right-handed with Y
// up: facing -Z, +X is on your right.
export function sideOf(fromX: number, fromZ: number, hx: number, hz: number, toX: number, toZ: number): Side {
  const tx = toX - fromX, tz = toZ - fromZ;
  const hl = Math.sqrt(hx * hx + hz * hz), tl = Math.sqrt(tx * tx + tz * tz);
  if (hl === 0 || tl === 0) return "ahead";
  const cos = (hx * tx + hz * tz) / (hl * tl);
  const cross = hz * tx - hx * tz; // < 0: right, > 0: left
  if (cos >= Math.cos((SPEECH_AHEAD_DEG * Math.PI) / 180)) return "ahead";
  return cross < 0 ? "right" : "left";
}

const SHOP_WORDS: { [category: string]: string } = { coffee: "coffee", clothes: "clothes" };

// The clip key for an event, or null when the companion says nothing about it.
export function speechFor(e: SpeechEvent): string | null {
  switch (e.kind) {
    case "found":
      return "start";
    case "tripStart":
      return e.stepFree ? "step_free" : null;
    case "rideAhead":
      if (e.ride !== "lift") return null;
      if (e.metres <= SPEECH_HOLD_M) return "hold_lift";
      if (e.metres > SPEECH_LIFT_M) return null;
      return "lift_" + e.side;
    case "floorChanged":
      if (e.floors !== 1) return null; // the lines say "one floor"
      return e.up ? "up_floor" : "down_floor";
    case "passing": {
      const w = SHOP_WORDS[e.category];
      if (!w || e.side === "ahead") return null;
      return w + "_" + e.side;
    }
    case "gateMoved":
      return "gate_moved";
    case "arrived":
      return "arrived";
  }
  return null;
}

// Lines about the same thing count as one: the lift is named once as you come up to it, even when it
// moves from ahead to your right as you turn.
export function speechTopic(key: string): string {
  const i = key.lastIndexOf("_");
  const side = i > 0 ? key.slice(i + 1) : "";
  return side === "left" || side === "right" || side === "ahead" ? key.slice(0, i) : key;
}

// One line at a time, never the same line (topic) within SPEECH_REPEAT_S, nothing while muted.
export class SpeechGate {
  muted = false;
  private saidAt: { [key: string]: number } = {};
  private busyUntil = -Infinity;

  // True when the line should play now (it then counts as said); seconds is the clip's length.
  say(key: string | null, now: number, seconds: number = 2): boolean {
    if (!key || this.muted || !(key in SPEECH_LINES)) return false;
    if (now < this.busyUntil) return false;
    const topic = speechTopic(key);
    const last = this.saidAt[topic];
    if (last !== undefined && now - last < SPEECH_REPEAT_S) return false;
    this.saidAt[topic] = now;
    this.busyUntil = now + seconds;
    return true;
  }

  reset(): void {
    this.saidAt = {};
    this.busyUntil = -Infinity;
  }
}
