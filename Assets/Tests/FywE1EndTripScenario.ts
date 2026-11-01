// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"

// E1b — a trip has a way out without the demo controls: End trip leaves the line and the pill
// behind, goes back to the three modes, and the next trip starts from where you stand.
@component
export class FywE1EndTripScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    expect(main.getPhase(), "on a trip").toBe("nav")
    expect(main.isLineVisible(), "line drawn").toBe(true)
    await tap(it, "EndWalkButton")
    await waitFor(() => main.getPhase() === "choose", 2000, "back to the modes")
    expect(main.isLineVisible(), "line gone").toBe(false)
    expect(main.getRouteStatus(), "no route").toBe("none")
    expect(main.getPillText(), "pill gone").toBe(null)
    log("E1b pass")
  }
}
