// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode, findRoute, parseMap, setEdgeOpen, MapData} from "../Scripts/FindYourWayRouter"
import {bruteShortest, bundledMaps, kindsOf, log, nodePoints, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"

// DC1 — Scanning the start: after choosing a mode, pinching the "you are here" sign places you
// at the entrance and a blue line appears on the floor toward gate B12.
@component
export class FywDc1ScanScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1500)
    const main = await startTrip(it, "walk")
    expect(main.getPhase(), "phase after scan").toBe("nav")
    expect(main.isScanSignVisible(), "sign button hides after the scan").toBe(false)
    expect(main.getDestinationId(), "destination").toBe("gateB12")
    const nodes = main.getRouteNodes()
    expect(nodes[0], "route starts at the entrance sign").toBe("sign")
    expect(nodes[nodes.length - 1], "route ends at B12").toBe("gateB12")
    await waitFor(() => main.isLineVisible(), 3000, "line visible")
    const pts = main.getLineMapPoints()
    expect(pts.length >= 2, "line has points").toBe(true)
    // the line starts at the point of the route nearest the user — the entrance sign, 1.5 m ahead —
    // and heads north into the hall
    const sign = findNode(main.getMapData(), "sign")!
    expect(Math.abs(pts[0].z - sign.z) < 0.2 && Math.abs(pts[0].x - sign.x) < 0.2, "line starts at the entrance sign").toBe(true)
    expect(pts[pts.length - 1].z > pts[0].z, "line heads into the building toward B12").toBe(true)
    // on the floor: building-local y = floor + 1 cm
    const local = main.getLineLocalPoints()
    expect(local.length >= 2, "line mesh points").toBe(true)
    expect(local[0].y, "line 1 cm above the floor").toBeCloseTo(1, 1)
    expect(main.getBadgeText() === "online map" || main.getBadgeText() === "offline map", "map badge").toBe(true)
    log("DC1 pass; badge=" + main.getBadgeText())
  }
}
