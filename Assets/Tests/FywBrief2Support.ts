// Shared helpers for the brief-2 LEAF scenarios (floors, companion, places, play, stops, mapping,
// peek ahead). Built on FindYourWayLeafSupport.
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode, Vec3} from "../Scripts/FindYourWayRouter"
import {levelName, placeOf} from "../Scripts/FindYourWayMapLibrary"
import {waitFor} from "./FindYourWayLeafSupport"

// The level name the map gives height y ("Ground floor", "Departures"...).
export function levelAt(main: FindYourWayMain, y: number): string {
  return levelName(placeOf(main.getMapData()), y)
}

// The first number before " m" in a pill ("Ground floor · Gate B12 · 58 m · ..."), or -1.
export function pillMetres(text: string | null): number {
  const m = text ? text.match(/(\d+) m\b/) : null
  return m ? parseInt(m[1], 10) : -1
}

// Stands still at `pos` until play is offered (≥ 2 s still with the companion on).
export async function standStill(main: FindYourWayMain, pos: Vec3, heading: number = 0): Promise<void> {
  main.debugSetPose(pos.x, pos.y, pos.z, heading)
  await waitFor(() => main.canPlayNow(), 5000, "play offered after standing still")
}

export function nodePos(main: FindYourWayMain, id: string): Vec3 {
  const n = findNode(main.getMapData(), id)
  if (!n) throw new Error("node " + id + " not in the map")
  return {x: n.x, y: n.y, z: n.z}
}

export function flat(a: Vec3, b: Vec3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2)
}

export async function frames(n: number): Promise<void> {
  await sleep(n * 40)
}
