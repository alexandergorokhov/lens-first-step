import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {parseMap, Vec3} from "../Scripts/FindYourWayRouter"
import {log, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// b3-dc1 — Map builder: from the sign, walk two floors of the room, mark two shops on each floor
// and upload. The map passes parseMap, and a walking mode can route on it.
@component
export class FywB3Dc1BuilderScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it, "room")
    main.debugSetPose(0, 0, 0, 0)
    await tap(it, "MapBuilderButton")
    await waitFor(() => main.getPhase() === "mapping" && main.isMappingPanelShown(), 3000, "map builder panel")
    expect(main.getMappedNodeCount(), "the sign is the first point").toBe(1)

    const walk = (pts: Vec3[]) => walkAlong(main, pts, 0.25)
    const at = (x: number, y: number, z: number, h: number) => main.debugSetPose(x, y, z, h)

    // Ground floor: two shops, facing east.
    await walk([{x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 4}])
    at(0, 0, 4, 90)
    await sleep(100)
    await tap(it, "MarkShopButton")
    await walk([{x: 0, y: 0, z: 4}, {x: 0, y: 0, z: 9}])
    at(0, 0, 9, 90)
    await sleep(100)
    await tap(it, "MarkShopButton")
    expect(main.getMappingStatus().indexOf("2 shops") >= 0, "two shops: " + main.getMappingStatus()).toBe(true)

    // Up: the height changes and holds for 2 s, the Lens guesses, one pinch confirms.
    await walk([{x: 0, y: 0, z: 9}, {x: 0, y: 3.5, z: 14}])
    at(0, 3.5, 14, 0)
    await waitFor(() => main.getFloorGuess() !== null, 4000, "floor change detected")
    await tap(it, "ConfirmFloorButton")
    expect(main.getFloorGuess(), "confirmed").toBe(null)

    // First floor: two shops.
    await walk([{x: 0, y: 3.5, z: 14}, {x: 5, y: 3.5, z: 14}])
    at(5, 3.5, 14, 0)
    await sleep(100)
    await tap(it, "MarkShopButton")
    await walk([{x: 5, y: 3.5, z: 14}, {x: 11, y: 3.5, z: 14}])
    at(11, 3.5, 14, 0)
    await sleep(100)
    await tap(it, "MarkShopButton")

    await tap(it, "SeeMapButton")
    await sleep(200)
    expect(main.isMapModelShown(), "See my map").toBe(true)
    await tap(it, "SeeMapButton")

    const walked = JSON.parse(main.getMappedMapText())
    await tap(it, "UploadMapButton")
    await waitFor(() => main.getPhase() === "choose", 3000, "back at the three modes")
    expect(main.getMapKey(), "my place loaded").toBe("mine")
    main.debugSetPose(11, 3.5, 14, 0) // still standing where the walk ended
    const parsed = parseMap(main.getMappedMapText())
    expect(parsed.ok, "passes parseMap").toBe(true)
    const shops = walked.nodes.filter((n: {kind: string}) => n.kind === "place")
    expect(shops.length, "four shops").toBe(4)
    expect(shops.filter((n: {y: number}) => n.y > 3).length, "two upstairs").toBe(2)
    expect(walked.place.levels.length, "two floors").toBe(2)

    await tap(it, "GoToPlaceButton")
    await waitFor(() => main.getPhase() === "mode", 3000, "Go to a place")
    await tap(it, "WalkButton")
    await waitFor(() => main.getPhase() === "nav", 3000, "routing on my place")
    expect(main.getRouteStatus(), "a walking mode routes on it").toBe("route")
    expect(main.isLineVisible(), "line drawn").toBe(true)
    main.debugForgetSavedMap()
    await tap(it, "RestartButton")
    log("b3-dc1 pass")
  }
}
