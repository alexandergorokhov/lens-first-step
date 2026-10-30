// Brief 2, the companion (P1-P7, Q7, Q8 in devpost/SCENARIOS.md): a feature you turn on or off,
// any model, waits at floor changes, never changes the route.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, walkAlong} from "./FindYourWayLeafSupport"
import {flat, nodePos} from "./FywBrief2Support"

// p1 — the toggle shows and hides the companion; the line stays; dog -> robot -> rover changes only
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
    expect((main.getScoreText() || "").indexOf("Treats 0 of ") === 0, "score chip: " + main.getScoreText()).toBe(true)
    const p = main.getCompanionMapPos()
    expect(!!p, "companion placed").toBe(true)
    await tap(it, "ModelButton")
    await sleep(300)
    expect(main.getCompanionModel(), "robot model").toBe("robot")
    expect(main.getCompanionName(), "robot name").toBe("Robot")
    expect((main.getScoreText() || "").indexOf("Bolts ") === 0, "robot collects bolts: " + main.getScoreText()).toBe(true)
    await tap(it, "ModelButton")
    await sleep(300)
    expect(main.getCompanionModel(), "rover model").toBe("rover")
    expect(main.getRouteNodes().join(">"), "route unchanged by the model").toBe(route)
    await tap(it, "CompanionButton")
    await sleep(300)
    expect(main.isCompanionShown(), "hidden when off").toBe(false)
    expect(main.isLineVisible(), "line without the companion").toBe(true)
    expect(main.getScoreText(), "no score chip when off").toBe(null)
    expect(main.getRouteNodes().join(">"), "route unchanged by the toggle").toBe(route)
    await tap(it, "ModelButton") // back to the dog for the next scenarios
    log("p1 pass")
  }
}

// p3 — near the escalator the companion sits at its foot on your floor until you get there.
@component
export class FywP3WaitsAtEscalatorScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const foot = nodePos(main, "escFoot")
    const hall = nodePos(main, "hall")
    const d = flat(foot, hall)
    const k = Math.max(0, 1 - 1.5 / d)
    // Walk there with the companion on (it waits for you if you jump more than 6 m ahead of it).
    await tap(it, "CompanionButton")
    await walkAlong(main, [nodePos(main, "sign"), hall, {x: hall.x + (foot.x - hall.x) * k, y: 0, z: hall.z + (foot.z - hall.z) * k}], 0.5)
    await sleep(3000)
    const p = main.getCompanionMapPos()
    expect(!!p, "companion placed").toBe(true)
    expect(flat(p!, foot) < 1.0, "sits at the foot: " + JSON.stringify(p)).toBe(true)
    expect(Math.abs(p!.y) < 0.3, "on your floor, not up the escalator").toBe(true)
    await tap(it, "CompanionButton")
    log("p3 pass")
  }
}
