import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos, standStill} from "./FywBrief2Support"

// pc1/pc2 — Catch: throw the treat, the companion fetches it and brings it back; the rover plays
// the same game; the route never changes.
@component
export class FywPc1CatchScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const spot = nodePos(main, "sign")
    await tap(it, "CompanionButton")
    await standStill(main, spot)
    await tap(it, "ThrowButton")
    expect(main.getCatchPhase() !== "idle", "fetching").toBe(true)
    await waitFor(() => main.getCatchPhase() === "idle", 8000, "fetched and brought back")
    expect(main.getCatches(), "one catch").toBe(1)
    await tap(it, "ModelButton")
    await tap(it, "ModelButton")
    expect(main.getCompanionModel(), "rover").toBe("rover")
    await standStill(main, spot)
    await tap(it, "ThrowButton")
    await waitFor(() => main.getCatchPhase() === "idle", 8000, "rover fetched")
    expect(main.getCatches(), "two catches").toBe(2)
    expect(main.getRouteNodes().join(">"), "route unchanged by catch").toBe(route)
    await tap(it, "ModelButton")
    await tap(it, "CompanionButton")
    log("pc1 pass")
  }
}
