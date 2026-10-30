import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"

// m5 — Learn this place: map 4 points in the room, name one, tag a stretch, save; the Lens routes
// on it at once; the map is kept on the device.
@component
export class FywM5LearnThisPlaceScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    main.debugForgetSavedMap()
    await tap(it, "RestartButton")
    await waitFor(() => main.getPhase() === "mode" && !main.isAnchorSettling(), 4000, "mode panel")
    main.debugSetPose(0, 0, 0, 0)
    await tap(it, "MapThisPlaceButton")
    expect(main.getPhase(), "mapping").toBe("mapping")
    expect(main.isMappingPanelShown(), "mapping panel").toBe(true)
    expect(main.getMappedNodeCount(), "M1: the sign is the first point").toBe(1)
    expect(main.debugMapPointAt(0, 0, 3) !== null, "M2: point 1").toBe(true)
    expect(main.debugMapPointAt(0, 0, 3.2), "M2: too close is ignored").toBe(null)
    expect(main.debugMapPointAt(3, 0, 3) !== null, "point 2").toBe(true)
    expect(main.debugMapTag("ramp"), "M3: tag the stretch").toBe(true)
    expect(main.debugMapPointAt(3, 0, 6) !== null, "point 3").toBe(true)
    expect(main.debugMapName("Room"), "M4: named").toBe("Room")
    expect(main.debugSaveMapping(), "M5: saved").toBe(true)
    main.debugSetPose(3, 0, 6, 0) // restart cleared the pose: still standing at the last point
    expect(main.hasSavedMap(), "kept").toBe(true)
    expect(main.getMapKey(), "my place loaded").toBe("mine")
    expect(main.getPhase(), "back at the mode panel").toBe("mode")
    await sleep(800)
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "scan", 3000, "scan")
    await tap(it, "ScanSignButton")
    await waitFor(() => main.getPhase() === "nav" || main.getPhase() === "arrived", 8000, "routing on my place")
    expect(main.getRouteStatus(), "a route on the mapped place").toBe("route")
    expect(main.getDestinationId(), "back to the sign from the last point").toBe("sign")
    expect(main.isLineVisible(), "line drawn").toBe(true)
    // Clean up so the other scenarios cycle only the bundled maps.
    main.debugForgetSavedMap()
    await tap(it, "RestartButton")
    log("m5 pass")
  }
}
