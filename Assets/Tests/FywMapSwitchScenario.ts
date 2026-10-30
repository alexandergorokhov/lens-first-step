// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor, shot, SHOT} from "./FindYourWayLeafSupport"

// Map switch: "Map: … (switch)" cycles Airport → Hospital → Campus → Room → Airport, and each
// switch restarts at the mode panel with nothing drawn.
@component
export class FywMapSwitchScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    for (let i = 0; i < 5 && main.getMapKey() !== "airport"; i++) {
      await tap(it, "NextMapButton")
      await sleep(600)
    }
    expect(main.getMapKey(), "start on the airport").toBe("airport")
    const order = ["hospital", "campus", "room", "mall", "airport"]
    for (const key of order) {
      await tap(it, "NextMapButton")
      await waitFor(() => main.getMapKey() === key, 3000, "map " + key)
      await sleep(500)
      expect(main.getPhase(), key + ": phase").toBe("mode")
      expect(main.isModePanelShown(), key + ": mode panel").toBe(true)
      expect(main.isScanSignVisible(), key + ": scan sign hidden").toBe(false)
      expect(main.isLineVisible(), key + ": no line").toBe(false)
    }
    // Screenshot mode only: each map after its sign is scanned.
    if (SHOT.pauseMs > 0) {
      const keys = ["airport", "hospital", "campus", "room"]
      for (let i = 0; i < keys.length; i++) {
        const m = await startTrip(it, "walk", 0, undefined, ["nav"], keys[i])
        await shot(m, "map-switch-cycle-" + (i + 1))
      }
    }
    log("Map switch pass")
  }
}
