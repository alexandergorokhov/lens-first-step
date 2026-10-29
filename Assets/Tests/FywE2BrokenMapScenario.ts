// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"

// E2 — an invalid map.json arrives: "Map couldn't load", the built-in map is used, no crash.
@component
export class FywE2BrokenMapScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, (m) => m.debugSetDownloadOverride('{"nodes": [ broken'))
    expect(main.getHudCardTextOrEmpty(), "card").toBe("Map couldn't load")
    expect(main.getBadgeText(), "badge").toBe("offline map")
    expect(main.getMapSource(), "source").toBe("offline")
    expect(main.getRouteNodes().join(">"), "built-in map still routes").toBe("sign>hall>escFoot>escTop>concourse>bJunction>gateB12")
    await waitFor(() => main.isLineVisible(), 3000, "line visible")
    log("E2 pass")
  }
}
