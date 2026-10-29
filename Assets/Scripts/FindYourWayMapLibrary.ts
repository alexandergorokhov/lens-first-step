// FindYourWayMapLibrary — the bundled maps and everything building-specific that the Lens
// reads from a map file: place info (start, destination, levels, sign texts, demo events),
// destination labels/cards, and the map-metres <-> building-local-cm frame.
// Plain module: no scene access. The router itself is FindYourWayRouter.ts (a verbatim copy
// of src/core/router.ts). Must not: contain any building-specific literal.

import {findNode, MapData, MapEdge, MapNode, Vec3} from "./FindYourWayRouter"
import {localCmToMap, mapToLocalCm} from "./FindYourWayGeometry"

export interface MapSource {
  key: string
  asset: JsonAsset
  // Where the real Lens would download this building's map from (empty = built-in only).
  url: string
}

// Bundled maps. Swapping buildings = adding a JSON file here; no code change elsewhere.
export const MAP_SOURCES: MapSource[] = [
  {
    key: "airport",
    asset: requireAsset("../Maps/airport.json") as JsonAsset,
    url: "https://raw.githubusercontent.com/alexandergorokhov/find-your-way-inside/main/src/core/data/map.json",
  },
  {key: "hospital", asset: requireAsset("../Maps/hospital.json") as JsonAsset, url: ""},
  {key: "campus", asset: requireAsset("../Maps/campus.json") as JsonAsset, url: ""},
  {key: "room", asset: requireAsset("../Maps/room.json") as JsonAsset, url: ""},
]

export interface PlaceLevel { y: number; name: string }
// Optional building footprints (campus-style maps with outdoor ground between buildings).
export interface PlaceBuilding { name: string; minX: number; maxX: number; minZ: number; maxZ: number; levels: number[] }
export interface PlaceEvent {
  id: string
  type: string // "destinationChanged" | "connectionClosed"
  to?: string
  edge?: string
  at?: string
  button?: string
  sign?: string
  card?: string
}
export interface PlaceInfo {
  title: string
  standInLabel: string
  standInModel: boolean
  start: string
  destination: string
  levels: PlaceLevel[]
  footprint: {minX: number; maxX: number; minZ: number; maxZ: number} | null
  buildings: PlaceBuilding[]
  scanSign: {title: string; button: string; hint: string}
  events: PlaceEvent[]
}

export function isDestination(n: MapNode): boolean {
  return n.kind === "destination" || n.kind === "gate"
}

export function placeOf(map: MapData): PlaceInfo {
  const raw: any = (map as any).place || {}
  let start = raw.start
  let dest = raw.destination
  if (!start) for (const n of map.nodes) if (n.kind === "sign") { start = n.id; break }
  if (!dest) for (const n of map.nodes) if (isDestination(n)) { dest = n.id; break }
  const sign = raw.scanSign || {}
  return {
    title: raw.title || map.name || "Map",
    standInLabel: raw.standInLabel || "Stand-in building",
    standInModel: raw.standInModel !== false,
    start: start,
    destination: dest,
    levels: Array.isArray(raw.levels) ? raw.levels : [{y: 0, name: "Ground"}],
    footprint: raw.footprint || null,
    buildings: Array.isArray(raw.buildings) ? raw.buildings : [],
    scanSign: {
      title: sign.title || "You are here",
      button: sign.button || "Scan sign",
      hint: sign.hint || "on real Specs: look at the sign",
    },
    events: Array.isArray(raw.events) ? raw.events : [],
  }
}

export function levelName(place: PlaceInfo, y: number): string {
  let best = place.levels[0]
  for (const l of place.levels) if (Math.abs(l.y - y) < Math.abs(best.y - y)) best = l
  return best ? best.name : "level " + y
}

export function nodeLabel(map: MapData, id: string): string {
  const n = findNode(map, id)
  return n && n.label ? n.label : id
}

export function arrivalText(map: MapData, id: string): string {
  const n: any = findNode(map, id)
  if (n && n.arrivalCard) return n.arrivalCard
  return nodeLabel(map, id)
}

export function edgeById(map: MapData, edgeId: string): MapEdge | undefined {
  for (const e of map.edges) if (e.id === edgeId) return e
  return undefined
}

// Lift edges touching a node (for the floor buttons).
export function liftEdgesAt(map: MapData, nodeId: string): MapEdge[] {
  return map.edges.filter((e) => e.kind === "lift" && (e.from === nodeId || e.to === nodeId))
}

// Unit direction (map x/z) from a node toward the corridor it is entered from: its first
// neighbour on the same level joined by a non-lift edge. Used to open lift shafts toward the
// approach and to put the door sign and floor button where the traveller arrives.
export function approachDir(map: MapData, nodeId: string): {x: number; z: number} {
  const n = findNode(map, nodeId)
  if (n) {
    for (const e of map.edges) {
      if (e.kind === "lift") continue
      const otherId = e.from === nodeId ? e.to : e.to === nodeId ? e.from : null
      if (!otherId) continue
      const o = findNode(map, otherId)
      if (!o || Math.abs(o.y - n.y) > 0.5) continue
      const dx = o.x - n.x, dz = o.z - n.z
      const l = Math.sqrt(dx * dx + dz * dz)
      if (l > 0.01) return {x: dx / l, z: dz / l}
    }
  }
  return {x: 0, z: -1}
}

// Map metres (x east, y up, z north) -> building-local cm, with the start sign at the origin
// and north pointing along -Z (straight ahead of the user at the sign).
export class MapFrame {
  constructor(private originX: number, private originZ: number) {}

  static forMap(map: MapData, startId: string): MapFrame {
    const s = findNode(map, startId)
    return new MapFrame(s ? s.x : 0, s ? s.z : 0)
  }

  toLocal(p: Vec3, liftCm: number = 0): vec3 {
    const l = mapToLocalCm(p, this.originX, this.originZ, liftCm)
    return new vec3(l.x, l.y, l.z)
  }

  toMap(local: vec3, eyeHeightCm: number): Vec3 {
    return localCmToMap({x: local.x, y: local.y, z: local.z}, this.originX, this.originZ, eyeHeightCm)
  }
}
