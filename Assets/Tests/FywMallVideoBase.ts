// TEMPORARY (not committed): scripted takes for the two voiced mall videos. Each beat starts at the
// voice-over's start time (seconds from T0). Run with the runner's only=visual-mall-robot / visual-mall-dog.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode, Vec3} from "../Scripts/FindYourWayRouter"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {bundledMaps, getMain, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"

export abstract class FywVideoBase extends Scenario {
  protected t0 = 0
  protected main: FindYourWayMain
  protected speed = 2.2

  protected now(): number { return getTime() - this.t0 }

  protected mark(text: string): void {
    print("[VID] " + this.now().toFixed(2) + " " + text)
  }

  protected async at(t: number, what: string): Promise<void> {
    if (this.now() > t + 0.3) this.mark("LATE for " + what + " (wanted " + t + ")")
    while (this.now() < t) await sleep(16)
    this.mark(what)
  }

  protected async soft(cond: () => boolean, ms: number, what: string): Promise<boolean> {
    const s = getTime()
    while (!cond() && (getTime() - s) * 1000 < ms) await sleep(30)
    if (!cond()) this.mark("missed " + what)
    return cond()
  }

  protected press(name: string): void {
    if (pressButton(name)) return
    if (pressButton("OptionsTabButton") && pressButton(name)) return
    this.mark("missed button " + name)
  }

  // Walks along the points at `speed`, turning smoothly; stops at `until` (seconds since T0) or when stop() is true.
  protected async walk(pts: Vec3[], until: number = 1e9, stop?: () => boolean): Promise<void> {
    let h = this.main.getDebugPose()!.heading
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2)
      if (len < 0.05) continue
      const leg = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
      const s = getTime()
      let f = 0
      while (f < 1) {
        const dt = getDeltaTime()
        f = Math.min(1, (getTime() - s) * this.speed / len)
        const turn = ((leg - h + 540) % 360) - 180
        h += turn * Math.min(1, dt * 5)
        this.main.debugSetPose(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f, h)
        await sleep(1)
        if (this.now() >= until || (stop && stop())) return
      }
    }
  }

  protected async turn(to: number, seconds: number): Promise<void> {
    const p = this.main.getDebugPose()!
    const from = p.heading
    const by = ((to - from + 540) % 360) - 180
    const s = getTime()
    let f = 0
    while (f < 1) {
      f = Math.min(1, (getTime() - s) / seconds)
      this.main.debugSetPose(p.pos.x, p.pos.y, p.pos.z, from + by * f)
      await sleep(1)
    }
  }

  protected pos(): Vec3 { return this.main.getDebugPose()!.pos }

  // The route from here: current pose, then the route's nodes from the first one ahead.
  protected routePts(fromIndex: number = 1): Vec3[] {
    return [this.pos()].concat(this.main.getRouteNodes().slice(fromIndex).map((id) => nodePos(this.main, id)))
  }

  protected async toSign(): Promise<void> {
    const main = this.main
    main.debugShowDemoControls(true)
    main.debugSetViewFollowsPose(false)
    for (let i = 0; i < 6 && main.getMapKey() !== "mall"; i++) {
      this.press("NextMapButton")
      await sleep(900)
    }
    this.press("RestartButton")
    await waitFor(() => main.getPhase() === "scan" && main.isScanSignVisible(), 8000, "scan sign")
    await sleep(800)
    await waitFor(() => !main.isAnchorSettling(), 12000, "anchor")
    main.debugSetDownloadOverride(JSON.stringify(bundledMaps().filter((m) => m.key === "mall")[0].map))
    const sign = findNode(main.getMapData(), main.getStartId())!
    main.debugSetPose(sign.x, sign.y, sign.z, 0)
    main.debugSetViewFollowsPose(true)
    await sleep(1500)
  }

  protected async scan(): Promise<void> {
    this.press("ScanSignButton")
    await this.soft(() => this.main.getPhase() === "choose" && this.main.isHomePanelShown(), 8000, "the modes")
  }

  protected async begin(model: string, stops: string | null): Promise<void> {
    await sleep(1000)
    this.main = getMain() // also turns the showing preset off for this run (not saved)
    const m = this.main as any
    m.companionModel = model
    m.companionOnAtStart = true
    m.multiStops = ""
    m.pointSeconds = 6
    this.main.debugSetStops(stops)
    this.main.debugForgetSavedMap()
    await this.toSign()
    this.main.setCompanionModel(model)
    this.main.debugShowDemoControls(false) // T0 marker in the footage: the demo controls vanish
    this.t0 = getTime()
    print("[VID] T0 wall " + Date.now())
  }

  protected async end(total: number): Promise<void> {
    await this.at(total, "END")
    this.main.debugSetStops(null)
    this.main.debugClearPose()
    print("[VID] done")
  }
}

