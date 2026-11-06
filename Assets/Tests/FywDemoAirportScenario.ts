import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {airportTrip, closeDemo, openDemo} from "./FywDemoSupport"

// demo-airport — preset 1: airport, wheelchair (seated), Talk "I need coffee and a bathroom before my
// flight at gate 12C": the dog leads through the lift to the café, the accessible toilet, Gate C12.
@component
export class FywDemoAirportScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("airportWheelchair")
    const main = run.main
    expect(main.getMapKey(), "airport").toBe("airport")
    expect(main.getCompanionModel(), "the dog").toBe("dog")
    expect(main.getPreselectedMode(), "Step-Free").toBe("stepFree")
    expect(main.getEyeHeightCm() < 140, "seated eyes: " + main.getEyeHeightCm()).toBe(true)
    const r = await airportTrip(run)
    expect(r.kinds.indexOf("lift") >= 0, "a lift").toBe(true)
    expect(r.kinds.indexOf("stairs") < 0 && r.kinds.indexOf("escalator") < 0, "step-free legs: " + r.kinds.join(",")).toBe(true)
    expect(r.stops.join(","), "three stops").toBe("cafeD,accToiletD,gateC12")
    expect(main.getArrivalText() !== null && main.getArrivalText()!.indexOf("C12") >= 0, "arrived: " + main.getArrivalText()).toBe(true)
    expect(main.isCompanionShown(), "the dog is there").toBe(true)
    await closeDemo(main)
    log("demo-airport pass")
  }
}
