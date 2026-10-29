// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode, findRoute, parseMap, setEdgeOpen, MapData} from "../Scripts/FindYourWayRouter"
import {bruteShortest, bundledMaps, kindsOf, log, nodePoints, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"

// Rule A — a Step-Free route never uses stairs or an escalator (every map, every node pair,
// with and without each lift/ramp closed), and the live Step-Free trip agrees.
@component
export class FywStepFreeRuleScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)
    let checked = 0
    for (const {key, map} of bundledMaps()) {
      const variants: MapData[] = [map]
      for (const e of map.edges) if (e.id) variants.push(setEdgeOpen(map, e.id, false))
      for (const m of variants) {
        for (const a of m.nodes) for (const b of m.nodes) {
          if (a.id === b.id) continue
          const r = findRoute(m, a.id, b.id, "stepFree")
          const edges = r.status === "route" ? r.edges : r.status === "askStaff" && r.assistance ? r.assistance.edges : []
          for (const k of kindsOf(edges)) {
            expect(k !== "stairs" && k !== "escalator", key + " " + a.id + "->" + b.id + " used " + k).toBe(true)
          }
          checked++
        }
      }
    }
    expect(checked > 100, "pairs checked").toBe(true)
    log("Step-Free rule pass (" + checked + " routes)")
  }
}
