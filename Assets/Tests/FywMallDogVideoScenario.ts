// TEMPORARY (not committed): scripted take for voiced video B.
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {nodePos} from "./FywBrief2Support"
import {FywVideoBase} from "./FywMallVideoBase"

// Video B: Go to a place, Cinema; Walk (escalator) vs Step-Free (Lift B); the dog waits at the lift.
@component
export class FywMallDogVideoScenario extends FywVideoBase {
  private async pickCinema(): Promise<void> {
    const main = this.main
    this.press("WhereToButton")
    await this.soft(() => main.isWhereToShown(), 2000, "where to")
    for (let i = 0; i < 9; i++) {
      await sleep(700)
      const k = main.getWhereToLabels().indexOf("Cinema")
      if (k >= 0) {
        await sleep(500)
        this.press("WhereToRow" + k)
        return
      }
      this.press("WhereToMoreButton")
    }
    this.mark("Cinema not found in Where to?")
  }

  async run(): Promise<void> {
    await this.begin("dog", null)
    const main = this.main
    await this.at(3.0, "scan sign")
    await this.scan()

    await this.at(7.2, "choose Cinema")
    this.press("GoToPlaceButton")
    await this.soft(() => main.getPhase() === "mode", 3000, "mode")
    await sleep(800)
    await this.pickCinema()
    this.mark("dest " + main.getDestinationLabel())

    await this.at(14.1, "walk line")
    this.press("WalkButton")
    await this.soft(() => main.getPhase() === "nav", 3000, "nav")
    this.mark("route " + main.getRouteNodes().join(">"))
    await this.walk([this.pos(), {x: 30, y: 0, z: 4.5}], 18.5)

    await this.at(19.7, "step-free")
    this.press("EndWalkButton")
    await this.soft(() => main.getPhase() === "choose", 3000, "choose")
    await sleep(400)
    this.press("GoToPlaceButton")
    await this.soft(() => main.getPhase() === "mode", 3000, "mode")
    await sleep(600)
    this.mark("dest " + main.getDestinationLabel())
    if (main.getDestinationId() !== "cinema") await this.pickCinema()
    await sleep(600)
    this.press("StepFreeButton")
    await this.soft(() => main.getPhase() === "nav", 3000, "nav")
    this.mark("route " + main.getRouteNodes().join(">") + " pill " + main.getPillText())

    await this.at(30.2, "walk with pill/arrow/cue")
    this.speed = 3.2
    await this.walk([this.pos(), nodePos(main, "gM"), nodePos(main, "gBM")], 36.5)
    await this.turn(-75, 1.0) // look away: the turn arrow shows
    await sleep(1200)
    this.mark("arrow " + main.isTurnArrowVisible() + " cue " + main.getCueText())
    const lift = nodePos(main, "liftBG")
    await this.walk([this.pos(), {x: lift.x - 4, y: 0, z: lift.z - 2.5}], 42.3)

    await this.at(42.5, "dog waits at Lift B")
    this.speed = 1.6
    await this.walk([this.pos(), {x: lift.x - 0.6, y: 0, z: lift.z - 0.6}], 45.0)
    this.mark("dog mood " + main.getCompanionMood())
    await this.at(45.3, "ride")
    const ride = main.getRideIdFor("liftBG", "lift")
    if (ride) this.press("RideButton_" + ride)
    await sleep(1500)
    this.mark("pill " + main.getPillText())
    this.speed = 3.0
    await this.walk([this.pos(), nodePos(main, "fBM")], 49.0)

    await this.at(49.4, "arrival")
    const c = nodePos(main, "cinema")
    await this.walk([this.pos(), {x: c.x, y: c.y, z: c.z - 2.2}], 53, () => main.getPhase() === "arrived")
    await this.soft(() => main.getPhase() === "arrived", 2500, "arrived")
    this.mark("card " + main.getArrivalText() + " treats " + JSON.stringify(main.getTreats()))
    await sleep(300)
    this.speed = 1.2
    await this.walk([this.pos(), {x: c.x, y: c.y, z: c.z - 6.5}], 56) // step back: the door, the card and the dog in view
    await this.turn(0, 0.6)
    await this.at(57.0, "end")
    await this.end(63.1)
  }
}
