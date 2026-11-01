// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor, shot, SHOT} from "./FindYourWayLeafSupport"

// E5 — the scanned sign isn't in the map: "This sign isn't in the map", nothing drawn.
@component
export class FywE5UnknownSignScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, (m) => m.debugSetStartOverride("sign-T9-404"), ["error"])
    expect(main.getPhase(), "phase").toBe("error")
    expect(main.getHudCardTextOrEmpty(), "card").toBe("This sign isn't in the map")
    expect(main.isLineVisible(), "nothing drawn").toBe(false)
    expect(main.getRouteStatus(), "no route").toBe("none")
    expect(main.isScanSignVisible(), "the sign stays, to scan again").toBe(true)
    await shot(main, "e5-unknown-sign-1")
    log("E5 pass")
  }
}
