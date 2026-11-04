import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"

// s1 — you start at the entrance sign (the building's start is under your feet), and the demo
// controls are hidden unless asked for.
@component
export class FywS1StartAtSignScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    await tap(it, "RestartButton")
    main.debugShowDemoControls(false)
    await sleep(300)
    expect(main.areDemoControlsShown(), "demo controls hidden by default").toBe(false)
    main.debugShowDemoControls(true)
    await waitFor(() => main.getPhase() === "scan" && !main.isAnchorSettling(), 12000, "scan sign")
    const s = main.getStartWorldPos()
    const c = main.getCameraWorldPos()
    const d = Math.sqrt((s.x - c.x) ** 2 + (s.z - c.z) ** 2)
    expect(d < 30, "the sign is under your feet (" + d.toFixed(0) + " cm)").toBe(true)
    expect(main.isScanSignVisible(), "scan panel ahead").toBe(true)
    // The whole panel fits the ~37° tall view: its centre sits a little below eye level, not at waist height.
    const p = main.getScanSignWorldPos()
    const below = Math.atan2(c.y - p.y, Math.sqrt((p.x - c.x) ** 2 + (p.z - c.z) ** 2)) * 180 / Math.PI
    expect(below > 0 && below < 10, "scan panel a little below eye level (" + below.toFixed(1) + " deg)").toBe(true)
    expect(main.standIn.hasDirectory(), "the 'You are here' board stands in the place").toBe(true)
    await startTrip(it, "walk")
    log("s1 pass")
  }
}
