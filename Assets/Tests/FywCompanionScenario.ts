// The companion (P1-P7, Q7, Q8 in devpost/SCENARIOS.md): a feature you turn on or off,
// any model, waits at floor changes, never changes the route.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, walkAlong} from "./FindYourWayLeafSupport"
import {flat, nodePos} from "./FywBrief2Support"

// p1 — the toggle shows and hides the companion; the line stays; dog -> robot changes only
// the model, name and collectible; the route never changes; the score survives off/on.
@component
export class FywP1CompanionToggleScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    expect(main.isCompanionOn(), "off by default").toBe(false)
    expect(main.isCompanionShown(), "not shown").toBe(false)
    await tap(it, "CompanionButton")
    await sleep(400)
    expect(main.isCompanionShown(), "shown when on").toBe(true)
    expect(main.isLineVisible(), "the line still shows").toBe(true)
    expect((main.getScoreWanted() || "").indexOf("Treats 0 of ") === 0, "score chip: " + main.getScoreWanted()).toBe(true)
    const p = main.getCompanionMapPos()
    expect(!!p, "companion placed").toBe(true)
    await tap(it, "ModelButton")
    await sleep(300)
    expect(main.getCompanionModel(), "robot model").toBe("robot")
    expect(main.getCompanionName(), "robot name").toBe("Robot")
    expect((main.getScoreWanted() || "").indexOf("Bolts ") === 0, "robot collects bolts: " + main.getScoreWanted()).toBe(true)
    expect(main.getRouteNodes().join(">"), "route unchanged by the model").toBe(route)
    await tap(it, "CompanionButton")
    await sleep(300)
    expect(main.isCompanionShown(), "hidden when off").toBe(false)
    expect(main.isLineVisible(), "line without the companion").toBe(true)
    expect(main.getScoreWanted(), "no score chip when off").toBe(null)
    expect(main.getRouteNodes().join(">"), "route unchanged by the toggle").toBe(route)
    await tap(it, "ModelButton") // back to the dog for the next scenarios
    log("p1 pass")
  }
}
