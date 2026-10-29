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
