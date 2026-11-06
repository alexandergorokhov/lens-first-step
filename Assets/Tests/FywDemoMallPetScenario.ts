import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {closeDemo, mallPetTrip, openDemo} from "./FywDemoSupport"

// demo-mall-pet — preset 2: mall, Walk, Talk "the food court"; the dog waits at the escalator; arrival.
@component
export class FywDemoMallPetScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("mallPet")
    const main = run.main
    expect(main.getMapKey(), "mall").toBe("mall")
    expect(main.getPreselectedMode(), "Walk").toBe("walk")
    const r = await mallPetTrip(run)
    expect(r.waitedAt !== null, "the route takes an escalator").toBe(true)
    expect(r.dogNearFoot, "the dog waited at the escalator foot").toBe(true)
    expect(main.getArrivalText() !== null && main.getArrivalText()!.toLowerCase().indexOf("food court") >= 0, "arrived: " + main.getArrivalText()).toBe(true)
    await closeDemo(main)
    log("demo-mall-pet pass")
  }
}
