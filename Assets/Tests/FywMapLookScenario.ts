import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, startTrip} from "./FindYourWayLeafSupport"

// visual-map — holds on the mini mall, the board and the top floor for checking them by eye. Not a
// test: "visual-" keeps it out of "all".
const HOLD_MS = 14000

@component
export class FywMapLookScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, (m) => m.debugSetDestinationOverride("skyGarden"), ["nav"], "mall")
    main.debugShowDemoControls(false)
    main.debugSetViewFollowsPose(true)
    main.debugSetPose(30, 0, 1, 0)
    log("LOOK board")
    await sleep(HOLD_MS)
    main.debugSeeMap(true)
    log("LOOK map")
    await sleep(HOLD_MS)
    main.debugSeeMap(false)
    const views: [string, number, number, number, number][] = [
      ["top-court", 30, 10, 16, 0], ["top-back", 30, 10, 24, 90], ["top-west", 44, 10, 13, -90], ["flight", 20, 5, 26, 180],
    ]
    for (const v of views) {
      main.debugSetPose(v[1], v[2], v[3], v[4])
      log("LOOK " + v[0])
      await sleep(HOLD_MS)
    }
    main.debugSetViewFollowsPose(false)
    log("LOOK done")
  }
}
