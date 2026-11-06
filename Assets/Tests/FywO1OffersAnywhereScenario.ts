import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {frontTargets} from "../Scripts/FindYourWayFreeWalk"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {log, shot, waitFor} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// o1 — Offers wherever you are in the mall: before any trip, look at a shop for 2 s and its offers
// show in the small card at the top right (at most 2); a sponsored shop's card says Sponsored. Not
// before 2 s, and looking away hides it.
@component
export class FywO1OffersAnywhereScenario extends Scenario {
  // Stand 4 m out from a shop's front, looking at it.
  private lookAt(main: FindYourWayMain, id: string): void {
    const t = frontTargets(main.getMapData() as any).filter((x) => x.id === id)[0]
    if (!t) throw new Error("no front for " + id)
    const cx = (t.x1 + t.x2) / 2, cz = (t.z1 + t.z2) / 2
    // Out from the front: the side away from the wall (try both, keep the one inside the mall).
    const nx = -(t.z2 - t.z1), nz = t.x2 - t.x1
    const l = Math.sqrt(nx * nx + nz * nz) || 1
    const s = t.outside !== 0 ? t.outside : 1
    const px = cx + (nx / l) * 4 * s, pz = cz + (nz / l) * 4 * s
    const h = (Math.atan2(cx - px, cz - pz) * 180) / Math.PI
    main.debugSetPose(px, t.y, pz, h)
  }

  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it)
    expect(main.getPhase(), "no trip yet").toBe("choose")
    main.debugSetViewFollowsPose(true)

    this.lookAt(main, "threads")
    await sleep(1200)
    expect(main.isOfferPeekShown(), "not before 2 s").toBe(false)
    await waitFor(() => main.getOfferBoxesId() === "threads", 3000, "Threads' offers after a 2 s look")
    const lines = main.getOfferPeekLines()
    expect(lines.length >= 1 && lines.length <= 2, "one or two offers: " + lines.join(" | ")).toBe(true)
    log("o1 Threads: " + main.getOfferPeekTitle() + " / " + lines.join(" | "))
    // The card never covers the open "What would you like to do?" menu (Nov 6 screenshot).
    await waitFor(() => main.getOfferCardOverlap() === 0, 1500, "offers card clear of the open menu")
    log("o1 card clear of the menu (overlap " + main.getOfferCardOverlap().toFixed(1) + " cm²)")
    expect(main.isOfferCardInView(), "the whole card inside the view").toBe(true)
    await shot(main, "o1-threads-offers")

    this.lookAt(main, "cafe")
    await waitFor(() => main.getOfferBoxesId() === "cafe", 4500, "Bean There Café's offers")
    expect(main.getOfferPeekTag().indexOf("Sponsored") >= 0, "sponsored: " + main.getOfferPeekTag()).toBe(true)
    log("o1 café: " + main.getOfferPeekTag() + " / " + main.getOfferPeekLines().join(" | "))
    await sleep(2500)

    const p = main.getDebugPose()!
    main.debugSetPose(p.pos.x, p.pos.y, p.pos.z, p.heading + 180)
    await waitFor(() => !main.isOfferPeekShown(), 4000, "hidden after looking away")
    main.debugSetViewFollowsPose(false)
    main.debugClearPose()
    log("o1 pass")
  }
}
