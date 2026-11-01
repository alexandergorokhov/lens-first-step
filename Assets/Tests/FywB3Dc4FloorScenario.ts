import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, tap, waitFor} from "./FindYourWayLeafSupport"
import {startFreeWalk} from "./FywB3Support"

// b3-dc4 — The companion stops at the stairs and shows the bubble. Opening the dot lists up to 3
// matching upstairs shops and "and more". You then go up and find one of them.
@component
export class FywB3Dc4FloorScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startFreeWalk(it, ["coffee", "clothes", "hardware"], true)
    main.debugMarkPointed(["threads", "cafe", "boltHardware"])
    main.debugSetPose(52, 0, 10, 0)
    await waitFor(() => main.getStopId() === "stairsFoot", 3000, "it heads for the stairs")
    await waitFor(() => main.getBubbleText() !== null, 5000, "the bubble")
    expect(main.getBubbleText(), "bubble").toBe("5 picks upstairs")

    // Looking at the stairs gives the same dot as a shop.
    main.debugSetPose(57, 0, 13, 0)
    await waitFor(() => main.getDotId() === "stairsFoot", 2000, "dot on the stairs")
    await tap(it, "DotButton")
    await waitFor(() => main.isOfferShown(), 2000, "the list")
    const v = main.getOfferList()!
    expect(v.rows.length, "first 3 picks").toBe(3)
    expect(v.more, "and more").toBe(true)
    expect(v.rows[0].text.indexOf("Second Skin · Sponsored"), "paid first, with its tag: " + v.rows[0].text).toBe(0)
    await tap(it, "OfferCloseButton")
    await waitFor(() => main.getBubbleText() === null, 6000, "the bubble hides")

    // Go up and find one of them.
    main.debugSetPose(57, 0, 15, 0)
    await sleep(200)
    await tap(it, "RideButton_" + main.getRideIdFor("stairsFoot", "stairs"))
    await sleep(300)
    expect(main.getDebugPose()!.pos.y, "upstairs").toBe(5)
    main.debugSetPose(50, 5, 22, 0)
    // The next flight's hint can come first.
    await waitFor(() => main.getStopId() === "secondSkin", 9000, "the companion stops at it")
    await waitFor(() => main.getDotId() === "secondSkin", 2000, "and it gets a dot")
    expect((main.getCompanionMapPos() as {y: number}).y, "the companion came up").toBe(5)
    log("b3-dc4 pass")
  }
}
