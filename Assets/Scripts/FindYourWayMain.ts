// FindYourWayMain — orchestrates the trip: mode choice -> simulated sign scan -> map load
// (online with 5 s timeout, else built-in) -> live routing with the floor line, turn arrow,
// notice card, arrival card, rides (lift / escalator / stairs / ramp), closures and
// destination changes.
// Owns: trip state (map, profile, Navigator, ride offset). UI modules are passive views:
// Main pushes state via their setters and listens to their events.
// Inputs: authored scene objects (camera, world anchor, building) and the UI/controller
// components; tunables for eye height, sign placement, look-ahead and panel offsets.
// Must not: create text or UIKit widgets (those live in the *UI.ts modules).
// The route logic is FindYourWayRouter.ts — a verbatim copy of src/core/router.ts.

import {
  ASK_STAFF_MESSAGE,
  findNode,
  levelDistance,
  lineAhead,
  loadMapWithTimeout,
  locateSign,
  MapData,
  MapEdge,
  MapNode,
  Navigator,
  parseMap,
  Profile,
  routePoints,
  setEdgeOpen,
  Vec3,
} from "./FindYourWayRouter"
import {
  approachDir,
  arrivalText,
  levelName,
  MAP_SOURCES,
  MapFrame,
  mapUrl,
  nodeLabel,
  PlaceEvent,
  PlaceInfo,
  placeOf,
} from "./FindYourWayMapLibrary"
import {nextTurnAlong, stopAtLift, turnOutOfView, yawTo} from "./FindYourWayGeometry"
import {FindYourWayRouteLine} from "./FindYourWayRouteLine"
import {FindYourWayStandIn} from "./FindYourWayStandIn"
import {FindYourWayTurnArrow} from "./FindYourWayTurnArrow"
import {FindYourWayModePanelUI} from "./FindYourWayModePanelUI"
import {FindYourWayBuildingUI} from "./FindYourWayBuildingUI"
import {FindYourWayDemoControlsUI} from "./FindYourWayDemoControlsUI"
import {FindYourWayHudUI} from "./FindYourWayHudUI"
import {FindYourWayArrivalUI} from "./FindYourWayArrivalUI"

export type Phase = "mode" | "scan" | "loading" | "nav" | "arrived" | "error"



// A ride: from one end of a lift / escalator / stairs / ramp edge to the other.
interface Ride {
  id: string
  edge: MapEdge
  at: string
  to: string
  label: string
  icon: string
  reach: number // metres from `at` within which the button works
}

@component
export class FindYourWayMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Find Your Way Inside – trip orchestrator</span>')
  @ui.separator
  @ui.group_start("References")
  @input @hint("The device-tracked camera (the user's head)") camera: SceneObject
  @input @hint("World anchor, placed at the user's start pose") world: SceneObject
  @input @hint("Stand-in building root (child of World); sign node at its origin") building: SceneObject
  @input @hint("Floor line renderer") routeLine: FindYourWayRouteLine
  @input @hint("Stand-in building generator") standIn: FindYourWayStandIn
  @input @hint("Turn arrow at the lower edge of view") turnArrow: FindYourWayTurnArrow
  @input @hint("Walk / Step-Free panel") modePanel: FindYourWayModePanelUI
  @input @hint("Signs and pinch targets inside the building") buildingUI: FindYourWayBuildingUI
  @input @hint("Demo controls panel") demoControls: FindYourWayDemoControlsUI
  @input @hint("Head-locked notice card + map badge") hud: FindYourWayHudUI
  @input @hint("Card over the destination") arrivalCard: FindYourWayArrivalUI
  @input @hint("Internet module used to download the map") internetModule: InternetModule
  @input @hint("Chime played with the notice card") chime: AudioTrackAsset
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Which bundled map to start with")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Airport (demo)", "airport"),
    new ComboBoxItem("Hospital wing", "hospital"),
    new ComboBoxItem("Preview room floor", "room"),
  ]))
  mapKey: string = "airport"

  @input
  @hint("Try downloading the map (5 s timeout) before falling back to the built-in copy")
  tryOnlineMap: boolean = true

  @input
  @hint("Map server folder; each map downloads from here + its file name (map.json, hospital.json…). Local: http://localhost:8787/ (npm run maps). Once the repo is public: https://raw.githubusercontent.com/alexandergorokhov/lens-first-step/master/src/core/data/")
  mapBaseUrl: string = "http://localhost:8787/"

  @input
  @hint("Standing eye height above the floor, cm — used when the floor can't be detected")
  @widget(new SliderWidget(100, 200, 1))
  eyeHeightCm: number = 180

  @input("vec3", "{0,0,-250}")
  @hint("Where the 'you are here' sign stands relative to the user when a mode is chosen (right, -, forward), cm")
  signOffset: vec3 = new vec3(0, 0, -250)

  @input
  @hint("How much of the route the line shows ahead of the user, m")
  @widget(new SliderWidget(3, 30, 0.5))
  lineAheadM: number = 10

  @input
  @hint("Half the horizontal field of view, degrees — outside it the turn arrow shows")
  @widget(new SliderWidget(8, 40, 1))
  halfViewDeg: number = 16

  @input("vec3", "{8,-4,-100}")
  @hint("Mode panel offset from the head at start (right, up, forward), cm")
  modePanelOffset: vec3 = new vec3(8, -4, -100)

  @input("vec3", "{-15,-14,-80}")
  @hint("Demo controls offset from the head (right, up, forward), cm — low-left, inside the ~32° view")
  demoOffset: vec3 = new vec3(-15, -14, -80)
  @ui.group_end

  private phase: Phase = "mode"
  private mapIndex = 0
  private builtInText = ""
  private map: MapData
  private place: PlaceInfo
  private frame: MapFrame
  private mapSource: string | null = null
  private profile: Profile | null = null
  private nav: Navigator | null = null
  private closed: {[edgeId: string]: boolean} = {}
  private rides: {[id: string]: Ride} = {}
  // Building-local cm the traveller has been carried by rides (the building moves the other way).
  private rideOffset = new vec3(0, 0, 0)
  private debugPose: {pos: Vec3; heading: number} | null = null
  private viewFollowsPose = false
  private pendingSwing = false
  private lastLineKey = ""
  private lineMapPoints: Vec3[] = []
  private lastHeading = 0
  private audio: AudioComponent
  private demoInit = false
  // The device-tracked camera settles a few frames after start; keep re-anchoring until then.
  private anchorFrames = 0
  // Eye height measured by a downward hit test against the real floor; null = use eyeHeightCm.
  private measuredEyeCm: number | null = null
  private hitSession: HitTestSession | null = null
  private floorProbeFrames = 0
  // Test overrides (cleared on restart): text returned by the "download", the scanned sign id,
  // and the destination.
  private downloadOverride: string | null = null
  private startOverride: string | null = null
  private destinationOverride: string | null = null

  onAwake() {
    const idx = MAP_SOURCES.map((m) => m.key).indexOf(this.mapKey)
    this.mapIndex = idx >= 0 ? idx : 0
    this.loadBuiltIn()
    this.audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    if (this.chime) this.audio.audioTrack = this.chime
    try { this.audio.playbackMode = Audio.PlaybackMode.LowLatency } catch (e) { /* editor */ }
    try {
      const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
      this.hitSession = wq.createHitTestSession()
      this.hitSession.start()
    } catch (e) {
      print("[FYW] world query unavailable, using eyeHeightCm")
    }
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private onStart(): void {
    const missing = ["camera", "world", "building", "routeLine", "standIn", "turnArrow", "modePanel",
      "buildingUI", "demoControls", "hud", "arrivalCard"].filter((k) => !(this as any)[k])
    if (missing.length > 0) {
      print("[FYW] ERROR missing inputs: " + missing.join(", "))
      return
    }
    this.modePanel.onWalk.add(() => this.chooseMode("walk"))
    this.modePanel.onStepFree.add(() => this.chooseMode("stepFree"))
    this.buildingUI.onScan.add(() => this.scanSign())
    this.buildingUI.onClosure.add((id) => this.closeConnection(id))
    this.buildingUI.onRide.add((id) => this.ride(id))
    this.demoControls.onEvent.add(() => this.changeDestination())
    this.demoControls.onRestart.add(() => this.restart())
    this.demoControls.onNextMap.add(() => this.nextMap())
    this.restart()
  }

  // ── Trip flow ────────────────────────────────────────────────────────────

  private loadBuiltIn(): void {
    this.builtInText = MAP_SOURCES[this.mapIndex].asset.getString()
    const parsed = parseMap(this.builtInText)
    if (!parsed.ok) {
      print("[FYW] ERROR built-in map " + MAP_SOURCES[this.mapIndex].key + " is invalid")
      return
    }
    this.setMap(parsed.map)
  }

  private setMap(map: MapData): void {
    this.map = map
    this.place = placeOf(map)
    this.frame = MapFrame.forMap(map, this.place.start)
  }

  restart(): void {
    this.loadBuiltIn()
    this.phase = "mode"
    this.profile = null
    this.nav = null
    this.closed = {}
    this.rideOffset = new vec3(0, 0, 0)
    this.mapSource = null
    this.debugPose = null
    this.viewFollowsPose = false
    this.downloadOverride = null
    this.startOverride = null
    this.destinationOverride = null
    this.lastLineKey = ""
    this.lineMapPoints = []
    this.anchorFrames = 30
    this.floorProbeFrames = 120
    this.anchorWorld()
    this.buildPlace()
    this.hud.hideCard()
    this.hud.setBadge(null)
    this.demoControls.setStatus("Choose a mode to start")
    this.placeModePanel()
    this.modePanel.show()
    print("[FYW] restart: map=" + MAP_SOURCES[this.mapIndex].key)
  }

  private nextMap(): void {
    this.mapIndex = (this.mapIndex + 1) % MAP_SOURCES.length
    this.restart()
  }

  private chooseMode(profile: Profile): void {
    if (this.phase !== "mode") return
    this.profile = profile
    this.modePanel.hide()
    // The sign (and so the building) is placed in front of where the user stands now, so they
    // can first step into clear floor and then choose.
    this.anchorWorld()
    this.buildingUI.setScanSignVisible(true)
    this.phase = "scan"
    this.demoControls.setStatus(profile === "walk" ? "Mode: Walk" : "Mode: Step-Free")
    print("[FYW] mode " + profile)
  }

  private scanSign(): void {
    if (this.phase !== "scan" || this.profile === null) return
    this.phase = "loading"
    this.buildingUI.setScanSignVisible(false)
    this.hud.setBadge("loading map…")
    const url = this.tryOnlineMap ? mapUrl(this.mapBaseUrl, MAP_SOURCES[this.mapIndex]) : ""
    print("[FYW] map download: " + (url || "(none, built-in map)"))
    const override = this.downloadOverride
    const fetchText = (u: string): Promise<string> => {
      if (override !== null) return Promise.resolve(override)
      if (!u || !this.internetModule) return Promise.reject(new Error("no download"))
      let pending: Promise<Response>
      try {
        pending = this.internetModule.fetch(u)
      } catch (e) {
        print("[FYW] map download failed: " + e)
        return Promise.reject(e)
      }
      return pending.then((r) => {
        print("[FYW] map download response: HTTP " + r.status)
        return r.ok ? r.text() : Promise.reject(new Error("HTTP " + r.status))
      }).then((body) => {
        print("[FYW] map download body: " + (body ? body.length : 0) + " chars")
        return body
      }, (err) => {
        print("[FYW] map download failed: " + err)
        return Promise.reject(err)
      })
    }
    const token = this.mapIndex
    loadMapWithTimeout(fetchText, url, this.builtInText).then((res) => {
      if (this.phase !== "loading" || token !== this.mapIndex) return
      this.startTrip(res.map, res.source, res.notice)
    })
  }

  private startTrip(map: MapData, source: string, notice: string | null): void {
    let m = map
    for (const id in this.closed) m = setEdgeOpen(m, id, false)
    const changed = JSON.stringify(m) !== JSON.stringify(this.map)
    this.setMap(m)
    if (changed) this.buildPlace()
    this.mapSource = source
    this.hud.setBadge(source === "online" ? "online map" : "offline map")
    this.demoControls.setStatus((this.profile === "walk" ? "Walk" : "Step-Free") + " · " +
      (source === "online" ? "online map" : "offline map"))
    if (notice) this.hud.showCard(notice, "info")
    const startId = this.startOverride || this.place.start
    const located = locateSign(this.map, startId)
    if (!located.ok) {
      this.phase = "error"
      this.routeLine.clear()
      this.hud.showCard((located as {ok: false; message: string}).message, "info")
      print("[FYW] scan failed: " + (located as {ok: false; message: string}).message)
      return
    }
    this.nav = new Navigator(this.map, startId, this.destinationOverride || this.place.destination, this.profile as Profile)
    this.phase = "nav"
    this.pendingSwing = true
    this.lastLineKey = ""
    this.reportRoute("scan")
  }

  private changeDestination(): void {
    const ev = this.firstEvent("destinationChanged")
    if (!ev || !ev.to) return
    this.notify(ev.card || ev.button || "Destination changed", this.iconOfNode(ev.to))
    if (this.nav) {
      if (this.nav.to !== ev.to) this.nav.setGate(ev.to)
      this.afterRouteChange()
    } else {
      this.place.destination = ev.to
    }
    this.reportRoute("destination changed")
  }

  private closeConnection(edgeId: string): void {
    if (this.closed[edgeId]) return
    this.closed[edgeId] = true
    const ev = this.place.events.filter((e) => e.type === "connectionClosed" && e.edge === edgeId)[0]
    this.buildingUI.setClosureClosed(edgeId, "Closed — re-routing")
    this.standIn.setConnectionClosed(edgeId)
    if (this.nav) {
      this.nav.setEdgeOpen(edgeId, false)
      this.map = this.nav.map
      this.afterRouteChange()
    } else {
      this.setMap(setEdgeOpen(this.map, edgeId, false))
    }
    for (const id in this.rides) {
      if (this.rides[id].edge.id === edgeId) this.buildingUI.setRideButtonText(id, "Out of service")
    }
    const askStaff = this.nav && this.nav.route.status === "askStaff"
    this.notify(askStaff ? ASK_STAFF_MESSAGE : (ev && ev.card) || "Connection closed. Re-routing.", "block")
    this.reportRoute("closed " + edgeId)
  }

  // Lift / escalator / stairs / ramp ride: only from the end the user is standing at.
  private ride(id: string): void {
    const r = this.rides[id]
    if (!r) return
    const map = this.nav ? this.nav.map : this.map
    const here = findNode(map, r.at)
    const there = findNode(map, r.to)
    if (!here || !there) return
    const edge = map.edges.filter((e) => e === r.edge || (e.id && e.id === r.edge.id) ||
      (e.from === r.edge.from && e.to === r.edge.to && e.kind === r.edge.kind))[0] || r.edge
    if (!edge.open) {
      this.hud.showCard(nodeLabel(map, r.at) + " is out of service", "block", 3)
      return
    }
    const user = this.userPos()
    if (levelDistance(user, here) > r.reach) {
      this.hud.showCard("Walk to " + nodeLabel(map, r.at) + " first", "info", 3)
      print("[FYW] ride " + id + " refused: " + levelDistance(user, here).toFixed(1) + " m away")
      return
    }
    const delta = this.local(there).sub(this.local(here))
    this.rideOffset = this.rideOffset.add(delta)
    this.placeBuilding()
    if (this.debugPose) this.debugPose.pos = {x: there.x, y: there.y, z: there.z}
    this.hud.showCard(r.label.replace(/^Ride to |^Ride /, "") + " — " + levelName(this.place, there.y), r.icon, 2.5)
    print("[FYW] ride " + id + " -> " + r.to)
  }

  private afterRouteChange(): void {
    this.pendingSwing = true
    this.lastLineKey = ""
    if (this.phase === "arrived" && this.nav && this.nav.route.status !== "arrived") {
      this.phase = "nav"
      this.arrivalCard.hide()
    }
  }

  private notify(text: string, iconName: string | null): void {
    this.hud.showCard(text, iconName)
    if (this.chime) this.audio.play(1)
  }

  private firstEvent(type: string): PlaceEvent | null {
    for (const e of this.place.events) if (e.type === type) return e
    return null
  }

  private iconOfNode(id: string): string | null {
    const n: any = findNode(this.nav ? this.nav.map : this.map, id)
    return n && n.icon ? n.icon : null
  }

  // ── Scene placement ──────────────────────────────────────────────────────

  private yawAngle(): number {
    const d = this.camera.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    return Math.atan2(-d.x, -d.z)
  }

  private headYaw(): quat {
    return quat.angleAxis(this.yawAngle(), vec3.up())
  }

  private anchorWorld(): void {
    const t = this.camera.getTransform()
    this.world.getTransform().setWorldPosition(t.getWorldPosition())
    this.world.getTransform().setWorldRotation(this.headYaw())
    this.placeBuilding()
  }

  private eye(): number {
    return this.measuredEyeCm !== null ? this.measuredEyeCm : this.eyeHeightCm
  }

  private placeBuilding(): void {
    const b = this.building.getTransform()
    b.setLocalRotation(quat.quatIdentity())
    b.setLocalPosition(new vec3(this.signOffset.x, -this.eye(), this.signOffset.z).sub(this.rideOffset))
  }

  // Test / screenshot aid: move the building so the real camera sees it from the debug pose.
  private placeBuildingForPose(): void {
    if (!this.debugPose) return
    const cam = this.camera.getTransform().getWorldPosition()
    const rot = quat.angleAxis(this.yawAngle() + (this.debugPose.heading * Math.PI) / 180, vec3.up())
    const p = this.local(this.debugPose.pos)
    const pos = cam.sub(new vec3(0, this.eye(), 0)).sub(rot.multiplyVec3(p))
    this.building.getTransform().setWorldRotation(rot)
    this.building.getTransform().setWorldPosition(pos)
  }

  // Casts a ray straight down just in front of the user to find the floor (on Specs; the
  // Interactive Preview room returns no hit, so eyeHeightCm is used there).
  private probeFloor(): void {
    if (!this.hitSession || this.floorProbeFrames <= 0 || this.phase !== "mode") return
    this.floorProbeFrames--
    if (this.floorProbeFrames % 10 !== 0) return
    const cam = this.camera.getTransform().getWorldPosition()
    const start = cam.add(this.headYaw().multiplyVec3(new vec3(0, 0, -40)))
    this.hitSession.hitTest(start, start.add(new vec3(0, -300, 0)), (hit) => {
      if (!hit || hit.normal.y < 0.8) return
      const eye = this.camera.getTransform().getWorldPosition().y - hit.position.y
      if (eye < 90 || eye > 230) return
      if (this.measuredEyeCm === null || Math.abs(this.measuredEyeCm - eye) > 2) {
        this.measuredEyeCm = eye
        this.placeBuilding()
        print("[FYW] floor found: eye height " + eye.toFixed(1) + " cm")
      }
      this.floorProbeFrames = 0
    })
  }

  private placeModePanel(): void {
    const t = this.camera.getTransform()
    const yaw = this.headYaw()
    const p = t.getWorldPosition().add(yaw.multiplyVec3(this.modePanelOffset))
    const so = this.modePanel.getSceneObject()
    so.getTransform().setWorldPosition(p)
    so.getTransform().setWorldRotation(yaw)
  }

  private local(p: Vec3, liftCm: number = 0): vec3 {
    return this.frame.toLocal(p, liftCm)
  }

  private buildRides(map: MapData): void {
    this.rides = {}
    let i = 0
    for (const e of map.edges) {
      const f = findNode(map, e.from), t = findNode(map, e.to)
      if (!f || !t) continue
      const dy = t.y - f.y
      if (e.kind !== "lift" && Math.abs(dy) < 0.3) continue
      if (e.kind !== "lift" && e.kind !== "escalator" && e.kind !== "stairs" && e.kind !== "ramp") continue
      const ends: [MapNode, MapNode][] = e.kind === "escalator" ? [[f, t]] : [[f, t], [t, f]]
      for (const [a, b] of ends) {
        const up = b.y > a.y
        const lvl = levelName(this.place, b.y)
        let label = "", ic = "elevator", reach = 3.5
        if (e.kind === "lift") { label = "Ride to " + lvl; ic = "elevator"; reach = 2.5 }
        else if (e.kind === "escalator") { label = "Ride escalator " + (up ? "up" : "down"); ic = "escalator" }
        else if (e.kind === "stairs") { label = "Take stairs " + (up ? "up" : "down"); ic = "stairs" }
        else { label = "Take ramp " + (up ? "up" : "down"); ic = "accessible" }
        const id = "r" + i++ + "_" + a.id
        this.rides[id] = {id, edge: e, at: a.id, to: b.id, label, icon: ic, reach}
      }
    }
  }

  private buildPlace(): void {
    const map = this.map
    const place = this.place
    this.standIn.build(map, place, (x, y, z) => this.local({x, y, z}))
    const ui = this.buildingUI
    ui.clear()
    const start = findNode(map, place.start)
    if (start) {
      ui.setScanSign(this.local(start, 125), place.scanSign.title, place.scanSign.button,
        place.scanSign.hint, place.standInLabel)
      ui.addPlaceSign("StandIn", this.local(start, 300).add(new vec3(-260, 0, -150)),
        place.standInLabel, place.title, "map")
    }
    for (const n of map.nodes) {
      const any = n as any
      if (n.kind === "destination" || n.kind === "gate") {
        ui.addPlaceSign(n.id, this.local(n, 330), n.label || n.id, any.type || null, any.icon || null)
      } else if (n.kind === "assistance") {
        ui.addPlaceSign(n.id, this.local(n, 280), n.label || n.id, null, "info")
      } else if (n.kind === "lift") {
        ui.addPlaceSign(n.id, this.local(n, 290).add(new vec3(0, 0, -60)), n.label || n.id, null, "elevator")
      }
    }
    for (const e of map.edges) {
      if (e.kind !== "escalator" && e.kind !== "stairs" && e.kind !== "ramp") continue
      const f = findNode(map, e.from), t = findNode(map, e.to)
      if (!f || !t) continue
      const mid = {x: (f.x + t.x) / 2, y: Math.max(f.y, t.y), z: (f.z + t.z) / 2}
      const dir = t.y > f.y ? " ↑" : t.y < f.y ? " ↓" : ""
      const label = e.kind === "escalator" ? "Escalator" + dir : e.kind === "stairs" ? "Stairs" : "Ramp"
      const ic = e.kind === "escalator" ? "escalator" : e.kind === "stairs" ? "stairs" : "accessible"
      ui.addPlaceSign("conn_" + e.from + "_" + e.to + "_" + e.kind, this.local(mid, 260), label, null, ic)
    }
    this.buildRides(map)
    for (const id in this.rides) {
      const r = this.rides[id]
      const a = findNode(map, r.at)!, b = findNode(map, r.to)!
      let pos: vec3
      if (r.edge.kind === "lift") {
        // inside the shaft, on the side wall opposite the red out-of-service plate
        const ad = approachDir(map, a.id)
        const fwd = new vec3(ad.x, 0, -ad.z)
        const side = new vec3(-fwd.z, 0, fwd.x)
        pos = this.local(a, 115).add(side.uniformScale(70)).sub(fwd.uniformScale(30))
      } else {
        // beside the foot of the escalator / stairs / ramp, facing the way in
        const pa = this.local(a), pb = this.local(b)
        let dir = new vec3(pb.x - pa.x, 0, pb.z - pa.z)
        dir = dir.length > 1 ? dir.normalize() : new vec3(0, 0, -1)
        const side = new vec3(-dir.z, 0, dir.x)
        pos = pa.add(side.uniformScale(80)).add(dir.uniformScale(30)).add(new vec3(0, 115, 0))
      }
      ui.addRideButton(id, pos, r.label, r.icon)
    }
    for (const ev of place.events) {
      if (ev.type !== "connectionClosed" || !ev.at || !ev.edge) continue
      const n = findNode(map, ev.at)
      if (!n) continue
      // on the red plate by the shaft opening, facing the approach
      const ad = approachDir(map, n.id)
      const fwd = new vec3(ad.x, 0, -ad.z)
      const side = new vec3(-fwd.z, 0, fwd.x)
      ui.addClosureSign(ev.edge, this.local(n, 150).sub(side.uniformScale(70)).add(fwd.uniformScale(60)), ev.sign || "Out of service")
    }
    const dc = this.firstEvent("destinationChanged")
    this.demoControls.setEventLabel(dc ? dc.button || dc.card || "Change destination" : null,
      dc && dc.to ? this.iconOfNode(dc.to) : null)
    this.demoControls.setMapName(place.title)
    this.arrivalCard.hide()
    this.routeLine.clear()
    this.turnArrow.hide()
  }

  // ── Per-frame ────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.camera || !this.demoControls) return
    if (this.anchorFrames > 0) {
      this.anchorFrames--
      this.anchorWorld()
      if (this.phase === "mode") this.placeModePanel()
    }
    this.probeFloor()
    this.followDemoControls()
    if (this.viewFollowsPose && this.debugPose) this.placeBuildingForPose()
    if ((this.phase !== "nav" && this.phase !== "arrived") || !this.nav) return
    const pos = this.userPos()
    const progress = this.nav.updatePosition(pos)
    if (progress === "rerouted") {
      // Navigator reports "rerouted" only when the planned nodes changed.
      this.pendingSwing = true
      this.lastLineKey = ""
      this.reportRoute("off route")
    }
    if (this.nav.route.status === "arrived") {
      if (this.phase !== "arrived") {
        this.phase = "arrived"
        this.routeLine.clear()
        this.turnArrow.hide()
        this.lineMapPoints = []
        const d = findNode(this.nav.map, this.nav.to)
        if (d) this.arrivalCard.show(arrivalText(this.nav.map, this.nav.to), this.local(d, 200), this.iconOfNode(this.nav.to))
        print("[FYW] arrived at " + this.nav.to)
      }
      return
    }
    if (this.phase === "arrived") {
      this.phase = "nav"
      this.arrivalCard.hide()
    }
    this.updateLine(pos)
    this.updateArrow(pos)
  }

  private routeMapPoints(): Vec3[] {
    if (!this.nav) return []
    const r = this.nav.route
    if (r.status === "route") return routePoints(this.nav.map, r)
    if (r.status === "askStaff" && r.assistance) {
      return r.assistance.nodes.map((id) => {
        const n = findNode(this.nav!.map, id)!
        return {x: n.x, y: n.y, z: n.z}
      })
    }
    return []
  }

  private updateLine(pos: Vec3): void {
    const pts = stopAtLift(lineAhead(this.routeMapPoints(), pos, this.lineAheadM))
    const key = pts.map((p) => Math.round(p.x * 20) + "," + Math.round(p.y * 20) + "," + Math.round(p.z * 20)).join(";")
    if (key === this.lastLineKey && !this.pendingSwing) return
    this.lastLineKey = key
    this.lineMapPoints = pts
    const local = pts.map((p) => this.local(p, 1))
    this.routeLine.setPath(local.length > 1 ? local : [], this.lineAheadM * 100, this.pendingSwing)
    this.pendingSwing = false
  }

  private updateArrow(pos: Vec3): void {
    const turn = nextTurnAlong(lineAhead(this.routeMapPoints(), pos, 100000))
    const heading = this.userHeading()
    if (!turn || !turnOutOfView(pos, heading, turn, this.halfViewDeg)) {
      this.turnArrow.hide()
      return
    }
    this.turnArrow.show(yawTo(pos, heading, turn) as number)
  }

  private followDemoControls(): void {
    const t = this.camera.getTransform()
    const yaw = this.headYaw()
    const target = t.getWorldPosition().add(yaw.multiplyVec3(this.demoOffset))
    const so = this.demoControls.getSceneObject().getTransform()
    const k = this.demoInit ? 1 - Math.exp(-getDeltaTime() * 4) : 1
    this.demoInit = true
    const p = vec3.lerp(so.getWorldPosition(), target, k)
    so.setWorldPosition(p)
    // Face the eyes (yaw and pitch) so the low panel reads square-on.
    so.setWorldRotation(quat.lookAt(t.getWorldPosition().sub(p).normalize(), vec3.up()))
  }

  // User position in map metres (feet), from the camera or a test override.
  private userPos(): Vec3 {
    if (this.debugPose) return this.debugPose.pos
    const inv = this.building.getTransform().getInvertedWorldTransform()
    const local = inv.multiplyPoint(this.camera.getTransform().getWorldPosition())
    return this.frame.toMap(local, this.eye())
  }

  // Heading in degrees clockwise from map north. Looking straight down or up gives no
  // horizontal direction, so keep the last valid heading then.
  private userHeading(): number {
    if (this.debugPose) return this.debugPose.heading
    const inv = this.building.getTransform().getInvertedWorldTransform()
    const d = inv.multiplyDirection(this.camera.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1)))
    const flat = Math.sqrt(d.x * d.x + d.z * d.z)
    if (flat < 0.25) return this.lastHeading
    this.lastHeading = (Math.atan2(d.x, -d.z) * 180) / Math.PI
    return this.lastHeading
  }

  private reportRoute(why: string): void {
    if (!this.nav) return
    const r = this.nav.route
    const nodes = r.status === "route" ? r.nodes.join(">") : r.status
    print("[FYW] route (" + why + ", " + this.nav.profile + "): " + nodes)
  }

  // ── Read-only state + test hooks (used by the LEAF scenarios) ────────────

  getPhase(): Phase { return this.phase }
  getProfile(): Profile | null { return this.profile }
  getMapKey(): string { return MAP_SOURCES[this.mapIndex].key }
  getMapData(): MapData { return this.nav ? this.nav.map : this.map }
  getMapSource(): string | null { return this.mapSource }
  getDestinationId(): string { return this.nav ? this.nav.to : this.place.destination }
  getStartId(): string { return this.place.start }
  getRouteStatus(): string { return this.nav ? this.nav.route.status : "none" }
  getRouteNodes(): string[] { return this.nav && this.nav.route.status === "route" ? this.nav.route.nodes.slice() : [] }
  getRouteEdgeKinds(): string[] {
    return this.nav && this.nav.route.status === "route" ? this.nav.route.edges.map((e) => e.kind) : []
  }
  getRouteLength(): number { return this.nav && this.nav.route.status === "route" ? this.nav.route.length : -1 }
  isLineVisible(): boolean { return this.routeLine.isShowing() }
  getLineMapPoints(): Vec3[] { return this.lineMapPoints.slice() }
  getLineLocalPoints(): vec3[] { return this.routeLine.getPoints() }
  isTurnArrowVisible(): boolean { return this.turnArrow.isShown() }
  isLineSwinging(): boolean { return this.routeLine.isSwinging() }
  getHudCardText(): string | null { return this.hud.getCardText() }
  getBadgeText(): string | null { return this.hud.getBadgeText() }
  getArrivalText(): string | null { return this.arrivalCard.getShownText() }
  isScanSignVisible(): boolean { return this.buildingUI.isScanSignVisible() }
  isModePanelShown(): boolean { return this.modePanel.isShown() }
  getEyeHeightCm(): number { return this.eye() }
  getRideOffsetCm(): vec3 { return this.rideOffset }
  // Ride button ids ("r<n>_<node>") for a given start node, e.g. "escFoot".
  // The ride button id at a node for a given connection kind ("lift", "escalator", "stairs", "ramp").
  getRideIdFor(nodeId: string, kind: string): string | null {
    for (const id in this.rides) if (this.rides[id].at === nodeId && this.rides[id].edge.kind === kind) return id
    return null
  }
  getDebugPose(): {pos: Vec3; heading: number} | null { return this.debugPose }
  getRideIdsAt(nodeId: string): string[] {
    return Object.keys(this.rides).filter((id) => this.rides[id].at === nodeId)
  }
  // Building-local cm of a point given in map metres (for view-angle checks in tests).
  mapToLocal(x: number, y: number, z: number): vec3 { return this.local({x, y, z}) }

  debugSetPose(x: number, y: number, z: number, headingDeg: number): void {
    this.debugPose = {pos: {x, y, z}, heading: headingDeg}
  }

  getHudCardTextOrEmpty(): string { return this.hud.getCardText() || "" }
  isEdgeOpen(edgeId: string): boolean {
    for (const e of this.getMapData().edges) if (e.id === edgeId) return e.open
    return false
  }
  isArrivalCardShown(): boolean { return this.arrivalCard.getShownText() !== null }

  // Test hooks: set before the sign is scanned (cleared by Restart).
  debugSetDownloadOverride(text: string | null): void { this.downloadOverride = text }
  debugSetStartOverride(signId: string | null): void { this.startOverride = signId }
  debugSetDestinationOverride(nodeId: string | null): void { this.destinationOverride = nodeId }
  // Closes any connection by edge id, exactly as pinching its red sign would.
  debugCloseEdge(edgeId: string): void { this.closeConnection(edgeId) }

  debugClearPose(): void {
    this.debugPose = null
    this.viewFollowsPose = false
    this.placeBuilding()
  }

  // Screenshot aid: the real camera sees the building from the debug pose.
  debugSetViewFollowsPose(on: boolean): void {
    this.viewFollowsPose = on
    if (!on) this.placeBuilding()
  }
}
