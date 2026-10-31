import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {parseMap, Vec3} from "../Scripts/FindYourWayRouter"
import {log, tap, waitFor, walkAlong} from "./FindYourWayLeafSupport"
import {toModes} from "./FywB3Support"

// mb5 — Map builder in the mall: the shops stay in view, looking at one and marking it leaves a pin,
// and walking on joins the marks into one connected map.
@component
export class FywMb5BuilderInMallScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = await toModes(it, "mall")
    await tap(it, "MapBuilderButton")
    await waitFor(() => main.getPhase() === "mapping" && main.isMappingPanelShown(), 3000, "map builder panel")
    expect(main.standIn.isBuilt(), "the mall stays in the preview").toBe(true)
    expect(main.getMapPinCount(), "no pins yet").toBe(0)

    const walk = (pts: Vec3[]) => walkAlong(main, pts, 0.25)
    await walk([{x: 30, y: 0, z: 1}, {x: 30, y: 0, z: 6}])
    main.debugSetPose(30, 0, 6, 90)
    await sleep(100)
    await tap(it, "MarkShopButton")
    expect(main.getMapPinCount(), "a pin on the first shop").toBe(1)

    await walk([{x: 30, y: 0, z: 6}, {x: 30, y: 0, z: 14}])
    main.debugSetPose(30, 0, 14, -90)
    await sleep(100)
    await tap(it, "MarkShopButton")
    expect(main.getMapPinCount(), "a pin on the second shop").toBe(2)

    const parsed = parseMap(main.getMappedMapText())
    expect(parsed.ok, "the map is valid").toBe(true)
    if (parsed.ok) {
      const places = parsed.map.nodes.filter((n) => n.kind === "place")
      expect(places.length, "both shops are nodes").toBe(2)
      for (const p of places) {
        expect(parsed.map.edges.some((e) => e.from === p.id || e.to === p.id), p.id + " is connected").toBe(true)
      }
    }
    await tap(it, "RestartButton")
    await sleep(500)
    expect(main.getMapPinCount(), "pins go with the builder").toBe(0)
    log("mb5 pass")
  }
}
