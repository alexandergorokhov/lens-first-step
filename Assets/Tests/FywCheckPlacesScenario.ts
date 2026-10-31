import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, shot, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"

// Run twice, with a preview reset between (a "visual-" id, so only when named in `only`).
// First run: every bundled map comes from the gist, then "My place" is saved and left on the device.
// Second run: after the reset the saved map is still there and routes; then it's forgotten.
@component
export class FywCheckPlacesScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    if (main.hasSavedMap()) {
      log("check: My place survived the reset")
      try {
        await startTrip(it, "walk", 0, undefined, ["nav", "arrived"], "mine")
        expect(main.getMapKey(), "my place in the map switch").toBe("mine")
        expect(main.getRouteStatus(), "a route on the saved map").toBe("route")
      } finally {
        main.debugForgetSavedMap()
        await tap(it, "RestartButton")
      }
      log("check: My place reload pass")
      return
    }
    for (const key of ["airport", "hospital", "campus", "room", "mall"]) {
      await startTrip(it, "walk", 0, undefined, ["nav", "arrived"], key)
      log("check: " + key + " badge=" + main.getBadgeText())
      expect(main.getBadgeText(), key + " comes from the gist").toBe("online map")
      if (key === "airport") await shot(main, "floor-and-start")
    }
    await tap(it, "RestartButton")
    await waitFor(() => main.getPhase() === "scan" && !main.isAnchorSettling(), 12000, "scan sign")
    main.debugSetPose(0, 0, 0, 0)
    await tap(it, "ScanSignButton")
    await waitFor(() => main.getPhase() === "choose", 8000, "the three modes")
    await tap(it, "MapBuilderButton")
    main.debugMapPointAt(0, 0, 3)
    main.debugMapPointAt(3, 0, 3)
    main.debugMapPointAt(3, 0, 6)
    main.debugMapName("Room")
    expect(main.debugSaveMapping(), "saved").toBe(true)
    expect(main.hasSavedMap(), "kept").toBe(true)
    log("check: My place saved, reset the preview")
  }
}
