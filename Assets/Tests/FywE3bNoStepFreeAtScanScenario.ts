// LEAF scenario for Find Your Way Inside (review C5).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ASK_STAFF_MESSAGE, setEdgeOpen} from "../Scripts/FindYourWayRouter"
import {log, startTrip, shot, SHOT} from "./FindYourWayLeafSupport"

// e3b — the downloaded map already has both lifts out of service: right after the scan the
// Step-Free traveller sees the ask-staff card (not silence).
@component
export class FywE3bNoStepFreeAtScanScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "stepFree", 0, (m) => {
      const closed = setEdgeOpen(setEdgeOpen(m.getMapData(), "lift1", false), "lift2", false)
      m.debugSetDownloadOverride(JSON.stringify(closed))
    })
    expect(main.getRouteStatus(), "route status").toBe("askStaff")
    expect(main.getHudCardTextOrEmpty(), "card at scan").toBe(ASK_STAFF_MESSAGE)
    await shot(main, "e3b-no-step-free-at-scan-1")
    log("E3b pass")
  }
}
