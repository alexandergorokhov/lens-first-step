// FindYourWayMapLibrary — the bundled maps and the Lens-side map frame.
// The place logic (start, destination, levels, sign texts, demo events, labels, arrival cards,
// approach directions, closure and ride card texts) is FindYourWayPlace.ts, a byte-identical
// copy of src/core/place.ts tested under Node; it is re-exported here so scripts have one import.
// The router is FindYourWayRouter.ts (a copy of src/core/router.ts).
// Plain module: no scene access. Must not: contain any building-specific literal.
// The list of maps matches src/core/data/index.json (checked by src/core/tests/sync.test.ts);
// requireAsset needs literal paths, so it cannot be read from the index at runtime.

import {findNode, mapDownloadUrl, MapData, Vec3} from "./FindYourWayRouter"
import {localCmToMap, mapToLocalCm, XYZ} from "./FindYourWayGeometry"

export {
  approachDir,
  arrivalText,
  closureNotice,
  isDestination,
  levelName,
  nodeLabel,
  placeOf,
  rideCard,
} from "./FindYourWayPlace"
export type {PlaceBuilding, PlaceEvent, PlaceInfo, PlaceLevel} from "./FindYourWayPlace"

export interface MapSource {
  key: string
  // Built-in copy shipped in the Lens (used when the download fails or is slow).
  asset: JsonAsset
  // File name of this map on the map server: the download URL is FindYourWay's mapBaseUrl + file
  // (e.g. the public gist copy of src/core/data, or http://localhost:8787/map.json from `npm run maps`).
  file: string
}

// Bundled maps (same order and names as src/core/data/index.json). Swapping buildings = adding
// a JSON file to the index, `npm run sync`, and a line here.
export const MAP_SOURCES: MapSource[] = [
  {key: "airport", asset: requireAsset("../Maps/airport.json") as JsonAsset, file: "map.json"},
  {key: "hospital", asset: requireAsset("../Maps/hospital.json") as JsonAsset, file: "hospital.json"},
  {key: "campus", asset: requireAsset("../Maps/campus.json") as JsonAsset, file: "campus.json"},
  {key: "room", asset: requireAsset("../Maps/room.json") as JsonAsset, file: "room.json"},
  {key: "mall", asset: requireAsset("../Maps/mall.json") as JsonAsset, file: "mall.json"},
]

// The map download URL for a source, or "" when there is no base URL.
export function mapUrl(baseUrl: string, source: MapSource): string {
  return mapDownloadUrl(baseUrl, source.file)
}

// Map metres (x east, y up, z north) -> building-local cm, with the start sign at the origin
// (its x, y and z) and north pointing along -Z (straight ahead of the user at the sign).
export class MapFrame {
  private origin: XYZ

  constructor(origin: XYZ) {
    this.origin = {x: origin.x, y: origin.y, z: origin.z}
  }

  static forMap(map: MapData, startId: string): MapFrame {
    const s = findNode(map, startId)
    return new MapFrame(s ? s : {x: 0, y: 0, z: 0})
  }

  toLocal(p: Vec3, liftCm: number = 0): vec3 {
    const l = mapToLocalCm(p, this.origin, liftCm)
    return new vec3(l.x, l.y, l.z)
  }

  toMap(local: vec3, eyeHeightCm: number): Vec3 {
    return localCmToMap({x: local.x, y: local.y, z: local.z}, this.origin, eyeHeightCm)
  }
}
