// Play while you wait (G1-G9, P8-P10 in devpost/SCENARIOS.md). Raising a hand is
// simulated with debugRaiseHand() (LEAF can't move tracked hands); the Jump button does the same.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
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
    await sleep(200)
    expect(main.isAppPanelPlaying(), "the panel moves to the side while playing").toBe(true)
    expect(findInteractableByName("CompanionButton", undefined, true) === undefined, "only Stop and Jump stay").toBe(true)
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
    expect(main.isAppPanelPlaying(), "the panel comes back").toBe(false)
    await tap(it, "CompanionButton")
    log("g1 pass")
  }
}
