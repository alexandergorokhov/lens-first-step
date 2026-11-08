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
    // Last time was Books (R2-15); you say coffee and fashion, and the walk uses those.
    expect(main.getPrefsSummary(), "last time").toBe("Books")
    const r = await freeWalkRobotTrip(run)
    log("demo-free-walk-robot: heard " + main.getPrefsHeard() + "; pointed " + r.pointed.join(",") + "; boxes " + r.boxes.join(",") + "; reasons " + r.reasons.join(" | "))
    expect(main.getCompanionModel(), "the robot").toBe("robot")
    expect(main.getFreePrefs().join(","), "coffee and clothes").toBe("coffee,clothes")
    expect(r.pointed.indexOf("cafe") >= 0, "pointed at Bean There Café").toBe(true)
    expect(r.pointed.indexOf("threads") >= 0, "pointed at Threads").toBe(true)
    expect(r.boxes.indexOf("cafe") >= 0, "café offer boxes").toBe(true)
    expect(r.boxes.indexOf("threads") >= 0, "Threads offer boxes").toBe(true)
    // The pointing line says why (R2-14).
    expect(r.reasons.indexOf("Café · your pick") >= 0, "reason at the café").toBe(true)
    expect(r.reasons.indexOf("Clothes · your pick") >= 0, "reason at Threads").toBe(true)
    await closeDemo(main)
    log("demo-free-walk-robot pass")
  }
}
