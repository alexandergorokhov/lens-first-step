// FindYourWayDemoRunner — the autoplay demo you can watch without clicking. It drives the real
// app: buttons are "pressed" through the same click handlers a pinch runs (pressButton), and the
// traveller is walked along the live route by moving the debug pose, with the view following
// the pose (the same mechanism the LEAF tests use). Beats and captions come from
// FindYourWayDemo.ts (the shared, Node-tested src/core/demo.ts).
// Owns: demo progress only. Must not: change routing or build UI itself.

import {DEMO_BEATS, DemoBeat, FREE_WALK_BEATS, PolylineWalker, XYZ, beatIndex} from "./FindYourWayDemo"
import {findNode, levelDistance} from "./FindYourWayRouter"
import {pressButton} from "./FindYourWayWidgetsUI"
import {FindYourWayMain} from "./FindYourWayMain"
import {FindYourWayHudUI} from "./FindYourWayHudUI"
import {FindYourWayDemoControlsUI} from "./FindYourWayDemoControlsUI"

const SEATED_FEET_M = -0.45 // seated: eyes ~45 cm lower than standing
const FREE_WALK_SPEED_MS = 2.2 // a brisk walk, so the demo doesn't drag
const STAND_BACK_M = 8 // the companion stops close to you, below the narrow view: step back to see it
const ESCALATOR_HEADING = -56 // from the hall's middle, looking at the escalator foot

@component
export class FindYourWayDemoRunner extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Demo runner – autoplay walkthrough of the brief\'s video beats</span>')
  @ui.separator
  @ui.group_start("References")
  @input @hint("Trip orchestrator") main: FindYourWayMain
  @input @hint("HUD (shows the captions)") hud: FindYourWayHudUI
  @input @hint("Demo controls (Play demo / Stop demo button)") demoControls: FindYourWayDemoControlsUI
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Start the demo automatically when the preview resets")
  autoplayDemo: boolean = false

  @input
  @hint("Playback speed (1 = walking pace, 1.4 m/s)")
  @widget(new SliderWidget(0.5, 10, 0.5))
  speed: number = 1

  @input
  @hint("Seconds each caption is held before the action")
  @widget(new SliderWidget(0.5, 5, 0.25))
  holdSeconds: number = 2.2
  @ui.group_end

  private running = false
  private finished = false
  private runId = 0
  private reached: string[] = []
  private arrivals: string[] = []
  private missedPresses: string[] = []
  private feetOffset = 0
  private beats: DemoBeat[] = DEMO_BEATS

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.main || !this.hud || !this.demoControls) {
        print("[FYW-DEMO] ERROR missing inputs")
        return
      }
      this.demoControls.onPlayDemo.add(() => (this.running ? this.stop() : this.play()))
      this.demoControls.onPlayFreeWalk.add(() => (this.running ? this.stop() : this.playFreeWalk()))
      if (this.autoplayDemo) setTimeout(() => this.play(), 2500)
    })
  }

  // ── Public API (Demo controls button, Inspector toggle, LEAF) ───────────────
  play(speed?: number, holdSeconds?: number): void {
    if (speed !== undefined) this.speed = speed
    if (holdSeconds !== undefined) this.holdSeconds = holdSeconds
    this.start(DEMO_BEATS, (id) => this.runDemoScript(id))
    this.demoControls.setPlayDemoLabel("Stop demo")
  }

  playFreeWalk(): void {
    this.start(FREE_WALK_BEATS, (id) => this.runFreeWalkScript(id))
    this.demoControls.setFreeWalkLabel("Stop demo")
  }

  private start(beats: DemoBeat[], script: (id: number) => Promise<void>): void {
    this.stop()
    this.beats = beats
    this.running = true
    this.finished = false
    this.reached = []
    this.arrivals = []
    this.missedPresses = []
    // The demo presses the demo controls, which are hidden by default (real use).
    this.main.debugShowDemoControls(true)
    const id = ++this.runId
    script(id).then(
      () => this.done(id),
      (e) => {
        if (String(e).indexOf("demo stopped") < 0) print("[FYW-DEMO] ERROR " + e)
        this.done(id)
      },
    )
  }

  stop(): void {
    if (!this.running) return
    this.runId++
    this.running = false
    this.hud.setCaption(null)
    this.resetLabels()
    this.main.debugClearPose()
    print("[FYW-DEMO] stopped")
  }

  isRunning(): boolean { return this.running }
  isFinished(): boolean { return this.finished }
  getReachedBeats(): string[] { return this.reached.slice() }
  getArrivals(): string[] { return this.arrivals.slice() }
  getMissedPresses(): string[] { return this.missedPresses.slice() }

  private done(id: number): void {
    if (id !== this.runId) return
    this.running = false
    this.finished = this.reached.length === this.beats.length
    this.resetLabels()
    print("[FYW-DEMO] finished: " + this.reached.length + "/" + this.beats.length + " beats; arrivals: " + this.arrivals.join(" | "))
  }

  private resetLabels(): void {
    this.demoControls.setPlayDemoLabel("Play demo")
    this.demoControls.setFreeWalkLabel("Free walk demo")
  }

  // ── The script: the brief's video beats ────────────────────────────────────
  private async runDemoScript(id: number): Promise<void> {
    const m = this.main
    await this.beat(id, "intro")
    await this.toMap(id, "airport")
    this.press("RestartButton")
    await this.until(id, () => m.getPhase() === "scan", 3000)

    // Walk run
    await this.beat(id, "walk-choose")
    await this.beat(id, "walk-scan")
    await this.scanAndGo(id, 0, "WalkButton")
    await this.beat(id, "walk-follow")
    await this.walkTo(id, "escFoot")
    await this.beat(id, "walk-escalator")
    this.press("RideButton_" + m.getRideIdFor("escFoot", "escalator"))
    await this.beat(id, "walk-concourse")
    await this.walkTo(id, "concourse")
    await this.beat(id, "gate-change")
    this.press("GateChangeButton")
    await this.hold(id, 1.2)
    await this.beat(id, "walk-to-pier")
    await this.walkTo(id, "cTop")
    await this.beat(id, "stairs-down")
    this.press("RideButton_" + m.getRideIdFor("cTop", "stairs"))
    await this.beat(id, "arrive-c3")
    await this.walkTo(id, "gateC3", true)
    await this.recordArrival(id)

    // Step-Free run, seated
    await this.beat(id, "restart")
    this.press("RestartButton")
    await this.until(id, () => m.getPhase() === "scan", 3000)
    await this.beat(id, "stepfree-choose")
    await this.beat(id, "stepfree-scan")
    await this.scanAndGo(id, SEATED_FEET_M, "StepFreeButton")
    await this.beat(id, "to-lift1")
    await this.walkTo(id, "lift1G")
    await this.beat(id, "lift1-out")
    this.press("ClosureButton_lift1")
    await this.hold(id, 1.2)
    await this.beat(id, "to-lift2")
    await this.walkTo(id, "lift2G")
    await this.beat(id, "lift2-ride")
    this.press("RideButton_" + m.getRideIdFor("lift2G", "lift"))
    await this.beat(id, "arrive-b12")
    await this.walkTo(id, "gateB12", true)
    await this.recordArrival(id)

    // Campus, Step-Free: the Science lift is out, so the ramp
    await this.beat(id, "campus")
    await this.toMap(id, "campus")
    await this.until(id, () => m.getPhase() === "scan", 3000)
    await this.beat(id, "campus-scan")
    await this.scanAndGo(id, SEATED_FEET_M, "StepFreeButton")
    await this.walkTo(id, "sciDoor")
    await this.beat(id, "campus-lift-out")
    this.press("ClosureButton_sciLift")
    await this.hold(id, 1.2)
    await this.beat(id, "campus-ramp")
    await this.walkTo(id, "sciRampFoot")
    this.press("RideButton_" + m.getRideIdFor("sciRampFoot", "ramp"))
    await this.beat(id, "arrive-lecture-hall")
    await this.walkTo(id, "lectureHall1", true)
    await this.recordArrival(id)

    await this.beat(id, "end")
    await this.hold(id, 2)
    this.hud.setCaption(null)
  }

  // ── The Free walk script: the mall, with the companion ─────────────────────
  private async runFreeWalkScript(id: number): Promise<void> {
    const m = this.main
    await this.beat(id, "fw-intro")
    await this.toMap(id, "mall")
    this.press("RestartButton")
    await this.until(id, () => m.getPhase() === "scan" && !m.isAnchorSettling(), 12000)
    await this.beat(id, "fw-scan")
    this.standAtSign(0)
    this.press("ScanSignButton")
    await this.until(id, () => m.getPhase() === "choose", 8000)
    this.press("FreeWalkButton")
    await this.until(id, () => m.getPhase() === "prefs", 3000)
    await this.beat(id, "fw-prefs")
    this.press("PrefsViewButton")
    await this.hold(id, 1.5)
    this.press("PrefsStartButton")
    await this.until(id, () => m.getPhase() === "free", 3000)
    m.debugMarkPointed(["threads", "cafe"]) // on to Bolt Hardware, the first shop it can reach in view
    await this.beat(id, "fw-lead")
    await this.walkPoints(id, [{x: 30, y: 0, z: 10}])
    await this.beat(id, "fw-upstairs")
    await this.turnTo(id, ESCALATOR_HEADING, 0.6)
    await this.until(id, () => m.getBubbleText() !== null, 8000)
    await this.hold(id, 2.5)
    await this.walkPoints(id, [{x: 30, y: 0, z: 19.5}])
    await this.beat(id, "fw-point")
    await this.turnTo(id, 0, 0.5)
    await this.until(id, () => m.getStopId() === "boltHardware", 6000)
    const pet = m.getCompanionMapPos()
    if (pet) m.debugSetPose(pet.x, 0, pet.z - STAND_BACK_M, 0)
    await this.hold(id, 3)
    await this.beat(id, "fw-turn")
    await this.turnTo(id, 180, 1.2)
    await this.hold(id, 4)
    await this.turnTo(id, 0, 1)
    await this.beat(id, "fw-end")
    this.hud.setCaption(null)
  }

  // Walks on from the pose through the points, at Free walk's pace.
  private async walkPoints(id: number, pts: XYZ[]): Promise<void> {
    const pose = this.main.getDebugPose()
    if (!pose) return
    const walker = new PolylineWalker([{x: pose.pos.x, y: pose.pos.y, z: pose.pos.z}, ...pts], FREE_WALK_SPEED_MS * this.speed)
    let last = getTime()
    for (;;) {
      await this.wait(id, 33)
      const now = getTime()
      const s = walker.step(now - last)
      last = now
      this.main.debugSetPose(s.x, s.y, s.z, s.heading)
      if (s.done) return
    }
  }

  private async turnTo(id: number, heading: number, seconds: number): Promise<void> {
    const pose = this.main.getDebugPose()
    if (!pose) return
    const by = ((heading - pose.heading + 540) % 360) - 180
    const t0 = getTime()
    let f = 0
    while (f < 1) {
      await this.wait(id, 33)
      f = Math.min(1, (getTime() - t0) / seconds)
      this.main.debugSetPose(pose.pos.x, pose.pos.y, pose.pos.z, pose.heading + by * f)
    }
  }

  // ── Steps ──────────────────────────────────────────────────────────────────
  // The scan comes first, then Go to a place, then Walk or Step-Free.
  private async scanAndGo(id: number, feet: number, button: string): Promise<void> {
    const m = this.main
    this.standAtSign(feet)
    this.press("ScanSignButton")
    await this.until(id, () => m.getPhase() === "choose", 8000)
    this.press("GoToPlaceButton")
    await this.until(id, () => m.getPhase() === "mode", 3000)
    this.press(button)
    await this.until(id, () => m.getPhase() === "nav", 3000)
  }

  private async beat(id: number, beatId: string): Promise<void> {
    this.check(id)
    const b = this.beats[beatIndex(beatId, this.beats)]
    this.reached.push(beatId)
    this.hud.setCaption(b.caption)
    print("[FYW-DEMO] beat " + beatId + ": " + b.caption)
    await this.hold(id, this.holdSeconds)
  }

  private press(name: string): void {
    if (!pressButton(name)) {
      this.missedPresses.push(name)
      print("[FYW-DEMO] could not press " + name)
    }
  }

  private async toMap(id: number, key: string): Promise<void> {
    for (let i = 0; i < 5 && this.main.getMapKey() !== key; i++) {
      this.press("NextMapButton")
      await this.wait(id, 300)
    }
  }

  // Stand 1.5 m in front of the start sign, facing it, with the view following the pose.
  private standAtSign(feetOffset: number): void {
    this.feetOffset = feetOffset
    const s = findNode(this.main.getMapData(), this.main.getStartId())
    if (!s) return
    this.main.debugSetPose(s.x, s.y + feetOffset, s.z - 1.5, 0)
    this.main.debugSetViewFollowsPose(true)
  }

  // Walk the live route from the current pose to `target` at the demo speed.
  private async walkTo(id: number, target: string, stopOnArrival: boolean = false): Promise<void> {
    const m = this.main
    const map = m.getMapData()
    const nodes = m.getRouteNodes()
    const pose = m.getDebugPose()
    const end = nodes.indexOf(target)
    if (!pose || end < 0) {
      print("[FYW-DEMO] cannot walk to " + target + " (route: " + nodes.join(">") + ")")
      return
    }
    const here: XYZ = {x: pose.pos.x, y: pose.pos.y - this.feetOffset, z: pose.pos.z}
    let start = 0
    let best = Infinity
    for (let i = 0; i <= end; i++) {
      const n = findNode(map, nodes[i])!
      const d = levelDistance(n, here)
      if (d < best) { best = d; start = i }
    }
    const first = findNode(map, nodes[start])!
    const from = levelDistance(first, here) < 1 ? start + 1 : start
    const pts: XYZ[] = [here]
    for (let i = from; i <= end; i++) {
      const n = findNode(map, nodes[i])!
      pts.push({x: n.x, y: n.y, z: n.z})
    }
    const walker = new PolylineWalker(pts, this.speed)
    let last = getTime()
    for (;;) {
      await this.wait(id, 33)
      const now = getTime()
      const s = walker.step(now - last)
      last = now
      m.debugSetPose(s.x, s.y + this.feetOffset, s.z, s.heading)
      if (s.done || (stopOnArrival && m.getPhase() === "arrived")) break
    }
  }

  private async recordArrival(id: number): Promise<void> {
    await this.until(id, () => this.main.getPhase() === "arrived", 4000)
    const text = this.main.getArrivalText()
    if (text) this.arrivals.push(text)
    await this.hold(id, 2.5)
  }

  // ── Timing helpers (stop-aware) ────────────────────────────────────────────
  private check(id: number): void {
    if (id !== this.runId) throw new Error("demo stopped")
  }

  private wait(id: number, ms: number): Promise<void> {
    this.check(id)
    return new Promise<void>((resolve) => setTimeout(() => resolve(), ms)).then(() => this.check(id))
  }

  private async hold(id: number, seconds: number): Promise<void> {
    await this.wait(id, (seconds * 1000) / Math.max(0.1, this.speed))
  }

  private async until(id: number, cond: () => boolean, timeoutMs: number): Promise<void> {
    const t0 = getTime()
    while (!cond()) {
      if ((getTime() - t0) * 1000 > timeoutMs) {
        print("[FYW-DEMO] timed out waiting (" + timeoutMs + " ms)")
        return
      }
      await this.wait(id, 50)
    }
  }
}
