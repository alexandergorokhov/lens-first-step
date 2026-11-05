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
    await waitFor(() => main.getDotId() === "boltHardware", 2000, "looking at Bolt Hardware")
    await waitFor(() => main.isOfferPeekShown() && main.getOfferBoxesId() === "boltHardware", 2000, "its boxes")
    expect(main.isDotShown(), "no button in the view").toBe(false)
    const v = main.getOfferPeekLines()
    expect(v.length > 0 && v.length <= 2, "one or two boxes: " + v.length).toBe(true)
    expect(main.getOfferPeekTitle(), "shop").toBe("Bolt Hardware")

    // A non-matching shop gets its boxes too: Aurora Sport (sport is not picked).
    main.debugSetPose(38, 0, 22, 0)
    await waitFor(() => main.getOfferBoxesId() === "auroraSport", 2000, "boxes at a non-matching shop")

    // Looking away hides them, and nothing else changes.
    main.debugSetPose(38, 0, 22, 90)
    await waitFor(() => !main.isOfferPeekShown(), 3500, "the boxes hide ~2 s after looking away")
    expect(main.getPhase(), "still walking").toBe("free")

    // The x closes them for that shop: looking at it again shows nothing.
    main.debugSetPose(30, 0, 22, 0)
    await waitFor(() => main.getOfferBoxesId() === "boltHardware", 2000, "boxes again")
    await tap(it, "OfferBoxClose0")
    await waitFor(() => !main.isOfferPeekShown(), 1000, "closed")
    main.debugSetPose(30, 0, 22, 90)
    await sleep(2500)
    main.debugSetPose(30, 0, 22, 0)
    await sleep(1500)
    expect(main.isOfferPeekShown(), "closed for that shop").toBe(false)
    log("b3-dc5 pass")
  }
}
