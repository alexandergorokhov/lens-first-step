import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, walkAlong} from "./FindYourWayLeafSupport"
import {flat, nodePos} from "./FywBrief2Support"

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
