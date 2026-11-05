import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FOV_HALF_DEG, inView} from "../Scripts/FindYourWayView"
import {insideShop} from "../Scripts/FindYourWayFreeWalk"
import {COMPANION_LEAD_M} from "../Scripts/FindYourWayDock"
import {log, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {startFreeWalk, toModes} from "./FywB3Support"
import {floorArrow, walkChecking} from "./FywVwSupport"

// vw2 — Free walk: it steps aside and points in view, ~10 s apart; no floor arrow while it is in view.
// Companion polish: the Options panel is folded to its tab once the walk starts (the tab opens it);
// the companion leads ~7 m ahead and never stands inside a shop; looking at a shop shows its card.
@component
export class FywVw2FreeWalkInViewScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["clothes", "coffee", "hardware"], true)
    main.debugMarkPointed(["floor:0:up", "floor:0:down"])
    await waitFor(() => main.isOptionsCollapsed(), 2000, "Options folded once the walk starts")
    await tap(it, "OptionsTabButton")
    expect(main.isOptionsCollapsed(), "the tab opens it").toBe(false)
    await tap(it, "HideOptionsButton")
    expect(main.isOptionsCollapsed(), "Hide folds it").toBe(true)
    expect(main.getCompanionLeadM(), "lead").toBe(COMPANION_LEAD_M)
    main.debugSetPose(8, 0, 10, 90)
    await sleep(500)
    let points = 0
    let last = "lead"
    let outFrames = 0
    let arrowInView = 0
    let inShop = 0
    const leads: number[] = []
    const t0 = getTime()
    const y = 0
    await walkAlong(main, [{x: 8, y, z: 10}, {x: 50, y, z: 10}], 0.12, () => {
      const st = main.getPointState()
      if (st === "point" && last !== "point") points++
      last = st
      const pet = main.getCompanionMapPos()
      const seen = !!pet && inView(main.getUserPos(), main.getUserHeading(), pet, FOV_HALF_DEG)
      if (st === "point" && pet && !seen) outFrames++
      if (seen && main.isFloorArrowShown()) arrowInView++
      if (pet && insideShop(main.getMapData() as any, pet)) inShop++
      // Once it has caught up after the jump to the start (3 s), how far ahead it leads.
      if (pet && st === "lead" && getTime() - t0 > 3) {
        const u = main.getUserPos()
        leads.push(Math.sqrt((pet.x - u.x) ** 2 + (pet.z - u.z) ** 2))
      }
      return false
    })
    log("vw2: " + points + " points, " + outFrames + " frames out of view while pointing")
    expect(points > 0, "it pointed on the way").toBe(true)
    expect(outFrames, "out of view while pointing").toBe(0)
    expect(arrowInView, "no floor arrow while the companion is in view").toBe(0)
    expect(inShop, "frames with the companion inside a shop").toBe(0)
    expect(main.getBadgeText(), "no map badge in the way while walking").toBe(null)
    leads.sort((a, b) => a - b)
    const lead = leads.length > 0 ? leads[Math.floor(leads.length / 2)] : -1
    expect(lead > 5.5 && lead < 8.5, "leads about 7 m ahead (median): " + lead.toFixed(1)).toBe(true)
    await waitFor(() => main.getPointState() === "lead", 8000, "back in the lead")
    // In Free walk it comes round in front of you when you turn, so it is never out of view for
    // long: the arrow must not show after you turn and it has caught up.
    const feet = main.getUserPos()
    main.debugSetPose(feet.x, feet.y, feet.z, main.getUserHeading() + 180)
    await sleep(6000)
    expect(main.isFloorArrowShown(), "no arrow once it is in front again").toBe(false)
    // Looking at Bean There Café from the hall: the dot and its short card (Sponsored, two offers).
    main.debugSetPose(16, 0, 11, 180)
    await waitFor(() => main.isOfferPeekShown(), 3000, "the look-at card")
    expect(main.getOfferPeekLines().length > 0, "offers on the card: " + main.getOfferPeekLines().join(" / ")).toBe(true)
    main.debugSetPose(16, 0, 11, 0)
    await waitFor(() => !main.isOfferPeekShown(), 4000, "the card hides after looking away")
    log("vw2 pass")
  }
}
