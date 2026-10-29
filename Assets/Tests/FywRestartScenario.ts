// LEAF scenario for Find Your Way Inside (devpost/SCENARIOS.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor, shot, SHOT} from "./FindYourWayLeafSupport"

// Restart trip resets cleanly: mode panel back, no line, no stale cards, closures reopened.
@component
export class FywRestartScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    await tap(it, "ClosureButton_lift1")
    expect(main.isEdgeOpen("lift1"), "lift1 closed").toBe(false)
    await tap(it, "GateChangeButton")
    expect(main.getDestinationId(), "gate changed").toBe("gateC3")
    expect(main.isLineVisible(), "line before restart").toBe(true)
    await shot(main, "restart-resets-trip-1")
    await tap(it, "RestartButton")
    await sleep(500)
    expect(main.getPhase(), "phase").toBe("mode")
    expect(main.isModePanelShown(), "mode panel").toBe(true)
    expect(main.isScanSignVisible(), "scan sign hidden").toBe(false)
    expect(main.isLineVisible(), "no line").toBe(false)
    expect(main.getHudCardText(), "no stale card").toBe(null)
    expect(main.isArrivalCardShown(), "no arrival card").toBe(false)
    expect(main.getBadgeText(), "badge cleared").toBe(null)
    expect(main.isEdgeOpen("lift1"), "lift1 reopened").toBe(true)
    expect(main.getDestinationId(), "destination back to B12").toBe("gateB12")
    expect(main.getRideOffsetCm().length, "no ride offset").toBeCloseTo(0, 1)
    await shot(main, "restart-resets-trip-2")
    log("Restart pass")
  }
}
