// LEAF scenario for Find Your Way Inside (review C4).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {afterRestartGo, getMain, log, tap, waitFor, shot, SHOT} from "./FindYourWayLeafSupport"

// dest-change-before-scan-sticks — the gate changes before the sign is scanned (and the map
// then loads): the trip still goes to the new gate.
@component
export class FywDestBeforeScanScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    for (let i = 0; i < 5 && main.getMapKey() !== "airport"; i++) {
      await tap(it, "NextMapButton")
      await sleep(800)
    }
    await tap(it, "RestartButton")
    await waitFor(() => main.getPhase() === "scan", 3000, "scan sign")
    await sleep(800)
    await tap(it, "GateChangeButton")
    await sleep(300)
    expect(main.getDestinationId(), "destination before scan").toBe("gateC3")
    await shot(main, "dest-change-before-scan-sticks-1")
    const sign = findNode(main.getMapData(), main.getStartId())!
    main.debugSetPose(sign.x, 0, sign.z - 1.5, 0)
    // A downloaded copy (differs only in name) replaces the built-in map at scan time.
    main.debugSetDownloadOverride(JSON.stringify(Object.assign({}, main.getMapData(), {name: "Downloaded airport"})))
    await afterRestartGo(it, main, "WalkButton")
    await waitFor(() => main.getPhase() === "nav", 8000, "nav after scan")
    expect(main.getDestinationId(), "destination after scan").toBe("gateC3")
    const nodes = main.getRouteNodes()
    expect(nodes[nodes.length - 1], "route ends at C3: " + nodes.join(">")).toBe("gateC3")
    await shot(main, "dest-change-before-scan-sticks-2")
    log("dest-change-before-scan pass")
  }
}
