import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {closeDemo, openDemo} from "./FywDemoSupport"

// mp1 — the demo presets hide the interest chips on "Where would you like to go?": the panel
// shrinks to fit, with no empty band where the chips were (Nov 6 known issue).
@component
export class FywMp1NoEmptyBandScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("mallPet")
    const main = run.main
    expect(main.getPhase(), "the Go to a place panel is open").toBe("mode")
    await sleep(500)
    const simple = main.getModePanelHeight()
    main.debugSetModeSimple(false)
    await sleep(500)
    const full = main.getModePanelHeight()
    main.debugSetModeSimple(true)
    await sleep(500)
    const again = main.getModePanelHeight()
    log("mp1 heights: simple " + simple.toFixed(1) + " cm, full " + full.toFixed(1) + " cm, simple again " + again.toFixed(1) + " cm")
    // The chips title (2 cm) and two rows (4 cm each) with their gaps: about 14 cm.
    expect(full - simple > 10, "the panel shrinks without the chips: " + simple.toFixed(1) + " vs " + full.toFixed(1)).toBe(true)
    expect(Math.abs(again - simple) < 0.5, "same height when hidden again").toBe(true)
    await closeDemo(main)
    log("mp1 pass")
  }
}
