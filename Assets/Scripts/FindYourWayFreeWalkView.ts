// FindYourWayFreeWalkView — shows one frame of a Free walk: the floor pill, the offers button and list,
// the companion, its bubble and the arrow to it. Created by FindYourWayMain. Must not: decide any of
// it; FindYourWayFreeWalk does.

import {Vec3} from "./FindYourWayRouter"
import {levelName, PlaceInfo} from "./FindYourWayMapLibrary"
import {turnOutOfView, yawTo} from "./FindYourWayGeometry"
import {FreeWalk, ShopLook} from "./FindYourWayFreeWalk"
import {FindYourWayBubbleUI} from "./FindYourWayBubbleUI"
import {FindYourWayCompanionView} from "./FindYourWayCompanionView"
import {FindYourWayHudUI} from "./FindYourWayHudUI"
import {FindYourWayOfferUI} from "./FindYourWayOfferUI"
import {FindYourWayPanelFollow} from "./FindYourWayPanelFollow"
import {FindYourWayTurnArrow} from "./FindYourWayTurnArrow"

// The offers button, from the head (right, up, forward), cm: inside the Specs view, clear of the panels.
const DOT_OFFSET = new vec3(13, 4, -100)
// The companion's bubble floats this high above its feet (cm).
const BUBBLE_ABOVE_CM = 115

export interface FreeWalkViewHost {
  camera: SceneObject
  place: PlaceInfo
  hud: FindYourWayHudUI
  turnArrow: FindYourWayTurnArrow
  offerUI: FindYourWayOfferUI | null
  view: FindYourWayCompanionView | null
  bubble: FindYourWayBubbleUI | null
  panels: FindYourWayPanelFollow
  offerOffset: vec3
  halfViewDeg: number
  userPos(): Vec3
  userHeading(): number
  local(p: Vec3, liftCm?: number): vec3
  playChime(): void
}

export class FindYourWayFreeWalkView {
  private shownOpen: string | null = null
  private offerPlaced = false

  constructor(private host: FreeWalkViewHost) {}

  reset(): void {
    this.shownOpen = null
    this.offerPlaced = false
  }

  // A guided trip: the button and short card of the shop you look at (no list); null hides them.
  showLook(look: ShopLook | null, pos: Vec3): void {
    const offer = this.host.offerUI
    if (!offer) return
    const dot = look ? look.dot() : null
    offer.showDot(dot !== null)
    if (dot === null || !look) {
      offer.setPeek(null)
      return
    }
    offer.setDotText(look.label(pos))
    offer.setPeek(look.peek(pos))
    const cam = this.host.camera.getTransform()
    offer.placeDot(cam.getWorldPosition().add(cam.getWorldRotation().multiplyVec3(DOT_OFFSET)), cam.getWorldRotation())
  }

  tick(free: FreeWalk): void {
    const pos = this.host.userPos()
    const heading = this.host.userHeading()
    const now = getTime()
    const f = free.update(pos, heading, getDeltaTime(), now)
    this.host.hud.setPill(levelName(this.host.place, pos.y) + " · Free walk")
    const cam = this.host.camera.getTransform()
    const offer = this.host.offerUI
    if (offer) {
      offer.showDot(f.dot !== null)
      offer.setDotText(free.dotText(pos))
      offer.setPeek(f.dot !== null && f.open === null ? free.peek(pos) : null)
      if (f.dot !== null) offer.placeDot(cam.getWorldPosition().add(cam.getWorldRotation().multiplyVec3(DOT_OFFSET)), cam.getWorldRotation())
      if (f.open !== this.shownOpen) {
        this.shownOpen = f.open
        offer.showList(free.list(pos))
        this.offerPlaced = false
      }
      if (f.open !== null) {
        this.host.panels.follow(offer.listRootObject(), this.host.offerOffset, this.offerPlaced)
        this.offerPlaced = true
      }
    }
    const pet = f.pet
    if (this.host.view && pet) {
      const pointing = pet.mood === "point"
      this.host.view.setPointing(pointing)
      this.host.view.setMood(pet.mood)
      this.host.view.setPose(this.host.local(pet.pos), pet.heading)
    }
    if (this.host.bubble) this.host.bubble.show(f.bubble, pet ? this.host.local(pet.pos, BUBBLE_ABOVE_CM) : null)
    if (f.stopped) {
      print("[FYW] companion stops at " + f.stopped + (f.bubble ? " (" + f.bubble + ")" : ""))
      this.host.playChime()
    }
    // If it is out of view at a stop, the turn arrow points to it.
    if (pet && f.pointing && turnOutOfView(pos, heading, pet.pos, this.host.halfViewDeg)) this.host.turnArrow.show(yawTo(pos, heading, pet.pos) as number)
    else this.host.turnArrow.hide()
  }
}
