import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// b3-dc6 — Go to a place: scan, use "Say it" or "Where to?", and the line leads to the shop.
@component
export class FywB3Dc6GoToScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    let main = await toModes(it)
    await tap(it, "GoToPlaceButton")
    await waitFor(() => main.getPhase() === "mode" && main.isModePanelShown(), 3000, "Go to a place panel")
    await tap(it, "SayItButton")
    await waitFor(() => main.getDestinationLabel() === "To: Food court", 2000, "the phrase matched: " + main.getDestinationLabel())
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "routing")
    let nodes = main.getRouteNodes()
    expect(nodes[nodes.length - 1], "Say it: the line leads to the shop").toBe("foodCourt")
    expect(main.isLineVisible(), "line").toBe(true)
    expect((main.getPillText() || "").indexOf("Food court") >= 0, "pill: " + main.getPillText()).toBe(true)

    // "Where to?" does the same job as a button.
    main = await toModes(it)
    await tap(it, "GoToPlaceButton")
    await waitFor(() => main.getPhase() === "mode", 3000, "Go to a place panel")
    await tap(it, "WhereToButton")
    await waitFor(() => main.isWhereToShown(), 2000, "Where to? list")
    const first = main.getWhereToLabels()[0]
    await tap(it, "WhereToRow0")
    await waitFor(() => !main.isWhereToShown() && main.isModePanelShown(), 2000, "picked")
    expect(main.getDestinationLabel(), "picked from the list").toBe("To: " + first)
    await tap(it, "StepFreeButton")
    await waitFor(() => main.getPhase() === "nav" || main.getPhase() === "arrived", 3000, "routing")
    nodes = main.getRouteNodes()
    expect(nodes.length > 1, "a route").toBe(true)
    expect(main.getRouteEdgeKinds().indexOf("stairs"), "Step-Free still holds").toBe(-1)
    log("b3-dc6 pass")
  }
}
