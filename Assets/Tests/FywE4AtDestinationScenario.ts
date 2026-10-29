// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"

// E4 — destination is where you already are: arrival right away, no line.
@component
export class FywE4AtDestinationScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, (m) => m.debugSetDestinationOverride("sign"), ["arrived"])
    expect(main.getPhase(), "phase").toBe("arrived")
    expect(main.isLineVisible(), "no line").toBe(false)
    expect(main.isArrivalCardShown(), "arrival card").toBe(true)
    log("E4 pass")
  }
}
