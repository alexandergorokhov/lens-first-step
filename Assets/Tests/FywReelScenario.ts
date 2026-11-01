import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode, Vec3} from "../Scripts/FindYourWayRouter"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {bundledMaps, getMain, waitFor} from "./FindYourWayLeafSupport"
import {nodePos, standStill} from "./FywBrief2Support"

const WALK_MS = 2.2 // walking pace of the reel (m/s)

// visual-reel — the 3-minute video from design-brief-4, played on the real app. Not a test: "visual-"
// keeps it out of the runner's "all". [REEL] lines mark each beat and what to cut in the edit.
@component
export class FywReelScenario extends Scenario {
  private t0 = 0
  private main: FindYourWayMain

  private cap(text: string | null): void {
    print("[REEL] " + (getTime() - this.t0).toFixed(1) + " " + (text || "(no caption)"))
  }

  private cut(on: boolean): void {
    print("[REEL] " + (getTime() - this.t0).toFixed(1) + (on ? " CUT-FROM" : " CUT-TO"))
  }

  // A wait that can't stop the reel: a missed moment shows in the log and is fixed in the edit.
  private async soft(cond: () => boolean, ms: number): Promise<void> {
    const t0 = getTime()
    while (!cond() && (getTime() - t0) * 1000 < ms) await sleep(50)
    if (!cond()) print("[REEL] missed a wait at " + (getTime() - this.t0).toFixed(1))
  }

  private press(name: string): void {
    if (!pressButton(name)) print("[REEL] missed " + name)
  }

  // Walks the pose along the points at the reel's pace, turning smoothly into each leg.
  private async walk(pts: Vec3[]): Promise<void> {
    let h = this.main.getDebugPose()!.heading
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
      const leg = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
      const t0 = getTime()
      let f = 0
      while (f < 1) {
        const dt = getDeltaTime()
        f = Math.min(1, (getTime() - t0) * WALK_MS / Math.max(0.01, len))
        const turn = ((leg - h + 540) % 360) - 180
        h += turn * Math.min(1, dt * 5)
        this.main.debugSetPose(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, h)
        await sleep(1)
      }
    }
  }

  // Turns on the spot to the heading, over `seconds`.
  private async turn(to: number, seconds: number): Promise<void> {
    const p = this.main.getDebugPose()!
    const from = p.heading
    const by = ((to - from + 540) % 360) - 180
    const t0 = getTime()
    let f = 0
    while (f < 1) {
      f = Math.min(1, (getTime() - t0) / seconds)
      this.main.debugSetPose(p.pos.x, p.pos.y, p.pos.z, from + by * f)
      await sleep(1)
    }
  }

  // From anywhere to the scan sign on this map, the panel in view.
  private async toSign(mapKey: string): Promise<void> {
    const main = this.main
    main.debugShowDemoControls(true)
    main.debugSetViewFollowsPose(false)
    for (let i = 0; i < 6 && main.getMapKey() !== mapKey; i++) {
      this.press("NextMapButton")
      await sleep(900)
    }
    this.press("RestartButton")
    await waitFor(() => main.getPhase() === "scan" && main.isScanSignVisible(), 5000, "scan sign")
    await sleep(800)
    await waitFor(() => !main.isAnchorSettling(), 12000, "anchor")
    main.debugSetDownloadOverride(JSON.stringify(bundledMaps().filter((m) => m.key === mapKey)[0].map))
    const sign = findNode(main.getMapData(), main.getStartId())!
    main.debugSetPose(sign.x, sign.y, sign.z, 0)
    main.debugSetViewFollowsPose(true)
    main.debugShowDemoControls(false)
    await sleep(300)
  }

  private async scan(): Promise<void> {
    this.press("ScanSignButton")
    await waitFor(() => this.main.getPhase() === "choose" && this.main.isHomePanelShown(), 8000, "the modes")
  }

  // The extension: walk the mall, look at a shop and mark it, and the path joins the marks.
  private async builder(): Promise<void> {
    const main = this.main
    this.press("MapBuilderButton")
    await waitFor(() => main.getPhase() === "mapping", 3000, "map builder")
    this.cap("Add your own place: just walk it")
    await this.walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 6}])
    await this.turn(90, 0.6)
    this.cap("Look at a shop and mark it")
    await sleep(900)
    this.press("MarkShopButton")
    await sleep(1400)
    await this.turn(0, 0.5)
    this.cap("Your path joins the marks")
    await this.walk([{x: 30, y: 0, z: 6}, {x: 30, y: 0, z: 14}])
    await this.turn(-90, 0.6)
    await sleep(500)
    this.press("MarkShopButton")
    await sleep(1400)
    this.cut(true)
    main.debugSetPose(57, 0, 14, 0)
    await sleep(300)
    this.cut(false)
    this.cap("Take the stairs: it sees the new floor")
    await this.walk([{x: 57, y: 0, z: 14}, {x: 57, y: 5, z: 24}])
    await this.soft(() => main.getFloorGuess() !== null, 4000)
    await sleep(900)
    this.press("ConfirmFloorButton")
    await sleep(800)
    this.cap("Upload it, and anyone can walk it")
    this.press("SeeMapButton")
    await sleep(2800)
    this.press("SeeMapButton")
    await sleep(300)
    this.press("UploadMapButton")
    await this.soft(() => main.getPhase() === "choose", 4000)
    await sleep(800)
  }

  private async freeWalkCompanion(): Promise<void> {
    const main = this.main
    this.press("FreeWalkButton")
    await waitFor(() => main.getPhase() === "prefs", 3000, "preferences")
    this.cap("Free walk: your preferences, saved for next time")
    await sleep(1500)
    this.press("PrefsViewButton")
    await sleep(3000)
    this.press("PrefsStartButton")
    await waitFor(() => main.getPhase() === "free", 3000, "free walk")
    main.debugMarkPointed(["threads", "cafe"]) // on to Bolt Hardware, where the camera can see it point
    this.cap("No destination. Your companion walks ahead")
    await this.walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 10}])
    this.cap("More picks upstairs? It waits at the escalator and says so")
    await this.turn(-56, 0.6) // the escalator is off to the side of the narrow view
    await this.soft(() => main.getBubbleText() !== null, 8000)
    await sleep(2500)
    await this.walk([{x: 30, y: 0, z: 10}, {x: 30, y: 0, z: 19.5}])
    this.cap("It stops at shops you'd like, and points")
    await this.turn(0, 0.5)
    await this.soft(() => main.getStopId() === "boltHardware", 6000)
    // It stops close to you, below the narrow view: step back to see it point.
    const dog = main.getCompanionMapPos()
    if (dog) {
      this.cut(true)
      main.debugSetPose(dog.x, 0, dog.z - 8, 0)
      await sleep(250)
      this.cut(false)
    }
    await sleep(3500)
    this.cap("Turn around: it runs around you and stays in front")
    await this.turn(180, 1.2)
    await sleep(7000)
    await this.turn(0, 1)
  }

  private async stairs(): Promise<void> {
    const main = this.main
    main.debugMarkPointed(["threads", "cafe", "boltHardware"])
    await this.walk([main.getDebugPose()!.pos, {x: 30, y: 0, z: 10}, {x: 52, y: 0, z: 10}])
    this.cap("Look at the stairs: a dot shows what's up there")
    await this.walk([{x: 52, y: 0, z: 10}, {x: 57, y: 0, z: 13}])
    await this.turn(0, 0.5)
    await this.soft(() => main.getDotId() === "stairsFoot", 3000)
    await sleep(1000)
    this.press("DotButton")
    await sleep(3500)
    this.press("OfferCloseButton")
    await sleep(500)
    main.debugSetPose(57, 0, 15, 0)
    await sleep(300)
    this.press("RideButton_" + main.getRideIdFor("stairsFoot", "stairs"))
    await sleep(600)
    await this.walk([{x: 57, y: 5, z: 24}, {x: 50, y: 5, z: 22}])
    await this.turn(0, 0.5)
    await sleep(2500)
  }

  private async freeWalkAlone(): Promise<void> {
    const main = this.main
    this.press("FreeWalkButton")
    await waitFor(() => main.getPhase() === "prefs", 3000, "preferences")
    this.press("PrefsViewButton")
    await sleep(200)
    this.press("PrefsCompanionButton")
    await sleep(200)
    this.press("PrefsStartButton")
    await waitFor(() => main.getPhase() === "free", 3000, "free walk")
    this.cap("Companion off: just look at a shop")
    await this.walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 22}])
    await waitFor(() => main.isDotShown(), 3000, "a dot")
    this.cap("A subtle dot. Open it, or ignore it")
    await sleep(1800)
    this.press("DotButton")
    await sleep(4000)
    this.press("OfferCloseButton")
    await sleep(400)
    await this.walk([{x: 30, y: 0, z: 22}, {x: 38, y: 0, z: 22}])
    await this.turn(0, 0.5)
    await sleep(2500)
  }

  private async goTo(): Promise<void> {
    const main = this.main
    this.press("GoToPlaceButton")
    await waitFor(() => main.getPhase() === "mode", 3000, "Go to a place")
    this.cap("Go to a place: just say it")
    await sleep(1800)
    this.press("SayItButton")
    await sleep(1500)
    this.press("WalkButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "routing")
    this.cap("The line leads you there, floor by floor")
    await sleep(600) // a button shown this frame gets its Interactable on its first frame
    this.press("CompanionButton")
    await this.soft(() => main.isCompanionOn(), 1000)
    await this.walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 10}, {x: 30, y: 0, z: 18}])
    await sleep(600)
    this.cap("See the whole mall, and your way through it")
    this.press("MiniMallButton")
    await sleep(3800)
    this.press("MiniMallButton")
    await sleep(400)
  }

  // Plans change: the line swings to the new place at once.
  private async planChange(): Promise<void> {
    const main = this.main
    main.debugShowDemoControls(true)
    await sleep(600)
    this.cap("Plans change? The line changes with you")
    this.press("GateChangeButton")
    await sleep(600)
    main.debugShowDemoControls(false)
    await sleep(3200)
  }

  private async companions(): Promise<void> {
    const main = this.main
    this.cap("Dog, robot or rover. Your pick")
    for (const id of ["robot", "rover", "dog"]) {
      main.setCompanionModel(id)
      await sleep(2200)
    }
  }

  // Standing still on the trip: throw the treat by hand. The grab itself is cut: in the preview the
  // treat follows the real head, not the walked view, and fills the frame for a moment.
  private async play(): Promise<void> {
    const main = this.main
    await standStill(main, {x: 30, y: 0, z: 18})
    await this.soft(() => main.isGrabTreatShown(), 2000)
    this.cap("Waiting? Pinch the treat, swing and let go")
    await sleep(1800)
    this.cut(true)
    const treat = findInteractableByName("GrabTreat", undefined, true)
    if (treat) await new DefaultLeafInteractor().drag(treat, new vec3(0, 3, -15), 900)
    else print("[REEL] missed GrabTreat")
    await this.soft(() => main.getCatchPhase() !== "idle", 2000)
    await sleep(400)
    this.cut(false)
    await this.soft(() => main.getCatchPhase() === "idle", 8000)
    this.cap("Your route never changes")
    await sleep(1500)
  }

  private async tour(): Promise<void> {
    const main = this.main
    this.press("TourButton")
    await waitFor(() => main.getPhase() === "prefs", 3000, "preferences")
    this.cap("Tour: the shops you like, one stop at a time")
    await sleep(1800)
    this.press("PrefsKeepButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "the tour")
    await this.walk(main.getRouteNodes().slice(0, 3).map((id) => nodePos(main, id)))
    const stops = main.getStops()
    this.cut(true)
    const p = nodePos(main, stops[0])
    const north = p.z > 15 // shops line both sides of the hall: stand back from this one, facing it
    main.debugSetPose(p.x, p.y, p.z + (north ? -2.6 : 2.6), north ? 0 : 180)
    await this.soft(() => main.getPhase() === "arrived", 3000)
    this.cut(false)
    await sleep(2500)
    this.press("NextStopButton")
    await sleep(2500)
  }

  async run(): Promise<void> {
    await sleep(1000)
    this.main = getMain()
    const main = this.main
    this.t0 = getTime()
    main.debugForgetSavedMap()
    this.cut(true)
    await this.toSign("mall")
    this.cut(false)
    this.cap("Lost in a big mall? Scan the 'You are here' sign")
    await sleep(2500)
    await this.scan()
    this.cap("Then choose what you need")
    await sleep(2200)
    await this.freeWalkCompanion()
    await this.stairs()
    this.cut(true)
    await this.toSign("mall")
    await this.scan()
    this.cut(false)
    await this.freeWalkAlone()
    this.cut(true)
    await this.toSign("mall")
    await this.scan()
    this.cut(false)
    await this.goTo()
    await this.play()
    await this.companions()
    await this.planChange()
    this.cut(true)
    await this.toSign("mall")
    await this.scan()
    this.cut(false)
    await this.tour()
    this.cut(true)
    await this.toSign("mall")
    await this.scan()
    this.cut(false)
    await this.builder()
    this.cap("Find Your Way Inside")
    await sleep(3000)
    this.cap(null)
    main.debugForgetSavedMap()
    main.debugClearPose()
    print("[REEL] done")
  }
}
