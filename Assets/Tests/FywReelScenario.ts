import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode, Vec3} from "../Scripts/FindYourWayRouter"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {bundledMaps, getMain, waitFor} from "./FindYourWayLeafSupport"

const WALK_MS = 2.2 // walking pace of the reel (m/s)

// visual-reel — the 120 s video from design-brief-3, played on the real app. Not a test: "visual-"
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

  private async builder(): Promise<void> {
    const main = this.main
    const at = (x: number, y: number, z: number, h: number) => main.debugSetPose(x, y, z, h)
    this.press("MapBuilderButton")
    await waitFor(() => main.getPhase() === "mapping", 3000, "map builder")
    this.cap("Map builder: walk the place and it draws itself")
    await this.walk([{x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 4}])
    await this.turn(90, 0.7)
    this.cap("Face a shop, pinch Mark shop")
    await sleep(700)
    this.press("MarkShopButton")
    await sleep(900)
    await this.walk([{x: 0, y: 0, z: 4}, {x: 0, y: 0, z: 9}])
    await this.turn(90, 0.7)
    await sleep(300)
    this.press("MarkShopButton")
    await sleep(700)
    this.cap("Go upstairs: the Lens sees the new floor")
    await this.walk([{x: 0, y: 0, z: 9}, {x: 0, y: 3.5, z: 14}])
    at(0, 3.5, 14, 0)
    await waitFor(() => main.getFloorGuess() !== null, 4000, "floor change")
    await sleep(800)
    this.press("ConfirmFloorButton")
    await sleep(700)
    this.cap("Two more shops upstairs")
    await this.walk([{x: 0, y: 3.5, z: 14}, {x: 5, y: 3.5, z: 14}])
    await sleep(300)
    this.press("MarkShopButton")
    await this.walk([{x: 5, y: 3.5, z: 14}, {x: 11, y: 3.5, z: 14}])
    await sleep(300)
    this.press("MarkShopButton")
    await sleep(600)
    this.cap("See my map, then Upload")
    this.press("SeeMapButton")
    await sleep(3000)
    this.press("SeeMapButton")
    await sleep(300)
    this.press("UploadMapButton")
    await waitFor(() => main.getPhase() === "choose", 4000, "uploaded")
    await sleep(1200)
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
    await this.walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 9}, {x: 30, y: 0, z: 19.5}])
    this.cap("It stops at shops you'd like, and points")
    await this.turn(0, 0.5)
    await this.soft(() => main.getStopId() === "boltHardware", 6000)
    // It stops close to you, below the narrow view: step back to see it point.
    const dog = main.getCompanionMapPos()
    if (dog) {
      this.cut(true)
      main.debugSetPose(dog.x, 0, dog.z - 6.5, 0)
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
    await this.walk([main.getDebugPose()!.pos, {x: 30, y: 0, z: 10}, {x: 50, y: 0, z: 10}])
    this.cap("More picks upstairs? It waits at the stairs and says so")
    await this.soft(() => main.getBubbleText() !== null, 6000)
    await sleep(2500)
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
    await this.walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 10}, {x: 30, y: 0, z: 18}])
    await sleep(1000)
  }

  async run(): Promise<void> {
    await sleep(1000)
    this.main = getMain()
    const main = this.main
    this.t0 = getTime()
    main.debugForgetSavedMap()
    this.cut(true)
    await this.toSign("room")
    this.cut(false)
    this.cap("Lost in a big building? Scan the 'You are here' sign")
    await sleep(2500)
    await this.scan()
    this.cap("Then choose what you need")
    await sleep(3000)
    await this.builder()
    this.cut(true)
    await this.toSign("mall")
    this.cut(false)
    this.cap("Someone names the shops and adds offers; the Lens downloads that map")
    await sleep(3500)
    await this.scan()
    await sleep(800)
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
    this.cap("Find Your Way Inside")
    await sleep(3000)
    this.cap(null)
    main.debugForgetSavedMap()
    main.debugClearPose()
    print("[REEL] done")
  }
}
