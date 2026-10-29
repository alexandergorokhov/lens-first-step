// LEAF scenario for Find Your Way Inside (see devpost/design-brief.md done criteria).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode, findRoute, parseMap, setEdgeOpen, MapData} from "../Scripts/FindYourWayRouter"
import {log, nodePoints, startTrip, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"

// DC3 — Step-Free at seated height: the line goes round the corner to the lift, never stairs or
// escalator; pinching the red sign on Lift 1 re-routes to Lift 2.
@component
export class FywDc3StepFreeScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    // Seated: eyes ~45 cm lower than standing, so the feet estimate sits ~0.45 m below the floor.
    const main = await startTrip(it, "stepFree", -0.45)
    const kinds = main.getRouteEdgeKinds()
    expect(kinds.indexOf("stairs") < 0 && kinds.indexOf("escalator") < 0, "no stairs/escalator: " + kinds.join(",")).toBe(true)
    expect(main.getRouteNodes().indexOf("lift1G") >= 0, "goes to Lift 1").toBe(true)
    await waitFor(() => main.isLineVisible(), 3000, "line visible")
    // Seated view: the line stays on the floor, and some of it is within 25° below eye level.
    const local = main.getLineLocalPoints()
    expect(local[0].y, "line still on the floor when seated").toBeCloseTo(1, 1)
    const eye = main.mapToLocal(findNode(main.getMapData(), "sign")!.x, 0, findNode(main.getMapData(), "sign")!.z - 1.5)
    const seatedEyeY = main.getEyeHeightCm() - 45
    let inView = false
    for (const p of local) {
      const dx = p.x - eye.x, dz = p.z - eye.z
      const flat = Math.sqrt(dx * dx + dz * dz)
      if (flat < 50) continue
      const down = (Math.atan2(seatedEyeY - p.y, flat) * 180) / Math.PI
      if (down > 3 && down < 25) inView = true
    }
    expect(inView, "line visible from seated eye height").toBe(true)

    await tap(it, "ClosureButton_lift1")
    await sleep(300)
    const after = main.getRouteNodes()
    expect(after.indexOf("lift1G") < 0 && after.indexOf("lift2G") >= 0, "re-routed to Lift 2: " + after.join(">")).toBe(true)
    const k2 = main.getRouteEdgeKinds()
    expect(k2.indexOf("stairs") < 0 && k2.indexOf("escalator") < 0, "still step-free").toBe(true)
    expect((main.getHudCardText() || "").indexOf("Lift 1 out of service") >= 0, "card: " + main.getHudCardText()).toBe(true)
    expect(main.isLineVisible(), "line still drawn after re-route").toBe(true)

    // Lift 1 is closed: its floor button refuses even when you stand in it.
    const lift1 = findNode(main.getMapData(), "lift1G")!
    main.debugSetPose(lift1.x, -0.45, lift1.z, 90)
    await sleep(300)
    const lift1Ride = main.getRideIdsAt("lift1G")[0]
    await tap(it, "RideButton_" + lift1Ride)
    expect(main.getRideOffsetCm().length, "closed lift does not ride").toBeCloseTo(0, 1)

    // Wheel along the new route to Lift 2, ride it up, and on to B12 (arrival after a ride).
    const map = main.getMapData()
    const nodes = main.getRouteNodes()
    const i2 = nodes.indexOf("lift2G")
    await walkAlong(main, nodePoints(map, ["lift1G"].concat(nodes.slice(nodes.indexOf("hall"), i2 + 1))), 1.5)
    const lift2Ride = main.getRideIdsAt("lift2G")[0]
    await tap(it, "RideButton_" + lift2Ride)
    expect(main.getRideOffsetCm().y, "lift carried the traveller up 6 m").toBeCloseTo(600, 0)
    const rest = main.getRouteNodes()
    const iu = rest.indexOf("lift2U")
    expect(iu >= 0, "route continues from the top of Lift 2: " + rest.join(">")).toBe(true)
    await walkAlong(main, nodePoints(map, rest.slice(iu)), 1.5, () => main.getPhase() === "arrived")
    expect(main.getPhase(), "arrived at B12 after the lift ride").toBe("arrived")
    expect(main.getArrivalText(), "arrival card").toBe("Gate B12. Boarding in 6 min.")
    log("DC3 pass")
  }
}
