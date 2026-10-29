// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"

// E3 — no step-free route (both lifts out): ask-staff message and a line to the assistance point.
@component
export class FywE3NoStepFreeScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "stepFree")
    await tap(it, "ClosureButton_lift1")
    main.debugCloseEdge("lift2")
    await sleep(300)
    expect(main.getRouteStatus(), "route status").toBe("askStaff")
    expect(main.getHudCardTextOrEmpty(), "card").toBe("No step-free route. Ask staff at the assistance point.")
    // From the check-in hall the line runs to the assistance point.
    const hall = findNode(main.getMapData(), "hall")!
    main.debugSetPose(hall.x, 0, hall.z, 270)
    await sleep(400)
    expect(main.isLineVisible(), "line drawn").toBe(true)
    const pts = main.getLineMapPoints()
    const assist = findNode(main.getMapData(), "assist")!
    const end = pts[pts.length - 1]
    expect(Math.abs(end.x - assist.x) < 0.1 && Math.abs(end.z - assist.z) < 0.1, "line ends at the assistance point").toBe(true)
    log("E3 pass")
  }
}
