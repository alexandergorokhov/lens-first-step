import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos, standStill} from "./FywBrief2Support"

// gt1 — catch by hand: pinch the treat by your hand, swing and let go; the companion fetches it.
@component
export class FywGt1GrabThrowScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const spot = nodePos(main, "sign")
    await tap(it, "CompanionButton")
    await standStill(main, spot)
    await waitFor(() => main.isGrabTreatShown(), 2000, "the treat by your hand")
    const treat = findInteractableByName("GrabTreat", undefined, true)
    if (!treat) throw new Error("GrabTreat not found")
    await it.drag(treat, new vec3(0, 3, -15), 900) // per frame: a real swing at the preview's low frame rate
    await waitFor(() => main.getCatchPhase() !== "idle", 2000, "thrown")
    const c = main.getCatchSpot()!
    const d = Math.sqrt((c.x - spot.x) ** 2 + (c.z - spot.z) ** 2)
    expect(d <= 5.01, "lands within reach: " + d.toFixed(2)).toBe(true)
    await waitFor(() => main.getCatchPhase() === "idle", 8000, "fetched and brought back")
    expect(main.getCatches(), "one catch").toBe(1)
    expect(main.getRouteNodes().join(">"), "route unchanged").toBe(route)
    await tap(it, "CompanionButton")
    log("gt1 pass")
  }
}
