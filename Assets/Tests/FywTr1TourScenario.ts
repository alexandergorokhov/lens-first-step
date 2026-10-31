import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"
import {toModes} from "./FywB3Support"

// tr1 — Tour: preferences, then the shops they match, stop by stop with Next stop.
@component
export class FywTr1TourScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    await tap(it, "TourButton")
    await waitFor(() => main.getPhase() === "prefs" && main.isPrefsShown(), 3000, "preferences")
    await tap(it, "PrefsKeepButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "the tour starts")
    expect(main.isTour(), "tour").toBe(true)
    const stops = main.getStops()
    expect(stops.length >= 2 && stops.length <= 6, "stops: " + stops.join(",")).toBe(true)
    for (const id of stops) {
      const n = findNode(main.getMapData(), id)!
      expect(["coffee", "clothes", "hardware"].indexOf(n.category as string) >= 0, id + " matches").toBe(true)
    }
    expect(main.getDestinationId(), "first stop first").toBe(stops[0])
    const p = nodePos(main, stops[0])
    main.debugSetPose(p.x + 1, p.y, p.z, 0)
    await waitFor(() => main.getPhase() === "arrived", 3000, "arrive at stop 1")
    await tap(it, "NextStopButton")
    await waitFor(() => main.getDestinationId() === stops[1], 3000, "on to stop 2")
    log("tr1 pass")
  }
}
