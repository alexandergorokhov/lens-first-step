import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// v1 — Talk: what you say reaches the plain-code matcher. The words are fed in here (a test can't
// speak); the live microphone is the one part only a person can check.
@component
export class FywV1VoiceScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    await tap(it, "GoToPlaceButton")
    await waitFor(() => main.getPhase() === "mode" && main.isModePanelShown(), 3000, "Go to a place panel")
    await tap(it, "TalkButton")
    await waitFor(() => main.getDestinationLabel() !== "", 1000, "a note on the panel")
    main.debugHeard("take me", false)
    expect(main.getDestinationLabel(), "live words").toBe("Heard: take me")
    main.debugHeard("Take me to the pharmacy, please.", true)
    expect(main.getDestinationLabel(), "matched").toBe("To: Pharmacy")
    expect(main.isListening(), "stopped after the phrase").toBe(false)
    main.debugHeard("flibbertigibbet", true)
    expect(main.getDestinationLabel(), "no match").toBe("didn't catch that: try Where to?")
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "routing")
    const nodes = main.getRouteNodes()
    expect(nodes[nodes.length - 1], "the line leads to what you said").toBe("pharmacy")
    log("v1 pass")
  }
}
