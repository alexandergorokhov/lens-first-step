// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode, findRoute, parseMap, setEdgeOpen, MapData} from "../Scripts/FindYourWayRouter"
import {bruteShortest, bundledMaps, kindsOf, log, nodePoints, startTrip, tap, waitFor, walkAlong, shot, SHOT} from "./FindYourWayLeafSupport"

// DC4 — Gate change: Walk takes the stairs down to the C pier; Step-Free takes the ramp.
@component
export class FywDc4GateChangeScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const walk = await startTrip(it, "walk")
    // walking: already at the top of the escalator when the gate changes
    const escTop = findNode(walk.getMapData(), "escTop")!
    walk.debugSetPose(escTop.x, escTop.y, escTop.z + 0.5, 0)
    await sleep(300)
    const swings = walk.getLineSwingCount()
    await tap(it, "GateChangeButton")
    expect(walk.getDestinationId(), "new destination").toBe("gateC3")
    expect(walk.getHudCardText(), "gate-change card").toBe("Gate change B12 → C3")
    // The swing lasts 0.9 s; on slow frames it is over before the tap returns, so count it.
    expect(walk.getLineSwingCount() > swings, "line swings round").toBe(true)
    await shot(walk, "dc4-gate-change-stairs-and-ramp-1", true)
    const k = walk.getRouteEdgeKinds()
    expect(k.indexOf("stairs") >= 0, "walk takes the stairs: " + k.join(",")).toBe(true)
    const nodes = walk.getRouteNodes()
    expect(nodes.indexOf("cTop") >= 0 && nodes.indexOf("cJunction") >= 0, "down to the C pier").toBe(true)

    const sf = await startTrip(it, "stepFree")
    await tap(it, "GateChangeButton")
    const k2 = sf.getRouteEdgeKinds()
    expect(k2.indexOf("ramp") >= 0, "step-free takes the ramp: " + k2.join(",")).toBe(true)
    expect(k2.indexOf("stairs") < 0 && k2.indexOf("escalator") < 0, "no stairs/escalator").toBe(true)
    await shot(sf, "dc4-gate-change-stairs-and-ramp-2")
    log("DC4 pass")
  }
}
