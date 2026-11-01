// Route engine for "Find Your Way Inside". Plain TypeScript, no Lens Studio APIs,
// so it runs under Node for tests and can be copied into Assets/ for the Lens.
//
// Map conventions: positions in metres, y up. Edges are two-way except
// escalators, which only run from -> to.

export type EdgeKind = "walk" | "stairs" | "escalator" | "lift" | "ramp";
export type Profile = "walk" | "stepFree";

// The line of a shop's front (or a stairs / lift entrance), on its node's floor: looking across it
// from outside counts as looking at it. The outside is the side the node's walk edge arrives from.
export interface FrontLine {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

// One thing a shop wants to show. "image" picks from the pictures bundled in the Lens.
export interface OfferItem {
  text: string;
  price: string;
  image?: string;
}

export interface MapNode {
  id: string;
  x: number;
  y: number;
  z: number;
  // "sign" | "junction" | "destination" | "assistance" | "lift" | ... (free text; "sign" and
  // "assistance" mean something to the router).
  kind: string;
  label?: string;
  // Destination extras: what kind of place it is ("gate", "room", "spot"), its short code,
  // a Material icon name and the card shown on arrival.
  type?: string;
  code?: string;
  icon?: string;
  arrivalCard?: string;
  // Places along the way (kind "place"): what it is ("coffee", "toilet", ...), whether it pays
  // to be pointed out, and the honest tag shown on it (default "Sponsored").
  category?: string;
  sponsored?: boolean;
  sponsorTag?: string;
  // Any node may have a front (no front: no dot); places may have an offer of at most 3 items.
  front?: FrontLine;
  offer?: OfferItem[];
}

export interface MapEdge {
  // Needed for anything that can be closed (every lift has one).
  id?: string;
  from: string;
  to: string;
  length: number;
  kind: EdgeKind;
  open: boolean;
  // Drawn as an outdoor path between buildings (campus).
  outdoor?: boolean;
}

export interface PlaceLevel {
  y: number;
  name: string;
  // Storey number for counting floors ("1 floor up"); default: the level's order by height.
  // Two levels can share a storey (a pier 1 m below the departures floor).
  floor?: number;
}

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
  to?: string; // destinationChanged: the new destination node
  edge?: string; // connectionClosed: the edge id that closes
  at?: string; // connectionClosed: the node its red sign hangs at
  button?: string;
  sign?: string;
  card?: string;
}

// The optional "place" block of a map file: everything building-specific the Lens shows,
// plus per-map trip distances (metres) for small spaces such as a room.
export interface MapPlace {
  title?: string;
  standInLabel?: string;
  standInModel?: boolean;
  start?: string;
  destination?: string;
  levels?: PlaceLevel[];
  footprint?: { minX: number; maxX: number; minZ: number; maxZ: number };
  buildings?: PlaceBuilding[];
  scanSign?: { title?: string; button?: string; hint?: string };
  // The preference checkboxes (ids are node categories); maps without it keep the Lens's list.
  interests?: { id: string; label: string }[];
  // The preset phrase of the "Say it" stand-in for speech.
  sayIt?: string;
  events?: PlaceEvent[];
  arrivalRadius?: number;
  offRouteDistance?: number;
  rideReach?: number | { lift?: number; other?: number };
  // Trip time: walking speed per profile (m/s) and the seconds a floor change costs.
  speeds?: { walk?: number; stepFree?: number };
  rideTimes?: { lift?: number; escalator?: number; stairs?: number; ramp?: number };
}

export interface MapData {
  version: number;
  // Bumped when the bundled copy changes shape: an online copy with a lower number is stale.
  revision?: number;
  name?: string;
  units?: string;
  nodes: MapNode[];
  edges: MapEdge[];
  place?: MapPlace;
}

export type ParseResult = { ok: true; map: MapData } | { ok: false; error: string };

export interface Path {
  nodes: string[];
  edges: MapEdge[];
  length: number;
}

export type RouteResult =
  | ({ status: "route"; profile: Profile } & Path)
  | { status: "arrived"; profile: Profile; nodes: string[]; edges: MapEdge[]; length: 0 }
  | { status: "askStaff"; profile: Profile; message: string; assistance?: Path }
  | { status: "error"; profile: Profile; message: string };

export const EDGE_KINDS: EdgeKind[] = ["walk", "stairs", "escalator", "lift", "ramp"];

export const ASK_STAFF_MESSAGE = "No step-free route. Ask staff at the assistance point.";
export const NO_ROUTE_MESSAGE = "No route right now. Ask staff at the assistance point.";
export const SIGN_NOT_IN_MAP = "This sign isn't in the map";
export const MAP_LOAD_FAILED = "Map couldn't load";

// Default distances in metres from the brief's scenarios; a map's place block can override them.
export const ARRIVAL_RADIUS = 3;
export const OFF_ROUTE_DISTANCE = 5;
// How close (horizontally, on the same level) the traveller must be to ride a connection.
export const RIDE_REACH_LIFT = 2.5;
export const RIDE_REACH_OTHER = 3.5;
// Feet within this many metres of a level count as on it (a seated traveller, a crouch).
export const LEVEL_SNAP = 1;
// Feet this close to another level mean you are really on it (LevelTracker), not just sitting.
export const LEVEL_CLEAR = 0.25;
// Two heights closer than this are the same level.
export const SAME_LEVEL = 0.5;
export const MAP_VERSION = 1;
// Limits for a map file (a downloaded map is untrusted): coordinates within +-MAX_MAP_COORD
// metres, labels up to MAX_LABEL_LENGTH characters (they go on cards), and at most
// MAX_MAP_NODES nodes and MAX_MAP_EDGES edges (route work runs every frame on the glasses).
export const MAX_MAP_COORD = 100000;
export const MAX_LABEL_LENGTH = 80;
export const MAX_MAP_NODES = 2000;
export const MAX_MAP_EDGES = 5000;
export const MAX_MAP_BYTES = 256 * 1024;
export const MAX_OFFER_ITEMS = 3;
export const MAX_INTERESTS = 12;
export const MAX_LEVELS = 64;
export const MAX_BUILDINGS = 64;
// How much shorter than the straight line an edge may be (rounding in hand-made maps), metres.
export const EDGE_SLACK = 0.5;

// Trip time defaults: walking speed (m/s) per profile, and the seconds each floor change adds.
// Lifts and escalators are ridden, so their time replaces walking their length; stairs add
// their seconds per floor on top of walking them; ramps are just walked.
export const WALK_SPEED = 1.3;
export const STEP_FREE_SPEED = 1.0;
// A map's own arrival and off-route distances stay within these (m), so no file can make every
// frame a re-plan or every trip an instant arrival.
const ARRIVAL_LIMITS = { min: 0.5, max: 50 };
const OFF_ROUTE_LIMITS = { min: 1, max: 100 };
// Re-planning tries this many of the nearest nodes for one with a way through.
const START_CANDIDATES = 8;
export const RIDE_SECONDS = { lift: 45, escalator: 20, stairs: 15, ramp: 0 };
// How far ahead (metres) of a floor change its cue shows.
export const FLOOR_CUE_DISTANCE = 15;

export interface TripSettings {
  arrivalRadius: number;
  offRouteDistance: number;
  rideReach: { lift: number; other: number };
  speeds: { walk: number; stepFree: number };
  rideTimes: { lift: number; escalator: number; stairs: number; ramp: number };
}

function positive(v: unknown, fallback: number): number {
  return typeof v === "number" && v > 0 && isFinite(v) ? v : fallback;
}

function within(v: number, limits: { min: number; max: number }): number {
  return Math.max(limits.min, Math.min(limits.max, v));
}

function atLeastZero(v: unknown, fallback: number): number {
  return typeof v === "number" && v >= 0 && isFinite(v) ? v : fallback;
}

export function tripSettings(map: MapData): TripSettings {
  const p: MapPlace = map.place || {};
  const r = p.rideReach;
  const lift = typeof r === "number" ? r : r ? r.lift : undefined;
  const other = typeof r === "number" ? r : r ? r.other : undefined;
  const sp = p.speeds || {};
  const rt = p.rideTimes || {};
  return {
    arrivalRadius: within(typeof p.arrivalRadius === "number" && p.arrivalRadius > 0 ? p.arrivalRadius : ARRIVAL_RADIUS, ARRIVAL_LIMITS),
    offRouteDistance: within(typeof p.offRouteDistance === "number" && p.offRouteDistance > 0 ? p.offRouteDistance : OFF_ROUTE_DISTANCE, OFF_ROUTE_LIMITS),
    rideReach: { lift: positive(lift, RIDE_REACH_LIFT), other: positive(other, RIDE_REACH_OTHER) },
    speeds: { walk: positive(sp.walk, WALK_SPEED), stepFree: positive(sp.stepFree, STEP_FREE_SPEED) },
    rideTimes: {
      lift: atLeastZero(rt.lift, RIDE_SECONDS.lift),
      escalator: atLeastZero(rt.escalator, RIDE_SECONDS.escalator),
      stairs: atLeastZero(rt.stairs, RIDE_SECONDS.stairs),
      ramp: atLeastZero(rt.ramp, RIDE_SECONDS.ramp),
    },
  };
}

// The floor heights of a map: the place block's levels, or else every node height.
export function levelsOf(map: MapData): number[] {
  const out: number[] = [];
  const src = map.place && Array.isArray(map.place.levels) && map.place.levels.length > 0
    ? map.place.levels.map((l) => l.y)
    : map.nodes.map((n) => n.y);
  for (const y of src) if (out.every((o) => Math.abs(o - y) >= SAME_LEVEL)) out.push(y);
  return out.sort((a, b) => a - b);
}

// Feet height -> the level it is on when within LEVEL_SNAP of one; otherwise unchanged
// (halfway up a ramp or stairs).
export function snapToLevel(y: number, levels: number[]): number {
  let best = y;
  let bestD = LEVEL_SNAP;
  for (const l of levels) {
    const d = Math.abs(l - y);
    if (d <= bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

// Which floor you are on, frame by frame. Feet alone can't say: sitting down drops them most of a
// metre, which on floors a metre apart is nearer the floor below. So you stay on your level until
// your feet are within LEVEL_CLEAR of another one, or further than LEVEL_SNAP from any.
export class LevelTracker {
  private levels: number[];
  private level: number | null;

  constructor(levels: number[], startY: number) {
    this.levels = levels;
    this.level = null;
    this.snap(startY);
  }

  snap(y: number): number {
    const near = snapToLevel(y, this.levels);
    const onOne = this.levels.some((l) => Math.abs(l - y) <= LEVEL_SNAP);
    if (this.level !== null && Math.abs(y - this.level) <= LEVEL_SNAP && Math.abs(near - y) > LEVEL_CLEAR) return this.level;
    this.level = onOne ? near : null;
    return near;
  }
}

// Can the traveller ride from `node`? Same level and within `reach` metres horizontally.
export function withinReach(user: Vec3, node: Vec3, reach: number, levels: number[]): boolean {
  if (Math.abs(snapToLevel(user.y, levels) - node.y) > SAME_LEVEL) return false;
  const dx = user.x - node.x;
  const dz = user.z - node.z;
  return Math.sqrt(dx * dx + dz * dz) <= reach;
}

// The text to show for a route: the ask-staff / no-route / error message, or null for a route.
export function noticeFor(route: RouteResult): string | null {
  if (route.status === "askStaff" || route.status === "error") return route.message || NO_ROUTE_MESSAGE;
  return null;
}

const STEP_FREE_BLOCKED: EdgeKind[] = ["stairs", "escalator"];

export function edgeAllowed(edge: MapEdge, profile: Profile): boolean {
  if (!edge.open) return false;
  if (profile === "stepFree" && STEP_FREE_BLOCKED.indexOf(edge.kind) >= 0) return false;
  return true;
}

// Validates untrusted JSON text (downloaded or bundled) and returns a map or a readable error.
// Ids that would clash with object internals in plain lookups (the Lens's own tables).
const RESERVED_IDS = ["__proto__", "constructor", "prototype"];

// Names plain objects already have: fine as a node id (those tables have no prototype), but not as
// a key into the Lens's plain tables of icons and closures.
function objectName(v: unknown): boolean {
  return typeof v === "string" && v in {};
}

// A short text the Lens shows: absent, or a string of at most MAX_LABEL_LENGTH characters.
function badText(v: unknown): boolean {
  return v !== undefined && (typeof v !== "string" || v.length > MAX_LABEL_LENGTH);
}

// The reason a node's front or offer can't be used, or null.
function badFront(f: any): string | null {
  if (!f || typeof f !== "object" || Array.isArray(f)) return "a bad front (x1, z1, x2, z2)";
  for (const k of ["x1", "z1", "x2", "z2"]) {
    if (typeof f[k] !== "number" || !isFinite(f[k]) || Math.abs(f[k]) > MAX_MAP_COORD) return "a bad front " + k;
  }
  return f.x1 === f.x2 && f.z1 === f.z2 ? "a front of no length" : null;
}

function badOffer(o: any): string | null {
  if (!Array.isArray(o)) return "a bad offer (a list)";
  if (o.length > MAX_OFFER_ITEMS) return "an offer of more than " + MAX_OFFER_ITEMS + " items";
  for (const it of o) {
    if (!it || typeof it !== "object") return "a bad offer item";
    if (typeof it.text !== "string" || it.text === "" || badText(it.text)) return "an offer item with bad text";
    if (typeof it.price !== "string" || it.price === "" || badText(it.price)) return "an offer item with a bad price";
    if (badText(it.image)) return "an offer item with a bad image";
  }
  return null;
}

// Never throws: a value that can't even be turned into text is one more bad map.
export function parseMap(text: string): ParseResult {
  try {
    return checkMap(text);
  } catch (e) {
    return { ok: false, error: "map.json has a value that can't be read" };
  }
}

function checkMap(text: string): ParseResult {
  if (typeof text === "string" && text.length > MAX_MAP_BYTES) return { ok: false, error: "map.json is too big (over " + MAX_MAP_BYTES + " bytes)" };
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "map.json is not valid JSON" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "map.json must be an object" };
  if (badText(raw.name)) return { ok: false, error: "map name must be text up to " + MAX_LABEL_LENGTH + " characters" };
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) return { ok: false, error: "map.json has no nodes" };
  if (!Array.isArray(raw.edges)) return { ok: false, error: "map.json has no edges" };
  if (raw.nodes.length > MAX_MAP_NODES) return { ok: false, error: "map.json has more than " + MAX_MAP_NODES + " nodes" };
  if (raw.edges.length > MAX_MAP_EDGES) return { ok: false, error: "map.json has more than " + MAX_MAP_EDGES + " edges" };

  // Null-prototype table, so ids like "toString" or "constructor" are just ids.
  const ids: { [id: string]: boolean } = Object.create(null);
  for (const n of raw.nodes) {
    if (!n || typeof n.id !== "string" || n.id === "") return { ok: false, error: "a node is missing its id" };
    if (ids[n.id] === true) return { ok: false, error: "duplicate node id " + n.id };
    if (RESERVED_IDS.indexOf(n.id) >= 0) return { ok: false, error: "node id " + n.id + " is reserved" };
    for (const axis of ["x", "y", "z"]) {
      if (typeof n[axis] !== "number" || !isFinite(n[axis]) || Math.abs(n[axis]) > MAX_MAP_COORD) {
        return { ok: false, error: "node " + n.id + " has a bad " + axis };
      }
    }
    if (typeof n.kind !== "string") return { ok: false, error: "node " + n.id + " has no kind" };
    if (objectName(n.icon)) return { ok: false, error: "node " + n.id + " has a bad icon" };
    for (const key of ["id", "kind", "label", "arrivalCard", "sponsorTag", "category", "type", "code", "icon"]) {
      if (badText(n[key])) {
        return { ok: false, error: "node " + n.id.slice(0, MAX_LABEL_LENGTH) + " has a bad " + key + " (text up to " + MAX_LABEL_LENGTH + " characters)" };
      }
    }
    if (n.sponsored !== undefined && typeof n.sponsored !== "boolean") return { ok: false, error: "node " + n.id + " has a bad sponsored (true/false)" };
    const extra = (n.front !== undefined ? badFront(n.front) : null) || (n.offer !== undefined ? badOffer(n.offer) : null);
    if (extra) return { ok: false, error: "node " + n.id + " has " + extra };
    ids[n.id] = true;
  }
  for (const e of raw.edges) {
    if (!e || typeof e.from !== "string" || typeof e.to !== "string" || ids[e.from] !== true || ids[e.to] !== true) {
      return { ok: false, error: "edge " + (e && e.from) + " -> " + (e && e.to) + " points at an unknown node" };
    }
    if (EDGE_KINDS.indexOf(e.kind) < 0) return { ok: false, error: "edge " + e.from + " -> " + e.to + " has unknown kind " + e.kind };
    if (typeof e.length !== "number" || !(e.length > 0) || !isFinite(e.length)) {
      return { ok: false, error: "edge " + e.from + " -> " + e.to + " needs a positive length" };
    }
    if (typeof e.open !== "boolean") return { ok: false, error: "edge " + e.from + " -> " + e.to + " needs open true/false" };
    if (e.id !== undefined && (typeof e.id !== "string" || badText(e.id) || RESERVED_IDS.indexOf(e.id) >= 0 || objectName(e.id))) return { ok: false, error: "edge id " + e.id + " is reserved or not text" };
  }
  // Checked after the shape, so a broken file says what is broken first.
  if (raw.version !== MAP_VERSION) return { ok: false, error: "unsupported map version " + raw.version + " (expected " + MAP_VERSION + ")" };
  if (raw.revision !== undefined && !(typeof raw.revision === "number" && Math.floor(raw.revision) === raw.revision)) return { ok: false, error: "map revision must be a whole number" };
  const problem = validateMap(raw as MapData);
  if (problem) return { ok: false, error: problem };
  return { ok: true, map: raw as MapData };
}

// Cross-reference checks on a structurally valid map: every lift can be closed (has an id),
// and the place block's start, destination and events point at real nodes and edges.
// Returns the first problem, or null.
export function validateMap(map: MapData): string | null {
  const nodeKind: { [id: string]: string } = Object.create(null);
  const nodeAt: { [id: string]: MapNode } = Object.create(null);
  for (const n of map.nodes) {
    nodeKind[n.id] = n.kind;
    nodeAt[n.id] = n;
  }
  // No shortcuts: an edge is at least as long as the straight line between its nodes.
  for (const e of map.edges) {
    const a = nodeAt[e.from];
    const b = nodeAt[e.to];
    if (a && b && e.length < dist3(a, b) - EDGE_SLACK) return "edge " + e.from + " -> " + e.to + " is shorter than the straight line";
  }
  const edgeIds: { [id: string]: boolean } = Object.create(null);
  for (const e of map.edges) {
    if (e.kind === "lift" && (typeof e.id !== "string" || e.id === "")) return "lift edge " + e.from + " -> " + e.to + " needs an id";
    if (typeof e.id === "string") edgeIds[e.id] = true;
  }
  const p = map.place;
  if (p === undefined) return null;
  if (!p || typeof p !== "object") return "place must be an object";
  const isNode = (id: unknown) => typeof id === "string" && nodeKind[id] !== undefined;
  const isArea = (a: any) => !!a && typeof a === "object" && ["minX", "maxX", "minZ", "maxZ"].every((k) => typeof a[k] === "number" && isFinite(a[k]));
  if (badText(p.standInLabel)) return "place standInLabel must be text up to " + MAX_LABEL_LENGTH + " characters";
  if (p.footprint !== undefined && !isArea(p.footprint)) return "place footprint needs minX, maxX, minZ and maxZ";
  if (p.buildings !== undefined) {
    if (!Array.isArray(p.buildings) || p.buildings.length > MAX_BUILDINGS) return "place buildings must be a list of up to " + MAX_BUILDINGS;
    for (const b of p.buildings) {
      if (!isArea(b) || badText((b as any).name)) return "a place building needs an area and a short name";
      const ys = (b as any).levels;
      if (!Array.isArray(ys) || ys.length > MAX_LEVELS || !ys.every((y: unknown) => typeof y === "number" && isFinite(y))) return "a place building needs up to " + MAX_LEVELS + " levels";
    }
  }
  if (p.start !== undefined && (!isNode(p.start) || nodeKind[p.start as string] !== "sign")) return "place start " + p.start + " is not a sign node";
  if (p.destination !== undefined && !isNode(p.destination)) return "place destination " + p.destination + " is not a node";
  for (const key of ["arrivalRadius", "offRouteDistance"]) {
    const v = (p as any)[key];
    if (v !== undefined && !(typeof v === "number" && v > 0)) return "place " + key + " must be a positive number";
  }
  if (badText(p.title)) return "place title must be text up to " + MAX_LABEL_LENGTH + " characters";
  if (badText(p.sayIt)) return "place sayIt must be text up to " + MAX_LABEL_LENGTH + " characters";
  if (p.interests !== undefined) {
    if (!Array.isArray(p.interests) || p.interests.length > MAX_INTERESTS) return "place interests must be a list of up to " + MAX_INTERESTS;
    for (const i of p.interests) {
      if (!i || typeof i.id !== "string" || i.id === "" || typeof i.label !== "string" || i.label === "" || badText(i.id) || badText(i.label)) return "place interests need an id and a label";
    }
  }
  if (p.levels !== undefined && (!Array.isArray(p.levels) || p.levels.length > MAX_LEVELS)) return "place levels must be a list of up to " + MAX_LEVELS;
  for (const l of p.levels || []) {
    if (!l || typeof l.y !== "number" || !isFinite(l.y) || typeof l.name !== "string" || badText(l.name)) return "a place level needs a height and a name (text)";
  }
  if (p.scanSign !== undefined) {
    if (!p.scanSign || typeof p.scanSign !== "object") return "place scanSign must be an object";
    for (const k of ["title", "button", "hint"]) if (badText((p.scanSign as any)[k])) return "place scanSign " + k + " must be short text";
  }
  if (p.events !== undefined && !Array.isArray(p.events)) return "place events must be a list";
  for (const ev of p.events || []) {
    const name = "event " + (ev && ev.id);
    if (!ev || typeof ev.id !== "string" || badText(ev.id)) return "an event is missing its id";
    for (const k of ["button", "sign", "card"]) if (badText((ev as any)[k])) return name + " " + k + " must be short text";
    if (ev.type === "destinationChanged") {
      if (!isNode(ev.to)) return name + " changes to unknown node " + ev.to;
    } else if (ev.type === "connectionClosed") {
      if (typeof ev.edge !== "string" || edgeIds[ev.edge] !== true) return name + " closes unknown edge " + ev.edge;
      if (!isNode(ev.at)) return name + " hangs its sign at unknown node " + ev.at;
    } else {
      return name + " has unknown type " + ev.type;
    }
  }
  return null;
}

export function findNode(map: MapData, id: string): MapNode | undefined {
  for (const n of map.nodes) if (n.id === id) return n;
  return undefined;
}

// Returns a copy of the map with the edge(s) carrying this id opened or closed,
// e.g. setEdgeOpen(map, "lift1", false) when the user pinches the lift's red sign.
export function setEdgeOpen(map: MapData, edgeId: string, open: boolean): MapData {
  return {
    ...map,
    edges: map.edges.map((e) => (e.id === edgeId ? { ...e, open } : e)),
  };
}

interface Step {
  to: string;
  edge: MapEdge;
}

function neighbours(map: MapData, profile: Profile): { [id: string]: Step[] } {
  const adj: { [id: string]: Step[] } = Object.create(null);
  for (const n of map.nodes) adj[n.id] = [];
  for (const e of map.edges) {
    if (!edgeAllowed(e, profile)) continue;
    adj[e.from].push({ to: e.to, edge: e });
    if (e.kind !== "escalator") adj[e.to].push({ to: e.from, edge: e });
  }
  return adj;
}

interface Tree {
  dist: { [id: string]: number };
  prev: { [id: string]: Step & { from: string } };
}

// Dijkstra over edge length. Both profiles minimise distance; Step-Free just
// never sees stairs or escalators. The graph is small, so a linear scan for the
// closest unvisited node is plenty.
function shortestTree(map: MapData, from: string, profile: Profile): Tree {
  const adj = neighbours(map, profile);
  const dist: { [id: string]: number } = Object.create(null);
  const prev: { [id: string]: Step & { from: string } } = Object.create(null);
  const done: { [id: string]: boolean } = Object.create(null);
  for (const n of map.nodes) dist[n.id] = Infinity;
  dist[from] = 0;

  for (;;) {
    let current: string | null = null;
    for (const n of map.nodes) {
      if (!done[n.id] && dist[n.id] < Infinity && (current === null || dist[n.id] < dist[current])) current = n.id;
    }
    if (current === null) break;
    done[current] = true;
    for (const step of adj[current]) {
      const d = dist[current] + step.edge.length;
      if (d < dist[step.to]) {
        dist[step.to] = d;
        prev[step.to] = { from: current, to: step.to, edge: step.edge };
      }
    }
  }
  return { dist, prev };
}

function pathTo(tree: Tree, from: string, to: string): Path {
  const nodes: string[] = [to];
  const edges: MapEdge[] = [];
  let at = to;
  while (at !== from) {
    const p = tree.prev[at];
    edges.unshift(p.edge);
    at = p.from;
    nodes.unshift(at);
  }
  return { nodes, edges, length: Math.round(tree.dist[to] * 1000) / 1000 };
}

export function findRoute(map: MapData, from: string, to: string, profile: Profile): RouteResult {
  if (!findNode(map, from)) return { status: "error", profile, message: "unknown start " + from };
  if (!findNode(map, to)) return { status: "error", profile, message: "unknown destination " + to };
  if (from === to) return { status: "arrived", profile, nodes: [from], edges: [], length: 0 };

  const tree = shortestTree(map, from, profile);
  if (tree.dist[to] < Infinity) return { status: "route", profile, ...pathTo(tree, from, to) };

  // No way through: point the traveller at the nearest assistance point they can reach.
  let help: string | null = null;
  for (const n of map.nodes) {
    if (n.kind === "assistance" && tree.dist[n.id] < Infinity && (help === null || tree.dist[n.id] < tree.dist[help])) help = n.id;
  }
  const message = profile === "stepFree" ? ASK_STAFF_MESSAGE : NO_ROUTE_MESSAGE;
  if (help === null) return { status: "askStaff", profile, message };
  return { status: "askStaff", profile, message, assistance: pathTo(tree, from, help) };
}

// The sign's code tells us where the traveller is standing.
export function locateSign(map: MapData, signId: string): { ok: true; node: MapNode } | { ok: false; message: string } {
  const node = findNode(map, signId);
  if (!node || node.kind !== "sign") return { ok: false, message: SIGN_NOT_IN_MAP };
  return { ok: true, node };
}

export type MapSource = "online" | "offline";

// Picks the map to use: the downloaded copy if it arrived and is valid,
// otherwise the copy shipped in the Lens. `downloaded` is null when the
// download failed or timed out.
// error: why a download was rejected (for the log), or null.
export function chooseMap(downloaded: string | null, builtIn: string): { map: MapData; source: MapSource; notice: string | null; error: string | null } {
  let error: string | null = null;
  if (downloaded !== null) {
    const parsed = parseMap(downloaded);
    if (parsed.ok) {
      const shipped = parseMap(builtIn);
      // A stale online copy (older revision) never replaces a newer map shipped in the Lens.
      if (!shipped.ok || (parsed.map.revision || 0) >= (shipped.map.revision || 0)) return { map: parsed.map, source: "online", notice: null, error: null };
      return { map: shipped.map, source: "offline", notice: null, error: "online map is older than the built-in one" };
    }
    error = (parsed as { ok: false; error: string }).error;
  }
  const fallback = parseMap(builtIn);
  // Explicit cast: Lens Studio's compiler (no strictNullChecks) can't narrow this union.
  if (!fallback.ok) throw new Error("built-in map is broken: " + (fallback as { ok: false; error: string }).error);
  return { map: fallback.map, source: "offline", notice: downloaded === null ? null : MAP_LOAD_FAILED, error };
}

export const DOWNLOAD_TIMEOUT_MS = 5000;

// Maps come over https, or from this computer (npm run maps).
const TRUSTED_URL = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))/i;

// Text from a download on its way to the log: one short line, and never a map block marker,
// because map:publish trusts blocks it finds in the log.
export function logSafe(text: string): string {
  return String(text).replace(/[\u0000-\u001f\u007f]+/g, " ").split("[FYW-MAP").join("[map").slice(0, 200);
}

// Where a map is downloaded from: the map server base folder + the map file name, e.g.
// http://localhost:8787/ + map.json (npm run maps). An empty base means no download.
export function mapDownloadUrl(baseUrl: string, file: string): string {
  const base = (baseUrl || "").trim();
  if (!base || !file || !TRUSTED_URL.test(base)) return "";
  return (base.endsWith("/") ? base : base + "/") + file;
}

// `fetchText` is whatever the platform provides (the Lens wraps InternetModule;
// tests pass a fake). It should resolve with the body text or reject. Anything
// slower than `timeoutMs`, a rejection, or an invalid body falls back to the
// built-in map, so the route always works.
export function loadMapWithTimeout(
  fetchText: (url: string) => Promise<string>,
  url: string,
  builtIn: string,
  timeoutMs: number = DOWNLOAD_TIMEOUT_MS,
): Promise<{ map: MapData; source: MapSource; notice: string | null; error: string | null }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (downloaded: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        resolve(chooseMap(downloaded, builtIn));
      } catch (e) {
        reject(e);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    let request: Promise<string>;
    try {
      request = fetchText(url);
    } catch (e) {
      finish(null);
      return;
    }
    Promise.resolve(request).then(
      (text) => finish(typeof text === "string" ? text : null),
      () => finish(null),
    );
  });
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function routePoints(map: MapData, route: RouteResult): Vec3[] {
  if (route.status !== "route" && route.status !== "arrived") return [];
  return route.nodes.map((id) => {
    const n = findNode(map, id) as MapNode;
    return { x: n.x, y: n.y, z: n.z };
  });
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// The part of the floor line to draw: from the point on the route closest to
// the user, forward along the route for at most `ahead` metres (the line fades
// out at its end). Returns at least two points unless the route is empty.
export function lineAhead(points: Vec3[], user: Vec3, ahead: number = 10): Vec3[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  let bestSeg = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    let t = len2 === 0 ? 0 : ((user.x - a.x) * (b.x - a.x) + (user.y - a.y) * (b.y - a.y) + (user.z - a.z) * (b.z - a.z)) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = dist3(user, lerp(a, b, t));
    if (d < bestD) {
      bestD = d;
      bestSeg = i;
      bestT = t;
    }
  }

  const out: Vec3[] = [lerp(points[bestSeg], points[bestSeg + 1], bestT)];
  let left = ahead;
  for (let i = bestSeg; i < points.length - 1 && left > 0; i++) {
    const start = out[out.length - 1];
    const end = points[i + 1];
    const d = dist3(start, end);
    if (d <= left) {
      out.push(end);
      left -= d;
    } else {
      out.push(lerp(start, end, left / d));
      left = 0;
    }
  }
  if (out.length === 1) out.push(out[0]);
  return out;
}

// Each metre of height difference counts as this many metres of floor distance, so the
// nearest node is on the traveller's own level (standing under a mezzanine never snaps
// to the node overhead).
export const LEVEL_PENALTY = 5;

export function levelDistance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz) + LEVEL_PENALTY * Math.abs(a.y - b.y);
}

export function nearestNode(map: MapData, pos: Vec3): MapNode {
  let best = map.nodes[0];
  let bestD = Infinity;
  for (const n of map.nodes) {
    const d = levelDistance(n, pos);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

// How far from the line, with height counting as in levelDistance: walking the floor above the
// route is being off it, however close the line is straight down.
export function distanceToLine(points: Vec3[], pos: Vec3): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return levelDistance(points[0], pos);
  const clipped = lineAhead(points, pos, 0);
  return levelDistance(clipped[0], pos);
}

export type Progress = "onRoute" | "rerouted" | "arrived";

// What a route looks like for change detection: status, nodes and the connections used
// (stairs vs ramp between the same two nodes is a change), or the assistance path.
function routeSignature(r: RouteResult): string {
  if (r.status === "route" || r.status === "arrived") {
    return r.status + ":" + r.nodes.join(">") + "|" + r.edges.map((e) => e.kind + (e.id ? "#" + e.id : "")).join(",");
  }
  if (r.status === "askStaff") {
    const a = r.assistance;
    return "askStaff:" + r.message + (a ? ":" + a.nodes.join(">") + "|" + a.edges.map((e) => e.kind).join(",") : "");
  }
  return "error:" + r.message;
}

// One floor change on a route, in the direction it is travelled.
export interface LevelChange {
  edge: MapEdge;
  from: string;
  to: string;
  up: boolean;
  floors: number; // levels crossed (1 for a single floor)
}

export interface TripAhead {
  metres: number; // left to walk or ride, along the route
  seconds: number; // at the profile's speed plus the floor-change times
  floorY: number; // height of the floor the traveller is on (for the floor badge)
  floors: number; // destination's floor minus the traveller's, counting levels (+ = up)
  changes: LevelChange[]; // floor changes still ahead, in order
  next: { change: LevelChange; metres: number } | null; // the next one and the distance to its start
}

// Storey number of the level closest to height y: the map level's "floor", else its order by
// height (levels holds the heights in order, from levelsOf).
function storeyOf(map: MapData, levels: number[], y: number): number {
  let best = 0;
  for (let i = 1; i < levels.length; i++) if (Math.abs(levels[i] - y) < Math.abs(levels[best] - y)) best = i;
  const named = map.place && Array.isArray(map.place.levels) ? map.place.levels : [];
  for (const l of named) {
    if (Math.abs(l.y - levels[best]) < SAME_LEVEL && typeof l.floor === "number" && isFinite(l.floor)) return l.floor;
  }
  return best;
}

// What is left of a route from where the traveller stands: distance, time and the floor
// changes still ahead (for the distance pill, the floor badge and the cue before a change).
// The traveller is placed on the closest route segment, measured on their own level first.
// A level change counts as ahead until they are past its middle. Null when there is no route.
export function tripAhead(map: MapData, route: RouteResult, user: Vec3): TripAhead | null {
  if (route.status !== "route" && route.status !== "arrived") return null;
  const settings = tripSettings(map);
  const levels = levelsOf(map);
  const pts = routePoints(map, route);
  const here = { x: user.x, y: snapToLevel(user.y, levels), z: user.z };
  const dest = pts[pts.length - 1];
  if (route.edges.length === 0) {
    return { metres: 0, seconds: 0, floorY: dest.y, floors: 0, changes: [], next: null };
  }

  let seg = 0;
  let segT = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    // On a slope your real height says how far up you are; snapped to the floor it would jump ahead.
    const p = Math.abs(b.y - a.y) >= SAME_LEVEL ? user : here;
    let t = len2 === 0 ? 0 : ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y) + (p.z - a.z) * (b.z - a.z)) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = levelDistance(p, lerp(a, b, t));
    if (d < bestD - 1e-9) {
      bestD = d;
      seg = i;
      segT = t;
    }
  }

  // The floor comes from the route, not the feet height (levels can be 1 m apart): on a level
  // change the traveller is still on the floor they left until past its middle.
  const floorY = segT < 0.5 ? pts[seg].y : pts[seg + 1].y;
  const floors = storeyOf(map, levels, dest.y) - storeyOf(map, levels, floorY);
  const speed = route.profile === "stepFree" ? settings.speeds.stepFree : settings.speeds.walk;
  let metres = 0;
  let seconds = 0;
  let next: { change: LevelChange; metres: number } | null = null;
  const changes: LevelChange[] = [];
  for (let i = seg; i < route.edges.length; i++) {
    const e = route.edges[i];
    const part = i === seg ? 1 - segT : 1;
    const a = pts[i];
    const b = pts[i + 1];
    const crossed = Math.abs(storeyOf(map, levels, b.y) - storeyOf(map, levels, a.y));
    const ridden = e.kind === "lift" || e.kind === "escalator";
    if (Math.abs(b.y - a.y) >= SAME_LEVEL && (i > seg || segT < 0.5)) {
      const change: LevelChange = { edge: e, from: route.nodes[i], to: route.nodes[i + 1], up: b.y > a.y, floors: Math.max(1, crossed) };
      changes.push(change);
      if (!next) next = { change, metres: i === seg ? 0 : metres };
    }
    if (e.kind !== "walk") {
      const extra = settings.rideTimes[e.kind as "lift" | "escalator" | "stairs" | "ramp"];
      seconds += part * extra * (e.kind === "stairs" ? Math.max(1, crossed) : 1);
    }
    if (!ridden) seconds += (part * e.length) / speed;
    metres += part * e.length;
  }
  return { metres, seconds, floorY, floors, changes, next };
}

// Holds the traveller's current choices and re-routes whenever one changes: a destination
// change, a profile switch, a connection closing, or walking off the line. Once a position
// is known, re-routes start from the node nearest to it. Distances come from tripSettings.
export class Navigator {
  map: MapData;
  from: string;
  to: string;
  profile: Profile;
  route: RouteResult;
  position: Vec3 | null = null;
  settings: TripSettings;
  levels: number[];
  private floor: LevelTracker;

  constructor(map: MapData, from: string, to: string, profile: Profile) {
    this.map = map;
    this.from = from;
    this.to = to;
    this.profile = profile;
    this.settings = tripSettings(map);
    this.levels = levelsOf(map);
    const start = findNode(map, from);
    this.floor = new LevelTracker(this.levels, start ? start.y : 0);
    this.route = findRoute(map, from, to, profile);
  }

  // Where the traveller's feet put them on this map's floors.
  snapFeet(y: number): number {
    return this.floor.snap(y);
  }

  private arrivedAt(id: string): RouteResult {
    return { status: "arrived", profile: this.profile, nodes: [id], edges: [], length: 0 };
  }

  // On the target's level and within the arrival radius of it (horizontally).
  private isAt(id: string, pos: Vec3): boolean {
    const n = findNode(this.map, id);
    return !!n && withinReach(pos, n, this.settings.arrivalRadius, this.levels);
  }

  // The node to plan from: the nearest on your floor with a way through, but never the destination itself (the
  // traveller is not at it, or they would have arrived), so walking away from it gives a way back.
  // With no way through from any close node, the nearest.
  private startNode(pos: Vec3): string {
    const near = this.map.nodes
      .filter((n) => n.id !== this.to)
      .map((n) => ({ id: n.id, d: levelDistance(n, pos) }))
      .sort((a, b) => a.d - b.d);
    if (near.length === 0) return this.to;
    const here = near.filter((n) => Math.abs((findNode(this.map, n.id) as MapNode).y - pos.y) < SAME_LEVEL);
    for (const n of here.slice(0, START_CANDIDATES)) {
      if (findRoute(this.map, n.id, this.to, this.profile).status === "route") return n.id;
    }
    return near[0].id;
  }

  private recompute(): boolean {
    const before = routeSignature(this.route);
    if (this.position && this.isAt(this.to, this.position)) {
      this.from = this.to;
      this.route = this.arrivedAt(this.to);
    } else {
      if (this.position) this.from = this.startNode(this.position);
      this.route = findRoute(this.map, this.from, this.to, this.profile);
    }
    return before !== routeSignature(this.route);
  }

  setDestination(id: string): boolean {
    this.to = id;
    return this.recompute();
  }

  setProfile(profile: Profile): boolean {
    this.profile = profile;
    return this.recompute();
  }

  setEdgeOpen(edgeId: string, open: boolean): boolean {
    this.map = setEdgeOpen(this.map, edgeId, open);
    return this.recompute();
  }

  // Call as the traveller moves (feet position, map metres). Within the arrival radius of the
  // destination on its level the route becomes "arrived" (the line stops); further than the
  // off-route distance from the line (or from where they arrived) it re-plans from the
  // nearest node. With no way through ("askStaff") the assistance path is tracked the same
  // way, and reaching the assistance point counts as arrival. "rerouted" is only reported
  // when the plan actually changes, so standing still never re-triggers it.
  updatePosition(feet: Vec3): Progress {
    const pos = { x: feet.x, y: this.snapFeet(feet.y), z: feet.z };
    this.position = pos;
    const off = this.settings.offRouteDistance;
    if (this.isAt(this.to, pos)) {
      this.from = this.to;
      this.route = this.arrivedAt(this.to);
      return "arrived";
    }
    const r = this.route;
    if (r.status === "arrived") {
      const at = findNode(this.map, r.nodes[0]);
      if (at && distanceToLine([at], pos) <= off) return "arrived";
      return this.recompute() ? "rerouted" : "onRoute";
    }
    if (r.status === "askStaff" && r.assistance) {
      const help = r.assistance.nodes[r.assistance.nodes.length - 1];
      if (this.isAt(help, pos)) {
        this.from = help;
        this.route = this.arrivedAt(help);
        return "arrived";
      }
      const pts = r.assistance.nodes.map((id) => findNode(this.map, id) as MapNode);
      if (distanceToLine(pts, pos) > off) return this.recompute() ? "rerouted" : "onRoute";
      return "onRoute";
    }
    if (r.status === "askStaff") {
      const at = findNode(this.map, this.from);
      if (at && distanceToLine([at], pos) > off) return this.recompute() ? "rerouted" : "onRoute";
      return "onRoute";
    }
    if (r.status === "route" && distanceToLine(routePoints(this.map, r), pos) > off) {
      return this.recompute() ? "rerouted" : "onRoute";
    }
    return "onRoute";
  }
}
