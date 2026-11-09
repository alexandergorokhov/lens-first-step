import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {log} from "./FindYourWayLeafSupport"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {waitFor} from "./FindYourWayLeafSupport"
import {closeDemo, cutAt, DemoRun, freeWalkRobotTrip, glide, hold, mallPetTrip, openDemo, routeAhead, talk, tiltTo, turnTo, walkLeg} from "./FywDemoSupport"
import {nodePos} from "./FywBrief2Support"
import {isBeat, NARRATION, NARRATION_GAP_S, speakSeconds} from "../Scripts/FindYourWayNarration"

// The voice-over clips may run a little slower than the 2.5 words a second estimate.
const LINE_PAD = 1.1

// visual-demos — the three demos in one take (demo 1 with the gate change heard on the way), at walking pace, for the video: the preview camera follows
// the walk. "[VID] <t> <what>" lines mark each beat (seconds since the take began).
@component
export class FywDemoVideoScenario extends Scenario {
  private t0 = 0
  // The voice-over (R2-7): the next line's index, and when the line now being said ends (getTime()).
  private line = 0
  private lineEnds = 0

  // The smooth camera for the video (R2-13); lift rides marked for the dissolve in the edit.
  private smoothRun(run: DemoRun): void {
    run.smooth = true
    run.onRide = (w) => this.mark(w)
  }

  private mark(what: string): void {
    print("[VID] " + (getTime() - this.t0).toFixed(2) + " " + what)
    if (!isBeat(this.line, what)) return
    const start = Math.max(getTime(), this.lineEnds + NARRATION_GAP_S)
    this.lineEnds = start + speakSeconds(NARRATION[this.line].line) * LINE_PAD
    this.line++
  }

  // Waits until the voice-over line being said is done, at least `atLeast` s (the view stays as it is).
  private async lineDone(run: DemoRun, atLeast: number = 0): Promise<void> {
    await hold(run, Math.max(atLeast, this.lineEnds + NARRATION_GAP_S - getTime()))
  }

  // A last look at the destination with the companion in view.
  private async lookBack(run: DemoRun, id: string): Promise<void> {
    const main: FindYourWayMain = run.main
    const g = nodePos(main, id)
    const p = run.main.getDebugPose()!.pos
    const h = (Math.atan2(g.x - p.x, g.z - p.z) * 180) / Math.PI
    main.debugSetPose(p.x - Math.sin((h * Math.PI) / 180) * 3, p.y, p.z - Math.cos((h * Math.PI) / 180) * 3, h)
    await hold(run, 2.5)
  }

  // Demo 1: the café, the accessible toilet (to its door), then on the way to Gate C12 the gate change
  // is announced in Spanish: the caption shows it in English, "Re-route to Gate B14?", Yes, and the dog
  // leads on to B14, still step-free.
  private async airportWithGateChange(run: DemoRun): Promise<void> {
    const main = run.main
    await this.lineDone(run, 0.8)
    this.mark("talk")
    await talk(run)
    const stops = main.getStops()
    for (let i = 0; i < stops.length; i++) {
      await waitFor(() => main.getPhase() === "nav" && main.getDestinationId() === stops[i], 9000, "leg " + (i + 1))
      if (i === 0) await this.lineDone(run)
      this.mark("leg " + (i + 1) + " to " + stops[i])
      if (i === stops.length - 1) {
        // Away from the toilet door first: the gate change is heard on the way, looking down the hall.
        await glide(run, cutAt(routeAhead(run), 9))
        await this.lineDone(run, 1.5)
        main.playAnnouncement()
        this.mark("announcement")
        await waitFor(() => main.getRerouteText() !== null, 9000, "Re-route to Gate B14?")
        this.mark("question " + main.getRerouteText())
        // The question's line ends on "Yes: re-routed": press Yes as it is said.
        await hold(run, 2.5)
        await this.lineDone(run, 0)
        pressButton("RerouteYesButton")
        await waitFor(() => main.getDestinationId() === "gateB14", 3000, "re-routed")
        this.mark("re-routed to Gate B14")
        await hold(run, 1.5)
      }
      await walkLeg(run)
      this.mark("arrived at " + main.getDestinationId())
      if (i < stops.length - 1) await hold(run, 1.5)
    }
  }

  // Waiting for a table: a quick game with the dog (R2-27, R2-32). Turned along the hall, so the lane
  // (HOP_AHEAD_M ahead, a couple of steps) shows whole with the dog on it.
  private async playWithTheDog(run: DemoRun): Promise<void> {
    await turnTo(run, 90, 1.5)
    const t = getTime()
    while (!run.main.canPlayNow() && getTime() - t < 5) await hold(run, 0.1)
    run.main.debugTogglePlay()
    while (run.main.getHopPhase() !== "running" && getTime() - t < 8) await hold(run, 0.1)
    if (run.main.getHopPhase() !== "running") {
      log("visual-demos: Hop did not start at the Bakery (" + run.main.getHopPhase() + ")")
      return
    }
    this.mark("play")
    // Look down at the lane, so the dog and the obstacles show whole (R2-42).
    await tiltTo(run, 12, 0.8)
    // At least 7 s of play, all kept at 1x in the edit (R2-43): the game reads as a game.
    for (let k = 0; k < 7; k++) {
      await hold(run, 1.1)
      run.main.jump()
    }
    await this.lineDone(run, 1)
    this.mark("play end")
    run.main.debugTogglePlay()
    await tiltTo(run, 0, 0.8)
  }

  async run(): Promise<void> {
    await sleep(1500)
    // LEAF's own log line at the top of the view is not part of the Lens.
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const r = global.scene.getRootObject(i)
      if (r.name.indexOf("LeafDebug") === 0) r.enabled = false
    }
    this.t0 = getTime()
    print("[VID] T0 wall " + Date.now())

    this.mark("demo 1: airport, wheelchair")
    let run = await openDemo("airportWheelchair", 1.7)
    this.smoothRun(run)
    await hold(run, 2)
    await this.airportWithGateChange(run)
    this.mark("arrived " + run.main.getArrivalText())
    await hold(run, 8.5)
    await this.lineDone(run)
    // The gate agent at B14 speaks of B14: no "Re-route to …?" at the gate you are at.
    expect(run.main.getRerouteText(), "no re-route question at the gate").toBe(null)
    await closeDemo(run.main)

    this.mark("demo 2: mall, follow the dog")
    run = await openDemo("mallPet", 1.7)
    this.smoothRun(run)
    await hold(run, 2)
    await mallPetTrip(run, async () => {
      await this.lineDone(run)
      this.mark("leg to the bakery")
    })
    this.mark("arrived " + run.main.getArrivalText())
    await hold(run, 8.5)
    await this.lineDone(run)
    await this.playWithTheDog(run)
    await closeDemo(run.main)

    this.mark("demo 3: Free walk with the robot")
    run = await openDemo("freeWalkRobot", 1.5)
    this.smoothRun(run)
    await this.lineDone(run, 2.5)
    const r = await freeWalkRobotTrip(run)
    this.mark("pointed " + r.pointed.join(",") + " boxes " + r.boxes.join(","))
    // The last view (R2-44): turn down the hall and walk on behind the robot, the shops either side.
    await turnTo(run, 90, 1.8)
    await tiltTo(run, 6, 0.8)
    await hold(run, 2.5)
    await this.lineDone(run, 0.5)
    // The last line is said over the walk on, then the take ends.
    this.mark("END")
    const p = run.main.getDebugPose()!.pos
    await glide(run, [p, {x: p.x + 9, y: p.y, z: p.z}])
    await this.lineDone(run, 0.5)
    await closeDemo(run.main)
    print("[VID] " + (getTime() - this.t0).toFixed(2) + " CUT")
    log("visual-demos done")
  }
}
