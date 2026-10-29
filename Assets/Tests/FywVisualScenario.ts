// Screenshot set-ups (not part of the pass/fail suite): each registered id puts the Lens in one
// state and, where needed, moves the stand-in building so the real preview camera sees it from
// the chosen spot (FindYourWayMain.debugSetViewFollowsPose). Then a Preview screenshot is taken.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {getMain, log, startTrip, tap, waitFor} from "./FindYourWayLeafSupport"

@component
export class FywVisualScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const shot = (config && config.get("shot")) || "mode"
    const it = new DefaultLeafInteractor()
    await sleep(800)
    const main = getMain()
    if (shot === "mode") {
      await tap(it, "RestartButton")
    } else if (shot === "scan") {
      await tap(it, "RestartButton")
      await sleep(800)
      await tap(it, "WalkButton")
    } else {
      const sf = shot === "lift" || shot === "liftbutton" || shot === "stepfree"
      const campus = shot.indexOf("campus") === 0
      const m = await startTrip(it, sf ? "stepFree" : "walk", 0, undefined, ["nav"], campus ? "campus" : "airport")
      const map = m.getMapData()
      const at = (id: string, dx: number, dz: number, heading: number): void => {
        const n = findNode(map, id)!
        m.debugSetPose(n.x + dx, n.y, n.z + dz, heading)
        m.debugSetViewFollowsPose(true)
      }
      if (shot === "line") at("sign", 0, -1.5, 0)
      if (shot === "campus") at("sign", 0, 4, 20)
      if (shot === "campus-quad") at("quad", 0, -2, 55)
      if (shot === "start") m.debugClearPose()
      if (shot === "card") { m.debugClearPose(); await tap(it, "GateChangeButton") }
      if (shot === "gatechange") { at("escTop", 0, 0.5, 0); await sleep(300); await tap(it, "GateChangeButton") }
      if (shot === "arrow") at("escTop", 0, 0.5, 180)
      if (shot === "lift") at("lift1G", -3.5, -0.5, 90)
      if (shot === "liftbutton") at("lift1G", -4.5, -0.6, 72)
      if (shot === "escalator") at("escFoot", 0, -3.5, 0)
      if (shot === "arrival") {
        await tap(it, "GateChangeButton")
        at("gateC3", 2.5, -1, 300)
        await waitFor(() => m.getPhase() === "arrived", 3000, "arrival")
      }
    }
    await sleep(shot === "gatechange" || shot === "card" ? 300 : 1200)
    log("VISUAL READY " + shot + " phase=" + main.getPhase())
    await sleep(8000) // hold the state for the screenshot
  }
}
