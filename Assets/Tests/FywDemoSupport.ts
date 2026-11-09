// The three demo presets as LEAF trips (POLISH-PLAN.md Tasks 1, 3, 4): open a preset, press Talk (the
// preview fallback types the demo phrase), walk the trip by the simulated pose, and check what is on
// screen. Shared by the clean-screen, voice-fallback and demo scenarios, and by the video takes.
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {Vec3} from "../Scripts/FindYourWayRouter"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {getMain, log, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"
import {CAM, CamPose, liftApproach, planWalk, rideLine} from "../Scripts/FindYourWayCamera"

export interface DemoRun {
  main: FindYourWayMain
  // Called every step of a walk (and while waiting): the clean-screen check hooks in here.
  onStep: () => void
  // Metres per second of the simulated walk.
  speed: number
  // The video take (R2-13): every walk is the smooth camera (eased, rounded, capped turns); escalators
  // straight along their axis; lifts a stop facing the doors, marked for a dissolve (onRide).
  smooth?: boolean
  onRide?: (what: string) => void
}

// Plays planned poses in real time (frame drops never slow the walk); stop() ends it early.
export async function playPoses(run: DemoRun, poses: CamPose[], stop?: () => boolean): Promise<void> {
  const main = run.main
  const t0 = getTime()
  for (;;) {
    const f = (getTime() - t0) / CAM.dt
    const i = Math.floor(f)
    if (i >= poses.length - 1) {
      const e = poses[poses.length - 1]
      main.debugSetPose(e.x, e.y, e.z, e.heading)
      return
    }
    const a = poses[i], b = poses[i + 1], t = f - i
    const dh = ((b.heading - a.heading + 540) % 360) - 180
    main.debugSetPose(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.heading + dh * t)
    await sleep(1)
    run.onStep()
    if (stop && stop()) return
  }
}

// The smooth camera along these points (pts[0] is where you stand now).
export async function glide(run: DemoRun, pts: Vec3[], stop?: () => boolean, ride?: {rideFrom: number; rideTo: number}): Promise<void> {
  const p = run.main.getDebugPose()
  await playPoses(run, planWalk(pts, p ? p.heading : 0, ride), stop)
}

// The points cut off m metres along (for a stop partway, eased like any other).
export function cutAt(pts: Vec3[], m: number): Vec3[] {
  const out: Vec3[] = [pts[0]]
  let left = m
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
    if (len >= left) {
      const t = len > 0 ? left / len : 0
      out.push({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t})
      return out
    }
    out.push(b)
    left -= len
  }
  return out
}

// Opens a demo preset exactly as Reset preview does with it picked in the Inspector.
export async function openDemo(preset: string, speed: number = 6): Promise<DemoRun> {
  const main = getMain()
  main.debugShowDemoControls(false)
  main.debugClearPose()
  main.debugSetDemo(preset)
  main.restartShowing()
  await waitFor(() => main.getPhase() === "mode" || main.getPhase() === "prefs", 30000, preset + " opens (scan + panel)")
  await sleep(300)
  const sign = nodePos(main, main.getStartId())
  main.debugSetPose(sign.x, sign.y, sign.z, 0)
  // The preview's camera sees what the simulated walk sees (for screenshots and the video).
  main.debugSetViewFollowsPose(true)
  return {main, onStep: () => {}, speed}
}

// Back to the Inspector's own settings (and the demo controls the other scenarios use).
export async function closeDemo(main: FindYourWayMain): Promise<void> {
  main.debugSetDemo("off")
  main.debugClearPose()
  main.restartShowing()
  main.debugShowDemoControls(true)
  await sleep(500)
}

// Walks the pose along the points at run.speed, facing the way it goes; stop() ends it early.
export async function walk(run: DemoRun, pts: Vec3[], stop?: () => boolean): Promise<void> {
  if (run.smooth) return glide(run, pts, stop)
  const main = run.main
  let h = main.getDebugPose() ? main.getDebugPose()!.heading : 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
    if (len < 0.05) continue
    const leg = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
    const s = getTime()
    let f = 0
    while (f < 1) {
      f = Math.min(1, ((getTime() - s) * run.speed) / len)
      const turn = ((leg - h + 540) % 360) - 180
      h += turn * Math.min(1, getDeltaTime() * 6)
      main.debugSetPose(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, h)
      await sleep(1)
      run.onStep()
      if (stop && stop()) return
    }
  }
}

// The same points, the last one moved back along the last stretch by `m` metres.
export function shortOfEnd(pts: Vec3[], m: number): Vec3[] {
  if (pts.length < 2) return pts
  const a = pts[pts.length - 2], b = pts[pts.length - 1]
  const len = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2)
  if (len <= m + 0.2) return pts
  const f = (len - m) / len
  return pts.slice(0, -1).concat([{x: a.x + (b.x - a.x) * f, y: b.y, z: a.z + (b.z - a.z) * f}])
}

export async function hold(run: DemoRun, seconds: number): Promise<void> {
  const s = getTime()
  while (getTime() - s < seconds) {
    await sleep(30)
    run.onStep()
  }
}

export async function turnTo(run: DemoRun, heading: number, seconds: number): Promise<void> {
  const p = run.main.getDebugPose()!
  const from = p.heading
  const by = ((heading - from + 540) % 360) - 180
  // The smooth take: no faster than the camera's turn cap, eased in and out.
  if (run.smooth) seconds = Math.max(seconds, (Math.abs(by) / CAM.maxTurnDegS) * 1.5)
  const s = getTime()
  let f = 0
  while (f < 1) {
    f = Math.min(1, (getTime() - s) / seconds)
    const e = run.smooth ? f * f * (3 - 2 * f) : f
    run.main.debugSetPose(p.pos.x, p.pos.y, p.pos.z, from + by * e)
    await sleep(1)
    run.onStep()
  }
}

export function pose(run: DemoRun): Vec3 {
  return run.main.getDebugPose()!.pos
}

// Where you stand, then the current route's nodes after the nearest one on this floor.
export function routeAhead(run: DemoRun): Vec3[] {
  const main = run.main
  const all = main.getRouteNodes()
  const me = pose(run)
  let at = 0, bestD = Infinity
  all.forEach((id, i) => {
    const n = nodePos(main, id)
    const d = Math.abs(n.y - me.y) < 0.6 ? Math.hypot(n.x - me.x, n.z - me.z) : Infinity
    if (d < bestD) { bestD = d; at = i }
  })
  return [me].concat(all.slice(at + 1).map((id) => nodePos(main, id)))
}

// Talk in the preview: the demo phrase types itself in, the matcher picks the place, the preset's mode
// starts. Returns the words shown while it typed.
export async function talk(run: DemoRun): Promise<string[]> {
  const main = run.main
  if (!pressButton("TalkButton")) throw new Error("Talk button not found")
  const seen: string[] = []
  const s = getTime()
  while (main.getPhase() === "mode" && getTime() - s < 8) {
    const t = main.getDestinationLabel()
    if (seen.indexOf(t) < 0) seen.push(t)
    await sleep(30)
  }
  await waitFor(() => main.getPhase() === "nav", 2000, "the trip starts after Talk")
  return seen
}

// The route from where you stand: the pose, then the route's nodes after `fromId` (or all of them).
export function routeFrom(run: DemoRun, fromId: string | null): Vec3[] {
  const nodes = run.main.getRouteNodes()
  const i = fromId === null ? 0 : nodes.indexOf(fromId)
  return [pose(run)].concat(nodes.slice(i + 1).map((id) => nodePos(run.main, id)))
}

// Walks the current leg to its end: along the route, riding any lift on the way (pressing its button
// as you would), until the trip says arrived.
export async function walkLeg(run: DemoRun): Promise<string[]> {
  const main = run.main
  const kinds = main.getRouteEdgeKinds()
  for (let guard = 0; guard < 4 && main.getPhase() !== "arrived"; guard++) {
    const all = main.getRouteNodes()
    // The route keeps the nodes already passed: go on from the nearest one on this floor.
    const me = pose(run)
    let at = 0, bestD = Infinity
    all.forEach((id, i) => {
      const n = nodePos(main, id)
      const d = Math.abs(n.y - me.y) < 0.6 ? Math.hypot(n.x - me.x, n.z - me.z) : Infinity
      if (d < bestD) { bestD = d; at = i }
    })
    const nodes = all.slice(at)
    const k = main.getRouteEdgeKinds().slice(at).indexOf("lift")
    if (k < 0) {
      // Stop 2.7 m from the door, inside the 3 m arrival radius (airport-model.test.ts DOOR_STOP_M, AM10): the front and its sign in view, not one wall.
      await walk(run, shortOfEnd([me].concat(nodes.slice(1).map((id) => nodePos(main, id))), 2.7), () => main.getPhase() === "arrived")
      break
    }
    const lift = nodes[k]
    const to = nodePos(main, lift)
    const before = nodes.slice(1, k).map((id) => nodePos(main, id))
    if (run.smooth) {
      // Stop in front of the lift, facing its doors; the floor change is a dissolve in the edit.
      const from = before.length > 0 ? before[before.length - 1] : pose(run)
      const stand = liftApproach(to, from)
      await glide(run, [pose(run)].concat(before).concat([{x: stand.x, y: stand.y, z: stand.z}]))
      await turnTo(run, stand.heading, 0.8)
      await hold(run, 0.8)
      if (run.onRide) run.onRide("ride in")
      main.debugSetPose(to.x, to.y, to.z, stand.heading)
      const rideId = main.getRideIdFor(lift, "lift")
      if (!rideId || !pressButton("RideButton_" + rideId)) throw new Error("no ride button at " + lift)
      await hold(run, 0.6)
      // Out on the new floor, a step out of the lift, facing the way on.
      const here = pose(run)
      const ahead = main.getRouteNodes().map((id) => nodePos(main, id)).filter((n) => Math.abs(n.y - here.y) < 0.6 && Math.hypot(n.x - here.x, n.z - here.z) > 2)[0]
      if (ahead) {
        const l = Math.hypot(ahead.x - here.x, ahead.z - here.z)
        const h = (Math.atan2(ahead.x - here.x, ahead.z - here.z) * 180) / Math.PI
        main.debugSetPose(here.x + ((ahead.x - here.x) / l) * 1.4, here.y, here.z + ((ahead.z - here.z) / l) * 1.4, h)
      }
      await hold(run, 0.3)
      if (run.onRide) run.onRide("ride out")
      continue
    }
    await walk(run, [pose(run)].concat(before).concat([{x: to.x, y: to.y, z: to.z - 1.2}]))
    await hold(run, 1.2)
    main.debugSetPose(to.x, to.y, to.z - 0.4, main.getUserHeading())
    await hold(run, 0.4)
    const ride = main.getRideIdFor(lift, "lift")
    if (!ride || !pressButton("RideButton_" + ride)) throw new Error("no ride button at " + lift)
    await hold(run, 1.2)
  }
  await waitFor(() => main.getPhase() === "arrived", 5000, "arrived at " + main.getDestinationId())
  return kinds
}

// Demo 1: "I need coffee and a bathroom before my flight at gate 12C", in a wheelchair: the café, the
// accessible toilet, then Gate C12, each leg step-free. Returns the stops and every leg's edge kinds.
export async function airportTrip(run: DemoRun): Promise<{stops: string[]; kinds: string[]}> {
  const main = run.main
  await hold(run, 0.8)
  await talk(run)
  const stops = main.getStops()
  if (stops.length < 2 || stops[stops.length - 1] !== "gateC12") throw new Error("stops " + stops.join(","))
  let kinds: string[] = []
  for (let i = 0; i < stops.length; i++) {
    await waitFor(() => main.getPhase() === "nav" && main.getDestinationId() === stops[i], 9000, "leg " + (i + 1) + " to " + stops[i])
    kinds = kinds.concat(await walkLeg(run))
    log("demo airport: arrived at " + main.getDestinationId() + " (" + main.getArrivalText() + ")")
  }
  return {stops, kinds}
}

// Demo 2: by voice, Walk; the dog leads (the Bakery, on the ground floor, R2-31; an escalator, if the route has one, it waits at its foot).
// beforeWalk: awaited after Talk, before the first step (the video take marks its "leg" beat there).
export async function mallPetTrip(run: DemoRun, beforeWalk?: () => Promise<void>): Promise<{waitedAt: string | null; dogNearFoot: boolean}> {
  const main = run.main
  await hold(run, 0.8)
  await talk(run)
  if (main.getDestinationId() !== "bakery") throw new Error("destination " + main.getDestinationId())
  if (beforeWalk) await beforeWalk()
  const nodes = main.getRouteNodes()
  const kinds = main.getRouteEdgeKinds()
  const k = kinds.indexOf("escalator")
  let waitedAt: string | null = null
  let dogNearFoot = false
  if (k >= 0) {
    const footId = nodes[k]
    const foot = nodePos(main, footId)
    const prev = nodePos(main, nodes[Math.max(0, k - 1)])
    const d = Math.sqrt((foot.x - prev.x) ** 2 + (foot.z - prev.z) ** 2)
    const f = d > 0 ? Math.max(0, 1 - 2 / d) : 0
    const short = {x: prev.x + (foot.x - prev.x) * f, y: foot.y, z: prev.z + (foot.z - prev.z) * f}
    if (run.smooth) {
      // Up the escalator straight along its axis: step on in line, ride, step off in line (R2-13).
      const line = rideLine(foot, nodePos(main, nodes[k + 1]))
      await glide(run, [pose(run)].concat(nodes.slice(1, k).map((id) => nodePos(main, id))).concat([line[0]]))
      await hold(run, 3)
      const p0 = main.getCompanionMapPos()
      dogNearFoot = !!p0 && Math.sqrt((p0.x - foot.x) ** 2 + (p0.z - foot.z) ** 2) < 1.5 && Math.abs(p0.y - foot.y) < 0.5
      waitedAt = footId
      await glide(run, [pose(run)].concat(line.slice(1)), undefined, {rideFrom: 1, rideTo: 2})
      await walk(run, [pose(run)].concat(nodes.slice(k + 2).map((id) => nodePos(main, id))), () => main.getPhase() === "arrived")
      await waitFor(() => main.getPhase() === "arrived", 8000, "arrived at " + main.getDestinationId())
      return {waitedAt, dogNearFoot}
    }
    await walk(run, [pose(run)].concat(nodes.slice(1, k).map((id) => nodePos(main, id))).concat([short]))
    await hold(run, 3)
    const p = main.getCompanionMapPos()
    dogNearFoot = !!p && Math.sqrt((p.x - foot.x) ** 2 + (p.z - foot.z) ** 2) < 1.5 && Math.abs(p.y - foot.y) < 0.5
    waitedAt = footId
    log("demo mall: dog at " + JSON.stringify(p) + ", foot " + footId + " mood " + main.getCompanionMood())
    await walk(run, routeFrom(run, nodes[k - 1] || null), () => main.getPhase() === "arrived")
  } else {
    // Along the route as drawn: straight off the corridor to the Bakery, as the dog goes (R2-41).
    await walk(run, [pose(run)].concat(main.getRoutePoints().slice(1)), () => main.getPhase() === "arrived")
  }
  await waitFor(() => main.getPhase() === "arrived", 5000, "arrived at " + main.getDestinationId())
  return {waitedAt, dogNearFoot}
}

// Demo 3: Free walk with the robot for coffee and clothes: it points at Bean There Café and Threads,
// and looking at each shows its offer boxes.
export async function freeWalkRobotTrip(run: DemoRun, beforeWalk?: () => Promise<void>): Promise<{pointed: string[]; boxes: string[]; reasons: string[]; picks: string[]}> {
  const main = run.main
  // At walking pace: the robot walks ahead of you and stops at the shops it passes.
  run.speed = Math.min(run.speed, 1.6)
  await hold(run, 0.8)
  // The companion asks; you say what you like (R2-15): the preview types the demo phrase in.
  if (!pressButton("PrefsTalkButton")) throw new Error("no Talk in the preferences")
  await waitFor(() => main.getPhase() === "free", 15000, "Free walk starts once the preferences are heard")
  const picks = main.getPrefsPicked()
  if (beforeWalk) await beforeWalk()
  const pointed: string[] = []
  const boxes: string[] = []
  const reasons: string[] = []
  const watch = run.onStep
  run.onStep = () => {
    watch()
    const id = main.getStopId()
    if (id && main.isCompanionPointing() && pointed.indexOf(id) < 0) pointed.push(id)
    const b = main.getOfferBoxesId()
    if (b && boxes.indexOf(b) < 0) boxes.push(b)
    const why = main.getPointReason()
    if (why && reasons.indexOf(why) < 0) reasons.push(why)
  }
  let n = 0
  const watch2 = run.onStep
  run.onStep = () => {
    watch2()
    if (n++ % 90 === 0) log("free walk: me " + JSON.stringify(pose(run)) + " pet " + JSON.stringify(main.getCompanionMapPos()) + " " + main.getCompanionMood() + " " + main.getPointState() + " phase " + main.getPhase())
  }
  const cafe = nodePos(main, "cafe"), threads = nodePos(main, "threads")
  // In from the sign, west past the café (look at it), then east past Threads (look at it).
  // Along the middle of the hall (z 10). The robot goes on about 8 m and points (R2-39): stop well short of
  // each shop and look at it, so the robot, its card and the shop show together, and the look opens the offers.
  const lookAt = (p: Vec3) => (Math.atan2(p.x - pose(run).x, (p.z + 2) - pose(run).z) * 180) / Math.PI
  await walk(run, [pose(run), {x: 30, y: 0, z: 10}, {x: cafe.x + 9, y: 0, z: 10}])
  await hold(run, 2)
  await turnTo(run, lookAt(cafe), 1.2)
  await tiltTo(run, 9, 0.8)
  await hold(run, 4)
  await tiltTo(run, 0, 0.8)
  await turnTo(run, 90, 2)
  await hold(run, 2)
  await walk(run, [pose(run), {x: threads.x - 8, y: 0, z: 10}])
  await hold(run, 2)
  await turnTo(run, lookAt(threads), 1.2)
  await tiltTo(run, 9, 0.8)
  await hold(run, 4)
  await tiltTo(run, 0, 0.8)
  run.onStep = watch
  return {pointed, boxes, reasons, picks}
}

// ── The clean screen ──────────────────────────────────────────────────────

// Texts the user can see right now that the clean screen does not allow while walking. World signs
// in the building are part of the place; the offer boxes, the arrival card, the voice caption (on the
// Go to a place panel) and the folded Control tab are allowed.
export function offendingTexts(main: FindYourWayMain): string[] {
  const out: string[] = []
  const visit = (so: SceneObject, path: string) => {
    if (!so.isEnabledInHierarchy) return
    const p = path ? path + "/" + so.name : so.name
    for (const t of so.getComponents("Component.Text") as Text[]) {
      if (t.text && t.text.trim() !== "" && !allowed(main, p)) out.push(p + ": " + t.text)
    }
    for (let i = 0; i < so.getChildrenCount(); i++) visit(so.getChild(i), p)
  }
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    const r = global.scene.getRootObject(i)
    if (r.name === "LeafIndex" || r.name.indexOf("LEAF") === 0 || r.name.indexOf("LeafDebug") === 0) continue
    visit(r, "")
  }
  return out
}

function allowed(main: FindYourWayMain, path: string): boolean {
  // The offers card, live captions and the companion's words (add-on A) are allowed on the clean screen.
  if (path.indexOf("OffersCard") >= 0 || path.indexOf("Captions") >= 0 || path.indexOf("CompanionSays") >= 0) return true
  if (path.indexOf("StandInBuilding") >= 0) return path.indexOf("PlaceIcons") < 0 && path.indexOf("CompanionBubble") < 0
  if (path.indexOf("AppPanel") === 0) return main.isOptionsCollapsed()
  if (path.indexOf("ModePanel") >= 0) return true
  return false
}

// Hooks the clean-screen check into a run: every offending text seen during the walk is kept.
export function watchCleanScreen(run: DemoRun, seen: string[]): void {
  const before = run.onStep
  let n = 0
  run.onStep = () => {
    before()
    if (n++ % 4 !== 0) return
    const ph = run.main.getPhase()
    if (ph !== "nav" && ph !== "arrived" && ph !== "free") return
    for (const t of offendingTexts(run.main)) if (seen.indexOf(t) < 0) seen.push(t)
  }
}

// Tilts the take's camera down to `deg` (0: level) over `seconds`, gently (R2-42).
export async function tiltTo(run: DemoRun, deg: number, seconds: number): Promise<void> {
  const from = run.main.getDebugPitch()
  const t0 = getTime()
  for (;;) {
    const k = Math.min(1, (getTime() - t0) / Math.max(0.01, seconds))
    const e = k * k * (3 - 2 * k)
    run.main.debugSetPitch(from + (deg - from) * e)
    if (k >= 1) return
    await sleep(1)
    run.onStep()
  }
}
