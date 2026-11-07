import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {pressButton} from "../Scripts/FindYourWayWidgetsUI"
import {log, shot, waitFor} from "./FindYourWayLeafSupport"
import {closeDemo, hold, openDemo, talk} from "./FywDemoSupport"

// cr1 — add-on D, "Heard a gate change": airport, wheelchair (Step-Free), on the trip that ends at
// Gate C12. The sample announcement types in (Spanish), shows in English, names gate B14 -> "Re-route to
// Gate B14?" -> No, then Yes -> the route now ends at Gate B14, still with no stairs or escalators. No on the
// first announcement keeps the route; Yes on a second re-routes; heard again at B14, no question.
@component
export class FywCaptionsRerouteScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const run = await openDemo("airportWheelchair")
    const main = run.main
    await hold(run, 0.8)
    await talk(run)
    const stops = main.getStops()
    expect(stops[stops.length - 1], "the trip ends at Gate C12").toBe("gateC12")
    expect(main.getRerouteText(), "no question before anything is heard").toBe(null)

    main.playAnnouncement()
    await waitFor(() => main.getCaptionRows().join(" ").indexOf("puerta") >= 0, 4000, "the Spanish announcement types in")
    await waitFor(() => main.getRerouteText() !== null, 6000, "Re-route to Gate B14?")
    const rows = main.getCaptionRows().join(" ")
    log("cr1 caption: " + rows + " / question: " + main.getRerouteText())
    expect(rows.indexOf("gate B14") >= 0, "the English caption: " + rows).toBe(true)
    expect(main.getRerouteText(), "the question").toBe("Re-route to Gate B14?")
    expect(main.getDestinationId() !== "gateB14", "nothing changes before an answer").toBe(true)
    await shot(main, "cr1-question")

    // No: the question goes, the trip stays as it was.
    const before = main.getRouteNodes().join(">")
    expect(pressButton("RerouteNoButton"), "No pressed").toBe(true)
    await sleep(500)
    expect(main.getRerouteText(), "No hides the question").toBe(null)
    expect(main.getRouteNodes().join(">"), "No keeps the route").toBe(before)

    // Heard again: Yes re-routes.
    main.playAnnouncement()
    await waitFor(() => main.getRerouteText() !== null, 7000, "asked again")
    expect(pressButton("RerouteYesButton"), "Yes pressed").toBe(true)
    await waitFor(() => main.getDestinationId() === "gateB14", 3000, "re-routed to Gate B14")
    const kinds = main.getRouteEdgeKinds()
    log("cr1 new route: " + main.getRouteNodes().join(">") + " (" + kinds.join(",") + ")")
    expect(kinds.indexOf("stairs") < 0 && kinds.indexOf("escalator") < 0, "still step-free: " + kinds.join(",")).toBe(true)
    expect(main.getRerouteText(), "the question is gone").toBe(null)

    // Heard again while already going to B14: no question.
    main.playAnnouncement()
    await sleep(5500)
    expect(main.getRerouteText(), "no question for the gate you are going to").toBe(null)
    // Close while an announcement is still typing in.
    main.playAnnouncement()
    await sleep(1000)
    expect(main.getCaptionRows().join(" ").length > 0, "captions are showing").toBe(true)
    await closeDemo(main)
    // The announcement was still playing: the next demo (Free walk, captions on) starts with no line
    // left over from this one.
    const next = await openDemo("freeWalkRobot")
    if (!pressButton("PrefsKeepButton")) pressButton("PrefsStartButton")
    await waitFor(() => next.main.getPhase() === "free", 3000, "Free walk starts")
    await sleep(1500)
    expect(next.main.getCaptionRows().join(" "), "no captions left over from the last demo").toBe("")
    await closeDemo(next.main)
    log("cr1 pass")
  }
}
