// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode, findRoute, parseMap, setEdgeOpen, MapData} from "../Scripts/FindYourWayRouter"
import {bruteShortest, bundledMaps, kindsOf, log, nodePoints, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"

// Rule B — the Walk route is the shortest: Dijkstra length equals an independent brute-force
// search on every map and node pair, and the live airport trip draws that shortest route.
@component
export class FywWalkShortestScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(500)
    let checked = 0
    for (const {key, map} of bundledMaps()) {
      for (const a of map.nodes) {
        await sleep(1) // one source node per frame: the big maps pass the per-frame JS limit
        for (const b of map.nodes) {
          if (a.id === b.id) continue
          const best = bruteShortest(map, a.id, b.id, "walk")
          const r = findRoute(map, a.id, b.id, "walk")
          if (best === Infinity) {
            expect(r.status !== "route", key + " " + a.id + "->" + b.id + " should have no route").toBe(true)
            continue
          }
          expect(r.status, key + " " + a.id + "->" + b.id).toBe("route")
          if (r.status === "route") expect(Math.abs(r.length - best) < 1e-6, key + " " + a.id + "->" + b.id + " " + r.length + " vs " + best).toBe(true)
          checked++
        }
      }
    }
    const main = await startTrip(it, "walk")
    const best = bruteShortest(main.getMapData(), "sign", "gateB12", "walk")
    expect(Math.abs(main.getRouteLength() - best) < 1e-6, "live route " + main.getRouteLength() + " vs " + best).toBe(true)
    log("Walk shortest pass (" + checked + " routes)")
  }
}
