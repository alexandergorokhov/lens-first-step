// Shared helpers for the Find Your Way LEAF scenarios.
// Interactions go through LEAF's DefaultLeafInteractor against the real UIKit/SIK buttons
// (found by SceneObject name). Walking is simulated with FindYourWayMain.debugSetPose
// (map metres), because LEAF cannot move the device-tracked camera.

import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode, MapData, MapEdge, parseMap, Profile, Vec3} from "../Scripts/FindYourWayRouter"
import {MAP_SOURCES} from "../Scripts/FindYourWayMapLibrary"
import {headingOf} from "../Scripts/FindYourWayGeometry"

export function getMain(): FindYourWayMain {
  const so = findSceneObjectByName("FindYourWay")
  if (!so) throw new Error("SceneObject 'FindYourWay' not found")
  const main = so.getComponent(FindYourWayMain.getTypeName()) as FindYourWayMain
  if (!main) throw new Error("FindYourWayMain component not found")
  // The demo controls (restart, map switch, gate change) are hidden by default; tests use them.
  main.debugShowDemoControls(true)
  return main
}

// A tap on Restart rebuilds the whole place inside the tap (~3 s, more late in a long batch).
const TAP_TIMEOUT_MS = 20000 // 12 s timed out late in long batches (Nov 3 night run)

export async function tap(interactor: DefaultLeafInteractor, name: string): Promise<void> {
  // A button shown this frame gets its Interactable on its first frame: retry for ~1 s.
  let target = findInteractableByName(name, undefined, true)
  for (let i = 0; i < 10 && !target; i++) {
    await sleep(100)
    target = findInteractableByName(name, undefined, true)
  }
  // The Options panel folds to a tab once a trip starts: open it, then find the button.
  if (!target && name !== "OptionsTabButton" && findInteractableByName("OptionsTabButton", undefined, true)) {
    await tap(interactor, "OptionsTabButton")
    target = findInteractableByName(name, undefined, true)
  }
  if (!target) throw new Error("Interactable '" + name + "' not found or not enabled")
  // LEAF's trigger waits forever on its hover/trigger events: fail instead if they never come.
  let done = false
  interactor.trigger(target).then(() => { done = true })
  await waitFor(() => done, TAP_TIMEOUT_MS, "tap on '" + name + "' (enabled now: " + target.getSceneObject().isEnabledInHierarchy + ")")
  await sleep(250)
}

// Put the companion on or off whatever companionOnAtStart says: tap its button only when needed.
export async function setCompanion(interactor: DefaultLeafInteractor, main: FindYourWayMain, on: boolean): Promise<void> {
  if (main.isCompanionOn() === on) return
  await tap(interactor, "CompanionButton")
  await waitFor(() => main.isCompanionOn() === on, 2000, "companion " + (on ? "on" : "off"))
}

export async function waitFor(cond: () => boolean, ms: number, what: string): Promise<void> {
  const t0 = getTime()
  while (!cond()) {
    if ((getTime() - t0) * 1000 > ms) throw new Error("Timed out waiting for: " + what)
    await sleep(100)
  }
}

// From the Restart: pinch the scan sign at the start pose, then Go to a place and the given mode
// button. Stops at the "error" phase when the scan fails.
export async function afterRestartGo(interactor: DefaultLeafInteractor, main: FindYourWayMain, button: string): Promise<void> {
  await tap(interactor, "ScanSignButton")
  await waitFor(() => main.getPhase() === "choose" || main.getPhase() === "error", 8000, "the three modes after the scan (map load ≤ 5 s)")
  if (main.getPhase() === "error") return
  await tap(interactor, "GoToPlaceButton")
  await waitFor(() => main.getPhase() === "mode", 3000, "Go to a place panel")
  await tap(interactor, button)
}

// Restart on the airport map, stand 1.5 m in front of the sign, pinch it, Go to a place, a mode.
// beforeMode runs once the world anchor has settled, just before the scan.
export async function startTrip(interactor: DefaultLeafInteractor, profile: Profile,
    footY: number = 0, beforeScan?: (m: FindYourWayMain) => void,
    until: string[] = ["nav"], mapKey: string = "airport",
    beforeMode?: (m: FindYourWayMain) => void): Promise<FindYourWayMain> {
  const main = getMain()
  for (let i = 0; i < 5 && main.getMapKey() !== mapKey; i++) {
    await tap(interactor, "NextMapButton")
    await sleep(800)
  }
  await tap(interactor, "RestartButton")
  await waitFor(() => main.getPhase() === "scan" && main.isScanSignVisible(), 8000, "scan sign")
  await sleep(800) // world anchor settles
  await waitFor(() => !main.isAnchorSettling(), 12000, "world anchor settled")
  if (beforeMode) beforeMode(main)
  const sign = findNode(main.getMapData(), main.getStartId())!
  main.debugSetPose(sign.x, footY, sign.z - 1.5, 0)
  if (beforeScan) beforeScan(main)
  await afterRestartGo(interactor, main, profile === "walk" ? "WalkButton" : "StepFreeButton")
  await waitFor(() => until.indexOf(main.getPhase()) >= 0, 8000, "phase " + until.join("/") + " after scan (map load ≤ 5 s)")
  await sleep(300)
  return main
}

// Simulated walk along map points (metres), `stepM` per frame-ish step, facing travel direction.
// Stops early when `stop()` returns true. Returns the number of steps taken.
export async function walkAlong(main: FindYourWayMain, pts: Vec3[], stepM: number,
    stop?: () => boolean): Promise<number> {
  let steps = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const d = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
    const n = Math.max(1, Math.ceil(d / stepM))
    const h = headingOf(a, b)
    for (let k = 1; k <= n; k++) {
      const t = k / n
      main.debugSetPose(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, h === null ? 0 : h)
      await sleep(60)
      steps++
      if (stop && stop()) return steps
    }
  }
  return steps
}

export function nodePoints(map: MapData, ids: string[]): Vec3[] {
  return ids.map((id) => {
    const n = findNode(map, id)!
    return {x: n.x, y: n.y, z: n.z}
  })
}

// The shortest distance by Bellman-Ford relaxation, honouring one-way escalators and the profile's
// rules. Independent of the router's Dijkstra, so it can check "shortest". (It used to try every
// simple path, which grew past Lens Studio's per-frame JS time limit on today's maps.)
export function bruteShortest(map: MapData, from: string, to: string, profile: Profile): number {
  const dist: {[id: string]: number} = {}
  for (const n of map.nodes) dist[n.id] = Infinity
  dist[from] = 0
  for (let i = 0; i < map.nodes.length; i++) {
    let changed = false
    for (const e of map.edges) {
      if (!e.open) continue
      if (profile === "stepFree" && (e.kind === "stairs" || e.kind === "escalator")) continue
      if (dist[e.from] + e.length < dist[e.to]) { dist[e.to] = dist[e.from] + e.length; changed = true }
      if (e.kind !== "escalator" && dist[e.to] + e.length < dist[e.from]) { dist[e.from] = dist[e.to] + e.length; changed = true }
    }
    if (!changed) break
  }
  return dist[to] === undefined ? Infinity : dist[to]
}

export function kindsOf(edges: MapEdge[]): string[] {
  return edges.map((e) => e.kind)
}

// Screenshot mode: when the runner's shotPauseMs > 0, shot() logs "[FYW-LEAF] SHOT <name>" and pauses
// so the Preview panel can be captured at that moment. followPose = render from the simulated
// pose (for moments deep inside the building). Off by default: shot() returns at once.
export const SHOT = {pauseMs: 0}

export async function shot(main: FindYourWayMain, name: string, followPose: boolean = false): Promise<void> {
  if (SHOT.pauseMs <= 0) return
  if (followPose) main.debugSetViewFollowsPose(true)
  await sleep(400)
  log("SHOT " + name)
  await sleep(SHOT.pauseMs)
  if (followPose) main.debugSetViewFollowsPose(false)
}

export function log(msg: string): void {
  print("[FYW-LEAF] " + msg)
}

export function bundledMaps(): {key: string; map: MapData}[] {
  return MAP_SOURCES.map((s) => {
    const r = parseMap(s.asset.getString())
    if (!r.ok) throw new Error("bundled map " + s.key + " is invalid")
    return {key: s.key, map: r.map}
  })
}
