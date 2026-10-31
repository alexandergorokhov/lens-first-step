import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip, tap} from "./FindYourWayLeafSupport"
import {nodePos} from "./FywBrief2Support"

// visual-look — a slow tour of the mall for checking the look by eye: each companion from behind,
// then shop fronts, an escalator and a planter. Not a test: "visual-" keeps it out of "all".
@component
export class FywLookScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, undefined, ["nav"], "mall")
    main.debugShowDemoControls(false)
    main.debugSetViewFollowsPose(true)
    await tap(it, "CompanionButton")
    const ids = main.getRouteNodes()
    const a = nodePos(main, ids[0]), b = nodePos(main, ids[1])
    const heading = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
    main.debugSetPose(a.x, a.y, a.z, heading)
    for (const id of ["dog", "robot", "rover"]) {
      main.setCompanionModel(id)
      log("LOOK " + id)
      await sleep(4000)
    }
    main.setCompanionModel("dog")
    await tap(it, "CompanionButton")
    const views: [string, number, number, number][] = [
      ["north", 30, 12, 0], ["east", 12, 15, 90], ["south", 30, 18, 180], ["west", 50, 15, -90], ["corner", 8, 8, 45],
    ]
    for (const v of views) {
      main.debugSetPose(v[1], 0, v[2], v[3])
      log("LOOK " + v[0])
      await sleep(4000)
    }
    main.debugSetViewFollowsPose(false)
    log("look done")
  }
}
