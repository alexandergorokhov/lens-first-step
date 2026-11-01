import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {startFreeWalk} from "./FywB3Support"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"

// walk-up-the-stairs — In the preview you walk at one height: following the stairs lifts you, back
// down lowers you, and stepping off halfway lands on the nearest floor. Keeps the feet the Lens
// worked out, as the preview's keys would.
@component
export class FywWalkStairsScenario extends Scenario {
  private async walkTo(main: FindYourWayMain, x: number, z: number, heading: number): Promise<void> {
    main.debugSetPose(x, main.getFeetY(), z, heading)
    await sleep(120)
  }

  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["coffee", "clothes", "hardware"], false)
    main.debugSetPose(57, 0, 14.5, 0)
    await sleep(200)
    for (let z = 15; z <= 24; z += 0.5) await this.walkTo(main, 57, z, 0)
    await this.walkTo(main, 57, 25, 0)
    expect(Math.round(main.getFeetY()), "up on the first floor").toBe(5)
    for (let z = 24; z >= 15; z -= 0.5) await this.walkTo(main, 57, z, 180)
    await this.walkTo(main, 57, 14, 180)
    expect(Math.round(main.getFeetY()), "back on the ground floor").toBe(0)
    for (let z = 15; z <= 21; z += 0.5) await this.walkTo(main, 57, z, 0)
    await this.walkTo(main, 54, 21, 270)
    expect(main.getFeetY(), "stepping off lands on a floor").toBe(5)
    log("walk-up-the-stairs pass")
  }
}
