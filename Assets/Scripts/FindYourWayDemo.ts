// Pure logic for the autoplay demo: the beat sequence (with captions) and walking along a
// route polyline at a watchable speed. No imports and no Lens globals, so the same file runs in
// Node tests and in the Lens (byte-identical copy at Assets/Scripts/FindYourWayDemo.ts).
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.

export interface DemoBeat {
  id: string;
  caption: string;
}

// Follows the brief's video beats: Walk run with gate change, Step-Free seated run with the
// lift out, then a quick campus Step-Free run, and an end card.
export const DEMO_BEATS: DemoBeat[] = [
  { id: "intro", caption: "Find Your Way Inside: stand-in airport" },
  { id: "walk-choose", caption: "Choose Walk, once for the whole trip" },
  { id: "walk-scan", caption: "Scan the 'you are here' sign" },
  { id: "walk-follow", caption: "Follow the blue line through the hall" },
  { id: "walk-escalator", caption: "Ride the escalator up" },
  { id: "walk-concourse", caption: "On to the departures concourse" },
  { id: "gate-change", caption: "Gate change B12 → C3" },
  { id: "walk-to-pier", caption: "The line swings round to the C pier" },
  { id: "stairs-down", caption: "Stairs down to the C pier" },
  { id: "arrive-c3", caption: "Within 3 m of Gate C3: arrived" },
  { id: "restart", caption: "Restart: now in a wheelchair" },
  { id: "stepfree-choose", caption: "Choose Step-Free, seated height" },
  { id: "stepfree-scan", caption: "Same sign, same gate B12" },
  { id: "to-lift1", caption: "The line goes round the corner to Lift 1" },
  { id: "lift1-out", caption: "Lift 1 is out: pinch the red sign" },
  { id: "to-lift2", caption: "Re-routed to Lift 2" },
  { id: "lift2-ride", caption: "Ride Lift 2 up to Departures" },
  { id: "arrive-b12", caption: "Step-free all the way to Gate B12" },
  { id: "campus", caption: "Same Lens, another map: a campus" },
  { id: "campus-scan", caption: "Step-Free to Lecture Hall 1" },
  { id: "campus-lift-out", caption: "Science lift out: re-routed" },
  { id: "campus-ramp", caption: "Up the ramp instead" },
  { id: "arrive-lecture-hall", caption: "Arrived at Lecture Hall 1" },
  { id: "end", caption: "That's the demo. Find Your Way Inside." },
];

// Free walk in the mall with the companion: the heart of the app, one click from the demo controls.
export const FREE_WALK_BEATS: DemoBeat[] = [
  { id: "fw-intro", caption: "Find Your Way Inside: a shopping mall" },
  { id: "fw-scan", caption: "Scan the 'you are here' sign" },
  { id: "fw-prefs", caption: "Your preferences, saved for next time" },
  { id: "fw-lead", caption: "No destination. Your companion walks ahead" },
  { id: "fw-upstairs", caption: "More picks upstairs? It waits and says so" },
  { id: "fw-point", caption: "It stops at shops you'd like, and points" },
  { id: "fw-turn", caption: "Turn around: it runs round you and stays in front" },
  { id: "fw-end", caption: "Keep walking. It's your walk." },
];

export function beatIndex(id: string, beats: DemoBeat[] = DEMO_BEATS): number {
  for (let i = 0; i < beats.length; i++) if (beats[i].id === id) return i;
  return -1;
}

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export interface Pose extends XYZ {
  heading: number;
}

// Walking speed, and the faster "skip" speed used after the first SKIP_AFTER metres of a long straight.
export const WALK_SPEED = 1.4;
export const SKIP_AFTER = 12;
export const SKIP_FACTOR = 3;

function segLength(a: XYZ, b: XYZ): number {
  return Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) + (b.z - a.z) * (b.z - a.z));
}

function segHeading(a: XYZ, b: XYZ, fallback: number): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return fallback;
  return Math.round(((Math.atan2(dx, dz) * 180) / Math.PI) * 1e6) / 1e6;
}

export function polylineLength(pts: XYZ[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += segLength(pts[i - 1], pts[i]);
  return total;
}

// The point (and walking heading) at `distance` metres along the polyline, clamped to its ends.
export function pointAt(pts: XYZ[], distance: number): Pose {
  if (pts.length === 0) return { x: 0, y: 0, z: 0, heading: 0 };
  let heading = 0;
  let left = distance > 0 ? distance : 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = segLength(a, b);
    heading = segHeading(a, b, heading);
    if (left <= len || i === pts.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, heading };
    }
    left -= len;
  }
  const p = pts[0];
  return { x: p.x, y: p.y, z: p.z, heading };
}

// Seconds to walk the polyline: WALK_SPEED, and SKIP_FACTOR times faster beyond the first
// SKIP_AFTER metres of each straight. `multiplier` speeds everything up (tests use it).
export function walkSeconds(pts: XYZ[], multiplier: number = 1): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = segLength(pts[i - 1], pts[i]);
    const slow = Math.min(len, SKIP_AFTER);
    t += slow / WALK_SPEED + (len - slow) / (WALK_SPEED * SKIP_FACTOR);
  }
  return t / multiplier;
}

// Steps along a polyline in time: call step(dt) every frame for the next pose.
export class PolylineWalker {
  private seg = 1;
  private along = 0; // metres along the current segment
  private heading = 0;
  private finished = false;
  private pts: XYZ[];
  private multiplier: number;

  constructor(pts: XYZ[], multiplier: number = 1) {
    this.pts = pts;
    this.multiplier = multiplier;
    if (pts.length < 2) this.finished = true;
    else this.heading = segHeading(pts[0], pts[1], 0);
  }

  step(dt: number): Pose & { done: boolean } {
    let time = Math.max(0, dt);
    while (!this.finished && time > 0) {
      const a = this.pts[this.seg - 1];
      const b = this.pts[this.seg];
      const len = segLength(a, b);
      this.heading = segHeading(a, b, this.heading);
      const fast = this.along >= SKIP_AFTER;
      const speed = WALK_SPEED * this.multiplier * (fast ? SKIP_FACTOR : 1);
      const boundary = fast ? len : Math.min(len, SKIP_AFTER);
      const need = (boundary - this.along) / speed;
      if (time < need) {
        this.along += time * speed;
        time = 0;
      } else {
        time -= need;
        this.along = boundary;
        if (this.along >= len - 1e-9) {
          if (this.seg >= this.pts.length - 1) {
            this.finished = true;
          } else {
            this.seg++;
            this.along = 0;
          }
        }
      }
    }
    const p = this.position();
    return { x: p.x, y: p.y, z: p.z, heading: this.heading, done: this.finished };
  }

  isDone(): boolean {
    return this.finished;
  }

  private position(): XYZ {
    if (this.pts.length === 0) return { x: 0, y: 0, z: 0 };
    if (this.pts.length === 1) return this.pts[0];
    const a = this.pts[this.seg - 1];
    const b = this.pts[this.seg];
    const len = segLength(a, b);
    const t = len > 0 ? Math.min(1, this.along / len) : 1;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }
}

// ── The showing preset (REVIEW-FIXES.md section 0) ─────────────────────────────────────────────

// What the Lens starts with (FindYourWayMain's Inspector inputs) and which mode is preselected.
export interface StartSettings {
  mapKey: string;
  startAtSign: boolean;
  showDemoControls: boolean;
  companionModel: string;
  companionOnAtStart: boolean;
  preselect: "walk" | "stepFree" | null;
}

// The state shown to the judges: the airport at its entrance sign, demo controls hidden, the dog
// on, Walk preselected (Step-Free one pinch away).
export const SHOWING: StartSettings = {
  mapKey: "airport",
  startAtSign: true,
  showDemoControls: false,
  companionModel: "dog",
  companionOnAtStart: true,
  preselect: "walk",
};

// The settings to start with: the preset when on, else the Inspector's own (always a copy).
export function showingSettings(authored: StartSettings, showingPreset: boolean): StartSettings {
  return { ...(showingPreset ? SHOWING : authored) };
}

// ── The three demo presets (POLISH-PLAN.md Task 4) ─────────────────────────────────────────────

// Pick one in the Inspector and reset the preview: the Lens opens ready for that demo, with the
// clean screen on and the demo controls hidden, at the map's entrance sign. "off" keeps the
// Inspector's own settings (and the older showing preset).
export const DEMO_PRESETS = ["off", "airportWheelchair", "mallPet", "freeWalkRobot"];

export interface DemoSettings {
  mapKey: string;
  companionModel: string;
  preselect: "walk" | "stepFree" | null;
  // Seated: the eyes this much lower than standing (cm).
  seatedDropCm: number;
  // What opens after the sign is scanned: Go to a place (Talk ready) or Free walk.
  open: "goTo" | "freeWalk";
  // Free walk's preferences (category ids): what was saved last time.
  interests: string[];
  // Free walk: what you say when the companion asks for preferences (the preview types it in; R2-15).
  prefsPhrase: string;
}

export function demoSettings(preset: string): DemoSettings | null {
  if (preset === "airportWheelchair") return { mapKey: "airport", companionModel: "robot", preselect: "stepFree", seatedDropCm: 45, open: "goTo", interests: [], prefsPhrase: "" };
  if (preset === "mallPet") return { mapKey: "mall", companionModel: "dog", preselect: "walk", seatedDropCm: 0, open: "goTo", interests: [], prefsPhrase: "" };
  if (preset === "freeWalkRobot") return { mapKey: "mall", companionModel: "robot", preselect: null, seatedDropCm: 0, open: "freeWalk", interests: ["books"], prefsPhrase: "A coffee, and I'm into fashion today" };
  return null;
}
