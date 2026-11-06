import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {startFreeWalk} from "./FywB3Support"

// b3-dc5 — Companion off: look at several shops. Each gets two small offer boxes at the shop,
// including non-matching ones; looking away hides them; the x closes them for that shop.
@component
export class FywB3Dc5LookScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["hardware"], false)
    expect(main.isCompanionOn(), "companion off").toBe(false)
    expect(main.getPhase(), "free").toBe("free")

    // A matching shop: Bolt Hardware from the back court, looking north: two small boxes at the
    // shop, one offer each, and no button or list in your face.
    main.debugSetPose(30, 0, 22, 0)
    await waitFor(() => main.getDotId() === "boltHardware", 3500, "looking at Bolt Hardware (2 s look)")
    await waitFor(() => main.isOfferPeekShown() && main.getOfferBoxesId() === "boltHardware", 3500, "its offers (2 s look)")
    expect(main.isDotShown(), "no button in the view").toBe(false)
    const v = main.getOfferPeekLines()
    expect(v.length > 0 && v.length <= 2, "one or two boxes: " + v.length).toBe(true)
    expect(main.getOfferPeekTitle(), "shop").toBe("Bolt Hardware")

    // A non-matching shop gets its boxes too: Aurora Sport (sport is not picked).
    main.debugSetPose(38, 0, 22, 0)
    await waitFor(() => main.getOfferBoxesId() === "auroraSport", 3500, "offers at a non-matching shop (2 s look)")

    // Looking away hides them, and nothing else changes.
    main.debugSetPose(38, 0, 22, 90)
    await waitFor(() => !main.isOfferPeekShown(), 3500, "the boxes hide ~2 s after looking away")
    expect(main.getPhase(), "still walking").toBe("free")

    // Looking again shows them again: the small card at the top right, never in the way.
    main.debugSetPose(30, 0, 22, 0)
    await waitFor(() => main.getOfferBoxesId() === "boltHardware", 3500, "offers again")
    expect(main.getOfferPeekLines().length <= 2, "at most two offers").toBe(true)
    log("b3-dc5 pass")
  }
}
