import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {closeDemo, openDemo, talk} from "./FywDemoSupport"

// offline-mode — R2-18: the Control panel's Offline switch; with no internet simulated the map stays and
// voice still finds the place from the map's own data (no LLM).
@component
export class FywOfflineModeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("mallPet")
    const main = run.main
    // The Control panel is folded in the demo: its switch's action, and the switch shows it.
    if (!pressButton("OfflineButton")) main.setOffline(true)
    expect(main.isOffline(), "offline on").toBe(true)
    expect(main.getOfflineLabel(), "the Control panel shows it").toBe("Offline: on")
    await talk(run)
    expect(main.getDestinationId(), "voice works offline from the map").toBe("foodCourt")
    main.setOffline(false)
    expect(main.isOffline(), "offline off again").toBe(false)
    await closeDemo(main)
    log("offline-mode pass")
  }
}
