// Brief 2: multi-stop mall trip (T1-T3), Learn this place (M1-M5), peek ahead (Z1-Z3), and the
// start at the entrance sign with the demo controls hidden (handoff items 1-2).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"

// t1 — the mall: three shops ordered for the shortest walk, stop by stop with Next stop; on
// Step-Free no leg uses stairs or an escalator.
@component
export class FywT1MallStopsScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    for (const profile of ["walk", "stepFree"]) {
      const main = await startTrip(it, profile as "walk" | "stepFree", 0, undefined, ["nav"], "mall")
      const stops = main.getStops()
      expect(stops.length, "three stops").toBe(3)
      expect(main.getDestinationId(), "first stop first").toBe(stops[0])
      for (let i = 0; i < stops.length; i++) {
        if (profile === "stepFree") {
          const kinds = main.getRouteEdgeKinds()
          expect(kinds.indexOf("stairs") < 0 && kinds.indexOf("escalator") < 0, "step-free leg " + (i + 1)).toBe(true)
        }
        const p = nodePos(main, stops[i])
        main.debugSetPose(p.x + 1, p.y, p.z, 0)
        await waitFor(() => main.getPhase() === "arrived", 3000, "arrive at stop " + (i + 1))
        expect((main.getArrivalText() || "").indexOf("Stop " + (i + 1) + " of 3: ") === 0, "card: " + main.getArrivalText()).toBe(true)
        if (i < stops.length - 1) {
          await tap(it, "NextStopButton")
          await sleep(300)
          expect(main.getDestinationId(), "next stop").toBe(stops[i + 1])
        }
      }
    }
    log("t1 pass")
  }
}

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
    expect(main.hasSavedMap(), "kept").toBe(true)
    expect(main.getMapKey(), "my place loaded").toBe("mine")
    expect(main.getPhase(), "back at the mode panel").toBe("mode")
    await sleep(800)
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "scan", 3000, "scan")
    main.debugSetPose(0, 0, -1, 0)
    await tap(it, "ScanSignButton")
    await waitFor(() => main.getPhase() === "nav" || main.getPhase() === "arrived", 8000, "routing on my place")
    expect(main.getRouteStatus(), "a route on the mapped place").toBe("route")
    expect(main.isLineVisible(), "line drawn").toBe(true)
    // Clean up so the other scenarios cycle only the bundled maps.
    main.debugForgetSavedMap()
    await tap(it, "RestartButton")
    log("m5 pass")
  }
}

// pk1 — peek ahead shows a small model with the route; letting go hides it; the route never changes.
@component
export class FywPk1PeekScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const length = main.getRouteLength()
    expect(main.isPeekShown(), "hidden at first").toBe(false)
    main.debugPeek(true)
    await sleep(400)
    expect(main.isPeekShown(), "Z1: pinch-pull shows the model").toBe(true)
    main.debugPeek(false)
    await sleep(300)
    expect(main.isPeekShown(), "Z2: let go hides it").toBe(false)
    expect(main.getRouteNodes().join(">"), "Z3: route unchanged").toBe(route)
    expect(main.getRouteLength(), "Z3: length unchanged").toBe(length)
    log("pk1 pass")
  }
}

// s1 — you start at the entrance sign (the building's start is under your feet), and the demo
// controls are hidden unless asked for.
@component
export class FywS1StartAtSignScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    await tap(it, "RestartButton")
    main.debugShowDemoControls(false)
    await sleep(300)
    expect(main.areDemoControlsShown(), "demo controls hidden by default").toBe(false)
    main.debugShowDemoControls(true)
    await waitFor(() => main.getPhase() === "mode" && !main.isAnchorSettling(), 4000, "mode panel")
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "scan", 3000, "scan")
    const s = main.getStartWorldPos()
    const c = main.getCameraWorldPos()
    const d = Math.sqrt((s.x - c.x) ** 2 + (s.z - c.z) ** 2)
    expect(d < 30, "the sign is under your feet (" + d.toFixed(0) + " cm)").toBe(true)
    expect(main.isScanSignVisible(), "scan panel ahead").toBe(true)
    await startTrip(it, "walk")
    log("s1 pass")
  }
}
