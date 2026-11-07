import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {log, shot, waitFor} from "./FindYourWayLeafSupport"
import {closeDemo, hold, openDemo, talk, walkLeg} from "./FywDemoSupport"

// sa1 — add-on A, the companion speaks: airport, wheelchair. "Found you. Where to?" when Go to a place
// opens; "Step-free route, no stairs." as the trip starts; a heard gate change and Yes: "Your gate
// moved."; on the way to B14 the lift named as it comes near, then "I'll hold the lift"; "You're here." Each line
// shows as a caption at the companion, never twice within 8 s. Voice: off in the Control panel: silent.
// Voice: on/off is in the Control panel, folded to its Options tab once a trip starts.
function pressVoice(): boolean {
  return pressButton("VoiceButton") || (pressButton("OptionsTabButton") && pressButton("VoiceButton"))
}

@component
export class FywSa1CompanionSpeaksScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("airportWheelchair")
    const main = run.main
    expect(main.getCompanionClipCount(), "all 14 clips handed to Main").toBe(14)
    expect(main.isCompanionMuted(), "speaks by default").toBe(false)
    await waitFor(() => main.getCompanionSaid().indexOf("start") >= 0, 4000, "Found you. Where to?")
    expect(main.getCompanionCaption(), "the words show at the companion").toBe("Found you. Where to?")
    await shot(main, "sa1-found-you")

    await hold(run, 0.8)
    await talk(run)
    await waitFor(() => main.getCompanionSaid().indexOf("step_free") >= 0, 4000, "Step-free route, no stairs")

    // A heard gate change on the way, Yes: "Your gate moved. New route."
    main.playAnnouncement()
    await waitFor(() => main.getRerouteText() !== null, 7000, "Re-route to Gate B14?")
    expect(pressButton("RerouteYesButton"), "Yes pressed").toBe(true)
    await waitFor(() => main.getCompanionSaid().indexOf("gate_moved") >= 0, 4000, "Your gate moved")
    await waitFor(() => main.getCompanionCaption() === "Your gate moved. New route.", 3000, "its caption")
    await shot(main, "sa1-gate-moved")

    // Walk to Gate B14: the lift named, "I'll hold the lift", "You're here."
    const kinds = await walkLeg(run)
    await waitFor(() => main.getCompanionSaid().indexOf("arrived") >= 0, 4000, "You're here")
    const said = main.getCompanionSaid()
    log("sa1 said: " + said.join(", ") + " (kinds " + kinds.join(",") + ")")
    if (kinds.indexOf("lift") >= 0) {
      expect(said.filter((k) => k.indexOf("lift_") === 0).length, "the lift named once: " + said.join(",")).toBe(1)
      expect(said.indexOf("hold_lift") >= 0, "I'll hold the lift: " + said.join(",")).toBe(true)
    }
    // Never the same line twice within 8 s is the gate's job (Node SP3); here: not every frame.
    expect(said.length < 20, "a handful of lines, not a stream: " + said.length).toBe(true)

    // Voice: off — nothing more is said, and the caption goes.
    expect(pressVoice(), "Voice button pressed").toBe(true)
    expect(main.isCompanionMuted(), "muted").toBe(true)
    expect(main.getCompanionCaption(), "no caption while muted").toBe(null)
    const n = main.getCompanionSaid().length
    await hold(run, 1)
    await closeDemo(main)
    const next = await openDemo("airportWheelchair")
    await sleep(1500)
    expect(next.main.getCompanionSaid().length, "silent while muted (was " + n + ")").toBe(0)
    next.main.setCompanionMuted(false) // the Control panel shows once a trip starts
    expect(next.main.isCompanionMuted(), "on again").toBe(false)
    await closeDemo(next.main)
    log("sa1 pass")
  }
}
