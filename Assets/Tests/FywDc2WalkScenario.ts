// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {log, nodePoints, startTrip, tap, walkAlong} from "./FindYourWayLeafSupport"

// DC2 — Walk: following the line goes through the hall and up the escalator to B12, the line
// goes round corners, and an arrow shows when the next turn is out of view.
// The escalator is ridden with its "Ride escalator up" button (the preview can't ride one).
@component
export class FywDc2WalkScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk")
    const route = main.getRouteNodes()
    expect(route.join(">"), "walk route").toBe("sign>hall>escFoot>escTop>concourse>bJunction>gateB12")
    expect(main.getRouteEdgeKinds().indexOf("escalator") >= 0, "uses the escalator").toBe(true)
    const map = main.getMapData()
    const sign = findNode(map, "sign")!

    // Ride buttons only work at their own end: from the entrance, the escalator button refuses.
    const rideId = main.getRideIdsAt("escFoot")[0]
    expect(!!rideId, "escalator ride button exists").toBe(true)
    await tap(it, "RideButton_" + rideId)
    expect(main.getRideOffsetCm().length, "ride refused away from the escalator").toBeCloseTo(0, 1)

    // Walk the ground floor to the foot of the escalator; the line must stay up.
    let lineDropped = false
    const watch = (): boolean => {
      if (main.getPhase() === "nav" && !main.isLineVisible()) lineDropped = true
      return main.getPhase() === "arrived"
    }
    await walkAlong(main, [{x: sign.x, y: 0, z: sign.z - 1.5}].concat(nodePoints(map, ["sign", "hall", "escFoot"])), 1.0, watch)
    expect(main.getRouteNodes()[0], "still on the planned route (no re-route)").toBe("sign")

    // Ride up: the traveller is carried to the top landing; the route is unchanged.
    await tap(it, "RideButton_" + rideId)
    const escTop = findNode(map, "escTop")!
    expect(main.getRideOffsetCm().y, "carried up 6 m").toBeCloseTo(600, 0)
    await sleep(300)
    expect(main.getRouteNodes()[0], "route not re-planned by the ride").toBe("sign")

    // Upstairs: round the concourse corner and on to B12.
    let cornerSeen = false
    await walkAlong(main, nodePoints(map, ["escTop", "concourse", "bJunction", "gateB12"]), 1.0, () => {
      const lp = main.getLineMapPoints()
      if (lp.length >= 3 && lp[lp.length - 1].x > lp[0].x + 2 && lp[0].y > 5) cornerSeen = true
      return watch()
    })
    expect(lineDropped, "line stayed visible while walking").toBe(false)
    expect(cornerSeen, "line goes round the concourse corner").toBe(true)
    expect(main.getPhase(), "reached B12 after riding the escalator").toBe("arrived")
    expect(main.getArrivalText(), "arrival card").toBe("Gate B12. Boarding in 6 min.")

    // Turn arrow: at the top of the escalator facing back (south), the next turn is out of view.
    const main2 = await startTrip(it, "walk")
    main2.debugSetPose(escTop.x, escTop.y, escTop.z + 0.5, 180)
    await sleep(400)
    expect(main2.isTurnArrowVisible(), "arrow shows when the turn is behind").toBe(true)
    main2.debugSetPose(escTop.x, escTop.y, escTop.z + 0.5, 0)
    await sleep(400)
    expect(main2.isTurnArrowVisible(), "arrow hidden when the turn is in view").toBe(false)

    // Walking on past the escalator on the ground floor re-plans from the ground (escFoot),
    // not from the landing 6 m overhead.
    main2.debugSetPose(30, 0, 30, 0)
    await sleep(400)
    expect(main2.getRouteNodes()[0], "re-planned from the ground floor").toBe("escFoot")
    log("DC2 pass")
  }
}
