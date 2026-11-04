import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {startFreeWalk} from "./FywB3Support"

// b3-dc2 — Set preferences, then walk Free walk: the companion stops at shops that match and walks
// past those that don't.
@component
export class FywB3Dc2CompanionScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["clothes"], true)
    expect(main.getFreePrefs().join(), "preferences set").toBe("clothes")
    expect(main.isCompanionShown(), "companion shown").toBe(true)
    main.debugMarkPointed(["floor:0:up"])

    // Along the ground floor east, with Threads ahead: it matches, Bolt Hardware doesn't.
    const stops: string[] = []
    const y = 0
    // Within the 8 m stop radius of Threads' front (36, 6).
    main.debugSetPose(30, y, 10, 90)
    await sleep(300)
    let stop: string | null = null
    for (let i = 0; i < 40; i++) {
      const s = main.getStopId()
      if (s && s !== stop && stops.indexOf(s) < 0) stops.push(s)
      stop = s
      if (s === "threads") break
      await sleep(100)
    }
    expect(stops.join(), "stops at the matching shop").toBe("threads")
    await waitFor(() => main.getCompanionMood() === "point" && main.isCompanionPointing(), 5000, "points at it")
    await waitFor(() => main.getStopId() === null, 9000, "pointing ends")

    // Up the back court past Bolt Hardware and Aurora Sport: neither matches.
    await walkAlong(main, [{x: 30, y, z: 10}, {x: 30, y, z: 22}, {x: 38, y, z: 22}], 0.3, () => {
      const s = main.getStopId()
      if (s) stops.push(s)
      return false
    })
    expect(stops.indexOf("boltHardware"), "walks past a shop that doesn't match").toBe(-1)
    expect(stops.indexOf("auroraSport"), "and another").toBe(-1)
    log("b3-dc2 pass")
  }
}
