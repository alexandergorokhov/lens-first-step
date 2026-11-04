// Shared by the vw1/vw2/vw3 scenarios: the companion points at shops but stays in view.
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {FOV_HALF_DEG, inView} from "../Scripts/FindYourWayView"
import {log, nodePoints, waitFor, walkAlong} from "./FindYourWayLeafSupport"

// Walks the route (map node ids), checking every frame that a pointing companion is in view.
export async function walkChecking(main: FindYourWayMain, ids: string[], what: string): Promise<{points: number; leads: number}> {
  let points = 0
  let leads = 0
  let last = "lead"
  let outFrames = 0
  await walkAlong(main, nodePoints(main.getMapData(), ids), 0.35, () => {
    const st = main.getPointState()
    if (st === "point" && last !== "point") points++
    if (st === "lead" && last === "return") leads++
    last = st
    const pet = main.getCompanionMapPos()
    const feet = main.getUserPos()
    if (st === "point" && pet && Math.abs(pet.y - feet.y) < 0.5 && !inView(feet, main.getUserHeading(), pet, FOV_HALF_DEG)) outFrames++
    return false
  })
  log(what + ": " + points + " points, " + leads + " back to lead, " + outFrames + " frames out of view while pointing")
  expect(outFrames, what + ": out of view while pointing").toBe(0)
  return {points, leads}
}

// Face the companion (stepping back first if it sits at your feet, e.g. at a ride's foot): no
// arrow. Turn your back on it: the floor arrow after ~2 s. Face it again: the arrow hides.
export async function floorArrow(main: FindYourWayMain, what: string): Promise<void> {
  let feet = main.getUserPos()
  let pet = main.getCompanionMapPos()
  if (!pet) throw new Error(what + ": no companion")
  if (Math.hypot(pet.x - feet.x, pet.z - feet.z) < 2) {
    const r = (main.getUserHeading() * Math.PI) / 180
    main.debugSetPose(feet.x - Math.sin(r) * 4, feet.y, feet.z - Math.cos(r) * 4, main.getUserHeading())
    await sleep(1500)
    feet = main.getUserPos()
    pet = main.getCompanionMapPos()!
  }
  const h = (Math.atan2(pet.x - feet.x, pet.z - feet.z) * 180) / Math.PI
  main.debugSetPose(feet.x, feet.y, feet.z, h)
  await sleep(600)
  expect(main.isFloorArrowShown(), what + ": no arrow while it is in view").toBe(false)
  main.debugSetPose(feet.x, feet.y, feet.z, h + 180)
  await sleep(1000)
  expect(main.isFloorArrowShown(), what + ": no arrow before 2 s").toBe(false)
  await waitFor(() => main.isFloorArrowShown(), 4000, what + ": floor arrow after ~2 s out of view")
  const now = main.getCompanionMapPos()!
  main.debugSetPose(feet.x, feet.y, feet.z, (Math.atan2(now.x - feet.x, now.z - feet.z) * 180) / Math.PI)
  await waitFor(() => !main.isFloorArrowShown(), 1500, what + ": arrow hides once it is back in view")
}

