// TEMPORARY (not committed): scripted take for voiced video A.
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {nodePos} from "./FywBrief2Support"
import {FywVideoBase} from "./FywMallVideoBase"

// Video A: free walk with the robot, offers, turn round, then a three-stop trip and Lift A.
@component
export class FywMallRobotVideoScenario extends FywVideoBase {
  async run(): Promise<void> {
    await this.begin("robot", "pharmacy,iceCream,sushi")
    const main = this.main
    await this.at(3.0, "scan sign")
    await this.scan()

    await this.at(8.9, "free walk")
    this.press("FreeWalkButton")
    await this.soft(() => main.getPhase() === "prefs", 3000, "prefs")
    await this.at(10.2, "pick robot")
    this.press("PrefsModel_robot")
    if (main.getPrefsCompanionLabel().indexOf("off") >= 0) this.press("PrefsCompanionAskButton")
    await this.at(11.8, "keep and walk")
    this.press("PrefsKeepButton")
    await this.soft(() => main.getPhase() === "free", 3000, "free walk")
    if (!main.isCompanionOn()) main.setCompanionOn(true)
    main.debugMarkPointed(["threads", "boltHardware", "supermarket", "phoneShop", "floor:0:up", "floor:0:down"]) // on to Bean There Café (coffee, Sponsored)
    await this.walk([this.pos(), {x: 30, y: 0, z: 10}], 15.9)

    await this.at(15.9, "robot points / Sponsored")
    this.speed = 1.3
    let pointedAt = -1
    await this.walk([this.pos(), {x: 21, y: 0, z: 10}], 24, () => {
      if (main.getPointState() === "point" && pointedAt < 0) pointedAt = this.now()
      return pointedAt > 0 && this.now() > pointedAt + 0.6
    })
    this.mark("stop " + main.getStopId() + " state " + main.getPointState())
    await this.turn(-115, 1.2) // toward the café front, the robot beside it
    await this.soft(() => main.getPointState() === "point", 3000, "pointing")
    this.mark("stop " + main.getStopId() + " state " + main.getPointState())

    await this.at(29.5, "offers")
    await this.soft(() => main.isDotShown(), 2500, "a dot")
    this.press("DotButton")
    await this.soft(() => main.isOfferShown(), 2000, "offer list")
    this.mark("offer " + main.getDotText())
    await this.at(33.2, "close offers")
    this.press("OfferCloseButton")

    await this.at(34.8, "turn round")
    await this.turn(65, 2.5)

    await this.at(41.4, "go to a place")
    this.press("EndWalkButton")
    await this.soft(() => main.getPhase() === "choose", 3000, "choose")
    await sleep(500)
    this.press("GoToPlaceButton")
    await this.soft(() => main.getPhase() === "mode", 3000, "mode")
    await sleep(900)
    this.press("WalkButton")
    await this.soft(() => main.getPhase() === "nav", 3000, "nav")
    this.mark("route " + main.getRouteNodes().join(">") + " stops " + main.getStops().join(","))
    this.speed = 4.5
    await this.walk(this.routePts(), 47.2, () => main.getPhase() === "arrived")
    if (main.getPhase() !== "arrived") {
      const p = nodePos(main, "pharmacy")
      main.debugSetPose(p.x, p.y, p.z, 180)
      this.mark("cut to pharmacy")
    }
    await this.soft(() => main.getPhase() === "arrived", 3000, "arrived")
    await sleep(150)
    main.debugSetPose(7, 0, 11.5, 195) // step back: the shop front and the card in view
    await this.at(47.2, "stop 1 of 3")
    this.mark("card " + main.getArrivalText())
    await this.at(52.5, "next stop")
    this.press("NextStopButton")
    await sleep(1500)
    this.mark("route " + main.getRouteNodes().join(">"))
    this.speed = 3.0
    const nodes = main.getRouteNodes()
    const iLift = nodes.indexOf("liftAG")
    if (iLift >= 0) await this.walk(this.routePts(1).slice(0, iLift + 1), 58.6)
    else this.mark("no Lift A on the route")

    await this.at(58.9, "ride Lift A")
    const ride = main.getRideIdFor("liftAG", "lift")
    if (ride) this.press("RideButton_" + ride)
    await sleep(1200)
    this.mark("pill " + main.getPillText())
    const after = main.getRouteNodes()
    const iu = after.indexOf("liftAU")
    this.speed = 2.2
    if (iu >= 0) await this.walk([this.pos()].concat(after.slice(iu + 1).map((id) => nodePos(main, id))), 64.4)
    await this.turn(0, 0.8)

    await this.at(65.4, "end")
    await this.end(73.5)
  }
}

