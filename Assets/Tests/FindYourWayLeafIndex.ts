// Registers the Find Your Way LEAF scenarios with the LEAF scenario manager.
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {FywDc1ScanScenario} from "./FywDc1ScanScenario"
import {FywDc2WalkScenario} from "./FywDc2WalkScenario"
import {FywDc3StepFreeScenario} from "./FywDc3StepFreeScenario"
import {FywDc4GateChangeScenario} from "./FywDc4GateChangeScenario"
import {FywDc5ArrivalScenario} from "./FywDc5ArrivalScenario"
import {FywStepFreeRuleScenario} from "./FywStepFreeRuleScenario"
import {FywWalkShortestScenario} from "./FywWalkShortestScenario"
import {FywVisualScenario} from "./FywVisualScenario"
import {FywE2BrokenMapScenario} from "./FywE2BrokenMapScenario"
import {FywE3NoStepFreeScenario} from "./FywE3NoStepFreeScenario"
import {FywE4AtDestinationScenario} from "./FywE4AtDestinationScenario"
import {FywE5UnknownSignScenario} from "./FywE5UnknownSignScenario"
import {FywMapSwitchScenario} from "./FywMapSwitchScenario"
import {FywRestartScenario} from "./FywRestartScenario"
import {FywDemoAutoplayScenario} from "./FywDemoAutoplayScenario"

@component
export class FindYourWayLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "dc1-scan-sign-line-appears", typename: FywDc1ScanScenario.getTypeName()},
    {id: "dc2-walk-escalator-corners-arrow", typename: FywDc2WalkScenario.getTypeName()},
    {id: "dc3-stepfree-seated-lift-reroute", typename: FywDc3StepFreeScenario.getTypeName()},
    {id: "dc4-gate-change-stairs-and-ramp", typename: FywDc4GateChangeScenario.getTypeName()},
    {id: "dc5-arrival-card", typename: FywDc5ArrivalScenario.getTypeName()},
    {id: "rule-stepfree-no-stairs-escalator", typename: FywStepFreeRuleScenario.getTypeName()},
    {id: "rule-walk-is-shortest", typename: FywWalkShortestScenario.getTypeName()},
    {id: "e2-broken-map-fallback", typename: FywE2BrokenMapScenario.getTypeName()},
    {id: "e3-no-step-free-ask-staff", typename: FywE3NoStepFreeScenario.getTypeName()},
    {id: "e4-already-at-destination", typename: FywE4AtDestinationScenario.getTypeName()},
    {id: "e5-unknown-sign", typename: FywE5UnknownSignScenario.getTypeName()},
    {id: "map-switch-cycle", typename: FywMapSwitchScenario.getTypeName()},
    {id: "restart-resets-trip", typename: FywRestartScenario.getTypeName()},
    {id: "demo-autoplay-completes", typename: FywDemoAutoplayScenario.getTypeName()},
    // Screenshot set-ups — skipped by the runner unless named in `only`.
    {id: "visual-start", typename: FywVisualScenario.getTypeName(), parameters: {shot: "start"}},
    {id: "visual-card", typename: FywVisualScenario.getTypeName(), parameters: {shot: "card"}},
    {id: "visual-campus", typename: FywVisualScenario.getTypeName(), parameters: {shot: "campus"}},
    {id: "visual-campus-quad", typename: FywVisualScenario.getTypeName(), parameters: {shot: "campus-quad"}},
    {id: "visual-mode", typename: FywVisualScenario.getTypeName(), parameters: {shot: "mode"}},
    {id: "visual-scan", typename: FywVisualScenario.getTypeName(), parameters: {shot: "scan"}},
    {id: "visual-line", typename: FywVisualScenario.getTypeName(), parameters: {shot: "line"}},
    {id: "visual-gatechange", typename: FywVisualScenario.getTypeName(), parameters: {shot: "gatechange"}},
    {id: "visual-arrow", typename: FywVisualScenario.getTypeName(), parameters: {shot: "arrow"}},
    {id: "visual-lift", typename: FywVisualScenario.getTypeName(), parameters: {shot: "lift"}},
    {id: "visual-liftbutton", typename: FywVisualScenario.getTypeName(), parameters: {shot: "liftbutton"}},
    {id: "visual-escalator", typename: FywVisualScenario.getTypeName(), parameters: {shot: "escalator"}},
    {id: "visual-arrival", typename: FywVisualScenario.getTypeName(), parameters: {shot: "arrival"}},
  ]
}
