// FindYourWayPlayTime — play while you wait: Hop (raise a hand to jump) and catch (throw a treat, by
// hand or button), standing or seated. Owns the games and when they may run. Created by
// FindYourWayMain, which calls update() each frame of a trip. Must not: change the route.

import {MapData, Navigator, TripAhead, Vec3} from "./FindYourWayRouter"
import {Companion, PetGuide} from "./FindYourWayPet"
import {CatchGame, canThrow, HOP_LANE, HopGame, hopText, landingSpot, PlayGate, PlayXYZ, RaiseDetector, releaseVelocity, SEATED_LANE, SEATED_THROW_MAX, SeatedDetector, seatedPlaySpot, THROW_MAX} from "./FindYourWayPlay"
import {mapLevels} from "./FindYourWayTour"
import {FindYourWayAppPanelUI} from "./FindYourWayAppPanelUI"
import {FindYourWayCompanionView} from "./FindYourWayCompanionView"
import {FindYourWayHudUI} from "./FindYourWayHudUI"
import SIK from "SpectaclesInteractionKit.lspkg/SIK"

// Hop lane: starts this far ahead of you (m), so you see the companion from behind.
const HOP_AHEAD_M = 1.3
// Catch: the treat leaves your hand at this height above the floor (m) and speed (m/s).
const THROW_FROM_M = 1.2
const THROW_SPEED = 6
// The treat you grab floats here, relative to your head (cm).
const GRAB_OFFSET = new vec3(20, -28, -45)
const HOP_RUN_MS = 2.4 // Hop's lane moves under the companion: its legs run at this speed
const CAUGHT_LINE_S = 2.5

export interface PlayHost {
  camera: SceneObject
  building: SceneObject
  map: MapData
  nav: Navigator | null
  trip: TripAhead | null
  guide: PetGuide
  companion: Companion
  view: FindYourWayCompanionView | null
  appPanel: FindYourWayAppPanelUI | null
  hud: FindYourWayHudUI
  userPos(): Vec3
  userHeading(): number
  local(p: Vec3, liftCm?: number): vec3
  eye(): number
  cameraPos(): vec3
  headYaw(): quat
  cardShowing(): boolean
  playChime(): void
  testDropM(): number // the simulated crouch, while a test sets the pose
}

export class FindYourWayPlayTime {
  gate = new PlayGate()
  hop = new HopGame()
  seated = new SeatedDetector()
  catchGame = new CatchGame()
  catchSpot: Vec3 | null = null
  hopOrigin: Vec3 | null = null
  debugRaise = false
  private hopSeated = false
  private hopHeading = 0
  private grabbing = false
  private grabSamples: {t: number; x: number; y: number; z: number}[] = []
  private raiseByHand: {[hand: string]: RaiseDetector} = {left: new RaiseDetector(), right: new RaiseDetector()}
  private catchHeading = 0
  private caughtUntil = 0

  constructor(private host: PlayHost) {}

  reset(): void {
    this.stopPlay()
    this.gate.reset()
    this.seated.reset()
    this.grabbing = false
    if (this.host.view) this.host.view.setGrab(null)
    this.catchGame = new CatchGame()
    this.catchSpot = null
  }

  // One frame of a trip. True when play drew the companion, or it is off, so the guide must not.
  update(pos: Vec3): boolean {
    if (!this.host.view) return true
    const dt = getDeltaTime()
    const now = getTime()
    this.gate.update(pos, dt, {companionOn: this.host.guide.on, cardShowing: this.host.cardShowing()})
    this.seated.update(this.headAboveFloorM(pos), this.host.eye() / 100, dt)
    if (this.hop.phase !== "idle" && (!this.gate.canPlay || this.hopSeated !== this.seated.seated)) this.stopPlay()
    const nearChange = !!this.host.trip && !!this.host.trip.next && this.host.trip.next.metres < 10
    const throwOk = canThrow({moving: !this.gate.canPlay, nearChange, cardShowing: this.host.cardShowing(), companionOn: this.host.guide.on})
    if (this.host.appPanel) this.host.appPanel.setPlay(this.gate.canPlay, this.hop.phase !== "idle", throwOk && this.catchGame.phase === "idle")
    this.updateGrabTreat(throwOk && this.catchGame.phase === "idle" && this.hop.phase === "idle")
    if (!this.host.guide.on) {
      this.host.hud.setPlayLine(null)
      return true
    }
    if (this.hop.phase !== "idle") {
      if (this.handRaised()) this.jump()
      this.hop.update(dt)
      const origin = this.hopOrigin as Vec3
      this.host.view.setLane(this.host.local(origin), this.hopHeading, this.hop.obstacles, this.hop.lane)
      this.host.view.setMood("run", HOP_RUN_MS)
      this.host.view.setPose(this.host.local(origin), this.hopHeading, this.hop.petY * 100, this.hop.shaking ? 1 : 0)
      this.host.hud.setPlayLine(hopText(this.hop, this.host.companion))
      return true
    }
    this.host.view.setLane(null, 0, [])
    if (this.catchGame.phase !== "idle") {
      const before = {x: this.catchGame.pos.x, y: this.catchGame.pos.y, z: this.catchGame.pos.z}
      const r = this.catchGame.update(dt, pos)
      if (r.caught) this.host.playChime()
      // Face the way it runs.
      const dx = r.pos.x - before.x, dz = r.pos.z - before.z
      if (dx * dx + dz * dz > 1e-8) this.catchHeading = (Math.atan2(dx, dz) * 180) / Math.PI
      this.host.view.setMood("run")
      this.host.view.setPose(this.host.local(r.pos), this.catchHeading, r.caught ? 15 : 0)
      this.host.view.setTreat(r.phase === "fetch" && this.catchSpot ? this.host.local(this.catchSpot) : null)
      this.host.hud.setPlayLine(null)
      if (r.phase === "idle") {
        this.caughtUntil = now + CAUGHT_LINE_S
        this.catchSpot = null
        this.host.guide.pet = {pos: r.pos, heading: 0, mood: "lead"}
      }
      return true
    }
    return false
  }

  // The line under the score when nothing is being played.
  idleLine(now: number): string | null {
    return now < this.caughtUntil ? "Caught! " + this.catchGame.catches + " so far"
      : this.gate.canPlay ? hopText(this.hop, this.host.companion) : null
  }

  // Play while you wait (Hop): the lane starts HOP_AHEAD_M ahead of you, along where you look.
  toggle(): void {
    if (this.hop.phase !== "idle") {
      this.stopPlay()
      return
    }
    if (!this.gate.canPlay || !this.host.nav) return
    const pos = this.host.userPos()
    this.hopHeading = this.host.userHeading()
    const r = (this.hopHeading * Math.PI) / 180
    this.hopSeated = this.seated.seated
    const laneM = this.hopSeated ? SEATED_LANE : HOP_LANE
    if (this.hop.lane !== laneM) this.hop = new HopGame(Math.random, laneM)
    const floor = this.floorUnder(pos)
    this.hopOrigin = this.hopSeated
      ? seatedPlaySpot({x: pos.x, y: floor + this.headAboveFloorM(pos), z: pos.z}, {x: Math.sin(r), z: Math.cos(r)}, floor).start
      : {x: pos.x + Math.sin(r) * HOP_AHEAD_M, y: pos.y, z: pos.z + Math.cos(r) * HOP_AHEAD_M}
    this.catchGame.cancel()
    this.catchSpot = null
    this.debugRaise = false
    if (this.host.view) this.host.view.setTreat(null)
    this.hop.start()
    print("[FYW] hop: start")
  }

  // The floor you're on, and your head above it (standing or seated).
  private floorUnder(pos: Vec3): number {
    if (this.host.nav) return this.host.nav.snapFeet(pos.y)
    let floor = pos.y
    let gap = Infinity
    for (const l of mapLevels(this.host.map)) {
      if (Math.abs(l.y - pos.y) < gap) {
        gap = Math.abs(l.y - pos.y)
        floor = l.y
      }
    }
    return floor
  }

  private headAboveFloorM(pos: Vec3): number {
    const drop = this.host.testDropM()
    return pos.y - this.floorUnder(pos) + this.host.eye() / 100 - drop
  }

  stopPlay(): void {
    if (this.hop.phase === "idle") return
    this.hop.stop()
    this.hopOrigin = null
    if (this.host.view) this.host.view.setLane(null, 0, [])
    this.host.hud.setPlayLine(null)
    print("[FYW] hop: stop")
  }

  // A raised hand (or the Jump button): jump, or after a bump, play again.
  jump(): boolean {
    const did = this.hop.jump()
    if (did && this.hop.phase === "running" && this.hop.score === 0 && this.hop.obstacles.length === 0) print("[FYW] hop: play again")
    return did
  }

  // Either hand's wrist near head height counts as raised (once per raise).
  private handRaised(): boolean {
    let raised = false
    if (this.debugRaise) {
      this.debugRaise = false
      return true
    }
    try {
      const head = this.host.cameraPos().y
      for (const side of ["left", "right"]) {
        const hand = SIK.HandInputData.getHand(side as "left" | "right")
        const h = hand && hand.isTracked() ? (hand.wrist.position.y - head) / 100 : null
        if (this.raiseByHand[side].update(h)) raised = true
      }
    } catch (e) {
      // No hand tracking (editor without SIK): only the Jump button.
    }
    return raised
  }

  // Catch: throw the treat ahead of you (on Specs: grab and throw; the button throws straight ahead).
  throwTreat(): void {
    if (!this.host.nav || !this.host.guide.on || !this.host.guide.pet || this.catchGame.phase !== "idle") return
    const nearChange = !!this.host.trip && !!this.host.trip.next && this.host.trip.next.metres < 10
    if (!canThrow({moving: !this.gate.canPlay, nearChange, cardShowing: this.host.cardShowing(), companionOn: this.host.guide.on})) return
    const pos = this.host.userPos()
    const r = (this.host.userHeading() * Math.PI) / 180
    this.throwWith({x: Math.sin(r) * THROW_SPEED * 0.7, y: THROW_SPEED * 0.7, z: Math.cos(r) * THROW_SPEED * 0.7})
  }

  private throwWith(v: PlayXYZ): void {
    if (!this.host.guide.pet) return
    const pos = this.host.userPos()
    const reach = this.seated.seated ? SEATED_THROW_MAX : THROW_MAX
    this.catchSpot = landingSpot({x: pos.x, y: pos.y + THROW_FROM_M, z: pos.z}, v, pos.y, reach)
    this.catchGame.throwTo(this.catchSpot, this.host.guide.pet.pos)
    print("[FYW] catch: thrown")
  }

  // The treat by your hand: pinch it and throw. It stays by you while you may throw.
  private updateGrabTreat(canGrab: boolean): void {
    if (!this.host.view) return
    if (this.grabbing) {
      const p = this.host.view.getGrabWorldPos()
      if (p) {
        const local = this.host.building.getTransform().getInvertedWorldTransform().multiplyPoint(p)
        this.grabSamples.push({t: getTime(), x: local.x / 100, y: local.y / 100, z: -local.z / 100})
        if (this.grabSamples.length > 30) this.grabSamples.shift()
      }
      return
    }
    if (!canGrab) {
      this.host.view.setGrab(null)
      return
    }
    const t = this.host.camera.getTransform()
    this.host.view.setGrab(t.getWorldPosition().add(this.host.headYaw().multiplyVec3(GRAB_OFFSET)))
  }

  grabStarted(): void {
    this.grabbing = true
    this.grabSamples = []
  }

  grabEnded(): void {
    if (!this.grabbing) return
    this.grabbing = false
    const v = releaseVelocity(this.grabSamples)
    print("[FYW] catch: let go, " + this.grabSamples.length + " samples, " + (v ? "thrown" : "no swing"))
    if (v && this.host.nav && this.host.guide.on && this.catchGame.phase === "idle") this.throwWith(v)
  }
}
