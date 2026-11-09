import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {closeDemo, mallPetTrip, openDemo} from "./FywDemoSupport"

// demo-mall-pet — preset 2: mall, Walk, Talk "the Bakery" (ground floor, no floor change: R2-31); the dog leads; arrival.
@component
export class FywDemoMallPetScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("mallPet")
    const main = run.main
    expect(main.getMapKey(), "mall").toBe("mall")
    expect(main.getPreselectedMode(), "Walk").toBe("walk")
    const r = await mallPetTrip(run)
    expect(r.waitedAt, "no floor change on the way").toBe(null)
    expect(main.getArrivalText() !== null && main.getArrivalText()!.toLowerCase().indexOf("bakery") >= 0, "arrived: " + main.getArrivalText()).toBe(true)
    // A lean Control panel in the demos, with Restart (R2-47, R2-48).
    expect(main.isControlLean(), "lean Control panel").toBe(true)
    expect(main.isRestartRowOn(), "Restart in the Control panel").toBe(true)
    await closeDemo(main)
    log("demo-mall-pet pass")
  }
}
