// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode, findRoute, parseMap, setEdgeOpen, MapData} from "../Scripts/FindYourWayRouter"
import {bruteShortest, bundledMaps, kindsOf, log, nodePoints, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"

// DC5 — Arrival: within 3 m of the gate the line stops and "Gate C3. Boarding in 6 min." shows.
@component
export class FywDc5ArrivalScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    await tap(it, "GateChangeButton")
    const gate = findNode(main.getMapData(), "gateC3")!
    main.debugSetPose(gate.x + 3.5, gate.y, gate.z, 270)
    await sleep(400)
    expect(main.getPhase(), "3.5 m away: not arrived yet").toBe("nav")
    expect(main.getArrivalText(), "no card yet").toBe(null)
    main.debugSetPose(gate.x + 2.9, gate.y, gate.z, 270)
    await sleep(400)
    expect(main.getPhase(), "arrived within 3 m").toBe("arrived")
    expect(main.isLineVisible(), "line stops").toBe(false)
    expect(main.getArrivalText(), "arrival card").toBe("Gate C3. Boarding in 6 min.")
    log("DC5 pass")
  }
}
