import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {closeDemo, openDemo, talk} from "./FywDemoSupport"

// v2 — Talk in the preview (no ASR there): the airport's demo sentence types in word by word, the
// planner picks the café, the accessible toilet and Gate C12, and the first Step-Free leg takes a lift.
@component
export class FywV2VoiceFallbackScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("airportWheelchair")
    const main = run.main
    expect(main.getTalkHint(), "the preview says so").toBe("Preview: voice shown as typed. Live speech on Specs.")
    const seen = await talk(run)
    log("v2 captions: " + seen.join(" / "))
    expect(seen.some((t) => t.indexOf("Heard: I need") === 0 && t.indexOf("12C") < 0), "typed in word by word").toBe(true)
    expect(seen.some((t) => t.indexOf("Heard: I need coffee and a bathroom before my flight at gate 12C") === 0), "the whole phrase").toBe(true)
    expect(main.getStops().join(","), "coffee, the accessible toilet, then Gate C12").toBe("cafeD,accToiletD,gateC12")
    expect(main.isAskTrip(), "they follow on by themselves").toBe(true)
    expect(main.getProfile(), "Step-Free").toBe("stepFree")
    const kinds = main.getRouteEdgeKinds()
    expect(kinds.indexOf("lift") >= 0, "through a lift: " + kinds.join(",")).toBe(true)
    expect(kinds.indexOf("stairs") < 0 && kinds.indexOf("escalator") < 0, "no stairs or escalators").toBe(true)
    await closeDemo(main)
    log("v2 pass")
  }
}
