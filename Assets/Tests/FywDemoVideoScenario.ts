import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {log} from "./FindYourWayLeafSupport"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {waitFor} from "./FindYourWayLeafSupport"
import {closeDemo, DemoRun, freeWalkRobotTrip, hold, mallPetTrip, openDemo, talk, turnTo, walkLeg} from "./FywDemoSupport"
import {nodePos} from "./FywBrief2Support"

// visual-demos — the three demos in one take (demo 1 with the gate change heard on the way), at walking pace, for the video: the preview camera follows
// the walk. "[VID] <t> <what>" lines mark each beat (seconds since the take began).
@component
export class FywDemoVideoScenario extends Scenario {
  private t0 = 0

  private mark(what: string): void {
    print("[VID] " + (getTime() - this.t0).toFixed(2) + " " + what)
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
    await hold(run, 0.8)
    await talk(run)
    const stops = main.getStops()
    for (let i = 0; i < stops.length; i++) {
      await waitFor(() => main.getPhase() === "nav" && main.getDestinationId() === stops[i], 9000, "leg " + (i + 1))
      this.mark("leg " + (i + 1) + " to " + stops[i])
      if (i === stops.length - 1) {
        await hold(run, 1.5)
        main.playAnnouncement()
        this.mark("announcement")
        await waitFor(() => main.getRerouteText() !== null, 9000, "Re-route to Gate B14?")
        this.mark("question " + main.getRerouteText())
        await hold(run, 2.5)
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
    await hold(run, 2)
    await this.airportWithGateChange(run)
    this.mark("arrived " + run.main.getArrivalText())
    await hold(run, 8.5)
    // The gate agent at B14 speaks of B14: no "Re-route to …?" at the gate you are at.
    expect(run.main.getRerouteText(), "no re-route question at the gate").toBe(null)
    await closeDemo(run.main)

    this.mark("demo 2: mall, follow the dog")
    run = await openDemo("mallPet", 1.7)
    await hold(run, 2)
    await mallPetTrip(run)
    this.mark("arrived " + run.main.getArrivalText())
    await hold(run, 8.5)
    await closeDemo(run.main)

    this.mark("demo 3: Free walk with the robot")
    run = await openDemo("freeWalkRobot", 1.5)
    await hold(run, 2.5)
    const r = await freeWalkRobotTrip(run)
    this.mark("pointed " + r.pointed.join(",") + " boxes " + r.boxes.join(","))
    await turnTo(run, 0, 1)
    await hold(run, 2)
    await closeDemo(run.main)
    this.mark("END")
    log("visual-demos done")
  }
}
