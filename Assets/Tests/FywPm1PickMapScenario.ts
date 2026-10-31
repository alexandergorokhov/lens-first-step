import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// pm1 — no voice: "Where to?" shows the places on a map, floor by floor; a pinch picks one.
@component
export class FywPm1PickMapScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    await tap(it, "GoToPlaceButton")
    await waitFor(() => main.getPhase() === "mode", 3000, "Go to a place panel")
    await tap(it, "WhereToButton")
    await waitFor(() => main.isWhereToShown(), 2000, "Where to? list")
    await tap(it, "WhereToMapButton")
    await waitFor(() => main.isPickMapShown(), 2000, "the map")
    expect(main.isWhereToShown(), "the list made way").toBe(false)
    expect(main.getPickMapDots() > 3, "places on the map: " + main.getPickMapDots()).toBe(true)
    const floor = main.getPickMapFloor()
    await tap(it, "PickMapFloorButton")
    await waitFor(() => main.getPickMapFloor() !== floor, 2000, "the other floor")
    const id = main.getPickMapDotId(0)
    await tap(it, "PickDot0")
    await waitFor(() => !main.isPickMapShown() && main.isModePanelShown(), 2000, "picked")
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "routing")
    expect(main.getDestinationId(), "the line goes to the pinched place").toBe(id)
    log("pm1 pass")
  }
}
