// LEAF scenario for Find Your Way Inside (review C13 + spec gaps: closure card, red sign height,
// every lift has its own sign, notice card hides after 5 s).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap} from "./FindYourWayLeafSupport"

// closure-card-and-signs — the Step-Free route uses Lift 1. Pinching Lift 2's own red sign says
// only that Lift 2 is out of service (the route did not use it, nothing re-routes); both red
// signs hang at ~1.2 m; the notice card is still up at 4 s and gone after 5 s.
@component
export class FywClosureCardScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "stepFree")
    const before = main.getRouteNodes().join(">")
    expect(before.indexOf("lift1G") >= 0, "route uses Lift 1: " + before).toBe(true)
    for (const id of ["lift1", "lift2"]) {
      expect(main.getClosureSignHeightCm(id), id + " red sign height (cm)").toBeCloseTo(120, -1)
    }
    await tap(it, "ClosureButton_lift2")
    await sleep(200)
    expect(main.getHudCardTextOrEmpty(), "card for an unused lift").toBe("Lift 2 out of service")
    expect(main.getRouteNodes().join(">"), "route unchanged").toBe(before)
    await sleep(3500)
    expect(main.getHudCardTextOrEmpty(), "card still up at ~4 s").toBe("Lift 2 out of service")
    await sleep(1600)
    expect(main.getHudCardText(), "card gone after 5 s").toBe(null)
    log("closure-card pass")
  }
}
