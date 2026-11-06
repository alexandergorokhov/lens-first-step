import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FOV_HALF_DEG, inView} from "../Scripts/FindYourWayView"
import {log, setCompanion, startTrip, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {startFreeWalk, toModes} from "./FywB3Support"
import {floorArrow, walkChecking} from "./FywVwSupport"

// vw1 — Go to a place: the companion points at a coffee shop but stays in view, goes back to the
// lead, never changes the route; turned away for ~2 s, the small floor arrow shows, and hides again.
@component
export class FywVw1GuidedInViewScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, undefined, ["nav"], "airport", (m) => m.debugSetInterests(["coffee"]))
    await setCompanion(it, main, true) // on at start or not (a blind tap turned it off)
    const route = main.getRouteNodes().join(">")
    const length = main.getRouteLength()
    const dest = main.getDestinationId()
    const r = await walkChecking(main, ["sign", "hall", "escFoot"], "vw1")
    expect(r.points > 0, "it pointed on the way").toBe(true)
    await waitFor(() => main.getPointState() === "lead", 8000, "back in the lead")
    expect(main.getRouteNodes().join(">"), "route unchanged").toBe(route)
    expect(main.getRouteLength(), "length unchanged").toBe(length)
    expect(main.getDestinationId(), "destination unchanged").toBe(dest)
    await floorArrow(main, "vw1")
    await setCompanion(it, main, false)
    log("vw1 pass")
  }
}
