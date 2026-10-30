// Brief 2, play while you wait (G1-G9, P8-P10 in devpost/SCENARIOS.md). Raising a hand is
// simulated with debugRaiseHand() (LEAF can't move tracked hands); the Jump button does the same.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos, standStill} from "./FywBrief2Support"

// g1 — Hop: only while standing still with the companion on; obstacles come, no jump = bump and
// shake; raise a hand to play again; walking off ends it; the route never changes.
@component
export class FywG1HopScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const spot = nodePos(main, "sign")
    main.debugSetPose(spot.x, 0, spot.z, 0)
    await sleep(2500)
    expect(main.canPlayNow(), "no play with the companion off").toBe(false)
    await tap(it, "CompanionButton")
    await standStill(main, spot)
    expect((main.getPlayLine() || "").indexOf("Raise your hand") === 0, "hint: " + main.getPlayLine()).toBe(true)
    await tap(it, "PlayButton")
    expect(main.getHopPhase(), "running").toBe("running")
    expect(main.isHopLaneShown(), "lane shown").toBe(true)
    await waitFor(() => main.getHopObstacles() > 0, 4000, "an obstacle comes")
    await waitFor(() => main.getHopPhase() === "crashed", 8000, "bump without a jump")
    expect((main.getPlayLine() || "").indexOf("Bump!") === 0, "bump text").toBe(true)
    await sleep(1500) // the shake ends
    main.debugRaiseHand()
    await sleep(300)
    expect(main.getHopPhase(), "raise a hand: play again").toBe("running")
    expect(main.getHopScore(), "score reset").toBe(0)
    await tap(it, "JumpButton")
    expect(main.getRouteNodes().join(">"), "route unchanged by play").toBe(route)
    // Walking off ends it.
    main.debugSetPose(spot.x + 2, 0, spot.z, 0)
    await sleep(400)
    expect(main.getHopPhase(), "walking ends play").toBe("idle")
    expect(main.isHopLaneShown(), "lane hidden").toBe(false)
    await tap(it, "CompanionButton")
    log("g1 pass")
  }
}

// pc1/pc2 — Catch: throw the treat, the companion fetches it and brings it back; the rover plays
// the same game; the route never changes.
@component
export class FywPc1CatchScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const spot = nodePos(main, "sign")
    await tap(it, "CompanionButton")
    await standStill(main, spot)
    await tap(it, "ThrowButton")
    expect(main.getCatchPhase() !== "idle", "fetching").toBe(true)
    await waitFor(() => main.getCatchPhase() === "idle", 8000, "fetched and brought back")
    expect(main.getCatches(), "one catch").toBe(1)
    await tap(it, "ModelButton")
    await tap(it, "ModelButton")
    expect(main.getCompanionModel(), "rover").toBe("rover")
    await standStill(main, spot)
    await tap(it, "ThrowButton")
    await waitFor(() => main.getCatchPhase() === "idle", 8000, "rover fetched")
    expect(main.getCatches(), "two catches").toBe(2)
    expect(main.getRouteNodes().join(">"), "route unchanged by catch").toBe(route)
    await tap(it, "ModelButton")
    await tap(it, "CompanionButton")
    log("pc1 pass")
  }
}
