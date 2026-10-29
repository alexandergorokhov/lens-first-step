// Places along the way and the companion pointing them out. Pure logic shared by the Lens and
// the Node tests: no imports and no Lens globals; the Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayPlaces.ts. Every place comes from the map (nodes of kind "place"
// with a "category", optional "sponsored" and "sponsorTag"); nothing here names a shop.
// Nothing in this file can change a route: it only reads it.
//
// Map metres: x east, y up, z north.

export interface PlaceXYZ {
  x: number;
  y: number;
  z: number;
}

export interface PlaceNodeInfo extends PlaceXYZ {
  id: string;
  kind: string;
  label?: string;
  category?: string;
  sponsored?: boolean;
  sponsorTag?: string;
}

export interface PlacesMapLike {
  nodes: PlaceNodeInfo[];
}

export interface Place extends PlaceXYZ {
  id: string;
  label: string;
  category: string;
  sponsored: boolean;
  sponsorTag: string;
}

// Icons: only places within this distance of the traveller (m), at most this many at once.
export const ICON_RADIUS = 15;
export const MAX_ICONS = 3;
// A place counts as "along the way" within this distance of the route (m).
export const NEAR_ROUTE = 10;
// Pointing: from this close (m), at most once per POINT_GAP_SECONDS and per POINT_GAP_METRES
// walked, never within POINT_CLEAR metres of a turn or a floor change; a point lasts POINT_SECONDS.
export const POINT_RADIUS = 10;
export const POINT_GAP_SECONDS = 30;
export const POINT_GAP_METRES = 20;
export const POINT_CLEAR = 10;
export const POINT_SECONDS = 3;
export const TURN_DEG = 25;
// A place more than this far behind the traveller (along their direction of travel) is skipped.
export const POINT_BEHIND = 2;
export const DEFAULT_SPONSOR_TAG = "Sponsored";

const INTERESTS = ["coffee", "food", "shopping", "toilet", "pharmacy"];
const STEP_FREE_FIRST = ["accessibleToilet", "lift"];

// What the traveller can pick on the mode panel. None is picked by default.
export function interestOptions(profile: string): string[] {
  return profile === "stepFree" ? INTERESTS.concat(["accessibleToilet"]) : INTERESTS.slice();
}

export function placesOf(map: PlacesMapLike): Place[] {
  const out: Place[] = [];
  for (const n of map.nodes) {
    if (n.kind !== "place" || typeof n.category !== "string" || n.category === "") continue;
    out.push({
      id: n.id, x: n.x, y: n.y, z: n.z,
      label: n.label || n.id,
      category: n.category,
      sponsored: n.sponsored === true,
      sponsorTag: n.sponsorTag || DEFAULT_SPONSOR_TAG,
    });
  }
  return out;
}

// The name shown on a place's icon; a sponsored one adds its tag: "<label> · Sponsored".
export function placeTag(p: Place): string {
  return p.sponsored ? p.label + " · " + p.sponsorTag : p.label;
}

function flat(a: PlaceXYZ, b: PlaceXYZ): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

const sameFloor = (a: PlaceXYZ, b: PlaceXYZ) => Math.abs(a.y - b.y) < 1;

// Horizontal distance from p to the route's segments on p's floor (Infinity if none).
export function distanceToRouteOnFloor(route: PlaceXYZ[], p: PlaceXYZ): number {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (!sameFloor(a, p) || !sameFloor(b, p)) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    best = Math.min(best, Math.sqrt((p.x - a.x - dx * t) ** 2 + (p.z - a.z - dz * t) ** 2));
  }
  if (route.length === 1 && sameFloor(route[0], p)) best = flat(route[0], p);
  return best;
}

// The traveller's direction of travel (unit x/z): along the route segment they are on.
function travelDir(route: PlaceXYZ[], user: PlaceXYZ): { x: number; z: number } | null {
  let best = Infinity;
  let dir: { x: number; z: number } | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-3 || !sameFloor(a, user) || !sameFloor(b, user)) continue;
    const t = Math.max(0, Math.min(1, ((user.x - a.x) * dx + (user.z - a.z) * dz) / (len * len)));
    const d = Math.sqrt((user.x - a.x - dx * t) ** 2 + (user.z - a.z - dz * t) ** 2);
    if (d < best - 1e-9 && t < 1) {
      best = d;
      dir = { x: dx / len, z: dz / len };
    }
  }
  return dir;
}

// Turns of at least TURN_DEG and both ends of every floor change on the route.
export function quietSpots(route: PlaceXYZ[]): PlaceXYZ[] {
  const out: PlaceXYZ[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (Math.abs(b.y - a.y) >= 0.5) {
      out.push(a, b);
      continue;
    }
    if (i + 2 >= route.length) continue;
    const c = route[i + 2];
    if (Math.abs(c.y - b.y) >= 0.5) continue;
    const h1 = Math.atan2(b.x - a.x, b.z - a.z);
    const h2 = Math.atan2(c.x - b.x, c.z - b.z);
    let turn = Math.abs(((h2 - h1) * 180) / Math.PI);
    if (turn > 180) turn = 360 - turn;
    if (turn >= TURN_DEG && flat(a, b) > 1e-3 && flat(b, c) > 1e-3) out.push(b);
  }
  return out;
}

export interface IconOptions {
  profile: string;
  muted: boolean;
}

// The place icons to show now: on the traveller's floor, within ICON_RADIUS of them and
// NEAR_ROUTE of the route, nearest first (Step-Free: accessible toilets and lifts first), at
// most MAX_ICONS. Muted ("Places off"): none. Step-Free also counts the map's lifts as places.
export function visiblePlaces(map: PlacesMapLike, route: PlaceXYZ[], user: PlaceXYZ, opts: IconOptions): Place[] {
  if (opts.muted) return [];
  const all = placesOf(map);
  if (opts.profile === "stepFree") {
    for (const n of map.nodes) {
      if (n.kind === "lift") all.push({ id: n.id, x: n.x, y: n.y, z: n.z, label: n.label || n.id, category: "lift", sponsored: false, sponsorTag: DEFAULT_SPONSOR_TAG });
    }
  }
  const near = all.filter((p) => sameFloor(p, user) && flat(p, user) <= ICON_RADIUS && distanceToRouteOnFloor(route, p) <= NEAR_ROUTE);
  const rank = (p: Place) => (opts.profile === "stepFree" && STEP_FREE_FIRST.indexOf(p.category) >= 0 ? 0 : 1);
  near.sort((a, b) => rank(a) - rank(b) || flat(a, user) - flat(b, user));
  return near.slice(0, MAX_ICONS);
}

// Decides when the companion points out a place. Call check() every frame; it returns the place
// to point at (and starts the gaps), or null. It only reads the route.
export class PointingCoach {
  interests: string[] = [];
  muted = false;
  private places: Place[];
  private lastAt = -Infinity;
  private lastTravelled = -Infinity;
  private done: { [id: string]: boolean } = {};

  constructor(map: PlacesMapLike) {
    this.places = placesOf(map);
  }

  // now: seconds; travelled: metres walked so far; cardShowing: a gate-change or out-of-service
  // card is up.
  check(route: PlaceXYZ[], user: PlaceXYZ, now: number, travelled: number, cardShowing: boolean): Place | null {
    if (this.muted || cardShowing || route.length < 2) return null;
    if (now - this.lastAt < POINT_GAP_SECONDS || travelled - this.lastTravelled < POINT_GAP_METRES) return null;
    for (const q of quietSpots(route)) if (sameFloor(q, user) && flat(q, user) < POINT_CLEAR) return null;
    const dir = travelDir(route, user);
    let best: Place | null = null;
    for (const p of this.places) {
      if (dir && (p.x - user.x) * dir.x + (p.z - user.z) * dir.z < -POINT_BEHIND) continue;
      if (this.done[p.id] || !(p.sponsored || this.interests.indexOf(p.category) >= 0)) continue;
      if (!sameFloor(p, user) || flat(p, user) > POINT_RADIUS || distanceToRouteOnFloor(route, p) > NEAR_ROUTE) continue;
      if (!best || flat(p, user) < flat(best, user)) best = p;
    }
    if (!best) return null;
    this.done[best.id] = true;
    this.lastAt = now;
    this.lastTravelled = travelled;
    return best;
  }
}
