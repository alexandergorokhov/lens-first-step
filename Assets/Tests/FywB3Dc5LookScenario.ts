import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {startFreeWalk} from "./FywB3Support"

// b3-dc5 — Companion off: look at several shops. Each gets a dot, including non-matching ones;
// opening one shows at most 3 items; ignoring one changes nothing.
@component
export class FywB3Dc5LookScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["hardware"], false)
    expect(main.isCompanionOn(), "companion off").toBe(false)
    expect(main.getPhase(), "free").toBe("free")

    // A matching shop: Bolt Hardware from the back court, looking north.
    main.debugSetPose(30, 0, 22, 0)
    await waitFor(() => main.getDotId() === "boltHardware", 2000, "dot on Bolt Hardware")
    expect(main.isDotShown(), "the dot shows").toBe(true)
    expect(main.getDotText(), "it says what it opens").toBe("Offers: Bolt Hardware")
    await tap(it, "DotButton")
    await waitFor(() => main.isOfferShown(), 2000, "offer list")
    const v = main.getOfferList()!
    expect(v.title, "shop name on top").toBe("Bolt Hardware")
    expect(v.rows.length <= 3 && v.rows.length > 0, "at most 3 items: " + v.rows.length).toBe(true)
    await tap(it, "OfferCloseButton")
    await waitFor(() => !main.isOfferShown(), 2000, "list closed")

    // A non-matching shop gets a dot too: Aurora Sport (sport is not picked).
    main.debugSetPose(38, 0, 22, 0)
    await waitFor(() => main.getDotId() === "auroraSport", 2000, "dot on a non-matching shop")

    // Ignoring it changes nothing: no list, and the dot goes after looking away.
    main.debugSetPose(38, 0, 22, 90)
    await sleep(600)
    expect(main.isOfferShown(), "no list").toBe(false)
    await waitFor(() => !main.isDotShown(), 3500, "the dot hides ~2 s after looking away")
    expect(main.getPhase(), "still walking").toBe("free")

    // A list closes after walking ~5 m away.
    main.debugSetPose(30, 0, 22, 0)
    await waitFor(() => main.isDotShown(), 2000, "dot again")
    await tap(it, "DotButton")
    await waitFor(() => main.isOfferShown(), 2000, "offer list again")
    main.debugSetPose(30, 0, 16.5, 180)
    await waitFor(() => !main.isOfferShown(), 2000, "closes after walking away")
    log("b3-dc5 pass")
  }
}
