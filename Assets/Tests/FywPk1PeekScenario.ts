import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"

// pk1 — peek ahead shows a small model with the route; letting go hides it; the route never changes.
@component
export class FywPk1PeekScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes().join(">")
    const length = main.getRouteLength()
    expect(main.isPeekShown(), "hidden at first").toBe(false)
    main.debugPeek(true)
    await sleep(400)
    expect(main.isPeekShown(), "Z1: pinch-pull shows the model").toBe(true)
    main.debugPeek(false)
    await sleep(300)
    expect(main.isPeekShown(), "Z2: let go hides it").toBe(false)
    expect(main.getRouteNodes().join(">"), "Z3: route unchanged").toBe(route)
    expect(main.getRouteLength(), "Z3: length unchanged").toBe(length)
    log("pk1 pass")
  }
}
