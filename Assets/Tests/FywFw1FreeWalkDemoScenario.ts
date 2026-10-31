import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep, findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayDemoRunner} from "../Scripts/FindYourWayDemoRunner"
import {FREE_WALK_BEATS} from "../Scripts/FindYourWayDemo"
import {getMain, log, tap, waitFor} from "./FindYourWayLeafSupport"

// fw1 — the Free walk demo button: the mall, the companion leading, its hint and its stop, all beats.
@component
export class FywFw1FreeWalkDemoScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    const so = findSceneObjectByName("DemoRunner")
    if (!so) throw new Error("DemoRunner not found")
    const runner = so.getComponent(FindYourWayDemoRunner.getTypeName()) as FindYourWayDemoRunner
    await tap(it, "FreeWalkDemoButton")
    await waitFor(() => main.getMapKey() === "mall", 8000, "the mall")
    await waitFor(() => main.getPhase() === "free", 25000, "Free walk starts")
    await waitFor(() => main.isCompanionShown(), 3000, "the companion is out")
    await waitFor(() => main.getBubbleText() !== null, 25000, "it says what's upstairs")
    await waitFor(() => main.getStopId() === "boltHardware", 25000, "it stops at a shop you like")
    await waitFor(() => !runner.isRunning(), 40000, "the demo ends")
    expect(runner.isFinished(), "finished").toBe(true)
    expect(runner.getReachedBeats().length, "every beat").toBe(FREE_WALK_BEATS.length)
    expect(runner.getMissedPresses().length, "no missed presses: " + runner.getMissedPresses().join(",")).toBe(0)
    main.debugClearPose()
    log("fw1 pass")
  }
}
