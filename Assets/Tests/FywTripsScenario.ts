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
