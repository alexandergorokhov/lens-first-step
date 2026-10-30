// Brief 2, places (Q2, Q4-Q6 in devpost/SCENARIOS.md): icons near the route, the companion points
// only at your interests and sponsored places (always tagged "Sponsored"), mute stops it, "Go
// here?" re-routes. Pointing never changes the route, distance or destination.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {log, nodePoints, startTrip, tap, walkAlong} from "./FindYourWayLeafSupport"

@component
export class FywQ4PointingScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await startTrip(it, "walk", 0, undefined, ["nav"], "airport", (m) => m.debugSetInterests(["coffee"]))
    await tap(it, "CompanionButton")
    const route = main.getRouteNodes().join(">")
    const length = main.getRouteLength()
    const dest = main.getDestinationId()
    const map = main.getMapData()
    const pointed: string[] = []
    let maxIcons = 0
    await walkAlong(main, nodePoints(map, ["sign", "hall", "escFoot"]), 0.7, () => {
      const id = main.getPointedPlaceId()
      if (id && pointed.indexOf(id) < 0) pointed.push(id)
      maxIcons = Math.max(maxIcons, main.getVisiblePlaceIds().length)
      return false
    })
    expect(maxIcons <= 3 + (pointed.length > 0 ? 1 : 0), "at most 3 icons (+ the pointed one)").toBe(true)
    expect(pointed.length > 0, "pointed at something on the way").toBe(true)
    for (const id of pointed) {
      const n = findNode(map, id)!
      expect(n.sponsored === true || n.category === "coffee", id + " is sponsored or coffee").toBe(true)
      if (n.sponsored) expect((main.getPlaceTag(id) || "").indexOf("Sponsored") >= 0, "sponsored tag on " + id).toBe(true)
    }
    expect(main.getRouteNodes().join(">"), "route unchanged by pointing").toBe(route)
    expect(main.getRouteLength(), "length unchanged").toBe(length)
    expect(main.getDestinationId(), "destination unchanged").toBe(dest)
    // Mute: no icons, no pointing.
    await tap(it, "PlacesButton")
    await sleep(300)
    expect(main.isPlacesMuted(), "muted").toBe(true)
    expect(main.getVisiblePlaceIds().length, "no icons when muted").toBe(0)
    await tap(it, "PlacesButton")
    // Go here?: a place becomes the destination (the same re-route as a gate change).
    main.debugGoHere(pointed[0])
    await sleep(400)
    expect(main.getDestinationId(), "Go here re-routes").toBe(pointed[0])
    await tap(it, "CompanionButton")
    log("q4 pass")
  }
}
