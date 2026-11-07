import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, waitFor} from "./FindYourWayLeafSupport"
import {closeDemo, openDemo} from "./FywDemoSupport"

// ask2 — add-on B, "the AI picks the place": in the airport, wheelchair, the plain words find no place
// in "where can my kids run around", so the LLM is asked (a stand-in here; on Specs the gateway). It
// names the toilets and the family lounge: the router makes it the accessible toilet, then the lounge,
// step-free. A reply that isn't valid JSON, or no reply in 3 s: "didn't catch that", no trip.
const SAID = "where can my kids run around"

@component
export class FywAsk2LlmPickScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    let run = await openDemo("airportWheelchair")
    let main = run.main
    let asked = ""
    main.debugSetLlm((prompt: string) => {
      asked = prompt
      return Promise.resolve('Sure! {"stops": ["toiletsD", "familyLounge"]}')
    })
    main.debugHear(SAID)
    await waitFor(() => main.getPhase() === "nav", 8000, "the trip starts after the AI picked")
    expect(asked.indexOf(SAID) >= 0 && asked.indexOf("familyLounge") >= 0, "the prompt has the sentence and the places").toBe(true)
    const stops = main.getStops()
    log("ask2 stops: " + stops.join(","))
    expect(stops.join(","), "accessible toilet, then the family lounge").toBe("accToiletD,familyLounge")
    const kinds = main.getRouteEdgeKinds()
    expect(kinds.indexOf("stairs") < 0 && kinds.indexOf("escalator") < 0, "step-free: " + kinds.join(",")).toBe(true)
    await closeDemo(main)

    // Not valid JSON: nothing starts.
    run = await openDemo("airportWheelchair")
    main = run.main
    main.debugSetLlm(() => Promise.resolve("I think the lounge?"))
    main.debugHear(SAID)
    await waitFor(() => main.getDestinationLabel().indexOf("didn't catch") >= 0, 4000, "didn't catch that (bad reply)")
    await sleep(1500)
    expect(main.getPhase(), "no trip on a bad reply").toBe("mode")
    await closeDemo(main)

    // No reply: after 3 s, "didn't catch that".
    run = await openDemo("airportWheelchair")
    main = run.main
    main.debugSetLlm(() => new Promise<string>(() => {}))
    main.debugHear(SAID)
    await sleep(1000)
    expect(main.getDestinationLabel().indexOf("Thinking") >= 0, "thinking while it waits: " + main.getDestinationLabel()).toBe(true)
    await waitFor(() => main.getDestinationLabel().indexOf("didn't catch") >= 0, 4000, "didn't catch that (timeout)")
    expect(main.getPhase(), "no trip on a timeout").toBe("mode")
    main.debugSetLlm(null)
    await closeDemo(main)
    log("ask2 pass")
  }
}
