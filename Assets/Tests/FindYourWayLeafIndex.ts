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
import {FywE1EndTripScenario} from "./FywE1EndTripScenario"
import {FywMapSwitchScenario} from "./FywMapSwitchScenario"
import {FywRestartScenario} from "./FywRestartScenario"
import {FywDemoAutoplayScenario} from "./FywDemoAutoplayScenario"
import {FywDc3bSeatedLiftScenario} from "./FywDc3bSeatedLiftScenario"
import {FywDestBeforeScanScenario} from "./FywDestBeforeScanScenario"
import {FywE3bNoStepFreeAtScanScenario} from "./FywE3bNoStepFreeAtScanScenario"
import {FywStaleLoadScenario} from "./FywStaleLoadScenario"
import {FywClosureCardScenario} from "./FywClosureCardScenario"
import {FywFl1PillScenario} from "./FywFloorsScenario"
import {FywFl2CueBadgeScenario} from "./FywFl2CueBadgeScenario"
import {FywP1CompanionToggleScenario} from "./FywCompanionScenario"
import {FywP3WaitsAtEscalatorScenario} from "./FywP3WaitsAtEscalatorScenario"
import {FywQ4PointingScenario} from "./FywPlacesScenario"
import {FywG1HopScenario} from "./FywPlayScenario"
import {FywPc1CatchScenario} from "./FywPc1CatchScenario"
import {FywT1MallStopsScenario} from "./FywTripsScenario"
import {FywM5LearnThisPlaceScenario} from "./FywM5LearnThisPlaceScenario"
import {FywPk1PeekScenario} from "./FywPk1PeekScenario"
import {FywS1StartAtSignScenario} from "./FywS1StartAtSignScenario"
import {FywBg1BackdropScenario} from "./FywBg1BackdropScenario"
import {FywB3ModesScenario} from "./FywB3ModesScenario"
import {FywCompanionPickScenario} from "./FywCompanionPickScenario"
import {FywWalkStairsScenario} from "./FywWalkStairsScenario"
import {FywB3Dc1BuilderScenario} from "./FywB3Dc1BuilderScenario"
import {FywB3Dc2CompanionScenario} from "./FywB3Dc2CompanionScenario"
import {FywB3Dc3TurnScenario} from "./FywB3Dc3TurnScenario"
import {FywB3Dc4FloorScenario} from "./FywB3Dc4FloorScenario"
import {FywB3Dc5LookScenario} from "./FywB3Dc5LookScenario"
import {FywB3Dc6GoToScenario} from "./FywB3Dc6GoToScenario"
import {FywReelScenario} from "./FywReelScenario"
import {FywV1VoiceScenario} from "./FywV1VoiceScenario"
import {FywPm1PickMapScenario} from "./FywPm1PickMapScenario"
import {FywTr1TourScenario} from "./FywTr1TourScenario"
import {FywSp1SeatedPlayScenario} from "./FywSp1SeatedPlayScenario"
import {FywGt1GrabThrowScenario} from "./FywGt1GrabThrowScenario"
import {FywFw1FreeWalkDemoScenario} from "./FywFw1FreeWalkDemoScenario"
import {FywMb5BuilderInMallScenario} from "./FywMb5BuilderInMallScenario"
import {FywVw1GuidedInViewScenario} from "./FywVw1GuidedInViewScenario"
import {FywVw2FreeWalkInViewScenario} from "./FywVw2FreeWalkInViewScenario"
import {FywVw3TourInViewScenario} from "./FywVw3TourInViewScenario"
import {FywSh1ShowingPresetScenario} from "./FywSh1ShowingPresetScenario"
import {FywCs1CleanScreenScenario} from "./FywCs1CleanScreenScenario"
import {FywV2VoiceFallbackScenario} from "./FywV2VoiceFallbackScenario"
import {FywDemoAirportScenario} from "./FywDemoAirportScenario"
import {FywDemoMallPetScenario} from "./FywDemoMallPetScenario"
import {FywDemoFreeWalkRobotScenario} from "./FywDemoFreeWalkRobotScenario"
import {FywDemoVideoScenario} from "./FywDemoVideoScenario"
import {FywCheckPlacesScenario} from "./FywCheckPlacesScenario"
import {FywLookScenario} from "./FywLookScenario"
import {FywMapLookScenario} from "./FywMapLookScenario"
import {FywRigStageScenario} from "./FywRigStageScenario"

// The LEAF plugin's stall after loading the list grows steeply with its length (44: ~30 s, 51: ~4 min
// of a frozen editor), so the 13 screenshot set-ups are only listed when they are needed.
const INCLUDE_SHOTS = false

@component
export class FindYourWayLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = ([
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
    {id: "e1b-end-trip", typename: FywE1EndTripScenario.getTypeName()},
    {id: "map-switch-cycle", typename: FywMapSwitchScenario.getTypeName()},
    {id: "restart-resets-trip", typename: FywRestartScenario.getTypeName()},
    {id: "demo-autoplay-completes", typename: FywDemoAutoplayScenario.getTypeName()},
    {id: "dc3b-seated-lift-ride", typename: FywDc3bSeatedLiftScenario.getTypeName()},
    {id: "dest-change-before-scan-sticks", typename: FywDestBeforeScanScenario.getTypeName()},
    {id: "e3b-no-step-free-at-scan", typename: FywE3bNoStepFreeAtScanScenario.getTypeName()},
    {id: "c12-stale-load-and-closures-kept", typename: FywStaleLoadScenario.getTypeName()},
    {id: "closure-card-signs-and-5s-hide", typename: FywClosureCardScenario.getTypeName()},
    // Floors, companion, places, play, trips (devpost/SCENARIOS.md S10-S14, P1-P10, Q2-Q8, G1-G9, T1-T3, M1-M5, Z1-Z3).
    {id: "s1-start-at-sign-controls-hidden", typename: FywS1StartAtSignScenario.getTypeName()},
    {id: "fl1-pill-shows-and-counts-down", typename: FywFl1PillScenario.getTypeName()},
    {id: "fl2-cue-post-and-badge-after-escalator", typename: FywFl2CueBadgeScenario.getTypeName()},
    {id: "p1-companion-toggle-and-models", typename: FywP1CompanionToggleScenario.getTypeName()},
    {id: "p3-companion-waits-at-escalator", typename: FywP3WaitsAtEscalatorScenario.getTypeName()},
    {id: "q4-points-at-interests-and-sponsored", typename: FywQ4PointingScenario.getTypeName()},
    {id: "g1-hop-jump-bump-restart", typename: FywG1HopScenario.getTypeName()},
    {id: "pc1-throw-and-fetch-any-model", typename: FywPc1CatchScenario.getTypeName()},
    {id: "t1-mall-multi-stop", typename: FywT1MallStopsScenario.getTypeName()},
    {id: "m5-learn-this-place-save-route", typename: FywM5LearnThisPlaceScenario.getTypeName()},
    {id: "pk1-peek-ahead-shows-and-hides", typename: FywPk1PeekScenario.getTypeName()},
    {id: "bg1-backdrop-solid-in-preview", typename: FywBg1BackdropScenario.getTypeName()},
    // The walking modes and the map builder.
    {id: "b3-modes-scan-first-preset", typename: FywB3ModesScenario.getTypeName()},
    {id: "companion-pick-before-walk", typename: FywCompanionPickScenario.getTypeName()},
    {id: "walk-up-the-stairs", typename: FywWalkStairsScenario.getTypeName()},
    {id: "b3-dc1-map-builder-two-floors", typename: FywB3Dc1BuilderScenario.getTypeName()},
    {id: "b3-dc2-companion-stops-at-matches", typename: FywB3Dc2CompanionScenario.getTypeName()},
    {id: "b3-dc3-turn-around", typename: FywB3Dc3TurnScenario.getTypeName()},
    {id: "b3-dc4-another-floor", typename: FywB3Dc4FloorScenario.getTypeName()},
    {id: "b3-dc5-companion-off-dots", typename: FywB3Dc5LookScenario.getTypeName()},
    {id: "b3-dc6-go-to-a-place", typename: FywB3Dc6GoToScenario.getTypeName()},
    // Voice, the map picker, Tour, seated play, catch by hand.
    {id: "v1-voice-reaches-the-matcher", typename: FywV1VoiceScenario.getTypeName()},
    {id: "pm1-pick-a-place-on-the-map", typename: FywPm1PickMapScenario.getTypeName()},
    {id: "tr1-tour-stop-by-stop", typename: FywTr1TourScenario.getTypeName()},
    {id: "sp1-seated-play", typename: FywSp1SeatedPlayScenario.getTypeName()},
    {id: "gt1-grab-and-throw", typename: FywGt1GrabThrowScenario.getTypeName()},
    {id: "fw1-free-walk-demo", typename: FywFw1FreeWalkDemoScenario.getTypeName()},
    {id: "mb5-builder-in-the-mall", typename: FywMb5BuilderInMallScenario.getTypeName()},
    {id: "vw1-guided-points-in-view", typename: FywVw1GuidedInViewScenario.getTypeName()},
    {id: "vw2-free-walk-points-in-view", typename: FywVw2FreeWalkInViewScenario.getTypeName()},
    {id: "vw3-tour-points-in-view", typename: FywVw3TourInViewScenario.getTypeName()},
    {id: "sh1-showing-preset", typename: FywSh1ShowingPresetScenario.getTypeName()},
    {id: "cs1-clean-screen", typename: FywCs1CleanScreenScenario.getTypeName()},
    {id: "v2-voice-fallback", typename: FywV2VoiceFallbackScenario.getTypeName()},
    {id: "demo-airport", typename: FywDemoAirportScenario.getTypeName()},
    {id: "demo-mall-pet", typename: FywDemoMallPetScenario.getTypeName()},
    {id: "demo-free-walk-robot", typename: FywDemoFreeWalkRobotScenario.getTypeName()},
    {id: "visual-reel", typename: FywReelScenario.getTypeName()},
    {id: "visual-demos", typename: FywDemoVideoScenario.getTypeName()},
    {id: "visual-check-places", typename: FywCheckPlacesScenario.getTypeName()},
    {id: "visual-look", typename: FywLookScenario.getTypeName()},
    {id: "visual-map", typename: FywMapLookScenario.getTypeName()},
    {id: "visual-rigs", typename: FywRigStageScenario.getTypeName()},
  ] as ScenarioMetadata[]).concat(!INCLUDE_SHOTS ? [] : [
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
  ])
}
