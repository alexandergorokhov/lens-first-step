import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FOV_HALF_DEG, inView} from "../Scripts/FindYourWayView"
import {log, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {startFreeWalk, toModes} from "./FywB3Support"
import {floorArrow, walkChecking} from "./FywVwSupport"

// vw2 — Free walk: it steps aside and points in view, ~10 s apart; no floor arrow while it is in view.
@component
export class FywVw2FreeWalkInViewScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["clothes", "coffee", "hardware"], true)
    main.debugMarkPointed(["floor:0:up", "floor:0:down"])
    main.debugSetPose(8, 0, 10, 90)
    await sleep(500)
    let points = 0
    let last = "lead"
    let outFrames = 0
    let arrowInView = 0
    const y = 0
    await walkAlong(main, [{x: 8, y, z: 10}, {x: 50, y, z: 10}], 0.12, () => {
      const st = main.getPointState()
      if (st === "point" && last !== "point") points++
      last = st
      const pet = main.getCompanionMapPos()
      const seen = !!pet && inView(main.getUserPos(), main.getUserHeading(), pet, FOV_HALF_DEG)
      if (st === "point" && pet && !seen) outFrames++
      if (seen && main.isFloorArrowShown()) arrowInView++
      return false
    })
    log("vw2: " + points + " points, " + outFrames + " frames out of view while pointing")
    expect(points > 0, "it pointed on the way").toBe(true)
    expect(outFrames, "out of view while pointing").toBe(0)
    expect(arrowInView, "no floor arrow while the companion is in view").toBe(0)
    await waitFor(() => main.getPointState() === "lead", 8000, "back in the lead")
    // In Free walk it comes round in front of you when you turn, so it is never out of view for
    // long: the arrow must not show after you turn and it has caught up.
    const feet = main.getUserPos()
    main.debugSetPose(feet.x, feet.y, feet.z, main.getUserHeading() + 180)
    await sleep(6000)
    expect(main.isFloorArrowShown(), "no arrow once it is in front again").toBe(false)
    log("vw2 pass")
  }
}
