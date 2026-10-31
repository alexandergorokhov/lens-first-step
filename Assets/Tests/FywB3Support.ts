// Shared helpers for the design-brief-3 LEAF scenarios: to the three modes on the mall, the shipped
// mall map (a test download, so a stale online copy can't change the result), and into Free walk.
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FindYourWayMain} from "../Scripts/FindYourWayMain"
import {findNode} from "../Scripts/FindYourWayRouter"
import {bundledMaps, getMain, tap, waitFor} from "./FindYourWayLeafSupport"

// Restart on the mall and pinch the scan sign: the three modes show.
export async function toModes(it: DefaultLeafInteractor, mapKey: string = "mall"): Promise<FindYourWayMain> {
  const main = getMain()
  main.debugForgetSavedMap()
  for (let i = 0; i < 6 && main.getMapKey() !== mapKey; i++) {
    await tap(it, "NextMapButton")
    await sleep(600)
  }
  await tap(it, "RestartButton")
  await waitFor(() => main.getPhase() === "scan" && main.isScanSignVisible(), 3000, "scan sign")
  await sleep(800)
  await waitFor(() => !main.isAnchorSettling(), 12000, "world anchor settled")
  main.debugSetDownloadOverride(JSON.stringify(bundledMaps().filter((m) => m.key === mapKey)[0].map))
  const sign = findNode(main.getMapData(), main.getStartId())!
  main.debugSetPose(sign.x, 0, sign.z, 0)
  await tap(it, "ScanSignButton")
  await waitFor(() => main.getPhase() === "choose" && main.isHomePanelShown(), 8000, "the three modes")
  return main
}

// Into Free walk with these preferences (tapping what differs from the demo preset).
export async function startFreeWalk(it: DefaultLeafInteractor, prefs: string[], companion: boolean): Promise<FindYourWayMain> {
  const main = await toModes(it)
  await tap(it, "FreeWalkButton")
  await waitFor(() => main.getPhase() === "prefs" && main.isPrefsShown(), 3000, "preferences pop-up")
  await tap(it, "PrefsViewButton")
  const preset = ["coffee", "clothes", "hardware"]
  for (const id of preset.concat(prefs)) {
    if ((preset.indexOf(id) >= 0) !== (prefs.indexOf(id) >= 0)) await tap(it, "Pref_" + id)
  }
  if (!companion) await tap(it, "PrefsCompanionButton")
  await tap(it, "PrefsStartButton")
  await waitFor(() => main.getPhase() === "free", 3000, "free walk")
  return main
}
