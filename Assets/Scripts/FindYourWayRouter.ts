// Route engine for "Find Your Way Inside". Plain TypeScript, no Lens Studio APIs,
// so it runs under Node for tests and can be copied into Assets/ for the Lens.
//
// Map conventions: positions in metres, y up. Edges are two-way except
// escalators, which only run from -> to.

export type EdgeKind = "walk" | "stairs" | "escalator" | "lift" | "ramp";
export type Profile = "walk" | "stepFree";

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
  events?: PlaceEvent[];
  arrivalRadius?: number;
  offRouteDistance?: number;
  rideReach?: number | { lift?: number; other?: number };
}

export interface MapData {
  version: number;
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
// Two heights closer than this are the same level.
export const SAME_LEVEL = 0.5;
export const MAP_VERSION = 1;

export interface TripSettings {
  arrivalRadius: number;
  offRouteDistance: number;
  rideReach: { lift: number; other: number };
}

function positive(v: unknown, fallback: number): number {
  return typeof v === "number" && v > 0 && isFinite(v) ? v : fallback;
}

export function tripSettings(map: MapData): TripSettings {
  const p: MapPlace = map.place || {};
  const r = p.rideReach;
  const lift = typeof r === "number" ? r : r ? r.lift : undefined;
  const other = typeof r === "number" ? r : r ? r.other : undefined;
  return {
    arrivalRadius: positive(p.arrivalRadius, ARRIVAL_RADIUS),
    offRouteDistance: positive(p.offRouteDistance, OFF_ROUTE_DISTANCE),
    rideReach: { lift: positive(lift, RIDE_REACH_LIFT), other: positive(other, RIDE_REACH_OTHER) },
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
export function parseMap(text: string): ParseResult {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "map.json is not valid JSON" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "map.json must be an object" };
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) return { ok: false, error: "map.json has no nodes" };
  if (!Array.isArray(raw.edges)) return { ok: false, error: "map.json has no edges" };

  // Null-prototype table, so ids like "toString" or "constructor" are just ids.
  const ids: { [id: string]: boolean } = Object.create(null);
  for (const n of raw.nodes) {
    if (!n || typeof n.id !== "string" || n.id === "") return { ok: false, error: "a node is missing its id" };
    if (ids[n.id] === true) return { ok: false, error: "duplicate node id " + n.id };
    for (const axis of ["x", "y", "z"]) {
      if (typeof n[axis] !== "number" || !isFinite(n[axis])) {
        return { ok: false, error: "node " + n.id + " has a bad " + axis };
      }
    }
    if (typeof n.kind !== "string") return { ok: false, error: "node " + n.id + " has no kind" };
    ids[n.id] = true;
  }
  for (const e of raw.edges) {
    if (!e || ids[e.from] !== true || ids[e.to] !== true) {
      return { ok: false, error: "edge " + (e && e.from) + " -> " + (e && e.to) + " points at an unknown node" };
    }
    if (EDGE_KINDS.indexOf(e.kind) < 0) return { ok: false, error: "edge " + e.from + " -> " + e.to + " has unknown kind " + e.kind };
    if (typeof e.length !== "number" || !(e.length > 0)) {
      return { ok: false, error: "edge " + e.from + " -> " + e.to + " needs a positive length" };
    }
    if (typeof e.open !== "boolean") return { ok: false, error: "edge " + e.from + " -> " + e.to + " needs open true/false" };
  }
  // Checked after the shape, so a broken file says what is broken first.
  if (raw.version !== MAP_VERSION) return { ok: false, error: "unsupported map version " + raw.version + " (expected " + MAP_VERSION + ")" };
  const problem = validateMap(raw as MapData);
  if (problem) return { ok: false, error: problem };
  return { ok: true, map: raw as MapData };
}

// Cross-reference checks on a structurally valid map: every lift can be closed (has an id),
// and the place block's start, destination and events point at real nodes and edges.
// Returns the first problem, or null.
export function validateMap(map: MapData): string | null {
  const nodeKind: { [id: string]: string } = Object.create(null);
  for (const n of map.nodes) nodeKind[n.id] = n.kind;
  const edgeIds: { [id: string]: boolean } = Object.create(null);
  for (const e of map.edges) {
    if (e.kind === "lift" && (typeof e.id !== "string" || e.id === "")) return "lift edge " + e.from + " -> " + e.to + " needs an id";
    if (typeof e.id === "string") edgeIds[e.id] = true;
  }
  const p = map.place;
  if (p === undefined) return null;
  if (!p || typeof p !== "object") return "place must be an object";
  const isNode = (id: unknown) => typeof id === "string" && nodeKind[id] !== undefined;
  if (p.start !== undefined && (!isNode(p.start) || nodeKind[p.start as string] !== "sign")) return "place start " + p.start + " is not a sign node";
  if (p.destination !== undefined && !isNode(p.destination)) return "place destination " + p.destination + " is not a node";
  for (const key of ["arrivalRadius", "offRouteDistance"]) {
    const v = (p as any)[key];
    if (v !== undefined && !(typeof v === "number" && v > 0)) return "place " + key + " must be a positive number";
  }
  if (p.events !== undefined && !Array.isArray(p.events)) return "place events must be a list";
  for (const ev of p.events || []) {
    const name = "event " + (ev && ev.id);
    if (!ev || typeof ev.id !== "string") return "an event is missing its id";
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
export function chooseMap(downloaded: string | null, builtIn: string): { map: MapData; source: MapSource; notice: string | null } {
  if (downloaded !== null) {
    const parsed = parseMap(downloaded);
    if (parsed.ok) return { map: parsed.map, source: "online", notice: null };
  }
  const fallback = parseMap(builtIn);
  // Explicit cast: Lens Studio's compiler (no strictNullChecks) can't narrow this union.
  if (!fallback.ok) throw new Error("built-in map is broken: " + (fallback as { ok: false; error: string }).error);
  return { map: fallback.map, source: "offline", notice: downloaded === null ? null : MAP_LOAD_FAILED };
}

export const DOWNLOAD_TIMEOUT_MS = 5000;

// Where a map is downloaded from: the map server base folder + the map file name, e.g.
// http://localhost:8787/ + map.json (npm run maps). An empty base means no download.
export function mapDownloadUrl(baseUrl: string, file: string): string {
  const base = (baseUrl || "").trim();
  if (!base) return "";
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
): Promise<{ map: MapData; source: MapSource; notice: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (downloaded: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(chooseMap(downloaded, builtIn));
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    let request: Promise<string>;
    try {
      request = fetchText(url);
    } catch (e) {
      finish(null);
      return;
    }
    request.then(
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

export function distanceToLine(points: Vec3[], pos: Vec3): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return dist3(points[0], pos);
  const clipped = lineAhead(points, pos, 0);
  return dist3(clipped[0], pos);
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

  constructor(map: MapData, from: string, to: string, profile: Profile) {
    this.map = map;
    this.from = from;
    this.to = to;
    this.profile = profile;
    this.settings = tripSettings(map);
    this.levels = levelsOf(map);
    this.route = findRoute(map, from, to, profile);
  }

  private arrivedAt(id: string): RouteResult {
    return { status: "arrived", profile: this.profile, nodes: [id], edges: [], length: 0 };
  }

  // On the target's level and within the arrival radius of it (horizontally).
  private isAt(id: string, pos: Vec3): boolean {
    const n = findNode(this.map, id);
    return !!n && withinReach(pos, n, this.settings.arrivalRadius, this.levels);
  }

  // The node to plan from: the nearest one, but never the destination itself (the traveller
  // is not at it, or they would have arrived), so walking away from it gives a way back.
  private startNode(pos: Vec3): string {
    let best: string | null = null;
    let bestD = Infinity;
    for (const n of this.map.nodes) {
      if (n.id === this.to) continue;
      const d = levelDistance(n, pos);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best === null ? this.to : best;
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
    const pos = { x: feet.x, y: snapToLevel(feet.y, this.levels), z: feet.z };
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
    if (r.status === "route" && distanceToLine(routePoints(this.map, r), pos) > off) {
      return this.recompute() ? "rerouted" : "onRoute";
    }
    return "onRoute";
  }
}
