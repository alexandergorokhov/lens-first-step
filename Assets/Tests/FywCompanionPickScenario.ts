import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// companion-pick — The preferences panel picks who walks with you. The pick is ticked, turns a
// companion that was off back on, and is the one that walks.
@component
export class FywCompanionPickScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    main.setCompanionModel("dog")
    await tap(it, "FreeWalkButton")
    await waitFor(() => main.isPrefsShown(), 2000, "the pop-up")
    expect(main.getPrefsModelLabel("dog"), "the dog starts ticked").toBe("✓ Dog")
    await tap(it, "PrefsCompanionAskButton")
    expect(main.getPrefsCompanionLabel(), "turned off").toBe("Pet: off")
    await tap(it, "PrefsModel_robot")
    expect(main.getCompanionModel(), "the robot is picked").toBe("robot")
    expect(main.getPrefsModelLabel("robot"), "the tick moved").toBe("✓ Robot")
    expect(main.getPrefsModelLabel("dog"), "the tick left the dog").toBe("Dog")
    expect(main.getPrefsCompanionLabel(), "picking turns it back on").toBe("Robot: on")
    await tap(it, "PrefsKeepButton")
    await waitFor(() => main.getPhase() === "free", 2000, "free walk")
    expect(main.isCompanionShown(), "the robot walks with you").toBe(true)
    expect(main.getCompanionModel(), "still the robot").toBe("robot")
    await tap(it, "EndWalkButton")
    await waitFor(() => main.getPhase() === "choose" && main.isHomePanelShown(), 2000, "back at the modes")
    main.setCompanionModel("dog")
    await sleep(200)
    log("companion-pick pass")
  }
}
