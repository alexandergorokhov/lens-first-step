import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip} from "./FindYourWayLeafSupport"

// bg1 — in Lens Studio the stand-in turns solid and a shell hides the preview room; the route is
// the same either way (the backdrop is drawing only, and isEditor() keeps it off Specs).
@component
export class FywBg1BackdropScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    expect(main.isBackdropSolid(), "solid in the preview").toBe(true)
    expect(!!findSceneObjectByName("Shell"), "the shell hides the room").toBe(true)
    expect(!!findSceneObjectByName("Tiles"), "floor tiles").toBe(true)
    expect(main.getRouteNodes().join(">"), "same route").toBe("sign>hall>escFoot>escTop>concourse>bJunction>gateB12")
    log("bg1 pass")
  }
}
