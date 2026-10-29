// LEAF scenario for Find Your Way Inside (review C12).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findNode} from "../Scripts/FindYourWayRouter"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {getMain, log, tap, waitFor} from "./FindYourWayLeafSupport"

async function toScan(it: DefaultLeafInteractor, main: FindYourWayMain, mode: string): Promise<void> {
  await tap(it, "RestartButton")
  await waitFor(() => main.getPhase() === "mode", 3000, "mode panel")
  await sleep(800)
  await tap(it, mode)
  await waitFor(() => main.getPhase() === "scan", 3000, "scan sign")
  const sign = findNode(main.getMapData(), main.getStartId())!
  main.debugSetPose(sign.x, 0, sign.z - 1.5, 0)
}

function named(main: FindYourWayMain, name: string): string {
  return JSON.stringify(Object.assign({}, main.getMapData(), {name}))
}

// c12 — (a) a slow map download from a trip that was restarted is ignored by the next trip;
// (b) a downloaded map that differs from the built-in one keeps the closures made before the
// scan visible: closed sign text, red plate, "Out of service" ride button.
@component
export class FywStaleLoadScenario extends Scenario {
  async run(): Promise<void> {
    const it = new DefaultLeafInteractor()
    await sleep(1000)
    const main = getMain()
    for (let i = 0; i < 5 && main.getMapKey() !== "airport"; i++) {
      await tap(it, "NextMapButton")
      await sleep(800)
    }
    // (a) trip 1 starts a 2.5 s download, then the traveller restarts; trip 2's takes 4 s.
    await toScan(it, main, "WalkButton")
    main.debugSetDownloadOverride(named(main, "STALE"), 2500)
    await tap(it, "ScanSignButton")
    await sleep(300)
    await toScan(it, main, "WalkButton")
    main.debugSetDownloadOverride(named(main, "FRESH"), 4000)
    await tap(it, "ScanSignButton")
    await waitFor(() => main.getPhase() === "nav", 8000, "nav after scan")
    expect(main.getMapData().name, "trip 2 uses its own download").toBe("FRESH")

    // (b) close Lift 1 before scanning; the downloaded map differs from the built-in one.
    await toScan(it, main, "StepFreeButton")
    await tap(it, "ClosureButton_lift1")
    await sleep(200)
    main.debugSetDownloadOverride(named(main, "Downloaded airport"))
    await tap(it, "ScanSignButton")
    await waitFor(() => main.getPhase() === "nav", 8000, "nav after scan")
    expect(main.isEdgeOpen("lift1"), "lift 1 still closed").toBe(false)
    expect((main.getClosureSignText("lift1") || "").indexOf("Closed") === 0, "sign: " + main.getClosureSignText("lift1")).toBe(true)
    expect(main.isConnectionShownClosed("lift1"), "red plate shows closed").toBe(true)
    const ride = main.getRideIdFor("lift1G", "lift")!
    expect(main.getRideButtonText(ride), "lift 1 ride button").toBe("Out of service")
    log("c12 pass")
  }
}
