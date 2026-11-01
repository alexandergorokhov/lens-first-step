// Pet guide ("follow the pet"): a small pet trots a little ahead of the traveller along the
// route instead of the floor line, waits at the foot of a lift/escalator/stairs/ramp until the
// traveller gets there, and stops and looks back if they fall behind. The game: treats sit at
// each turn, each floor change and the destination; walking past one collects it.
// Pure logic shared by the Lens and the Node tests: no imports and no Lens globals; the Lens
// keeps a byte-identical copy at Assets/Scripts/FindYourWayPet.ts.
//
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export type PetMood = "lead" | "sit" | "wait" | "point" | "arrived";

// The companion is any model: same guiding logic, its own name (the toggle label), the model the
// Lens/video shows and what it collects. Pick one by id; unknown ids get the dog.
export interface Companion {
  id: string;
  name: string;
  model: string;
  collectible: { one: string; many: string };
}

export const COMPANIONS: { [id: string]: Companion } = {
  dog: { id: "dog", name: "Pet", model: "dog", collectible: { one: "treat", many: "treats" } },
  robot: { id: "robot", name: "Robot", model: "robot", collectible: { one: "bolt", many: "bolts" } },
  rover: { id: "rover", name: "Rover", model: "rover", collectible: { one: "star", many: "stars" } },
};

export function companionOf(id: string): Companion {
  return Object.prototype.hasOwnProperty.call(COMPANIONS, id) ? COMPANIONS[id] : COMPANIONS.dog;
}

// What the picker shows. The dog's name is "Pet", its toggle label; here it is named for its look.
export function companionChoices(): { id: string; label: string }[] {
  return Object.keys(COMPANIONS).map((id) => ({ id, label: id === "dog" ? "Dog" : COMPANIONS[id].name }));
}

// The route line is ~50% transparent in every guide mode (line only, or companion + line), so
// the floor and the flow of people show through it.
export const LINE_OPACITY = 0.5;

export function guideVisuals(companionOn: boolean): { showLine: boolean; lineOpacity: number; showCompanion: boolean } {
  return { showLine: true, lineOpacity: LINE_OPACITY, showCompanion: companionOn };
}

export interface PetState {
  pos: XYZ;
  heading: number;
  mood: PetMood;
}

// How far ahead of the traveller the pet walks (m), how far behind they may fall before it
// stops and looks back (m), its top speed (m/s) and how close a treat is collected from (m).
export const PET_LEAD = 2.5;
export const PET_WAIT_DISTANCE = 6;
export const PET_SPEED = 2.4;
export const TREAT_RADIUS = 1.5;
// How long the companion points at a place (s); the same as places.ts's POINT_SECONDS.
export const POINT_SECONDS = 3;
// While pointing it steps this far off the line toward the place (m): out of the way, in view.
export const SIDE_STEP = 1.2;
// A segment that climbs or drops at least this much is a floor change.
const LEVEL_STEP = 0.5;

function d3(a: XYZ, b: XYZ): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function flat(a: XYZ, b: XYZ): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

function lerp(a: XYZ, b: XYZ, t: number): XYZ {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function headingOf(a: XYZ, b: XYZ): number | null {
  if (flat(a, b) < 1e-3) return null;
  return (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI;
}

function wrap(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

// The traveller's place on the route: segment index and fraction along it (closest in 3D).
function project(route: XYZ[], user: XYZ): { seg: number; t: number } {
  let seg = 0;
  let segT = 0;
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    let t = len2 === 0 ? 0 : ((user.x - a.x) * (b.x - a.x) + (user.y - a.y) * (b.y - a.y) + (user.z - a.z) * (b.z - a.z)) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = d3(user, lerp(a, b, t));
    if (d < best - 1e-9) {
      best = d;
      seg = i;
      segT = t;
    }
  }
  return { seg, t: segT };
}

const isChange = (a: XYZ, b: XYZ) => Math.abs(b.y - a.y) >= LEVEL_STEP;

// Where the pet heads: `lead` metres ahead of the traveller along the route, but never past
// the foot of a floor change the traveller has not reached yet (it waits there), nor the end.
// On a sloped connection the traveller is already on, the pet goes up (or down) it ahead of them.
export function petTarget(route: XYZ[], user: XYZ, lead: number = PET_LEAD): { at: XYZ; atChange: boolean; atEnd: boolean } {
  if (route.length === 0) return { at: user, atChange: false, atEnd: true };
  if (route.length === 1) return { at: route[0], atChange: false, atEnd: true };
  const { seg, t } = project(route, user);
  let at = lerp(route[seg], route[seg + 1], t);
  // Standing in a lift (vertical first segment) or before a floor change: wait at its foot.
  const riding = isChange(route[seg], route[seg + 1]) && flat(route[seg], route[seg + 1]) >= LEVEL_STEP && t > 0;
  if (isChange(route[seg], route[seg + 1]) && !riding) return { at: route[seg], atChange: true, atEnd: false };
  let left = lead;
  for (let i = seg; i < route.length - 1; i++) {
    const end = route[i + 1];
    if (i > seg && isChange(route[i], end)) return { at, atChange: true, atEnd: false };
    const d = d3(at, end);
    if (d >= left) return { at: lerp(at, end, left / d), atChange: false, atEnd: false };
    left -= d;
    at = end;
  }
  return { at, atChange: false, atEnd: true };
}

// Where the companion stands while pointing: its usual spot ahead on the line, moved SIDE_STEP
// sideways (square to the line there) toward the place, so it keeps pace ahead of the traveller
// without standing on the line.
export function sideStepSpot(route: XYZ[], user: XYZ, place: XYZ, step: number = SIDE_STEP, lead: number = PET_LEAD): XYZ {
  const on = petTarget(route, user, lead).at;
  let dir: { x: number; z: number } | null = null;
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const len = flat(a, b);
    if (len < 1e-3 || isChange(a, b)) continue;
    const { t } = project([a, b], on);
    const d = d3(lerp(a, b, t), on);
    if (d < best - 1e-9) {
      best = d;
      dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    }
  }
  if (!dir) return on;
  let nx = -dir.z;
  let nz = dir.x;
  if ((place.x - on.x) * nx + (place.z - on.z) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { x: on.x + nx * step, y: on.y, z: on.z + nz * step };
}

export function newPet(route: XYZ[], user: XYZ, lead: number = PET_LEAD): PetState {
  const t = petTarget(route, user, lead);
  const h = headingOf(user, t.at);
  return { pos: t.at, heading: h === null ? 0 : h, mood: "lead" };
}

// One step of the pet: trot toward its target at up to PET_SPEED; ride along when the target is
// on another floor (the traveller rode a lift or an escalator); stop and look back when the
// traveller is more than PET_WAIT_DISTANCE past the usual lead. `arrived` = the trip has ended.
export function stepPet(pet: PetState, route: XYZ[], user: XYZ, dt: number, arrived: boolean = false, lead: number = PET_LEAD): PetState {
  const t = petTarget(route, user, lead);
  const lookBack = headingOf(pet.pos, user);
  if (arrived) return { pos: pet.pos, heading: lookBack === null ? pet.heading : lookBack, mood: "arrived" };
  if (d3(pet.pos, user) > PET_WAIT_DISTANCE + lead - PET_LEAD && Math.abs(pet.pos.y - user.y) < LEVEL_STEP * 2) {
    return { pos: pet.pos, heading: lookBack === null ? pet.heading : lookBack, mood: "wait" };
  }
  let pos: XYZ;
  if (Math.abs(t.at.y - pet.pos.y) >= LEVEL_STEP * 2 && !isChangeNear(route, pet.pos)) pos = t.at; // rides with you
  else {
    const d = d3(pet.pos, t.at);
    const step = PET_SPEED * dt;
    pos = d <= step ? t.at : lerp(pet.pos, t.at, step / d);
  }
  const moved = headingOf(pet.pos, pos);
  const settled = d3(pos, t.at) < 0.05;
  const mood: PetMood = settled && t.atEnd ? "arrived" : settled && t.atChange ? "sit" : "lead";
  // Sitting or done: face the traveller; trotting: face where it goes.
  const heading = mood === "lead" && moved !== null ? moved : lookBack === null ? pet.heading : lookBack;
  return { pos, heading, mood };
}

// True when p lies on a sloped floor-change segment (the pet walks it rather than jumping).
function isChangeNear(route: XYZ[], p: XYZ): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (!isChange(a, b) || flat(a, b) < LEVEL_STEP) continue;
    const { t } = project([a, b], p);
    if (d3(lerp(a, b, t), p) < 0.3 && t < 0.98) return true;
  }
  return false;
}

// About how far apart (m) treats sit along long stretches between turns and floor changes.
export const TREAT_EVERY = 7;

// Where the treats go, in route order: every turn of at least minTurnDeg, the foot of every
// floor change and the destination; then the long gaps between those are filled evenly, about
// `every` metres apart (never on stairs, an escalator, a ramp or in a lift).
export function treatSpots(route: XYZ[], minTurnDeg: number = 25, every: number = TREAT_EVERY): XYZ[] {
  if (route.length < 2) return route.slice();
  // Distance along the route at each vertex.
  const along: number[] = [0];
  for (let i = 1; i < route.length; i++) along.push(along[i - 1] + d3(route[i - 1], route[i]));
  const keys: number[] = []; // vertex indices
  for (let i = 1; i < route.length - 1; i++) {
    const a = route[i - 1];
    const b = route[i];
    const c = route[i + 1];
    if (isChange(b, c)) keys.push(i);
    else if (!isChange(a, b)) {
      const h1 = headingOf(a, b);
      const h2 = headingOf(b, c);
      if (h1 !== null && h2 !== null && Math.abs(wrap(h2 - h1)) >= minTurnDeg) keys.push(i);
    }
  }
  keys.push(route.length - 1);
  // The point at distance s along the route, or null on a floor-change segment.
  const pointAt = (s: number): XYZ | null => {
    for (let i = 0; i < route.length - 1; i++) {
      if (s > along[i + 1]) continue;
      if (isChange(route[i], route[i + 1])) return null;
      const len = along[i + 1] - along[i];
      return lerp(route[i], route[i + 1], len === 0 ? 0 : (s - along[i]) / len);
    }
    return null;
  };
  const out: XYZ[] = [];
  let from = 0;
  for (const k of keys) {
    const gap = along[k] - from;
    const fills = Math.max(0, Math.round(gap / every) - 1);
    for (let f = 1; f <= fills; f++) {
      const p = pointAt(from + (gap * f) / (fills + 1));
      if (p) out.push(p);
    }
    out.push(route[k]);
    from = along[k];
  }
  return out;
}

// Collects the treats within TREAT_RADIUS on the traveller's floor; returns the newly collected
// indices (each treat is collected once).
export function collectTreats(spots: XYZ[], got: boolean[], user: XYZ, radius: number = TREAT_RADIUS): number[] {
  const out: number[] = [];
  for (let i = 0; i < spots.length; i++) {
    if (got[i]) continue;
    if (flat(spots[i], user) <= radius && Math.abs(spots[i].y - user.y) < 1) {
      got[i] = true;
      out.push(i);
    }
  }
  return out;
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

// "Treats 2 of 5" (a robot: "Bolts 2 of 5").
export function treatsText(got: number, total: number, companion: Companion = COMPANIONS.dog): string {
  return cap(companion.collectible.many) + " " + got + " of " + total;
}

// The arrival line under the arrival card: "All 5 treats found!" or "3 of 5 treats found".
export function treatsResult(got: number, total: number, companion: Companion = COMPANIONS.dog): string {
  const many = companion.collectible.many;
  return got === total ? "All " + total + " " + many + " found!" : got + " of " + total + " " + many + " found";
}

// The companion as a feature the traveller turns on or off at any time (the "Pet" toggle; the
// label is the companion's name). On: it walks ahead with the line still showing at 50%; off: just
// the line. It never changes the route. The score survives turning it off and on, and a re-route
// (pass a new routeKey) lays fresh treats along the new route while keeping the ones already
// found. point() makes it stop and face a place for POINT_SECONDS, then it carries on.
export class PetGuide {
  on = false;
  companion: Companion = COMPANIONS.dog;
  pointing: { at: XYZ; until: number } | null = null;
  pet: PetState | null = null;
  spots: XYZ[] = [];
  got: boolean[] = [];
  found = 0;
  lead = PET_LEAD;
  private routeKey = "";

  get total(): number {
    return this.found + this.got.filter((g) => !g).length;
  }

  // The line always shows (at LINE_OPACITY), with or without the companion.
  get showLine(): boolean {
    return guideVisuals(this.on).showLine;
  }

  // Stop, turn and point at a place for POINT_SECONDS (from places.ts's PointingCoach).
  point(place: XYZ, now: number, seconds: number = POINT_SECONDS): void {
    if (this.on) this.pointing = { at: { x: place.x, y: place.y, z: place.z }, until: now + seconds };
  }

  setOn(on: boolean, route: XYZ[], user: XYZ, routeKey: string): void {
    this.on = on;
    this.pet = on && route.length > 0 ? newPet(route, user, this.lead) : null;
    if (on && route.length > 0) this.layTreats(route, routeKey);
  }

  private layTreats(route: XYZ[], routeKey: string): void {
    if (routeKey === this.routeKey) return;
    this.routeKey = routeKey;
    this.spots = treatSpots(route);
    this.got = this.spots.map(() => false);
  }

  // Call every frame with the current route (now: seconds, for pointing). Returns the treats
  // collected this frame.
  update(route: XYZ[], user: XYZ, dt: number, routeKey: string, arrived: boolean = false, now: number = 0): number[] {
    if (!this.on) return [];
    // At arrival the route shrinks to the destination: keep the treats as they are.
    if (!arrived) this.layTreats(route, routeKey);
    if (!this.pet && route.length > 0) this.pet = newPet(route, user, this.lead);
    if (this.pointing && (arrived || now >= this.pointing.until)) this.pointing = null;
    if (this.pet && this.pointing) {
      // A couple of steps off the line toward the place, keeping pace ahead; facing the place.
      const spot = sideStepSpot(route, user, this.pointing.at, SIDE_STEP, this.lead);
      const d = d3(this.pet.pos, spot);
      const step = PET_SPEED * dt;
      const pos = d <= step ? spot : lerp(this.pet.pos, spot, step / d);
      const h = headingOf(pos, this.pointing.at);
      this.pet = { pos, heading: h === null ? this.pet.heading : h, mood: "point" };
    } else if (this.pet) this.pet = stepPet(this.pet, route, user, dt, arrived, this.lead);
    const got = collectTreats(this.spots, this.got, user);
    // Arriving (within the arrival radius) collects the destination's treat.
    const last = this.spots.length - 1;
    if (arrived && last >= 0 && !this.got[last]) {
      this.got[last] = true;
      got.push(last);
    }
    this.found += got.length;
    return got;
  }
}
