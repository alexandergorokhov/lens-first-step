import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, tap, waitFor} from "./FindYourWayLeafSupport"

// sh1 — the showing preset (REVIEW-FIXES.md section 0): one switch puts the Lens in the state shown
// to the judges, and Restart showing brings it back after a trip, a lift closure, a gate change and
// a model swap.

function shown(name: string): boolean {
  const t = findInteractableByName(name, undefined, true)
  return !!t && t.getSceneObject().isEnabledInHierarchy
}

// At the sign: Scan sign, then Go to a place (the mode panel with Walk preselected).
async function toModePanel(it: DefaultLeafInteractor, main: FindYourWayMain): Promise<void> {
  await waitFor(() => main.getPhase() === "scan" && main.isScanSignVisible(), 4000, "scan sign")
  await sleep(800)
  await waitFor(() => !main.isAnchorSettling(), 12000, "world anchor settled")
  const sign = findNode(main.getMapData(), main.getStartId())!
  main.debugSetPose(sign.x, 0, sign.z - 1.5, 0)
  await tap(it, "ScanSignButton")
  await waitFor(() => main.getPhase() === "choose", 8000, "the three modes")
  await tap(it, "GoToPlaceButton")
  await waitFor(() => main.getPhase() === "mode", 3000, "Go to a place panel")
}

async function expectShowingState(it: DefaultLeafInteractor, main: FindYourWayMain, what: string): Promise<void> {
  expect(main.getMapKey(), what + ": airport").toBe("airport")
  expect(main.getPhase(), what + ": scan phase").toBe("scan")
  const s = main.getStartSettings()
  expect(s.startAtSign, what + ": starts at the sign").toBe(true)
  expect(s.showDemoControls, what + ": demo controls off").toBe(false)
  expect(s.companionModel + "/" + s.companionOnAtStart, what + ": the dog, on").toBe("dog/true")
  expect(main.getCompanionModel(), what + ": dog model").toBe("dog")
  expect(main.getClosedEdges().length, what + ": no closures").toBe(0)
  expect(main.getNextMapKey(), what + ": the room is one press away").toBe("room")
  main.debugShowDemoControls(false)
  await sleep(200)
  expect(main.areDemoControlsShown(), what + ": demo controls hidden").toBe(false)
  await toModePanel(it, main)
  expect(main.getPreselectedMode(), what + ": Walk preselected").toBe("walk")
  expect(main.getWalkButtonLabel().indexOf("▶") === 0, what + ": Walk highlighted: " + main.getWalkButtonLabel()).toBe(true)
  expect(main.getDestinationId(), what + ": to B12").toBe("gateB12")
  await tap(it, "WalkButton")
  await waitFor(() => main.getPhase() === "nav", 8000, what + ": one pinch starts Walk")
  await sleep(300)
  expect(main.isCompanionOn(), what + ": companion on").toBe(true)
}

@component
export class FywSh1ShowingPresetScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    try {
      main.debugSetShowingPreset(true)
      main.restartShowing()
      await expectShowingState(it, main, "preset")
      // The Options panel folds to its tab once the trip starts: open it to see the preset's rows.
      if (main.isOptionsCollapsed()) await tap(it, "OptionsTabButton")
      expect(shown("RestartShowingButton"), "Restart showing on the Options panel").toBe(true)
      expect(shown("ShowingGateChangeButton"), "Demo: gate change shown under the preset").toBe(true)
      expect(shown("ShowingMapButton"), "the map switch shown under the preset").toBe(true)

      // Mess it up: a lift closure, a model swap, the gate change.
      main.debugCloseEdge("lift1")
      await tap(it, "ModelButton")
      expect(main.getCompanionModel() !== "dog", "model swapped").toBe(true)
      await tap(it, "ShowingGateChangeButton")
      expect(main.getDestinationId(), "gate change swings the route to C3").toBe("gateC3")
      expect(main.getHudCardText(), "with the card").toBe("Gate change B12 → C3")
      expect(main.getClosedEdges().length > 0, "a closure").toBe(true)

      await tap(it, "RestartShowingButton")
      await expectShowingState(it, main, "after Restart showing")

      // The preset off: no showing buttons.
      main.debugSetShowingPreset(false)
      main.restartShowing()
      await toModePanel(it, main)
      expect(main.getPreselectedMode(), "nothing preselected without the preset").toBe(null)
      // Without the preset a place is picked first (R2-23), as by Where to?.
      main.debugPickDefaultDestination()
      await tap(it, "WalkButton")
      await waitFor(() => main.getPhase() === "nav", 8000, "Walk")
      await sleep(300)
      expect(shown("ShowingGateChangeButton"), "no Demo: gate change without the preset").toBe(false)
      // Restart is always there now (R2-48).
      // (Its row is on; the panel itself may be folded to the tab at this point.)
      log("sh1: restart row " + main.isRestartRowOn() + ", phase " + main.getPhase())
      expect(main.isRestartRowOn(), "Restart without the preset too").toBe(true)
      log("sh1 pass")
    } finally {
      main.debugSetShowingPreset(false)
      main.debugShowDemoControls(true)
    }
  }
}
