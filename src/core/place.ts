// Pure place logic shared by the Lens and the Node tests: what a map file's optional "place"
// block means once defaults are filled in (start, destination, levels, sign texts, demo events),
// destination labels and cards, the direction a node is approached from, and the texts of the
// closure and ride cards. No imports and no Lens globals; the Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayPlace.ts. The types below are structural subsets of the router's
// MapData, so a router map can be passed straight in.

export interface PlaceNodeLike {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: string;
  label?: string;
  arrivalCard?: string;
}

export interface PlaceEdgeLike {
  id?: string;
  from: string;
  to: string;
  kind: string;
}

export interface PlaceLevel {
  y: number;
  name: string;
}

// Optional building footprints (campus-style maps with outdoor ground between buildings).
export interface PlaceBuilding {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  levels: number[];
}

export interface PlaceEvent {
  id: string;
  type: string; // "destinationChanged" | "connectionClosed"
  to?: string;
  edge?: string;
  at?: string;
  button?: string;
  sign?: string;
  card?: string;
}

export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// The place block as written in a map file: every field optional.
export interface PlaceSpec {
  title?: string;
  standInLabel?: string;
  standInModel?: boolean;
  // A shopping place: the Lens lines its walls with shops. Other maps keep their own plain look.
  // Left out, a map with shopping interests (Free walk picks) counts as one.
  retail?: boolean;
  interests?: unknown[];
  start?: string;
  destination?: string;
  levels?: PlaceLevel[];
  footprint?: Footprint;
  buildings?: PlaceBuilding[];
  scanSign?: { title?: string; button?: string; hint?: string };
  events?: PlaceEvent[];
}

export interface PlaceMapLike {
  name?: string;
  nodes: PlaceNodeLike[];
  edges: PlaceEdgeLike[];
  place?: PlaceSpec;
}

export interface PlaceInfo {
  title: string;
  standInLabel: string;
  standInModel: boolean;
  retail: boolean;
  start: string;
  destination: string;
  levels: PlaceLevel[];
  footprint: Footprint | null;
  buildings: PlaceBuilding[];
  scanSign: { title: string; button: string; hint: string };
  events: PlaceEvent[];
}

export const DEFAULT_TITLE = "Map";
export const DEFAULT_STAND_IN_LABEL = "Stand-in building";
export const DEFAULT_LEVEL_NAME = "Ground";
export const DEFAULT_SIGN_TITLE = "You are here";
export const DEFAULT_SCAN_BUTTON = "Scan sign";
export const DEFAULT_SCAN_HINT = "on real Specs: look at the sign";
// Two node heights closer than this are on the same level (for approach directions).
const SAME_LEVEL_M = 0.5;

function nodeById(map: PlaceMapLike, id: string): PlaceNodeLike | undefined {
  for (const n of map.nodes) if (n.id === id) return n;
  return undefined;
}

export function isDestination(n: PlaceNodeLike): boolean {
  return n.kind === "destination" || n.kind === "gate";
}

// The place block with defaults: start = first sign, destination = first destination node.
export function placeOf(map: PlaceMapLike): PlaceInfo {
  const raw: PlaceSpec = map.place || {};
  let start = raw.start || "";
  let dest = raw.destination || "";
  if (!start) for (const n of map.nodes) if (n.kind === "sign") { start = n.id; break; }
  if (!dest) for (const n of map.nodes) if (isDestination(n)) { dest = n.id; break; }
  const sign = raw.scanSign || {};
  return {
    title: raw.title || map.name || DEFAULT_TITLE,
    standInLabel: raw.standInLabel || DEFAULT_STAND_IN_LABEL,
    standInModel: raw.standInModel !== false,
    retail: raw.retail === true || (raw.retail === undefined && Array.isArray(raw.interests) && raw.interests.length > 0),
    start: start,
    destination: dest,
    levels: Array.isArray(raw.levels) && raw.levels.length > 0 ? raw.levels : [{ y: 0, name: DEFAULT_LEVEL_NAME }],
    footprint: raw.footprint || null,
    buildings: Array.isArray(raw.buildings) ? raw.buildings : [],
    scanSign: {
      title: sign.title || DEFAULT_SIGN_TITLE,
      button: sign.button || DEFAULT_SCAN_BUTTON,
      hint: sign.hint || DEFAULT_SCAN_HINT,
    },
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

// The name of the level closest to height y.
export function levelName(place: PlaceInfo, y: number): string {
  let best = place.levels[0];
  for (const l of place.levels) if (Math.abs(l.y - y) < Math.abs(best.y - y)) best = l;
  return best ? best.name : "level " + y;
}

export function nodeLabel(map: PlaceMapLike, id: string): string {
  const n = nodeById(map, id);
  return n && n.label ? n.label : id;
}

// The card shown on arrival: the node's arrivalCard, else its label.
export function arrivalText(map: PlaceMapLike, id: string): string {
  const n = nodeById(map, id);
  if (n && n.arrivalCard) return n.arrivalCard;
  return nodeLabel(map, id);
}

// Unit direction (map x/z) from a node toward the corridor it is entered from: its first
// neighbour on the same level joined by a non-lift edge. Used to open lift shafts toward the
// approach and to put the door sign and floor button where the traveller arrives.
export function approachDir(map: PlaceMapLike, nodeId: string): { x: number; z: number } {
  const n = nodeById(map, nodeId);
  if (n) {
    for (const e of map.edges) {
      if (e.kind === "lift") continue;
      const otherId = e.from === nodeId ? e.to : e.to === nodeId ? e.from : null;
      if (!otherId) continue;
      const o = nodeById(map, otherId);
      if (!o || Math.abs(o.y - n.y) > SAME_LEVEL_M) continue;
      const dx = o.x - n.x;
      const dz = o.z - n.z;
      const l = Math.sqrt(dx * dx + dz * dz);
      if (l > 0.01) return { x: dx / l, z: dz / l };
    }
  }
  return { x: 0, z: -1 };
}

// The card shown when a connection closes. "Re-routing" only when the current route used it;
// otherwise just what closed (the sign text, or the card without its re-routing sentence).
export function closureNotice(ev: PlaceEvent, routeUsedIt: boolean): string {
  const card = ev.card || ev.sign || "Connection closed. Re-routing.";
  if (routeUsedIt) return card;
  return ev.sign || card.replace(/\s*Re-routing\.?\s*$/, "").replace(/\.$/, "");
}

const RIDE_NAMES: { [kind: string]: string } = { lift: "Lift", escalator: "Escalator", stairs: "Stairs", ramp: "Ramp" };

// The card shown while riding a connection between levels: "Lift up to Departures".
export function rideCard(kind: string, up: boolean, toLevel: string): string {
  const name = RIDE_NAMES[kind] || "Connection";
  return name + (up ? " up to " : " down to ") + toLevel;
}

// "1 floor up", "2 floors down", or "" on the same floor.
export function floorsText(floors: number): string {
  if (floors === 0) return "";
  const n = Math.abs(floors);
  return n + (n === 1 ? " floor " : " floors ") + (floors > 0 ? "up" : "down");
}

// Whole minutes, rounded up, never below 1: "3 min".
export function minutesText(seconds: number): string {
  return Math.max(1, Math.ceil(seconds / 60)) + " min";
}

// The distance pill: "Gate C3 · 140 m · 1 floor down · 3 min" (no floors part on the same floor).
export function distancePill(destination: string, metres: number, floors: number, seconds: number): string {
  const parts = [destination, Math.round(metres) + " m"];
  const f = floorsText(floors);
  if (f) parts.push(f);
  parts.push(minutesText(seconds));
  return parts.join(" · ");
}

// The cue before a floor change: "In 15 m: lift down to Ground floor", or "Now: ..." within 2 m.
export function floorCue(kind: string, up: boolean, toLevel: string, metres: number): string {
  const ride = rideCard(kind, up, toLevel);
  const what = ride.charAt(0).toLowerCase() + ride.slice(1);
  return (metres < 2 ? "Now: " : "In " + Math.round(metres) + " m: ") + what;
}

// Where the destination is: "Gate C3 is on C pier, 1 floor down" / "Gate B12 is on this floor".
export function destinationFloorText(destination: string, level: string, floors: number): string {
  if (floors === 0) return destination + " is on this floor";
  return destination + " is on " + level + ", " + floorsText(floors);
}

// What place.ts needs of router.ts's TripAhead (structural, so it can be passed straight in).
export interface TripLike {
  metres: number;
  seconds: number;
  floors: number;
  next: { change: { edge: { kind: string }; to: string; up: boolean }; metres: number } | null;
}

// How far ahead (m) of a floor change its cue shows (router.ts's FLOOR_CUE_DISTANCE).
export const FLOOR_CUE_M = 15;

// The cue above the pill: the next floor change once it is within FLOOR_CUE_M, else null.
export function floorCueFor(place: PlaceInfo, map: PlaceMapLike, trip: TripLike | null, within: number = FLOOR_CUE_M): string | null {
  if (!trip || !trip.next || trip.next.metres > within) return null;
  const to = nodeById(map, trip.next.change.to);
  return floorCue(trip.next.change.edge.kind, trip.next.change.up, levelName(place, to ? to.y : 0), trip.next.metres);
}

// The pill text, or null when there is nothing left to walk (arrived) or no route.
export function tripPill(destination: string, trip: TripLike | null): string | null {
  if (!trip || trip.metres <= 0) return null;
  return distancePill(destination, trip.metres, trip.floors, trip.seconds);
}

// A card's clock: one long frame (a rebuild, a hitch) counts as CARD_MAX_STEP seconds at most, so
// it can't use up a card nobody has seen yet.
export const CARD_MAX_STEP = 0.1;

export function cardClock(t: number, dt: number): number {
  return dt > 0 ? t + Math.min(dt, CARD_MAX_STEP) : t;
}
