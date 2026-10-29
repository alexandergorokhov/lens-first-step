// LEAF scenario for Find Your Way Inside (review C1: seated Step-Free traveller).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {log, startTrip, tap} from "./FindYourWayLeafSupport"

// dc3b — a seated traveller: sitting down before choosing the mode does not lower the building
// (anchoring ignores the crouch), and 0.5 m from Lift 2 with the feet estimate 0.45 m below
// the floor the lift button still rides (same level, within reach).
@component
export class FywDc3bSeatedLiftScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    let floorStanding = 0
    const main = await startTrip(it, "stepFree", -0.45, undefined, ["nav"], "airport", (m) => {
      floorStanding = m.getFloorWorldY()
      m.debugSetCameraDropCm(45)
    })
    expect(main.getFloorWorldY(), "floor stays where it was when standing").toBeCloseTo(floorStanding, 0)
    const lift2 = findNode(main.getMapData(), "lift2G")!
    main.debugSetPose(lift2.x + 0.5, -0.45, lift2.z, 90)
    await sleep(300)
    const ride = main.getRideIdFor("lift2G", "lift")!
    await tap(it, "RideButton_" + ride)
    expect(main.getRideOffsetCm().y, "seated traveller rode Lift 2 up 6 m").toBeCloseTo(600, 0)
    expect(main.getHudCardTextOrEmpty(), "ride card").toBe("Lift up to Departures")
    log("DC3b pass")
  }
}
