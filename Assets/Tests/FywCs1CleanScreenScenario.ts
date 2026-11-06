import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {airportTrip, closeDemo, freeWalkRobotTrip, mallPetTrip, openDemo, watchCleanScreen} from "./FywDemoSupport"

// cs1 — the clean screen: each demo trip, walked from the sign; while walking, no text shows but the
// offer boxes, the arrival card (3 s), the voice caption and the folded Control tab.
@component
export class FywCs1CleanScreenScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const seen: string[] = []
    for (const preset of ["airportWheelchair", "mallPet", "freeWalkRobot"]) {
      const run = await openDemo(preset)
      expect(run.main.isCleanScreen(), preset + " clean screen on").toBe(true)
      expect(run.main.areDemoControlsShown(), preset + " no demo controls").toBe(false)
      watchCleanScreen(run, seen)
      if (preset === "airportWheelchair") await airportTrip(run)
      else if (preset === "mallPet") await mallPetTrip(run)
      else await freeWalkRobotTrip(run)
      if (preset !== "freeWalkRobot") {
        expect(run.main.isArrivalCardShown(), preset + " arrival card").toBe(true)
        await sleep(3500)
        expect(run.main.isArrivalCardShown(), preset + " arrival card gone after 3 s").toBe(false)
      }
      expect(run.main.getHudCardText(), preset + " no notice card").toBe(null)
      expect(run.main.isOptionsCollapsed(), preset + " Control tab folded").toBe(true)
      log("cs1 " + preset + ": " + seen.length + " offending texts so far")
      await closeDemo(run.main)
    }
    expect(seen.length === 0, "texts shown while walking: " + seen.slice(0, 8).join(" | ")).toBe(true)
    log("cs1 pass")
  }
}
