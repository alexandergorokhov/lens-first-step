// LEAF scenario: the autoplay demo runs end to end at high speed and every beat is reached.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DEMO_BEATS} from "../Scripts/FindYourWayDemo"
import {FindYourWayDemoRunner} from "../Scripts/FindYourWayDemoRunner"
import {log, waitFor} from "./FindYourWayLeafSupport"

@component
export class FywDemoAutoplayScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const so = findSceneObjectByName("DemoRunner")
    if (!so) throw new Error("DemoRunner not found")
    const demo = so.getComponent(FindYourWayDemoRunner.getTypeName()) as FindYourWayDemoRunner
    try {
      demo.play(10, 0.3)
    } catch (e) {
      log("play threw: " + e + " " + (e && (e as any).stack))
      throw e
    }
    await waitFor(() => !demo.isRunning(), 240000, "demo to finish")
    expect(demo.getReachedBeats().join(","), "every beat, in order").toBe(DEMO_BEATS.map((b) => b.id).join(","))
    expect(demo.isFinished(), "finished").toBe(true)
    expect(demo.getMissedPresses().join(","), "every button press found its button").toBe("")
    const arrivals = demo.getArrivals()
    expect(arrivals.join(" | "), "arrival cards").toBe(
      "Gate C3. Boarding in 6 min. | Gate B12. Boarding in 6 min. | Lecture Hall 1. Lecture starts in 10 min.")
    log("Demo autoplay pass (" + DEMO_BEATS.length + " beats)")
  }
}
