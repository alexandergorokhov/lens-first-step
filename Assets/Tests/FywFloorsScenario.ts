// Brief 2, floors and distance (S10-S14 in devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, walkAlong, nodePoints} from "./FindYourWayLeafSupport"
import {levelAt, nodePos, pillMetres} from "./FywBrief2Support"

// fl1 — the pill shows after the scan with the floor badge first, names the gate, counts down as
// you walk; the destination note shows above it; it hides at arrival.
@component
export class FywFl1PillScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const ground = levelAt(main, 0)
    const pill = main.getPillText()
    expect(pill !== null, "pill shows after the scan").toBe(true)
    expect((pill as string).indexOf(ground + " · Gate B12 · ") === 0, "badge then gate: " + pill).toBe(true)
    expect((pill as string).indexOf("1 floor up") >= 0, "1 floor up: " + pill).toBe(true)
    expect((main.getCueText() || "").indexOf("Gate B12 is on ") === 0, "destination note: " + main.getCueText()).toBe(true)
    const m0 = pillMetres(pill)
    const total = main.getRouteLength()
    expect(Math.abs(m0 - total) <= 2, "pill metres ≈ route length " + m0 + " vs " + total).toBe(true)
    const map = main.getMapData()
    await walkAlong(main, nodePoints(map, ["sign", "hall"]), 1.0)
    await sleep(300)
    const m1 = pillMetres(main.getPillText())
    expect(m1 < m0 - 3, "counts down: " + m0 + " -> " + m1).toBe(true)
    // Arrival hides it.
    const gate = nodePos(main, "gateB12")
    await tap(it, "RideButton_" + main.getRideIdFor("escFoot", "escalator"))
    main.debugSetPose(gate.x + 1, gate.y, gate.z, 0)
    await sleep(500)
    expect(main.getPhase(), "arrived").toBe("arrived")
    expect(main.getPillText(), "pill hidden at arrival").toBe(null)
    log("fl1 pass")
  }
}

// fl2/fl3 — 15 m before the escalator the cue reads "In N m: escalator up to <level>"; the line ends
// at its foot with an up post; after riding, the badge names the upper floor.
@component
export class FywFl2CueBadgeScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const foot = nodePos(main, "escFoot")
    const top = nodePos(main, "escTop")
    const upper = levelAt(main, top.y)
    // Stand on the route ~8 m before the foot (approaching along hall -> escFoot).
    const hall = nodePos(main, "hall")
    const d = Math.sqrt((foot.x - hall.x) ** 2 + (foot.z - hall.z) ** 2)
    const k = Math.max(0, 1 - 8 / d)
    main.debugSetPose(hall.x + (foot.x - hall.x) * k, 0, hall.z + (foot.z - hall.z) * k, 0)
    await sleep(800)
    const cue = main.getCueText() || ""
    expect(cue.indexOf("In ") === 0 && cue.indexOf("escalator up to " + upper) > 0, "cue: " + cue).toBe(true)
    expect(main.isFloorPostShown(), "up post at the foot").toBe(true)
    const pts = main.getLineMapPoints()
    expect(pts.every((p) => Math.abs(p.y) < 0.3), "line stays on the ground floor").toBe(true)
    main.debugSetPose(foot.x, 0, foot.z, 0)
    await sleep(300)
    await tap(it, "RideButton_" + main.getRideIdFor("escFoot", "escalator"))
    main.debugSetPose(top.x, top.y, top.z, 0)
    await sleep(600)
    expect((main.getPillText() || "").indexOf(upper + " · ") === 0, "badge after the ride: " + main.getPillText()).toBe(true)
    log("fl2 pass")
  }
}
