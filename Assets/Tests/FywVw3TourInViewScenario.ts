import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FOV_HALF_DEG, inView} from "../Scripts/FindYourWayView"
import {log, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {startFreeWalk, toModes} from "./FywB3Support"
import {floorArrow, walkChecking} from "./FywVwSupport"

// vw3 — Tour: the same in-view pointing on a leg of the tour, and the floor arrow.
@component
export class FywVw3TourInViewScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    await tap(it, "TourButton")
    await waitFor(() => main.getPhase() === "prefs" && main.isPrefsShown(), 3000, "preferences")
    await tap(it, "PrefsKeepButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "the tour starts")
    if (!main.isCompanionOn()) await tap(it, "CompanionButton")
    const route = main.getRouteNodes()
    const length = main.getRouteLength()
    await walkChecking(main, route.slice(0, Math.max(2, route.length - 1)), "vw3")
    expect(main.getRouteLength() <= length + 1e-6, "route not lengthened by pointing").toBe(true)
    await floorArrow(main, "vw3")
    log("vw3 pass")
  }
}
