// FindYourWayPlaceBuilder — puts what a map describes into the building: the stand-in, the scan
// board, shop and floor signs, ride buttons, closure signs and place icons. Created by FindYourWayMain,
// which calls build() whenever the map changes. Must not: hold trip state or change the route.

import {findNode, MapData, MapEdge, MapNode, tripSettings, Vec3} from "./FindYourWayRouter"
import {approachDir, levelName, PlaceEvent, PlaceInfo} from "./FindYourWayMapLibrary"
import {placesOf, placeTag} from "./FindYourWayPlaces"
import {FindYourWayArrivalUI} from "./FindYourWayArrivalUI"
import {FindYourWayBuildingUI} from "./FindYourWayBuildingUI"
import {FindYourWayDemoControlsUI} from "./FindYourWayDemoControlsUI"
import {FindYourWayPlacesUI} from "./FindYourWayPlacesUI"
import {FindYourWayRouteLine} from "./FindYourWayRouteLine"
import {FindYourWayStandIn} from "./FindYourWayStandIn"
import {FindYourWayTurnArrow} from "./FindYourWayTurnArrow"

// Heights (cm above a node's floor) of the signs placed in the building.
// Heights (cm above a node's floor) of the signs placed in the building.
const SCAN_SIGN_CM = 125
const DEST_SIGN_CM = 330 // overhead destination signs
const SHOP_SIGN_CM = 300 // a shop's name, on its awning
const SHOP_SIGN_SCALE = 7
// In the preview the name sits on the shop's own fascia, big enough to read down the mall.
const FASCIA_SIGN_CM = 262
const FASCIA_SIGN_SCALE = 11
const FASCIA_TEXT_SIZE = 200
const FASCIA_AHEAD_CM = 150 // from the shop's front back toward the node
const ASSIST_SIGN_CM = 280
const LIFT_SIGN_CM = 290
const CONNECTION_SIGN_CM = 260 // escalator / stairs / ramp signs
const PLACE_SIGN_CM = 300 // the "stand-in building" title sign
const CLOSURE_SIGN_CM = 120 // the red out-of-service sign: ~1.2 m, readable seated or standing
const RIDE_BUTTON_CM = 115
const SPONSORED_SIGN = "Sponsored"
const SCAN_PANEL_AHEAD_CM = 160
const SCAN_PANEL_RIGHT_CM = 10 // clear of the Demo controls on the left
const SCAN_PANEL_BELOW_EYE_CM = 15
// In the preview it sits on a board that stands in the place: further off, and beside the way in.
const BOARD_AHEAD_CM = 340
const BOARD_RIGHT_CM = 62
const BOARD_BELOW_EYE_CM = 45
const PLACE_FACE_CM = 0 // place icons sit on the node (the shop front)

// A ride: from one end of a lift / escalator / stairs / ramp edge to the other.
export interface Ride {
  id: string
  edge: MapEdge
  at: string
  to: string
  label: string
  icon: string
  reach: number // metres (horizontal, same level) from `at` within which the button works
}

export interface PlaceBuilderHost {
  map: MapData
  place: PlaceInfo
  standIn: FindYourWayStandIn
  buildingUI: FindYourWayBuildingUI
  demoControls: FindYourWayDemoControlsUI
  arrivalCard: FindYourWayArrivalUI
  routeLine: FindYourWayRouteLine
  turnArrow: FindYourWayTurnArrow
  placesUI: FindYourWayPlacesUI | null
  startAtSign: boolean
  local(p: Vec3, liftCm?: number): vec3
  eye(): number
  firstEvent(type: string): PlaceEvent | null
  iconOfNode(id: string): string | null
}

export class FindYourWayPlaceBuilder {
  private rides: {[id: string]: Ride} = {}

  constructor(private host: PlaceBuilderHost) {}

  private buildRides(map: MapData): void {
    this.rides = {}
    const reach = tripSettings(map).rideReach
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
        const lvl = levelName(this.host.place, b.y)
        let label = "", ic = "elevator"
        if (e.kind === "lift") { label = "Ride to " + lvl; ic = "elevator" }
        else if (e.kind === "escalator") { label = "Ride escalator " + (up ? "up" : "down"); ic = "escalator" }
        else if (e.kind === "stairs") { label = "Take stairs " + (up ? "up" : "down"); ic = "stairs" }
        else { label = "Take ramp " + (up ? "up" : "down"); ic = "accessible" }
        const id = "r" + i++ + "_" + a.id
        this.rides[id] = {id, edge: e, at: a.id, to: b.id, label, icon: ic, reach: e.kind === "lift" ? reach.lift : reach.other}
      }
    }
  }

  private fasciaSpot(n: MapNode): vec3 {
    const ad = approachDir(this.host.map, n.id)
    return this.host.local(n, FASCIA_SIGN_CM).sub(new vec3(ad.x, 0, -ad.z).uniformScale(FASCIA_AHEAD_CM))
  }

  // Everything in the building that comes from the map. Returns the rides it made buttons for.
  build(): {[id: string]: Ride} {
    const map = this.host.map
    const place = this.host.place
    this.host.standIn.build(map, place, (x, y, z) => this.host.local({x, y, z}))
    const ui = this.host.buildingUI
    ui.clear()
    const start = findNode(map, place.start)
    if (start) {
      // Standing at the sign: on Specs the real sign is in front of you and the panel floats by it; in
      // the preview the board stands in the place.
      const board = this.host.standIn.isSolid()
      const scanAt = this.host.startAtSign
        ? this.host.local(start, this.host.eye() - (board ? BOARD_BELOW_EYE_CM : SCAN_PANEL_BELOW_EYE_CM))
          .add(board ? new vec3(BOARD_RIGHT_CM, 0, -BOARD_AHEAD_CM) : new vec3(SCAN_PANEL_RIGHT_CM, 0, -SCAN_PANEL_AHEAD_CM))
        : this.host.local(start, SCAN_SIGN_CM)
      this.host.standIn.addDirectory(map, place.start, scanAt, this.host.local(start).y, (x, y, z) => this.host.local({x, y, z}))
      ui.setScanSign(scanAt, place.scanSign.title, place.scanSign.button,
        place.scanSign.hint, place.standInLabel)
      ui.addPlaceSign("StandIn", this.host.local(start, PLACE_SIGN_CM).add(new vec3(-260, 0, -150)),
        place.standInLabel, place.title, "map")
    }
    for (const n of map.nodes) {
      if (n.kind === "destination" || n.kind === "gate") {
        if (this.host.standIn.isSolid()) ui.addPlaceSign(n.id, this.fasciaSpot(n), n.label || n.id, null, n.icon || null, FASCIA_SIGN_SCALE, FASCIA_TEXT_SIZE)
        else ui.addPlaceSign(n.id, this.host.local(n, DEST_SIGN_CM), n.label || n.id, n.type || null, n.icon || null)
      } else if (n.kind === "place" && n.front) {
        // The shop's name over its front, readable from the walkway.
        const tag = n.sponsored ? SPONSORED_SIGN : null
        if (this.host.standIn.isSolid()) ui.addPlaceSign(n.id, this.fasciaSpot(n), n.label || n.id, tag, null, FASCIA_SIGN_SCALE, FASCIA_TEXT_SIZE)
        else ui.addPlaceSign(n.id, this.host.local(n, SHOP_SIGN_CM), n.label || n.id, tag, null, SHOP_SIGN_SCALE)
      } else if (n.kind === "assistance") {
        ui.addPlaceSign(n.id, this.host.local(n, ASSIST_SIGN_CM), n.label || n.id, null, "info")
      } else if (n.kind === "lift") {
        ui.addPlaceSign(n.id, this.host.local(n, LIFT_SIGN_CM).add(new vec3(0, 0, -60)), n.label || n.id, null, "elevator")
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
      ui.addPlaceSign("conn_" + e.from + "_" + e.to + "_" + e.kind, this.host.local(mid, CONNECTION_SIGN_CM), label, null, ic)
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
        pos = this.host.local(a, RIDE_BUTTON_CM).add(side.uniformScale(70)).sub(fwd.uniformScale(30))
      } else {
        // beside the foot of the escalator / stairs / ramp, facing the way in
        const pa = this.host.local(a), pb = this.host.local(b)
        let dir = new vec3(pb.x - pa.x, 0, pb.z - pa.z)
        dir = dir.length > 1 ? dir.normalize() : new vec3(0, 0, -1)
        const side = new vec3(-dir.z, 0, dir.x)
        pos = pa.add(side.uniformScale(80)).add(dir.uniformScale(30)).add(new vec3(0, RIDE_BUTTON_CM, 0))
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
      ui.addClosureSign(ev.edge, this.host.local(n, CLOSURE_SIGN_CM).sub(side.uniformScale(70)).add(fwd.uniformScale(60)), ev.sign || "Out of service")
    }
    const dc = this.host.firstEvent("destinationChanged")
    this.host.demoControls.setEventLabel(dc ? dc.button || dc.card || "Change destination" : null,
      dc && dc.to ? this.host.iconOfNode(dc.to) : null)
    this.host.demoControls.setMapName(place.title)
    this.host.arrivalCard.hide()
    this.host.routeLine.clear()
    this.host.turnArrow.hide()
    this.buildPlaceIcons()
    return this.rides
  }

  private buildPlaceIcons(): void {
    if (!this.host.placesUI) return
    this.host.placesUI.clear()
    const map = this.host.map
    const all = placesOf(map)
    for (const n of map.nodes) {
      if (n.kind === "lift") all.push({id: n.id, x: n.x, y: n.y, z: n.z, label: n.label || n.id, category: "lift", sponsored: false, sponsorTag: ""})
    }
    for (const p of all) {
      const ad = approachDir(map, p.id)
      // Face the walkway the place is approached from.
      const yaw = Math.atan2(ad.x, -ad.z)
      this.host.placesUI.addPlace(p.id, this.host.local(p, PLACE_FACE_CM), yaw, p.label, p.category, p.category === "lift" ? "" : placeTag(p), p.sponsored)
    }
  }
}
