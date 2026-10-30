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
