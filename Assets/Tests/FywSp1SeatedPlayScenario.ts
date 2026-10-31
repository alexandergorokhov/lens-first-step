import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos, standStill} from "./FywBrief2Support"

// sp1 — sitting down: play moves close and short, a pinch jumps, standing up or a card ends it.
@component
export class FywSp1SeatedPlayScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const spot = nodePos(main, "sign")
    await tap(it, "CompanionButton")
    await standStill(main, spot)
    expect(main.isSeatedNow(), "standing").toBe(false)
    main.debugSetCameraDropCm(60)
    await waitFor(() => main.isSeatedNow(), 4000, "seated after 2 s")
    await standStill(main, spot)
    await tap(it, "PlayButton")
    await waitFor(() => main.getHopPhase() === "running", 2000, "Hop started")
    expect(main.getHopLaneM(), "short lane").toBe(3)
    const o = main.getHopOrigin()!
    const d = Math.sqrt((o.x - spot.x) ** 2 + (o.z - spot.z) ** 2)
    expect(d > 0.7 && d < 1.3, "close by: " + d.toFixed(2)).toBe(true)
    expect(main.jump(), "a pinch jumps").toBe(true)
    await sleep(800)
    main.debugSetCameraDropCm(0)
    await waitFor(() => !main.isSeatedNow(), 2000, "standing again")
    await waitFor(() => main.getHopPhase() === "idle", 2000, "standing up ends play")
    expect(main.getRouteNodes().join(">"), "route unchanged").toBe(route)
    log("sp1 pass")
  }
}
