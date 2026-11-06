import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log} from "./FindYourWayLeafSupport"
import {closeDemo, freeWalkRobotTrip, openDemo} from "./FywDemoSupport"

// demo-free-walk-robot — preset 3: Free walk with the robot for coffee and clothes; it points at Bean
// There Café and Threads, and looking at each shows its offer boxes.
@component
export class FywDemoFreeWalkRobotScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("freeWalkRobot")
    const main = run.main
    expect(main.getPhase(), "preferences open").toBe("prefs")
    log("demo-free-walk-robot prefs: " + main.getPrefsSummary())
    const r = await freeWalkRobotTrip(run)
    log("demo-free-walk-robot: pointed " + r.pointed.join(",") + "; boxes " + r.boxes.join(","))
    expect(main.getCompanionModel(), "the robot").toBe("robot")
    expect(main.getFreePrefs().join(","), "coffee and clothes").toBe("coffee,clothes")
    expect(r.pointed.indexOf("cafe") >= 0, "pointed at Bean There Café").toBe(true)
    expect(r.pointed.indexOf("threads") >= 0, "pointed at Threads").toBe(true)
    expect(r.boxes.indexOf("cafe") >= 0, "café offer boxes").toBe(true)
    expect(r.boxes.indexOf("threads") >= 0, "Threads offer boxes").toBe(true)
    await closeDemo(main)
    log("demo-free-walk-robot pass")
  }
}
