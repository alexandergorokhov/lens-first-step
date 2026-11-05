// TEMPORARY (not committed): the short demo take. The robot guides you from the "You are here" sign
// to Bean There Café; on the way you glance at one shop (Threads) and its card shows.
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {nodePos} from "./FywBrief2Support"
import {FywVideoBase} from "./FywMallVideoBase"

@component
export class FywMallCoffeeVideoScenario extends FywVideoBase {
  private async pick(label: string): Promise<void> {
    const main = this.main
    this.press("WhereToButton")
    await this.soft(() => main.isWhereToShown(), 2000, "where to")
    for (let i = 0; i < 9; i++) {
      await sleep(600)
      const k = main.getWhereToLabels().indexOf(label)
      if (k >= 0) {
        await sleep(400)
        this.press("WhereToRow" + k)
        return
      }
      this.press("WhereToMoreButton")
    }
    this.mark(label + " not found in Where to?")
  }

  async run(): Promise<void> {
    await this.begin("robot", null)
    const main = this.main
    await this.at(2.5, "scan sign")
    await this.scan()

    await this.at(5.5, "go to a place")
    this.press("GoToPlaceButton")
    await this.soft(() => main.getPhase() === "mode", 3000, "mode")
    await sleep(600)
    await this.pick("Bean There Café")
    this.mark("dest " + main.getDestinationLabel())

    await this.at(11, "walk")
    this.press("WalkButton")
    await this.soft(() => main.getPhase() === "nav", 3000, "nav")
    this.mark("route " + main.getRouteNodes().join(">") + " lead " + main.getCompanionLeadM())
    this.speed = 1.5
    // Walk to the centre court, then glance at Threads (a clothes shop) for its card.
    await this.walk([this.pos(), nodePos(main, "gM")], 22)
    await this.turn(115, 1.0)
    await this.soft(() => main.isOfferPeekShown(), 3000, "the Threads card")
    this.mark("card " + main.getOfferPeekTitle() + " / " + main.getOfferPeekLines().join(" | "))
    await sleep(3200)
    await this.turn(-90, 1.0)
    // On along the line to the café.
    const nodes = main.getRouteNodes()
    const rest = nodes.slice(Math.max(0, nodes.indexOf("gM") + 1)).map((id) => nodePos(main, id))
    await this.walk([this.pos()].concat(rest), 60, () => main.getPhase() === "arrived")
    await this.soft(() => main.getPhase() === "arrived", 4000, "arrived")
    this.mark("card " + main.getArrivalText())
    await sleep(400)
    // Step back so the café front, its card and the robot are in view.
    const c = nodePos(main, "cafe")
    main.debugSetPose(c.x + 0.5, 0, c.z + 7, 180)
    await sleep(6000)
    await this.end(this.now() + 0.1)
  }
}
