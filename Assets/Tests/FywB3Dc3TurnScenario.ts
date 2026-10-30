import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, waitFor} from "./FindYourWayLeafSupport"
import {flat} from "./FywBrief2Support"
import {startFreeWalk} from "./FywB3Support"

// b3-dc3 — Turn around: the companion runs around you, at least 1 m away, and carries on in front.
@component
export class FywB3Dc3TurnScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["books"], true)
    main.debugMarkPointed(["floor:0:up"])
    const pos = {x: 30, y: 0, z: 16}
    main.debugSetPose(pos.x, pos.y, pos.z, 0)
    await waitFor(() => {
      const p = main.getCompanionMapPos()
      return !!p && p.z > 17.5 && Math.abs(p.x - 30) < 0.5
    }, 4000, "ahead of you, north")
    main.debugSetPose(pos.x, pos.y, pos.z, 180)
    let closest = 1000
    let ran = false
    const t0 = getTime()
    while (getTime() - t0 < 4) {
      const p = main.getCompanionMapPos()!
      closest = Math.min(closest, flat(p, pos))
      if (main.getCompanionMood() === "run") ran = true
      await sleep(30)
    }
    const end = main.getCompanionMapPos()!
    expect(ran, "it ran").toBe(true)
    expect(closest >= 0.99, "stays at least 1 m away: " + closest.toFixed(2)).toBe(true)
    expect(end.z < 14.5, "now in front of you, south: z " + end.z.toFixed(1)).toBe(true)
    log("b3-dc3 pass")
  }
}
