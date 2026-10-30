import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// b3-modes — The scan comes first, then Free walk, Go to a place and Map builder. The pop-up shows
// the demo preset, labelled, and the checkbox list comes from the map.
@component
export class FywB3ModesScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    expect(main.isModePanelShown(), "Walk / Step-Free only after Go to a place").toBe(false)
    await tap(it, "FreeWalkButton")
    await waitFor(() => main.isPrefsShown(), 2000, "the pop-up")
    expect(main.getPrefsSummary(), "the demo preset").toBe("Café, Clothes, Hardware")
    await tap(it, "PrefsViewButton")
    await tap(it, "Pref_sport")
    expect(main.getPrefsSummary(), "a ticked box").toBe("Café, Clothes, Sport, Hardware")
    await tap(it, "PrefsStartButton")
    await waitFor(() => main.getPhase() === "free", 2000, "free walk")
    expect(main.getFreePrefs().join(), "what the walk uses").toBe("coffee,clothes,sport,hardware")
    await tap(it, "EndWalkButton")
    await waitFor(() => main.getPhase() === "choose" && main.isHomePanelShown(), 2000, "back at the modes")
    expect(main.isCompanionShown(), "companion gone").toBe(false)
    await sleep(200)
    log("b3-modes pass")
  }
}
