// FindYourWayMain — orchestrates the Lens: simulated sign scan -> map load (online with 5 s
// timeout, else built-in) -> the three modes (Free walk, Go to a place, Map builder) -> for
// Go to a place, live routing with the floor line, turn arrow,
// notice card, arrival card, rides (lift / escalator / stairs / ramp), closures and
// destination changes. Also the distance pill with the floor badge and the floor-change cue,
// the line only on your floor with an up/down post, place icons ("Places on/off", "Go here?"),
// the companion (a feature you turn on or off; any model) with its collectibles and pointing,
// play while you wait (Hop: raise a hand to jump; catch: throw a treat) and multi-stop trips.
// Owns: trip state (map, profile, Navigator, ride offset). UI modules are passive views:
// Main pushes state via their setters and listens to their events.
// The building's contents, play, the Free walk view and panel placement live in their own modules.
// Inputs: authored scene objects (camera, world anchor, building) and the UI/controller
// components; tunables for eye height, sign placement, look-ahead and panel offsets.
// Must not: create text or UIKit widgets (those live in the *UI.ts modules).
// The route logic is FindYourWayRouter.ts — a verbatim copy of src/core/router.ts.

import {
  findNode,
  chooseMap,
  levelsOf,
  lineAhead,
  loadMapWithTimeout,
  locateSign,
  logSafe,
  MAP_LOAD_FAILED,
  MapData,
  Navigator,
  nearestNode,
  noticeFor,
  parseMap,
  Profile,
  routePoints,
  setEdgeOpen,
  tripAhead,
  TripAhead,
  Vec3,
  withinReach,
} from "./FindYourWayRouter"
import {
  arrivalText,
  closureNotice,
  levelName,
  MAP_SOURCES,
  MapFrame,
  mapUrl,
  nodeLabel,
  PlaceEvent,
  PlaceInfo,
  placeOf,
  rideCard,
} from "./FindYourWayMapLibrary"
import {feetOnSlope, isClear, lineOnLevel, nextTurnAlong, turnOutOfView, walkStep, yawFromForward, yawTo} from "./FindYourWayGeometry"
import {destinationFloorText, floorCueFor, tripPill} from "./FindYourWayPlace"
import {Companion, companionChoices, companionOf, COMPANIONS, PetGuide, treatsResult, treatsText} from "./FindYourWayPet"
import {Place, placeTag, PointingCoach, POINT_SECONDS, visiblePlaces} from "./FindYourWayPlaces"
import {tourStops} from "./FindYourWayTour"
import {clampToView, FOV_HALF_DEG, inView, OutOfViewTimer, VIEW_FAR_M, VIEW_HALF_DEG} from "./FindYourWayView"
import {FindYourWayVoice} from "./FindYourWayVoice"
import {FindYourWayPickMapUI} from "./FindYourWayPickMapUI"
import {MultiStopTrip, orderStops} from "./FindYourWayTrip"
import {mapLogLines, tripAfterSaving} from "./FindYourWayMapping"
import {peekPlace} from "./FindYourWayPeek"
import {demoSettings, DemoSettings, showingSettings, StartSettings} from "./FindYourWayDemo"
import {destinationsOf, FreeWalk, interestList, LookBoxes, matchDestination, OfferDismissals, sayItPhrase, ShopLook, typedSoFar, typingSeconds, planAsk, VOICE_FALLBACK_S, walkableRoute, CLEAN_FREE_WALK, OFFER_LOOK_S} from "./FindYourWayFreeWalk"
import {arrivalCardOn, cleanAllows, OptionsDock, routeLineAheadM, walkingHud} from "./FindYourWayDock"
import {FindYourWayOfferBoxesUI} from "./FindYourWayOfferBoxesUI"
import {FindYourWayHomePanelUI} from "./FindYourWayHomePanelUI"
import {FindYourWayPrefsUI} from "./FindYourWayPrefsUI"
import {FindYourWayOfferUI} from "./FindYourWayOfferUI"
import {FindYourWayBubbleUI} from "./FindYourWayBubbleUI"
import {FindYourWayWhereToUI} from "./FindYourWayWhereToUI"
import {FindYourWayMapBuilder} from "./FindYourWayMapBuilder"
import {FindYourWayMappingPanelUI} from "./FindYourWayMappingPanelUI"
import {FindYourWayPeekView} from "./FindYourWayPeekView"
import {FindYourWayCompanionView} from "./FindYourWayCompanionView"
import {FindYourWayAppPanelUI} from "./FindYourWayAppPanelUI"
import {FindYourWayPlacesUI} from "./FindYourWayPlacesUI"
import SIK from "SpectaclesInteractionKit.lspkg/SIK"
import {FindYourWayRouteLine} from "./FindYourWayRouteLine"
import {FindYourWayStandIn} from "./FindYourWayStandIn"
import {FindYourWayTurnArrow} from "./FindYourWayTurnArrow"
import {FindYourWayModePanelUI} from "./FindYourWayModePanelUI"
import {FindYourWayBuildingUI} from "./FindYourWayBuildingUI"
import {FindYourWayDemoControlsUI} from "./FindYourWayDemoControlsUI"
import {FindYourWayHudUI} from "./FindYourWayHudUI"
import {FindYourWayArrivalUI} from "./FindYourWayArrivalUI"
import {FindYourWayFreeWalkView} from "./FindYourWayFreeWalkView"
import {FindYourWayPanelFollow} from "./FindYourWayPanelFollow"
import {FindYourWayPlaceBuilder, Ride} from "./FindYourWayPlaceBuilder"
import {FindYourWayPlayTime} from "./FindYourWayPlayTime"
import {FindYourWayPropsView} from "./FindYourWayPropsView"
import {FindYourWayLiveCaptions} from "./FindYourWayLiveCaptions"
import {FindYourWaySpeakerView} from "./FindYourWaySpeakerView"

// scan -> loading -> choose (the three modes) -> prefs -> free (Free walk)
//                                           -> mode -> nav -> arrived (Go to a place)
//                                           -> mapping (Map builder)
export type Phase = "scan" | "loading" | "choose" | "prefs" | "free" | "mode" | "nav" | "arrived" | "error" | "mapping"

const ARRIVAL_CARD_CM = 200
// The offer boxes at a shop stand this high (cm): above eye level, over plants and props.
const OFFER_BOX_CM = 185
const LINE_LIFT_CM = 1 // the floor line sits 1 cm above the floor
const CLOSED_SIGN_TEXT = "Closed — re-routing"
const RIDE_CARD_S = 2.5
const SLOPE_MIN_RISE_M = 0.005
// The preview's keys can't reliably look down, so there the Options panel stays in view, at its left edge.
const PREVIEW_PANEL_OFFSET = new vec3(-18, -6, -100)
const PREVIEW_PANEL_SCALE = 0.8
const MAPPING_PANEL_OFFSET = new vec3(0, -8, -115)
const DEST_NOTE_S = 3.5
// Voice: stop listening after this long with no finished phrase (s).
const VOICE_TIMEOUT_S = 8
const COMPANION_IDS = ["dog", "robot"]
// The airport model's solids, for walking by hand in the preview (npm run airport:solids).
const AIRPORT_SOLIDS_ASSET = requireAsset("../Maps/airport-solids.json") as JsonAsset
let AIRPORT_SOLIDS: number[][] | null = null
// The preview can't hear (ASR runs on Specs): said under Talk there.
const PREVIEW_TALK_HINT = "Preview: voice shown as typed. Live speech on Specs."
// After the typed phrase is complete, this long before it is matched (s).
const TYPED_HOLD_S = 0.6
// A trip asked for in your own words goes on to its next stop this long after arriving (s).
const ASK_NEXT_S = 4.5
// What was heard stays on the panel this long before a demo sets off (s).
const HEARD_READ_S = 2.2
// In the preview the scripted announcement plays this long into a trip (s).
const CAPTION_DEMO_AFTER_S = 0.8
// Learn this place: the saved map lives in the device's persistent storage under this key.
const MAPPED_KEY = "fyw.mappedMap"
const MAPPED_KEY_NAME = "mine"
// The published copy of the saved map on the map server (npm run map:publish).
// Peek ahead: the model floats this far ahead and below the eyes (cm); pull a pinch this far
// toward you (cm) to show it.
const PEEK_AHEAD_CM = 60
const PEEK_BELOW_CM = 45
// See map puts the mini mall in the narrow view, as it can't be looked down at with a pinch.
const SEE_MAP_AHEAD_CM = 115
const SEE_MAP_RIGHT_CM = 15
const SEE_MAP_BELOW_CM = 3
const SEE_MAP_SIZE_M = 0.26
const SEE_MAP_FLOOR_GAP_M = 0.075
const PEEK_PULL_CM = 8
// Frames after a restart during which the world keeps re-anchoring to the settling camera.
const ANCHOR_SETTLE_FRAMES = 30


@component
export class FindYourWayMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Find Your Way Inside – trip orchestrator</span>')
  @ui.separator
  @ui.group_start("References")
  @input @hint("The device-tracked camera (the user's head)") camera: SceneObject
  @input @hint("World anchor, placed at the user's start pose") world: SceneObject
  @input @hint("Stand-in building root (child of World); sign node at its origin") building: SceneObject
  @input @hint("Floor line renderer") routeLine: FindYourWayRouteLine
  @input @hint("Stand-in building generator") standIn: FindYourWayStandIn
  @input @hint("Turn arrow at the lower edge of view") turnArrow: FindYourWayTurnArrow
  @input @hint("Walk / Step-Free panel") modePanel: FindYourWayModePanelUI
  @input @hint("Signs and pinch targets inside the building") buildingUI: FindYourWayBuildingUI
  @input @hint("Demo controls panel") demoControls: FindYourWayDemoControlsUI
  @input @hint("Head-locked notice card + map badge") hud: FindYourWayHudUI
  @input @hint("Card over the destination") arrivalCard: FindYourWayArrivalUI
  @input @hint("Internet module used to download the map") internetModule: InternetModule
  @input @hint("Chime played with the notice card") chime: AudioTrackAsset
  @input @allowUndefined @hint("The dog's animated model (Assets/Models/Dog, Quaternius CC0); empty: the jointed primitives") dogModel: ObjectPrefab
  @input @allowUndefined @hint("Props that dress the airport and the mall (Assets/Models/Props, CC0), found by name") propModels: ObjectPrefab[]
  @input @allowUndefined @hint("The gate agent who talks to you (live captions, Assets/Models/People, CC0)") agentModel: ObjectPrefab
  @input @allowUndefined @hint("The shop assistant who talks to you (live captions, Assets/Models/People, CC0)") assistantModel: ObjectPrefab
  @input @allowUndefined @hint("The robot's animated model (Assets/Models/Robot, Quaternius CC0); empty: the jointed primitives") robotModel: ObjectPrefab
  @ui.group_end
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Which bundled map to start with (same list as src/core/data/index.json)")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Airport (demo)", "airport"),
    new ComboBoxItem("Hospital wing", "hospital"),
    new ComboBoxItem("Campus (two buildings)", "campus"),
    new ComboBoxItem("Preview room floor", "room"),
    new ComboBoxItem("Shopping mall (multi-stop)", "mall"),
  ]))
  mapKey: string = "airport"

  @input
  @hint("Try downloading the map (5 s timeout) before falling back to the built-in copy")
  tryOnlineMap: boolean = true

  @input
  @hint("Map server folder; each map downloads from here + its file name (map.json, hospital.json…). Default: public gist copy of src/core/data. Local: http://localhost:8787/ (npm run maps, needs https in the preview)")
  mapBaseUrl: string = "https://gist.githubusercontent.com/alexandergorokhov/ac59c2c8d02687651f256b320fff27b8/raw/"

  @input
  @hint("Standing eye height above the floor, cm — used when the floor can't be detected")
  @widget(new SliderWidget(100, 200, 1))
  eyeHeightCm: number = 180

  @input
  @hint("Lay the building out with you standing at the entrance sign, facing in (the line starts at your feet). Off: the old virtual sign at signOffset")
  startAtSign: boolean = true

  @input
  @hint("Show the demo controls (gate change, restart, map switch, play demo) — for recording; off for real use")
  showDemoControls: boolean = false

  @input("vec3", "{0,0,-250}")
  @hint("Where the 'you are here' sign stands relative to the user when a mode is chosen (right, -, forward), cm")
  signOffset: vec3 = new vec3(0, 0, -250)

  @input
  @hint("How much of the route the line shows ahead of the user, m")
  @widget(new SliderWidget(3, 30, 0.5))
  lineAheadM: number = 10

  @input
  @hint("Half the horizontal field of view, degrees — outside it the turn arrow shows")
  @widget(new SliderWidget(8, 40, 1))
  halfViewDeg: number = 16

  @input("vec3", "{8,-4,-100}")
  @hint("Mode panel offset from the head at start (right, up, forward), cm")
  modePanelOffset: vec3 = new vec3(8, -4, -100)

  @input
  @hint("The companion's model: same logic, only the look and the collectible change")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Dog (treats)", "dog"),
    new ComboBoxItem("Robot (bolts)", "robot"),
  ]))
  companionModel: string = "dog"

  @input
  @hint("Companion on when a trip starts (it can always be turned on or off on the app panel)")
  companionOnAtStart: boolean = false

  @input
  @hint("Showing preset (for the judges): overrides map, start at sign, demo controls, companion model and on at start; preselects Walk; adds Restart showing, Demo: gate change and an Airport/Preview room map switch to the Options panel")
  showingPreset: boolean = false

  @input
  @hint("Demo preset: pick one and reset the preview; the Lens opens ready for that demo (clean screen, no demo controls, at the entrance sign). Off: the settings here")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("Off (settings below)", "off"),
    new ComboBoxItem("1 Airport, wheelchair, Talk: gate 12C", "airportWheelchair"),
    new ComboBoxItem("2 Mall, follow the dog, Talk: food court", "mallPet"),
    new ComboBoxItem("3 Mall, Free walk with the robot", "freeWalkRobot"),
  ]))
  demo: string = "off"

  @input
  @hint("Clean screen while walking: only the floor line, the companion, the turn arrow and the offer boxes; no badges, hints, score, cards or demo controls; the arrival card for 3 s (on in the demo presets)")
  cleanScreen: boolean = false

  @input
  @hint("Live captions: speech around you as two rows at the bottom, translated into the language below (ASR on Specs; the preview shows a scripted announcement). On in the demo presets")
  liveCaptions: boolean = false

  @input
  @hint("Live captions are translated into this language")
  captionLanguage: string = "English"

  @input
  @hint("The saved preferences of the demo (category ids, comma separated)")
  presetPreferences: string = "coffee,clothes,hardware"

  @input
  @hint("How far ahead the companion walks, m (core COMPANION_LEAD_M = 7). The floor only enters the view from about 5.4 m")
  @widget(new SliderWidget(1.5, 10, 0.1))
  companionLeadM: number = 7

  @input
  @hint("Free walk: seconds the companion points at a matching shop")
  @widget(new SliderWidget(1, 8, 0.5))
  pointSeconds: number = 3

  @input
  @hint("Free walk: how near a matching shop must be for the companion to stop, m")
  @widget(new SliderWidget(2, 15, 0.5))
  pointRadiusM: number = 12

  @input
  @hint("Free walk: most stops per walk (0 = every match); stopping everywhere may get annoying")
  @widget(new SliderWidget(0, 30, 1))
  maxStopsPerWalk: number = 0

  @input
  @hint("Free walk: how far a shop front can be looked at from, m")
  @widget(new SliderWidget(3, 25, 0.5))
  lookRangeM: number = 12

  @input("vec3", "{24,0,-100}")
  @hint("The offer list, from the head (right, up, forward), cm")
  offerOffset: vec3 = new vec3(15, 0, -100)

  @input
  @hint("Multi-stop trip on maps that have these place ids (comma separated, ordered for the shortest walk); empty = off")
  multiStops: string = ""

  @input("vec3", "{-30,-38,-55}")
  @hint("App panel offset from the head (right, up, forward), cm — waist height, to the left")
  appPanelOffset: vec3 = new vec3(-30, -38, -55)

  @input("vec3", "{-34,-14,-55}")
  @hint("Where the app panel sits while playing Hop (cm from the head): to the side, clear of the lane")
  playPanelOffset: vec3 = new vec3(-34, -14, -55)

  @input("vec3", "{-15,-14,-80}")
  @hint("Demo controls offset from the head (right, up, forward), cm — low-left, inside the ~32° view")
  demoOffset: vec3 = new vec3(-15, -14, -80)
  @ui.group_end

  private phase: Phase = "scan"
  private mapIndex = 0
  private builtInText = ""
  private map: MapData
  private place: PlaceInfo
  private frame: MapFrame
  private mapSource: string | null = null
  private profile: Profile | null = null
  private nav: Navigator | null = null
  private closed: {[edgeId: string]: boolean} = {}
  private rides: {[id: string]: Ride} = {}
  // Building-local cm the traveller has been carried by rides (the building moves the other way).
  private rideOffset = new vec3(0, 0, 0)
  private placeBuilder: FindYourWayPlaceBuilder
  private propsView: FindYourWayPropsView | null = null
  private captions: FindYourWayLiveCaptions | null = null
  private speaker: FindYourWaySpeakerView | null = null
  // The conversation on arrival (preview): when the person speaks (0 = done, -1 = none yet).
  private talkAt = -1
  // The shop whose offers show in the card (looked at for 2 s).
  private offersShown: LookBoxes | null = null
  private playTime: FindYourWayPlayTime
  private freeView: FindYourWayFreeWalkView
  private panels: FindYourWayPanelFollow
  private onSlope = false
  private lastWalked: Vec3 | null = null
  private debugPose: {pos: Vec3; heading: number} | null = null
  private viewFollowsPose = false
  private pendingSwing = false
  private lastLineKey = ""
  private lineMapPoints: Vec3[] = []
  private lastHeading = 0
  private audio: AudioComponent
  private demoInit = false
  // The device-tracked camera settles a few frames after start; keep re-anchoring until then.
  private anchorFrames = 0
  // Eye height measured by a downward hit test against the real floor; null = use eyeHeightCm.
  private measuredEyeCm: number | null = null
  private hitSession: HitTestSession | null = null
  private hitRunning = false
  // The mini mall, on the panel's See map button (no pinch and pull needed).
  private mapShown = false
  // The world as it stood before Map builder, for Cancel.
  private beforeMapping: {pos: vec3; rot: quat; offset: vec3} | null = null
  private floorProbeFrames = 0
  // Test overrides (cleared on restart): text returned by the "download", the scanned sign id,
  // and the destination.
  private downloadOverride: string | null = null
  private startOverride: string | null = null
  private destinationOverride: string | null = null
  private stopsOverride: string | null = null
  // Trip state that survives the map (re)load at scan time: a destination change made before
  // the scan (closures are in `closed`). Cleared by restart.
  private tripDestination: string | null = null
  // Where the trip starts right after "Learn this place": the mapped point you stand at.
  private tripStart: string | null = null
  // Bumped by every restart, so a slow map download from an earlier trip is ignored.
  private tripGeneration = 0
  // World y of the head while standing, taken while the anchor settles after a restart; the
  // world is anchored at this height so sitting down or crouching later does not lower the floor.
  private standingEyeY: number | null = null
  private lastYaw = 0
  private downloadDelayMs = 0
  private cameraDropCm = 0
  // Companion, places, play, multi-stop. Views are created at runtime in onStart.
  private view: FindYourWayCompanionView | null = null
  private appPanel: FindYourWayAppPanelUI | null = null
  private placesUI: FindYourWayPlacesUI | null = null
  private companion: Companion = COMPANIONS.dog
  private guide = new PetGuide()
  private coach: PointingCoach | null = null
  private placesMuted = false
  private pointed: {place: Place; until: number} | null = null
  private travelled = 0
  private lastFeet: Vec3 | null = null
  private trip: TripAhead | null = null
  private voice = new FindYourWayVoice()
  private voiceTry = 0
  private tourIds: string[] | null = null
  private tourPending = false
  private pickMap: FindYourWayPickMapUI | null = null
  private stops: MultiStopTrip | null = null
  private ptsCache: {key: string; map: MapData; pts: Vec3[]} | null = null
  // The companion's own copy of the route: stopped just outside a shop door (it never walks in).
  private petPtsCache: {pts: Vec3[]; out: Vec3[]} | null = null
  // The Options panel folds to a small tab once a trip or walk starts.
  private dock = new OptionsDock()
  // Looking at a shop on a guided trip: its button and short card (Free walk has its own).
  private shopLook: {map: MapData; look: ShopLook} | null = null
  // The two small offer boxes at a shop you look at, and the shops whose boxes you closed.
  private offerBoxes: FindYourWayOfferBoxesUI | null = null
  private offerClosed = new OfferDismissals()
  private boxesTitle: string | null = null
  private mappingPanelPlaced = false
  // "Gate C3 is on C pier, 1 floor up": shown in the cue slot for DEST_NOTE_S after the scan or a
  // destination change (null = work it out on the next frame).
  private destNote: string | null = null
  private destNoteUntil = 0
  // Learn this place.
  private builder: FindYourWayMapBuilder
  private mappingPanel: FindYourWayMappingPanelUI | null = null
  private mappedText: string | null = null
  // The three modes, Free walk and Go to a place. Views are created at runtime in onStart.
  private homePanel: FindYourWayHomePanelUI | null = null
  private prefsPanel: FindYourWayPrefsUI | null = null
  private offerUI: FindYourWayOfferUI | null = null
  private bubble: FindYourWayBubbleUI | null = null
  private whereTo: FindYourWayWhereToUI | null = null
  private free: FreeWalk | null = null
  // The floor arrow: shown once the companion has been out of view for ~2 s.
  private outOfView = new OutOfViewTimer()
  private floorArrowOn = false
  private freeCompanion = true
  // What a Free walk hands on to a trip started from it: its companion and its preferences.
  private fromWalk: {companion: boolean; prefs: string[]} | null = null
  // Peek ahead.
  private peekView: FindYourWayPeekView | null = null
  private peekPinch: {[hand: string]: number | null} = {left: null, right: null}
  private peekOn = false
  private peekForced = false
  private peekBuiltAt = -1
  // The LEAF scenarios and the autoplay demo show the demo controls even when they're off.
  private demoControlsForced = false
  // The Inspector's own start settings (before the showing preset overrides them).
  private authored: StartSettings | null = null
  private preselect: string | null = null
  // The demo preset in use (null: off), and whether it still has to scan and open its mode.
  private demoSet: DemoSettings | null = null
  private demoAutoPending = false
  private authoredEyeCm = 180
  private authoredOnline = true
  private arrivedAt = 0
  // Talk: whether anything was heard, and the preview fallback typing the demo phrase in.
  private heardAny = false
  private typing: {phrase: string; t0: number} | null = null
  // Stops planned from a sentence ("coffee and a bathroom before my flight"): they follow on by themselves.
  private askTrip = false

  onAwake() {
    try {
      const store = global.persistentStorageSystem.store
      if (store.has(MAPPED_KEY)) this.mappedText = store.getString(MAPPED_KEY)
    } catch (e) {
      print("[FYW] no persistent storage: " + e)
    }
    this.applyShowing()
    const idx = MAP_SOURCES.map((m) => m.key).indexOf(this.mapKey)
    this.mapIndex = idx >= 0 ? idx : 0
    this.loadBuiltIn()
    this.audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    if (this.chime) this.audio.audioTrack = this.chime
    try { this.audio.playbackMode = Audio.PlaybackMode.LowLatency } catch (e) { /* editor */ }
    try {
      const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
      this.hitSession = wq.createHitTestSession()
      this.setFloorProbe(true)
    } catch (e) {
      print("[FYW] world query unavailable, using eyeHeightCm")
    }
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // Depth runs for as long as a session does, so only while the floor is being found.
  private setFloorProbe(on: boolean): void {
    if (!this.hitSession || this.hitRunning === on) return
    this.hitRunning = on
    if (on) this.hitSession.start()
    else this.hitSession.stop()
  }

  private onStart(): void {
    const missing = ["camera", "world", "building", "routeLine", "standIn", "turnArrow", "modePanel",
      "buildingUI", "demoControls", "hud", "arrivalCard"].filter((k) => !(this as any)[k])
    if (missing.length > 0) {
      print("[FYW] ERROR missing inputs: " + missing.join(", "))
      return
    }
    this.modePanel.onWalk.add(() => this.chooseMode("walk"))
    this.modePanel.onStepFree.add(() => this.chooseMode("stepFree"))
    this.modePanel.onSayIt.add(() => this.sayIt())
    this.modePanel.onTalk.add(() => this.talk())
    this.modePanel.onWhereTo.add(() => this.openWhereTo())
    this.buildingUI.onScan.add(() => this.scanSign())
    this.buildingUI.onClosure.add((id) => this.closeConnection(id))
    this.buildingUI.onRide.add((id) => this.ride(id))
    this.demoControls.onEvent.add(() => this.changeDestination())
    this.demoControls.onRestart.add(() => this.restart())
    this.demoControls.onNextMap.add(() => this.nextMap())
    this.createViews()
    this.restart()
  }

  // The companion view and place icons live in the building (building-local cm); the app panel
  // follows the head at waist height. Built at runtime, so the scene needs no new objects.
  private createViews(): void {
    const self = this
    this.panels = new FindYourWayPanelFollow({
      camera: this.camera,
      modePanelOffset: this.modePanelOffset,
      headYaw: () => this.headYaw(),
    })
    this.placeBuilder = new FindYourWayPlaceBuilder({
      get map() { return self.map },
      get place() { return self.place },
      standIn: this.standIn,
      buildingUI: this.buildingUI,
      demoControls: this.demoControls,
      arrivalCard: this.arrivalCard,
      routeLine: this.routeLine,
      turnArrow: this.turnArrow,
      get placesUI() { return self.placesUI },
      startAtSign: this.startAtSign,
      local: (p, liftCm) => this.local(p, liftCm),
      eye: () => this.eye(),
      firstEvent: (type) => this.firstEvent(type),
      iconOfNode: (id) => this.iconOfNode(id),
    })
    this.playTime = new FindYourWayPlayTime({
      camera: this.camera,
      building: this.building,
      get map() { return self.map },
      get nav() { return self.nav },
      get trip() { return self.trip },
      get guide() { return self.guide },
      get companion() { return self.companion },
      get view() { return self.view },
      get appPanel() { return self.appPanel },
      hud: this.hud,
      userPos: () => this.userPos(),
      userHeading: () => this.userHeading(),
      local: (p, liftCm) => this.local(p, liftCm),
      eye: () => this.eye(),
      cameraPos: () => this.cameraPos(),
      headYaw: () => this.headYaw(),
      cardShowing: () => this.cardShowing(),
      playChime: () => this.playChime(),
      testDropM: () => (this.debugPose ? this.cameraDropCm / 100 : 0),
    })
    this.freeView = new FindYourWayFreeWalkView({
      camera: this.camera,
      get place() { return self.place },
      hud: this.hud,
      turnArrow: this.turnArrow,
      get offerUI() { return self.offerUI },
      get view() { return self.view },
      get bubble() { return self.bubble },
      panels: this.panels,
      offerOffset: this.offerOffset,
      showBoxes: (b: LookBoxes | null) => this.showBoxes(b),
      clean: () => this.cleanScreen,
      halfViewDeg: this.halfViewDeg,
      userPos: () => this.userPos(),
      userHeading: () => this.userHeading(),
      local: (p, liftCm) => this.local(p, liftCm),
      playChime: () => this.playChime(),
    })
    const v = global.scene.createSceneObject("CompanionView")
    v.setParent(this.building)
    this.view = v.createComponent(FindYourWayCompanionView.getTypeName()) as FindYourWayCompanionView
    this.view.setup(this.standIn.material)
    this.view.setPrefabs({dog: this.dogModel || null, robot: this.robotModel || null})
    this.captions = new FindYourWayLiveCaptions(this.hud, this.captionLanguage)
    const sp = global.scene.createSceneObject("Speaker")
    sp.setParent(this.building)
    this.speaker = sp.createComponent(FindYourWaySpeakerView.getTypeName()) as FindYourWaySpeakerView
    this.speaker.setup({agent: this.agentModel || null, assistant: this.assistantModel || null}, this.standIn.material)
    const pv = global.scene.createSceneObject("PropsView")
    pv.setParent(this.building)
    this.propsView = pv.createComponent(FindYourWayPropsView.getTypeName()) as FindYourWayPropsView
    this.propsView.setup(this.propModels || [])
    const pl = global.scene.createSceneObject("PlaceIcons")
    pl.setParent(this.building)
    this.placesUI = pl.createComponent(FindYourWayPlacesUI.getTypeName()) as FindYourWayPlacesUI
    this.placesUI.setup((id) => this.goHere(id))
    const ap = global.scene.createSceneObject("AppPanel")
    this.appPanel = ap.createComponent(FindYourWayAppPanelUI.getTypeName()) as FindYourWayAppPanelUI
    this.appPanel.setup({
      onCompanion: () => this.setCompanionOn(!this.guide.on),
      onModel: () => this.setCompanionModel(COMPANION_IDS[(COMPANION_IDS.indexOf(this.companion.id) + 1) % COMPANION_IDS.length]),
      onPlaces: () => this.setPlacesMuted(!this.placesMuted),
      onPlay: () => this.playTime.toggle(),
      onJump: () => this.playTime.jump(),
      onThrow: () => this.playTime.throwTreat(),
      onNextStop: () => this.nextStop(),
      onEndWalk: () => this.endTrip(),
      onToggleOptions: () => {
        this.dock.toggle()
        if (this.appPanel) this.appPanel.setCollapsed(this.dock.isCollapsed())
      },
      onMap: () => this.setMapShown(!this.mapShown),
      onRestartShowing: () => this.restartShowing(),
      onShowingMap: () => this.nextMap(),
      onShowingGate: () => this.changeDestination(),
    })
    if (global.deviceInfoSystem.isEditor()) this.appPanel.setBaseScale(PREVIEW_PANEL_SCALE)
    this.setCompanionModel(this.companionModel)
    const mp = global.scene.createSceneObject("MappingPanel")
    this.mappingPanel = mp.createComponent(FindYourWayMappingPanelUI.getTypeName()) as FindYourWayMappingPanelUI
    this.mappingPanel.setup({
      onMarkShop: () => this.builder.markShop(),
      onConfirmFloor: () => this.builder.confirmFloor(),
      onTag: (k) => this.builder.confirmFloor(k),
      onNextFloor: () => this.builder.nextFloor(),
      onUndo: () => this.builder.undo(),
      onSeeMap: () => this.builder.toggleSeeMap(),
      onUpload: () => this.saveMapping(),
      onCancel: () => this.endMapping(true),
    })
    this.mappingPanel.show(false)
    const pk = global.scene.createSceneObject("PeekAhead")
    this.peekView = pk.createComponent(FindYourWayPeekView.getTypeName()) as FindYourWayPeekView
    const main = this
    this.builder = new FindYourWayMapBuilder({
      get panel() { return main.mappingPanel },
      get peek() { return main.peekView },
      userPos: () => this.userPos(),
      userHeading: () => this.userHeading(),
      showPins: (spots) => { if (this.view) this.view.setPins(spots.map((p) => this.local(p))) },
      placeMapModel: () => this.placeMapModel(),
    })
    this.peekView.setup(this.standIn.material)
    const hp = global.scene.createSceneObject("HomePanel")
    this.homePanel = hp.createComponent(FindYourWayHomePanelUI.getTypeName()) as FindYourWayHomePanelUI
    this.homePanel.setup({
      onFreeWalk: () => this.chooseFreeWalk(),
      onTour: () => this.chooseTour(),
      onGoTo: () => this.chooseGoTo(),
      onBuilder: () => this.startMapping(),
    })
    const pp = global.scene.createSceneObject("PrefsPanel")
    this.prefsPanel = pp.createComponent(FindYourWayPrefsUI.getTypeName()) as FindYourWayPrefsUI
    this.prefsPanel.setup({
      onStart: () => this.startFreeWalk(),
      onCompanion: () => {
        this.freeCompanion = !this.freeCompanion
        if (this.prefsPanel) this.prefsPanel.setCompanion(this.companion.name, this.freeCompanion)
      },
      // Picking one means you want it: a companion that stays off would change nothing you can see.
      onPickModel: (id) => {
        this.freeCompanion = true
        this.setCompanionModel(id)
      },
    })
    const ou = global.scene.createSceneObject("OfferUI")
    this.offerUI = ou.createComponent(FindYourWayOfferUI.getTypeName()) as FindYourWayOfferUI
    this.offerUI.setup(() => this.openDot(), () => { if (this.free) this.free.closeList() })
    const ob = global.scene.createSceneObject("OfferBoxes")
    ob.setParent(this.building)
    this.offerBoxes = ob.createComponent(FindYourWayOfferBoxesUI.getTypeName()) as FindYourWayOfferBoxesUI
    this.offerBoxes.setup((id) => {
      this.offerClosed.dismiss(id)
      this.showBoxes(null)
    })
    const bu = global.scene.createSceneObject("CompanionBubble")
    bu.setParent(this.building)
    this.bubble = bu.createComponent(FindYourWayBubbleUI.getTypeName()) as FindYourWayBubbleUI
    this.bubble.setup()
    const wt = global.scene.createSceneObject("WhereToPanel")
    this.whereTo = wt.createComponent(FindYourWayWhereToUI.getTypeName()) as FindYourWayWhereToUI
    this.whereTo.setup((id) => this.pickDestination(id), () => this.closeWhereTo(), () => this.openPickMap())
    const pm = global.scene.createSceneObject("PickMapPanel")
    this.pickMap = pm.createComponent(FindYourWayPickMapUI.getTypeName()) as FindYourWayPickMapUI
    this.pickMap.setup((id) => this.pickDestination(id), () => this.closeWhereTo())
    if (this.view) this.view.onGrab(() => this.playTime.grabStarted(), () => this.playTime.grabEnded())
  }

  // ── The three modes ──────────────────────────────────────────────────────


  private enterChoose(): void {
    this.phase = "choose"
    this.modePanel.hide()
    this.demoControls.setStatus("Choose what to do")
    if (!this.homePanel) return
    this.panels.placeAhead(this.homePanel.getSceneObject())
    this.homePanel.show(true)
    if (this.demoAutoPending && this.demoSet) {
      this.demoAutoPending = false
      if (this.demoSet.open === "freeWalk") this.chooseFreeWalk()
      else this.chooseGoTo()
    }
  }

  // Go to a place: say where to, then Walk or Step-Free (today's flow).
  private chooseGoTo(): void {
    if (this.phase !== "choose") return
    if (this.homePanel) this.homePanel.show(false)
    this.phase = "mode"
    this.placeModePanel()
    this.modePanel.setSayItPhrase(sayItPhrase(this.map))
    this.modePanel.setDestination(nodeLabel(this.map, this.tripDestination || this.place.destination))
    this.modePanel.setPreselected(this.showingPreset || this.demoSet ? this.preselect : null)
    this.modePanel.setSayItShown(!this.demoSet)
    this.modePanel.setSimple(!!this.demoSet)
    if (this.demoSet) this.modePanel.setNote("e.g. \"" + sayItPhrase(this.map) + "\"")
    this.modePanel.setTalkHint(global.deviceInfoSystem.isEditor() ? PREVIEW_TALK_HINT : null)
    this.modePanel.show()
  }

  // The real plain-code matcher on the preset phrase. On Specs the phrase comes from ASR.
  private sayIt(): void {
    if (this.phase !== "mode") return
    const phrase = sayItPhrase(this.map)
    const id = matchDestination(this.map, phrase)
    if (!id) {
      this.modePanel.setDestination("didn't catch that: try Where to?")
      return
    }
    print("[FYW] said: " + phrase + " -> " + id)
    this.pickDestination(id)
  }

  // Talk: the same matcher on what you really said (Snap's ASR module).
  private talk(): void {
    if (this.phase !== "mode") return
    if (this.voice.listening) {
      this.voice.stop()
      this.modePanel.setNote("Say it, or try Where to?")
      return
    }
    this.modePanel.setNote("Listening…")
    this.heardAny = false
    this.typing = null
    this.voice.start((text, final) => this.heard(text, final), (why) => {
      print("[FYW] voice: " + why)
      this.modePanel.setNote("didn't catch that: try Where to?")
    })
    print("[FYW] voice: " + (this.voice.listening ? "listening" : "not available"))
    const attempt = ++this.voiceTry
    // The preview fallback: nothing heard within VOICE_FALLBACK_S, the map's demo phrase types itself
    // in ("Heard: Take me to gate 12C"), then the real matcher and router take over. On Specs live
    // ASR answers first and this never runs.
    const fb = this.createEvent("DelayedCallbackEvent")
    fb.bind(() => {
      this.removeEvent(fb)
      if (attempt !== this.voiceTry || this.heardAny || this.phase !== "mode") return
      const phrase = sayItPhrase(this.map)
      if (!phrase) return
      this.voice.stop()
      this.typing = {phrase, t0: getTime()}
      print("[FYW] voice: preview fallback, typing the demo phrase")
    })
    fb.reset(VOICE_FALLBACK_S)
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      this.removeEvent(ev)
      if (attempt !== this.voiceTry || !this.voice.listening || this.typing) return
      this.voice.stop()
      this.modePanel.setNote("didn't catch that: try Where to?")
    })
    ev.reset(VOICE_TIMEOUT_S)
  }

  private heard(text: string, final: boolean): void {
    if (this.phase !== "mode") return
    if (text) this.heardAny = true
    if (!final) {
      this.modePanel.setNote("Heard: " + text)
      return
    }
    this.voice.stop()
    const plan = this.planSentence(text)
    if (plan.length >= 2) {
      print("[FYW] heard: " + text.length + " characters -> " + plan.join(" > ")) // never what was said
      this.tourIds = plan
      this.askTrip = true
      this.tripDestination = null
      this.modePanel.setNote("Heard: " + text + "\n→ " + plan.map((x) => nodeLabel(this.map, x)).join(" → "))
      this.goOnAfterHeard()
      return
    }
    const id = plan.length === 1 ? plan[0] : matchDestination(this.map, text)
    print("[FYW] heard: " + text.length + " characters -> " + id) // never what was said
    if (id) {
      this.pickDestination(id)
      if (this.demoSet) this.modePanel.setNote("Heard: " + text + "  →  " + nodeLabel(this.map, id))
      this.goOnAfterHeard()
    } else this.modePanel.setNote("didn't catch that: try Where to?")
  }

  // A demo preset goes on with its mode by itself once you have read what was heard: one Talk, and
  // the companion leads.
  private goOnAfterHeard(): void {
    if (!this.demoSet || !this.preselect) return
    const attempt = this.voiceTry
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      this.removeEvent(ev)
      if (attempt === this.voiceTry && this.phase === "mode") this.chooseMode(this.preselect as Profile)
    })
    ev.reset(HEARD_READ_S)
  }

  // Live captions in the preview: on arrival someone (the gate agent, the food court host) stands in
  // front of you, facing you, and speaks; the captions show it and its translation. On Specs the
  // captions come from real speech around you and nobody is placed.
  private startConversation(pos: Vec3): void {
    if (!this.liveCaptions || !global.deviceInfoSystem.isEditor() || !this.speaker || this.talkAt !== -1) return
    const key = this.getMapKey()
    if (key !== "airport" && key !== "mall") return
    const h = (this.userHeading() * Math.PI) / 180
    const fwd = {x: Math.sin(h), z: Math.cos(h)}, side = {x: Math.cos(h), z: -Math.sin(h)}
    const map = this.nav ? this.nav.map : this.map
    let spot: Vec3 | null = null
    for (const [f, s] of [[1.9, 0.5], [1.9, -0.5], [1.6, 0.9], [1.6, -0.9], [2.4, 0], [1.4, 0]]) {
      const p = {x: pos.x + fwd.x * f + side.x * s, y: pos.y, z: pos.z + fwd.z * f + side.z * s}
      if (isClear(map as any, p)) { spot = p; break }
    }
    if (!spot) spot = {x: pos.x + fwd.x * 1.9, y: pos.y, z: pos.z + fwd.z * 1.9}
    const face = (Math.atan2(pos.x - spot.x, pos.z - spot.z) * 180) / Math.PI
    this.speaker.show(key === "airport" ? "agent" : "assistant", this.local(spot), face)
    this.talkAt = getTime() + CAPTION_DEMO_AFTER_S
  }

  // The stops for a sentence: the needs in it, the places that make the shortest trip from here
  // (Step-Free when it is the chosen or preselected mode), the gate last.
  private planSentence(text: string): string[] {
    const profile: Profile = (this.profile || this.preselect || "walk") as Profile
    const start = this.startOverride || this.tripStart || this.place.start
    return planAsk(this.map, text, start, profile === "stepFree", (a, b) => {
      const r = new Navigator(this.map, a, b, profile).route
      return r.status === "route" ? r.length : r.status === "arrived" ? 0 : Infinity
    })
  }

  // One frame of the preview fallback: the phrase appears word by word, then it is "heard".
  private tickTyping(): void {
    if (!this.typing) return
    if (this.phase !== "mode") {
      this.typing = null
      return
    }
    const t = getTime() - this.typing.t0
    const secs = typingSeconds(this.typing.phrase)
    const shown = typedSoFar(this.typing.phrase, t, secs)
    this.modePanel.setNote("Heard: " + shown + (shown === this.typing.phrase ? "" : "…"))
    if (t < secs + TYPED_HOLD_S) return
    const phrase = this.typing.phrase
    this.typing = null
    this.heard(phrase, true)
  }

  private openWhereTo(): void {
    if (this.phase !== "mode" || !this.whereTo) return
    this.modePanel.hide()
    this.panels.placeAhead(this.whereTo.getSceneObject())
    this.whereTo.open(destinationsOf(this.map))
  }

  // The no-voice way, as a map: the places where they are, on the floor you're on.
  private openPickMap(): void {
    if (this.phase !== "mode" || !this.pickMap) return
    if (this.whereTo) this.whereTo.show(false)
    this.panels.placeAhead(this.pickMap.getSceneObject())
    this.pickMap.open(this.map, this.userPos().y)
  }

  private closeWhereTo(): void {
    if (this.whereTo) this.whereTo.show(false)
    if (this.pickMap) this.pickMap.show(false)
    if (this.phase === "mode") this.modePanel.show()
  }

  private pickDestination(id: string): void {
    this.tripDestination = id
    this.modePanel.setDestination(nodeLabel(this.map, id))
    this.closeWhereTo()
  }

  // ── Free walk ────────────────────────────────────────────────────────────

  private presetList(): string[] {
    const known = interestList(this.map).map((i) => i.id)
    return this.presetPreferences.split(",").map((x) => x.trim()).filter((x) => known.indexOf(x) >= 0)
  }

  private chooseFreeWalk(): void {
    if (this.phase !== "choose" || !this.prefsPanel) return
    if (this.homePanel) this.homePanel.show(false)
    this.phase = "prefs"
    this.tourPending = false
    this.panels.placeAhead(this.prefsPanel.getSceneObject())
    this.prefsPanel.open(interestList(this.map), this.presetList(), this.companion.name, this.freeCompanion, this.companion.id)
  }

  // Tour: the same preferences, then the shops they match, stop by stop.
  private chooseTour(): void {
    if (this.phase !== "choose" || !this.prefsPanel) return
    if (this.homePanel) this.homePanel.show(false)
    this.phase = "prefs"
    this.tourPending = true
    this.panels.placeAhead(this.prefsPanel.getSceneObject())
    this.prefsPanel.open(interestList(this.map), this.presetList(), this.companion.name, this.freeCompanion, this.companion.id)
  }

  private startTour(): void {
    if (!this.prefsPanel) return
    this.tourPending = false
    this.prefsPanel.show(false)
    this.profile = "walk"
    const startId = this.startOverride || this.tripStart || this.place.start
    const ids = tourStops(this.map, startId, this.prefsPanel.getPicked(), this.stopDistance(), orderStops)
    if (ids.length === 0) {
      this.hud.showCard("No shops here match your preferences", "info")
      this.enterChoose()
      return
    }
    this.tourIds = ids
    print("[FYW] tour: " + ids.join(" > "))
    this.beginTrip()
    this.setCompanionOn(this.freeCompanion)
  }

  private startFreeWalk(): void {
    if (this.phase !== "prefs" || !this.prefsPanel) return
    if (this.tourPending) {
      this.startTour()
      return
    }
    this.prefsPanel.show(false)
    this.free = new FreeWalk(this.map, this.prefsPanel.getPicked(), {
      aheadM: this.companionLeadM,
      pointSeconds: this.pointSeconds,
      pointRadiusM: this.pointRadiusM,
      maxStops: this.maxStopsPerWalk,
      lookRangeM: this.lookRangeM,
      dotShowSeconds: OFFER_LOOK_S,
      ...(this.cleanScreen ? CLEAN_FREE_WALK : {}),
    })
    this.free.keepInView = (spot, user, look) => this.keepInView(spot, user, look)
    this.phase = "free"
    this.freeView.reset()
    this.setCompanionOn(this.freeCompanion)
    if (this.appPanel) this.appPanel.setFreeWalk(true)
    this.demoControls.setStatus("Free walk")
    print("[FYW] free walk: " + this.free.prefs.join(", "))
  }

  private clearFreeWalk(): void {
    this.free = null
    this.freeView.reset()
    if (this.offerUI) {
      this.offerUI.showDot(false)
      this.offerUI.showList(null)
    }
    if (this.bubble) this.bubble.show(null, null)
    if (this.appPanel) this.appPanel.setFreeWalk(false)
    if (this.view) this.view.setPointing(false)
  }

  // Back to the three modes, on the same map, from where you stand.
  private endFreeWalk(): void {
    if (this.phase !== "free") return
    if (this.free) this.fromWalk = {companion: this.guide.on, prefs: this.free.prefs}
    this.setCompanionOn(false)
    this.setMapShown(false)
    this.clearFreeWalk()
    this.hud.setPill(null)
    this.turnArrow.hide()
    this.tripStart = nearestNode(this.map, this.userPos()).id
    this.enterChoose()
  }

  // The panel's End button. Without demo controls it is the only way out of a trip.
  endTrip(): void {
    if (this.phase === "free") {
      this.endFreeWalk()
      return
    }
    if (this.phase !== "nav" && this.phase !== "arrived") return
    this.setCompanionOn(false)
    this.setMapShown(false)
    this.tripStart = nearestNode(this.map, this.userPos()).id
    this.tripDestination = null
    this.destinationOverride = null
    this.endStops()
    this.tourIds = null
    this.askTrip = false
    this.nav = null
    this.profile = null
    this.coach = null
    this.lastLineKey = ""
    this.lineMapPoints = []
    this.resetGuide()
    this.arrivalCard.hide()
    this.routeLine.clear()
    this.turnArrow.hide()
    this.hud.hideCard()
    this.hud.setPill(null)
    this.hud.setCue(null)
    this.hud.setScore(null)
    this.hud.setPlayLine(null)
    this.enterChoose()
    print("[FYW] trip ended")
  }

  private openDot(): void {
    if (this.free) this.free.openDot(this.userPos())
  }


  // ── Map builder ──────────────────────────────────────────────────────────

  // Starts mapping where you stand: that spot is the entrance sign (the first point). Nothing else
  // to set up: the walk records itself.
  startMapping(): void {
    if (this.phase !== "choose") return
    if (this.homePanel) this.homePanel.show(false)
    const world = this.world.getTransform()
    this.beforeMapping = {pos: world.getWorldPosition(), rot: world.getWorldRotation(), offset: this.rideOffset}
    this.anchorFrames = 0
    this.anchorWorld()
    this.phase = "mapping"
    this.mappingPanelPlaced = false
    // On Specs the old building would only be in the way of the real place. In the preview it is
    // the place: its shops are what you look at and mark.
    if (!this.standIn.isSolid()) this.standIn.clear()
    this.buildingUI.clear()
    if (this.placesUI) this.placesUI.clear()
    this.builder.start()
    print("[FYW] mapping: start")
  }

  // "See my map" sits low on the right, in the mall's frame.
  private placeMapModel(): void {
    if (!this.peekView) return
    const t = this.camera.getTransform()
    const so = this.peekView.getSceneObject().getTransform()
    so.setWorldPosition(t.getWorldPosition().add(this.headYaw().multiplyVec3(new vec3(26, -20, -PEEK_AHEAD_CM - 15))))
    so.setWorldRotation(this.building.getTransform().getWorldRotation())
  }

  // Upload: a Lens must not hold a git token, so the map goes to the log between markers, where
  // the laptop's map:publish reads it. It is also kept on the device and a walking mode routes on
  // it at once: back to the three modes with "My place" loaded.
  saveMapping(): boolean {
    const done = this.builder.finish((t) => {
      const parsed = parseMap(t)
      return parsed.ok ? null : (parsed as {ok: false; error: string}).error
    })
    if (!done) return false
    const m = done.map, text = done.text
    for (const line of mapLogLines(text, MAPPED_KEY_NAME)) print(line)
    try {
      global.persistentStorageSystem.store.putString(MAPPED_KEY, text)
    } catch (e) {
      print("[FYW] could not save the map: " + e)
    }
    this.mappedText = text
    // Keep the world where the walk was mapped: the new map's origin is its sign (where mapping
    // started), so shift the building by that point and stand the traveller where they are now.
    const signAt = this.local(m.nodes[0])
    const lifted = this.builder.getFloorOffset() // "Next floor" height the tracking never saw
    const worldPos = this.world.getTransform().getWorldPosition()
    const worldRot = this.world.getTransform().getWorldRotation()
    const offset = this.rideOffset.sub(signAt).add(new vec3(0, lifted * 100, 0))
    const feet = this.userPos()
    const here = {x: feet.x, y: feet.y + lifted, z: feet.z}
    this.endMapping(false)
    this.mapIndex = MAP_SOURCES.length
    this.restart()
    this.anchorFrames = 0
    this.world.getTransform().setWorldPosition(worldPos)
    this.world.getTransform().setWorldRotation(worldRot)
    this.rideOffset = offset
    this.placeBuilding()
    const trip = tripAfterSaving(m, here)
    this.tripStart = trip.start
    this.tripDestination = trip.destination
    this.buildingUI.setScanSignVisible(false)
    this.mapSource = "device"
    this.enterChoose()
    print("[FYW] mapping: saved " + m.nodes.length + " points, " + m.edges.length + " stretches")
    return true
  }

  private endMapping(backToChoose: boolean): void {
    this.builder.end()
    if (this.phase === "mapping" && backToChoose) {
      // Cancel puts the place back exactly where it stood: mapping re-anchored it to your feet.
      if (this.beforeMapping) {
        this.world.getTransform().setWorldPosition(this.beforeMapping.pos)
        this.world.getTransform().setWorldRotation(this.beforeMapping.rot)
        this.rideOffset = this.beforeMapping.offset
        this.placeBuilding()
      }
      this.buildPlace()
      this.buildingUI.setScanSignVisible(false)
      this.enterChoose()
    }
  }

  // ── Peek ahead ───────────────────────────────────────────────────────────

  private setMapShown(on: boolean): void {
    this.mapShown = on
    if (this.appPanel) this.appPanel.setMapShown(on)
  }

  // Pinch and pull toward you, or See map: the mini mall shows. Never changes the route.
  private updatePeek(): void {
    if (!this.peekView) return
    if (this.builder.isSeeingMap()) return
    const navOn = ((this.phase === "nav" || this.phase === "arrived") && !!this.nav) || this.phase === "free"
    let pulled = this.mapShown
    try {
      const head = this.cameraPos()
      for (const side of ["left", "right"]) {
        const hand = SIK.HandInputData.getHand(side as "left" | "right")
        if (!hand || !hand.isTracked() || !hand.isPinching()) {
          this.peekPinch[side] = null
          continue
        }
        const d = hand.thumbTip.position.distance(head)
        const start = this.peekPinch[side]
        if (start === null) this.peekPinch[side] = d
        else if (start - d >= PEEK_PULL_CM) pulled = true
        else if (this.peekOn) pulled = true
      }
    } catch (e) {
      // No hand tracking: only the test hook.
    }
    const want = navOn && (pulled || this.peekForced)
    const now = getTime()
    if (want && (!this.peekOn || now - this.peekBuiltAt > 0.5)) {
      this.peekView.showPlace(peekPlace(this.nav ? this.nav.map : this.map, this.routeMapPoints(), this.userPos(),
        this.mapShown ? {size: SEE_MAP_SIZE_M, gap: SEE_MAP_FLOOR_GAP_M} : undefined))
      this.peekBuiltAt = now
    } else if (!want && this.peekOn) this.peekView.showPlace(null)
    this.peekOn = want
    if (want) {
      const t = this.camera.getTransform()
      const yaw = this.headYaw()
      const so = this.peekView.getSceneObject().getTransform()
      const spot = this.mapShown ? new vec3(SEE_MAP_RIGHT_CM, -SEE_MAP_BELOW_CM, -SEE_MAP_AHEAD_CM) : new vec3(0, -PEEK_BELOW_CM, -PEEK_AHEAD_CM)
      so.setWorldPosition(t.getWorldPosition().add(yaw.multiplyVec3(spot)))
      // Map north points where the building's north points.
      so.setWorldRotation(this.building.getTransform().getWorldRotation())
    }
  }

  // ── Trip flow ────────────────────────────────────────────────────────────

  private loadBuiltIn(): void {
    const src = this.source()
    this.builtInText = src ? src.asset.getString() : this.mappedText || ""
    const parsed = parseMap(this.builtInText)
    if (!parsed.ok) {
      print("[FYW] ERROR built-in map " + this.getMapKey() + " is invalid")
      if (!src) {
        this.mapIndex = 0
        this.loadBuiltIn()
      }
      return
    }
    this.setMap(parsed.map)
  }

  private setMap(map: MapData): void {
    this.map = map
    this.place = placeOf(map)
    this.frame = MapFrame.forMap(map, this.place.start)
  }

  // The bundled map in use, or null for the map saved by "Learn this place".
  private source(): typeof MAP_SOURCES[0] | null {
    return this.mapIndex < MAP_SOURCES.length ? MAP_SOURCES[this.mapIndex] : null
  }

  restart(): void {
    this.endMapping(false)
    this.clearFreeWalk()
    this.setMapShown(false)
    this.freeCompanion = true
    this.fromWalk = null
    this.loadBuiltIn()
    this.phase = "scan"
    this.profile = null
    this.nav = null
    this.closed = {}
    this.rideOffset = new vec3(0, 0, 0)
    this.onSlope = false
    this.mapSource = null
    this.debugPose = null
    this.viewFollowsPose = false
    this.tripGeneration++
    this.tripDestination = null
    this.tripStart = null
    this.tourIds = null
    this.tourPending = false
    this.voice.stop()
    this.typing = null
    this.askTrip = false
    this.demoAutoPending = !!this.demoSet
    if (this.pickMap) this.pickMap.show(false)
    this.standingEyeY = null
    this.downloadOverride = null
    this.downloadDelayMs = 0
    this.cameraDropCm = 0
    this.startOverride = null
    this.destinationOverride = null
    this.lastLineKey = ""
    this.lineMapPoints = []
    this.resetGuide()
    this.anchorFrames = ANCHOR_SETTLE_FRAMES
    this.floorProbeFrames = 120
    this.setFloorProbe(true)
    this.anchorWorld(true)
    this.buildPlace()
    this.hud.hideCard()
    this.hud.setBadge(null)
    this.hud.setPill(null)
    this.hud.setCue(null)
    this.hud.setScore(null)
    this.hud.setPlayLine(null)
    this.demoControls.setStatus("Scan the sign to start")
    this.modePanel.hide()
    if (this.homePanel) this.homePanel.show(false)
    if (this.prefsPanel) this.prefsPanel.show(false)
    if (this.whereTo) this.whereTo.show(false)
    if (this.turnArrow) this.turnArrow.hide()
    this.buildingUI.setScanSignVisible(true)
    print("[FYW] restart: map=" + this.getMapKey())
  }

  private nextMap(): void {
    this.mapIndex = this.nextMapIndex()
    this.restart()
  }

  // The saved map (Learn this place) comes after the bundled ones. Under the showing preset the
  // switch goes between the airport and the preview room (for Learn this place), one press each way.
  private nextMapIndex(): number {
    if (this.showingPreset) {
      const keys = MAP_SOURCES.map((m) => m.key)
      return this.getMapKey() === "airport" ? keys.indexOf("room") : keys.indexOf("airport")
    }
    return (this.mapIndex + 1) % (MAP_SOURCES.length + (this.mappedText ? 1 : 0))
  }

  // The showing preset over the Inspector's settings (or the Inspector's own when it is off).
  private applyShowing(): void {
    if (!this.authored) {
      this.authoredEyeCm = this.eyeHeightCm
      this.authoredOnline = this.tryOnlineMap
      this.authored = {mapKey: this.mapKey, startAtSign: this.startAtSign, showDemoControls: this.showDemoControls,
        companionModel: this.companionModel, companionOnAtStart: this.companionOnAtStart, preselect: null}
    }
    const s = showingSettings(this.authored, this.showingPreset)
    this.demoSet = demoSettings(this.demo)
    if (this.demoSet) {
      const d = this.demoSet
      s.mapKey = d.mapKey
      s.startAtSign = true
      s.showDemoControls = false
      s.companionModel = d.companionModel
      s.companionOnAtStart = true
      s.preselect = d.preselect
      this.cleanScreen = true
      this.liveCaptions = true
      // The map in the Lens: the public gist copy may lag behind (Gate C12).
      this.tryOnlineMap = false
      if (d.interests.length > 0) this.presetPreferences = d.interests.join(",")
      // Seated: the floor this much nearer the eyes.
      this.eyeHeightCm = this.authoredEyeCm - d.seatedDropCm
      print("[FYW] demo preset: " + this.demo)
    }
    this.mapKey = s.mapKey
    this.startAtSign = s.startAtSign
    this.showDemoControls = s.showDemoControls
    this.companionModel = s.companionModel
    this.companionOnAtStart = s.companionOnAtStart
    this.preselect = s.preselect
  }

  // Restart showing: the airport at its sign, closures cleared, the destination back to the map's
  // own, the dog; the demo controls follow the preset.
  restartShowing(): void {
    this.applyShowing()
    const idx = MAP_SOURCES.map((m) => m.key).indexOf(this.mapKey)
    this.mapIndex = idx >= 0 ? idx : 0
    this.setCompanionModel(this.companionModel)
    this.restart()
    this.demoControls.getSceneObject().enabled = this.showDemoControls || this.demoControlsForced
    print("[FYW] restart showing")
  }

  private chooseMode(profile: Profile): void {
    if (this.phase !== "mode") return
    this.profile = profile
    this.voice.stop()
    this.modePanel.hide()
    this.demoControls.setStatus(profile === "walk" ? "Mode: Walk" : "Mode: Step-Free")
    print("[FYW] mode " + profile)
    this.beginTrip()
  }

  private scanSign(): void {
    if (this.phase !== "scan" && this.phase !== "error") return
    // The building is laid out from where the user stands now: the scan ends the settling.
    this.anchorFrames = 0
    this.anchorWorld()
    this.phase = "loading"
    this.buildingUI.setScanSignVisible(false)
    this.hud.setBadge("loading map…")
    const src = this.source()
    // A place you walked yourself stays yours: no download ever replaces it.
    const url = !this.tryOnlineMap || !src ? "" : mapUrl(this.mapBaseUrl, src)
    print("[FYW] map download: " + (url || "(none, built-in map)"))
    const override = this.downloadOverride
    const delay = this.downloadDelayMs
    const fetchText = (u: string): Promise<string> => {
      if (override !== null) {
        if (delay <= 0) return Promise.resolve(override)
        return new Promise<string>((resolve) => {
          const ev = this.createEvent("DelayedCallbackEvent")
          ev.bind(() => resolve(override))
          ev.reset(delay / 1000)
        })
      }
      if (!u || !this.internetModule) return Promise.reject(new Error("no download"))
      let pending: Promise<Response>
      try {
        pending = this.internetModule.fetch(u)
      } catch (e) {
        print("[FYW] map download failed: " + e)
        return Promise.reject(e)
      }
      return pending.then((r) => {
        print("[FYW] map download response: HTTP " + r.status)
        return r.ok ? r.text() : Promise.reject(new Error("HTTP " + r.status))
      }).then((body) => {
        print("[FYW] map download body: " + (body ? body.length : 0) + " chars")
        return body
      }, (err) => {
        print("[FYW] map download failed: " + err)
        return Promise.reject(err)
      })
    }
    const generation = this.tripGeneration
    loadMapWithTimeout(fetchText, url, this.builtInText).then((res) => {
      if (res.error) print("[FYW] downloaded map rejected: " + logSafe(res.error))
      if (this.phase !== "loading" || generation !== this.tripGeneration) return
      this.mapLoaded(res.map, res.source, res.notice)
    }).catch((e) => {
      if (this.phase !== "loading" || generation !== this.tripGeneration) return
      this.useBuiltInMap(e)
    })
  }

  // The map couldn't be used after all: the one in the Lens, or if even that fails, try again.
  private useBuiltInMap(why: unknown): void {
    print("[FYW] map failed: " + logSafe(String(why)))
    try {
      const res = chooseMap(null, this.builtInText)
      this.mapLoaded(res.map, res.source, MAP_LOAD_FAILED)
    } catch (e) {
      this.scanFailed(MAP_LOAD_FAILED)
    }
  }

  // The sign stays, so you can scan again: without demo controls it is the only way on.
  private scanFailed(message: string): void {
    this.phase = "error"
    this.routeLine.clear()
    this.hud.showCard(message, "info")
    this.buildingUI.setScanSignVisible(true)
    print("[FYW] scan failed: " + logSafe(message))
  }

  // The map is in: the sign must be on it, then the three modes.
  private mapLoaded(map: MapData, source: string, notice: string | null): void {
    let m = map
    for (const id in this.closed) m = setEdgeOpen(m, id, false)
    const changed = JSON.stringify(m) !== JSON.stringify(this.map)
    this.setMap(m)
    if (changed) this.buildPlace()
    this.mapSource = source
    this.hud.setBadge(source === "online" ? "online map" : "offline map")
    if (notice) this.hud.showCard(notice, "info")
    // A just-mapped place starts where you stand, which need not be a sign.
    const located = this.tripStart ? null : locateSign(this.map, this.startOverride || this.place.start)
    if (located && !located.ok) {
      this.scanFailed((located as {ok: false; message: string}).message)
      return
    }
    this.enterChoose()
  }

  // Walk or Step-Free chosen: the line, the pill and the rest of today's flow.
  private beginTrip(): void {
    const startId = this.startOverride || this.tripStart || this.place.start
    this.demoControls.setStatus((this.profile === "walk" ? "Walk" : "Step-Free") + " · " +
      (this.mapSource === "online" ? "online map" : "offline map"))
    this.stops = this.planStops(startId)
    const tourStop = this.tourIds && this.stops ? this.stops.current() as string : null
    const dest = this.destinationOverride || tourStop || this.tripDestination || (this.stops ? this.stops.current() as string : this.place.destination)
    this.nav = new Navigator(this.map, startId, dest, this.profile as Profile)
    this.destNote = null
    this.coach = new PointingCoach(this.map)
    this.coach.interests = this.modePanel.getInterests().concat(this.fromWalk ? this.fromWalk.prefs : [])
    this.coach.muted = this.placesMuted
    this.travelled = 0
    this.lastFeet = null
    if (this.companionOnAtStart || (this.fromWalk && this.fromWalk.companion)) this.setCompanionOn(true)
    this.phase = "nav"
    this.pendingSwing = true
    this.lastLineKey = ""
    this.announce(this.stops ? this.stops.label((id) => nodeLabel(this.map, id)) : null, "location_on")
    this.reportRoute("scan")
  }

  private changeDestination(): void {
    const ev = this.firstEvent("destinationChanged")
    if (!ev || !ev.to) return
    this.endStops()
    this.tripDestination = ev.to
    if (this.nav) {
      if (this.nav.to !== ev.to) this.nav.setDestination(ev.to)
      this.afterRouteChange(true)
    }
    this.announce(ev.card || ev.button || "Destination changed", this.iconOfNode(ev.to))
    this.reportRoute("destination changed")
  }

  private closeConnection(edgeId: string): void {
    if (this.closed[edgeId]) return
    this.closed[edgeId] = true
    const ev = this.place.events.filter((e) => e.type === "connectionClosed" && e.edge === edgeId)[0]
    const r0 = this.nav ? this.nav.route : null
    const usedIt = !!r0 && r0.status === "route" && r0.edges.some((e) => e.id === edgeId)
    if (this.nav) {
      this.nav.setEdgeOpen(edgeId, false)
      this.map = this.nav.map
      this.afterRouteChange()
    } else {
      this.setMap(setEdgeOpen(this.map, edgeId, false))
    }
    if (this.free) this.free.setMap(this.map)
    this.showClosures()
    const text = ev ? closureNotice(ev, usedIt) : usedIt ? "Connection closed. Re-routing." : "Connection closed"
    this.announce(text, "block")
    this.reportRoute("closed " + edgeId)
  }

  // Shows every closed connection: closed sign text, red plate, "Out of service" ride buttons.
  // Also called after the place is rebuilt for a downloaded map.
  private buildPlace(): void {
    this.rides = this.placeBuilder.build()
    if (this.propsView) {
      const key = this.getMapKey()
      // The airport's own model has its seats, desks and people already.
      const kit = key === "mall" || (key === "airport" && !this.standIn.usesModel()) ? key : ""
      this.propsView.build(kit, (p, lift) => this.local(p, lift))
    }
    this.showClosures()
  }

  private showClosures(): void {
    for (const edgeId in this.closed) {
      this.buildingUI.setClosureClosed(edgeId, CLOSED_SIGN_TEXT)
      this.standIn.setConnectionClosed(edgeId)
      for (const id in this.rides) {
        if (this.rides[id].edge.id === edgeId) this.buildingUI.setRideButtonText(id, "Out of service")
      }
    }
  }

  // The one notice after a route change: the route's own notice (no route / ask staff / error)
  // wins over the change's card; with neither, nothing is shown.
  private announce(changeText: string | null, iconName: string | null): void {
    const notice = this.nav ? noticeFor(this.nav.route) : null
    if (notice) this.notify(notice, "info")
    else if (changeText) this.notify(changeText, iconName)
  }

  // Lift / escalator / stairs / ramp ride: only from the end the user is standing at.
  private ride(id: string): void {
    const r = this.rides[id]
    if (!r) return
    const map = this.nav ? this.nav.map : this.map
    const here = findNode(map, r.at)
    const there = findNode(map, r.to)
    if (!here || !there) return
    const edge = map.edges.filter((e) => e === r.edge || (e.id && e.id === r.edge.id) ||
      (e.from === r.edge.from && e.to === r.edge.to && e.kind === r.edge.kind))[0] || r.edge
    if (!edge.open) {
      this.hud.showCard(nodeLabel(map, r.at) + " is out of service", "block", 3)
      return
    }
    const user = this.userPos()
    const feet = this.nav ? {x: user.x, y: this.nav.snapFeet(user.y), z: user.z} : user
    if (!withinReach(feet, here, r.reach, levelsOf(map))) {
      this.hud.showCard("Walk to " + nodeLabel(map, r.at) + " first", "info", 3)
      const dx = user.x - here.x, dz = user.z - here.z
      print("[FYW] ride " + id + " refused: " + Math.sqrt(dx * dx + dz * dz).toFixed(1) + " m away, feet y " + user.y.toFixed(2))
      return
    }
    this.playTime.stopPlay()
    const delta = this.local(there).sub(this.local(here))
    this.rideOffset = this.rideOffset.add(delta)
    this.placeBuilding()
    if (this.debugPose) this.debugPose.pos = {x: there.x, y: there.y, z: there.z}
    this.hud.showCard(rideCard(r.edge.kind, there.y > here.y, levelName(this.place, there.y)), r.icon, RIDE_CARD_S)
    print("[FYW] ride " + id + " -> " + r.to)
  }

  private walkingInPreview(): boolean {
    return global.deviceInfoSystem.isEditor() && (this.phase === "free" || this.phase === "nav" || this.phase === "arrived")
  }

  private inSolid(p: Vec3): boolean {
    if (!AIRPORT_SOLIDS) {
      try { AIRPORT_SOLIDS = JSON.parse(AIRPORT_SOLIDS_ASSET.getString()) } catch (e) { AIRPORT_SOLIDS = [] }
    }
    const b = 0.3 // half a body
    for (const s of AIRPORT_SOLIDS as number[][]) {
      if (Math.abs(p.y - s[4]) < 0.9 && p.x > s[0] - b && p.x < s[1] + b && p.z > s[2] - b && p.z < s[3] + b) return true
    }
    return false
  }

  // The preview's keys walk through anything, so the walls push back here. The real building does it on Specs.
  private walkWalls(): void {
    if (!this.walkingInPreview() || this.debugPose) {
      this.lastWalked = null
      return
    }
    const pos = this.userPos()
    let to = this.lastWalked ? walkStep(this.nav ? this.nav.map : this.map, this.lastWalked, pos) : pos
    // The airport model's own desks, seats, shops and people (Assets/Maps/airport-solids.json): slide
    // along them, as along a wall.
    if (this.lastWalked && this.standIn.usesModel()) {
      const from = this.lastWalked
      if (this.inSolid(to) && !this.inSolid(from)) {
        const alongX = {x: to.x, y: to.y, z: from.z}, alongZ = {x: from.x, y: to.y, z: to.z}
        to = !this.inSolid(alongX) ? alongX : !this.inSolid(alongZ) ? alongZ : {x: from.x, y: to.y, z: from.z}
      }
    }
    if (to.x !== pos.x || to.z !== pos.z) {
      this.rideOffset = this.rideOffset.add(new vec3((to.x - pos.x) * 100, 0, -(to.z - pos.z) * 100))
      this.placeBuilding()
    }
    this.lastWalked = {x: to.x, y: to.y, z: to.z}
  }

  // The preview's keys keep you at one height, so stairs, ramps and escalators lift you here as you
  // walk along them. On Specs your own climbing does this. Stepping off one lands on the nearest floor.
  private walkSlope(): void {
    if (!this.walkingInPreview() && !(global.deviceInfoSystem.isEditor() && this.phase === "mapping")) return
    const map = this.nav ? this.nav.map : this.map
    const pos = this.userPos()
    let y = feetOnSlope(map, pos)
    if (y === null) {
      if (!this.onSlope) return
      this.onSlope = false
      y = levelsOf(map).reduce((best, l) => (Math.abs(l - pos.y) < Math.abs(best - pos.y) ? l : best), pos.y + 1000)
    } else {
      this.onSlope = true
    }
    const rise = y - pos.y
    if (Math.abs(rise) < SLOPE_MIN_RISE_M) return
    this.rideOffset = this.rideOffset.add(new vec3(0, rise * 100, 0))
    this.placeBuilding()
    if (this.debugPose) this.debugPose.pos.y = y
  }

  // newTarget: the destination changed, so an arrival counts again even if you are already there.
  private afterRouteChange(newTarget: boolean = false): void {
    this.destNote = null
    this.pendingSwing = true
    this.lastLineKey = ""
    if (this.phase === "arrived" && this.nav && (newTarget || this.nav.route.status !== "arrived")) {
      this.phase = "nav"
      this.arrivalCard.hide()
    }
  }

  private playChime(): void {
    if (this.chime) this.audio.play(1)
  }

  private notify(text: string, iconName: string | null): void {
    this.hud.showCard(text, iconName)
    this.playChime()
  }

  private firstEvent(type: string): PlaceEvent | null {
    for (const e of this.place.events) if (e.type === type) return e
    return null
  }

  private iconOfNode(id: string): string | null {
    const n = findNode(this.nav ? this.nav.map : this.map, id)
    return n && n.icon ? n.icon : null
  }

  // ── Scene placement ──────────────────────────────────────────────────────

  // Head yaw about +Y; looking straight down or up keeps the last valid yaw.
  private yawAngle(): number {
    const d = this.camera.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    this.lastYaw = yawFromForward(d.x, d.z, this.lastYaw)
    return this.lastYaw
  }

  // The head position (world), lowered by the test crouch hook.
  private cameraPos(): vec3 {
    return this.camera.getTransform().getWorldPosition().sub(new vec3(0, this.cameraDropCm, 0))
  }

  private headYaw(): quat {
    return quat.angleAxis(this.yawAngle(), vec3.up())
  }

  // settling = during the frames after a restart, while the head is still the standing head;
  // later re-anchors (choosing the mode) keep that height.
  private anchorWorld(settling: boolean = false): void {
    const cam = this.cameraPos()
    if (settling || this.standingEyeY === null) this.standingEyeY = cam.y
    this.world.getTransform().setWorldPosition(new vec3(cam.x, this.standingEyeY, cam.z))
    this.world.getTransform().setWorldRotation(this.headYaw())
    this.placeBuilding()
  }

  private eye(): number {
    return this.measuredEyeCm !== null ? this.measuredEyeCm : this.eyeHeightCm
  }

  private placeBuilding(): void {
    const b = this.building.getTransform()
    b.setLocalRotation(quat.quatIdentity())
    const off = this.startAtSign ? new vec3(0, 0, 0) : this.signOffset
    b.setLocalPosition(new vec3(off.x, -this.eye(), off.z).sub(this.rideOffset))
  }

  // Test / screenshot aid: move the building so the real camera sees it from the debug pose.
  private placeBuildingForPose(): void {
    if (!this.debugPose) return
    const cam = this.camera.getTransform().getWorldPosition()
    const rot = quat.angleAxis(this.yawAngle() + (this.debugPose.heading * Math.PI) / 180, vec3.up())
    const p = this.local(this.debugPose.pos)
    const pos = cam.sub(new vec3(0, this.eye(), 0)).sub(rot.multiplyVec3(p))
    this.building.getTransform().setWorldRotation(rot)
    this.building.getTransform().setWorldPosition(pos)
  }

  // Casts a ray straight down just in front of the user to find the floor (on Specs; the
  // Interactive Preview room returns no hit, so eyeHeightCm is used there).
  private probeFloor(): void {
    if (!this.hitSession || this.floorProbeFrames <= 0 || this.phase !== "scan") {
      if (this.floorProbeFrames <= 0 || this.phase !== "scan") this.setFloorProbe(false)
      return
    }
    this.floorProbeFrames--
    if (this.floorProbeFrames % 10 !== 0) return
    const cam = this.camera.getTransform().getWorldPosition()
    const start = cam.add(this.headYaw().multiplyVec3(new vec3(0, 0, -40)))
    this.hitSession.hitTest(start, start.add(new vec3(0, -300, 0)), (hit) => {
      if (!hit || hit.normal.y < 0.8) return
      const eye = this.camera.getTransform().getWorldPosition().y - hit.position.y
      if (eye < 90 || eye > 230) return
      if (this.measuredEyeCm === null || Math.abs(this.measuredEyeCm - eye) > 2) {
        this.measuredEyeCm = eye
        this.placeBuilding()
        print("[FYW] floor found: eye height " + eye.toFixed(1) + " cm")
      }
      this.floorProbeFrames = 0
    })
  }

  private placeModePanel(): void {
    const t = this.camera.getTransform()
    const yaw = this.headYaw()
    const p = t.getWorldPosition().add(yaw.multiplyVec3(this.modePanelOffset))
    const so = this.modePanel.getSceneObject()
    so.getTransform().setWorldPosition(p)
    so.getTransform().setWorldRotation(yaw)
  }

  private local(p: Vec3, liftCm: number = 0): vec3 {
    return this.frame.toLocal(p, liftCm)
  }




  // ── Per-frame ────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.camera || !this.demoControls) return
    if (this.anchorFrames > 0) {
      this.anchorFrames--
      this.anchorWorld(true)
    }
    this.probeFloor()
    this.tickTyping()
    if (this.captions) {
      const walking = this.phase === "nav" || this.phase === "arrived" || this.phase === "free"
      this.captions.setOn(this.liveCaptions && walking)
      if (!walking && this.talkAt !== -1) {
        this.talkAt = -1
        if (this.speaker) this.speaker.hide()
      }
      if (this.talkAt > 0 && getTime() >= this.talkAt) {
        this.talkAt = 0
        this.captions.playDemo(this.getMapKey())
      }
      if (this.speaker && this.speaker.isShown()) this.speaker.setSpeaking(this.captions.isDemoSpeaking())
      this.captions.tick()
    }
    // A demo preset scans the sign by itself once the world has settled.
    if (this.demoAutoPending && this.phase === "scan" && this.anchorFrames === 0 && !this.debugPose) this.scanSign()
    this.followDemoControls()
    this.followAppPanel()
    this.updatePeek()
    this.walkWalls()
    this.walkSlope()
    if (this.phase === "mapping") {
      this.builder.tick()
      this.followMappingPanel()
    }
    if (this.viewFollowsPose && this.debugPose) this.placeBuildingForPose()
    if (this.phase === "free" && this.free) {
      this.freeView.tick(this.free)
      this.updateFloorArrow(this.userPos(), this.free.pet ? this.free.pet.pos : null)
    }
    if ((this.phase !== "nav" && this.phase !== "arrived") || !this.nav) return
    const pos = this.userPos()
    const progress = this.nav.updatePosition(pos)
    if (progress === "rerouted") {
      // Navigator reports "rerouted" only when the planned nodes changed.
      this.pendingSwing = true
      this.lastLineKey = ""
      this.reportRoute("off route")
    }
    if (this.nav.route.status === "arrived") {
      if (this.phase !== "arrived") {
        this.phase = "arrived"
        this.routeLine.clear()
        this.turnArrow.hide()
        this.lineMapPoints = []
        const at = this.nav.route.nodes[0]
        const d = findNode(this.nav.map, at)
        if (d) this.arrivalCard.show(this.arrivalWords(at), this.local(d, ARRIVAL_CARD_CM), this.iconOfNode(at))
        this.arrivedAt = getTime()
        const lastStop = !this.stops || this.stops.index >= this.stops.total - 1
        if (lastStop) this.startConversation(pos)
        this.hud.setPill(null)
        this.hud.setCue(null)
        this.freeView.showLook(null, pos)
        this.showBoxes(null)
        this.pointed = null
        if (this.placesUI) this.placesUI.show([], null)
        if (this.view) this.view.setPost(null, true)
        print("[FYW] arrived at " + at)
      }
      if (!arrivalCardOn(getTime() - this.arrivedAt, this.cleanScreen) && this.arrivalCard.getShownText() !== null) this.arrivalCard.hide()
      if (this.askTrip && this.stops && this.stops.index < this.stops.total - 1 && getTime() - this.arrivedAt > ASK_NEXT_S) {
        this.nextStop()
        return
      }
      this.updateCompanion(pos, true)
      return
    }
    if (this.phase === "arrived") {
      this.phase = "nav"
      this.arrivalCard.hide()
    }
    this.trip = tripAhead(this.nav.map, this.nav.route, pos)
    this.updatePill()
    this.updateLine(pos)
    this.updateArrow(pos)
    this.updatePlaces(pos)
    this.updateCompanion(pos, false)
    this.updateShopLook(pos)
  }

  // The boxes at the shop you look at, unless you closed them for that shop (null hides them).
  // The shop you looked at for 2 s: its offers (at most 2) in the small card at the top right, clear of
  // the way ahead (the old boxes at the shop front stay hidden). null hides it.
  private showBoxes(b: LookBoxes | null): void {
    const on = !!b && this.offerClosed.visible(b.id)
    this.offersShown = on ? b : null
    this.boxesTitle = on ? b!.title : null
    this.hud.setOffers(on ? {title: b!.title, tag: b!.tag, lines: b!.boxes.slice(0, 2)} : null)
    if (this.offerBoxes && this.offerBoxes.isShown()) this.offerBoxes.show(null, null)
  }

  private updateShopLook(pos: Vec3): void {
    if (!this.nav) return
    if (!this.shopLook || this.shopLook.map !== this.nav.map) this.shopLook = {map: this.nav.map, look: new ShopLook(this.nav.map as any, [], {dotShowSeconds: OFFER_LOOK_S})}
    this.shopLook.look.update(pos, this.userHeading(), getTime())
    this.freeView.showLook(this.shopLook.look, pos)
  }

  // ── Pill, places, companion, play, stops ────────────────────────

  private updatePill(): void {
    if (!this.nav) return
    const dest = nodeLabel(this.nav.map, this.nav.to)
    const pill = tripPill(dest, this.trip)
    // The floor badge is the pill's first chip: the floor under your feet (from the route).
    this.hud.setPill(pill && this.trip ? levelName(this.place, this.trip.floorY) + " · " + pill : null)
    const cue = floorCueFor(this.place, this.nav.map, this.trip)
    if (this.destNote === null && this.trip) {
      const to = findNode(this.nav.map, this.nav.to)
      this.destNote = destinationFloorText(dest, levelName(this.place, to ? to.y : 0), this.trip.floors)
      this.destNoteUntil = getTime() + DEST_NOTE_S
    }
    this.hud.setCue(cue || (getTime() < this.destNoteUntil ? this.destNote : null))
  }

  private cardShowing(): boolean {
    return this.hud.getCardText() !== null
  }

  private updatePlaces(pos: Vec3): void {
    if (!this.nav || !this.placesUI || !this.coach) return
    const route = this.routeMapPoints()
    const now = getTime()
    if (this.lastFeet) {
      const dx = pos.x - this.lastFeet.x, dz = pos.z - this.lastFeet.z
      this.travelled += Math.sqrt(dx * dx + dz * dz)
    }
    this.lastFeet = {x: pos.x, y: pos.y, z: pos.z}
    if (this.pointed && now >= this.pointed.until) this.pointed = null
    const p = this.coach.check(route, pos, now, this.travelled, this.cardShowing())
    if (p) {
      this.pointed = {place: p, until: now + POINT_SECONDS}
      this.guide.point(p, now)
      print("[FYW] pointing at " + p.id + " (" + placeTag(p) + ")")
    }
    if (!cleanAllows("placeIcons", this.cleanScreen, true)) {
      this.placesUI.show([], null)
      return
    }
    const shown = visiblePlaces(this.nav.map, route, pos, {profile: this.nav.profile, muted: this.placesMuted})
    this.placesUI.show(shown.map((q) => q.id), this.pointed && !this.placesMuted ? this.pointed.place.id : null)
  }


  // "Go here?" on a place: it becomes the destination (the same re-route as a gate change).
  private goHere(id: string): void {
    if (!this.nav) return
    this.endStops()
    this.tripDestination = id
    if (this.nav.to !== id) this.nav.setDestination(id)
    this.pointed = null
    this.afterRouteChange()
    this.announce("Going to " + nodeLabel(this.nav.map, id), "location_on")
    this.reportRoute("go here " + id)
  }

  private setPlacesMuted(muted: boolean): void {
    this.placesMuted = muted
    if (this.coach) this.coach.muted = muted
    if (muted) this.pointed = null
    if (this.appPanel) this.appPanel.setPlaces(!muted)
  }

  private resetGuide(): void {
    this.guide = new PetGuide()
    this.guide.companion = this.companion
    this.guide.lead = this.companionLeadM
    this.coach = null
    this.pointed = null
    this.travelled = 0
    this.lastFeet = null
    this.trip = null
    this.stops = null
    this.playTime.reset()
    if (this.view) {
      this.view.setVisible(false)
      this.view.setPost(null, true)
      this.view.setCollectibles([], [])
      this.view.setTreat(null)
    }
    if (this.placesUI) this.placesUI.clear()
    if (this.appPanel) {
      this.appPanel.setCompanion(this.companion.name, false, this.companion.collectible.one)
      this.appPanel.setPlay(false, false, false)
      this.appPanel.setNextStop(null)
      this.appPanel.show(false)
    }
  }

  setCompanionOn(on: boolean): void {
    const route = this.petRoutePoints()
    const pos = this.nav || this.free ? this.userPos() : {x: 0, y: 0, z: 0}
    this.guide.setOn(on, route, pos, this.routeKey())
    if (this.free) this.free.setCompanion(on, pos, this.userHeading())
    if (!on) this.playTime.stopPlay()
    if (this.view) this.view.setVisible(on)
    if (this.appPanel) this.appPanel.setCompanion(this.companion.name, on, this.companion.collectible.one)
    this.hud.setScore(on && this.nav ? treatsText(this.guide.found, this.guide.total, this.companion) : null)
    print("[FYW] companion " + this.companion.id + " " + (on ? "on" : "off"))
  }

  // Any model: only the look, its name and its collectible change; the logic is the same.
  setCompanionModel(id: string): void {
    this.companion = companionOf(id)
    this.guide.companion = this.companion
    if (this.view) this.view.setModel(this.companion.model)
    if (this.appPanel) {
      this.appPanel.setCompanion(this.companion.name, this.guide.on, this.companion.collectible.one)
      const next = COMPANION_IDS[(COMPANION_IDS.indexOf(this.companion.id) + 1) % COMPANION_IDS.length]
      this.appPanel.setNextModel(companionChoices().filter((c) => c.id === next)[0].label)
    }
    if (this.prefsPanel) this.prefsPanel.setCompanion(this.companion.name, this.freeCompanion, this.companion.id)
  }

  // A pointing spot kept in the cone you look along (out to the companion's lead, + an aside step).
  private keepInView(spot: Vec3, user: Vec3, look: number): Vec3 {
    return clampToView(user, look, spot, VIEW_HALF_DEG, Math.max(VIEW_FAR_M, this.companionLeadM + 1.5))
  }

  // The small floor arrow near your feet toward the companion, after ~2 s out of view.
  private updateFloorArrow(pos: Vec3, pet: Vec3 | null): void {
    if (!this.view) return
    const heading = this.userHeading()
    if (!pet || !this.view.isVisible()) this.outOfView.reset()
    const show = !!pet && this.view.isVisible() && this.outOfView.update(inView(pos, heading, pet, FOV_HALF_DEG), getDeltaTime())
    if (show !== this.floorArrowOn) print("[FYW] floor arrow " + (show ? "on" : "off"))
    this.floorArrowOn = show
    if (!show || !pet) {
      this.view.setFloorArrow(null)
      return
    }
    const yaw = (Math.atan2(pet.x - pos.x, pet.z - pos.z) * 180) / Math.PI
    const r = (yaw * Math.PI) / 180
    this.view.setFloorArrow(this.local({x: pos.x + Math.sin(r) * 0.8, y: pos.y, z: pos.z + Math.cos(r) * 0.8}), yaw)
  }

  private routeKey(): string {
    if (!this.nav) return ""
    const r = this.nav.route
    if (r.status === "route") return r.nodes.join(">")
    return r.status === "askStaff" && r.assistance ? "askStaff:" + r.assistance.nodes.join(">") : r.status
  }

  private updateCompanion(pos: Vec3, arrived: boolean): void {
    if (!this.view || !this.nav) return
    if (this.playTime.update(pos)) return
    const dt = getDeltaTime()
    const now = getTime()
    const route = this.petRoutePoints()
    if (!this.guide.keepInView) this.guide.keepInView = (spot, user, look) => this.keepInView(spot, user, look)
    this.guide.look = this.userHeading()
    this.guide.update(route, pos, dt, this.routeKey(), arrived, now)
    const pet = this.guide.pet
    this.updateFloorArrow(pos, pet && this.guide.on ? pet.pos : null)
    if (pet) {
      this.view.setPointing(pet.mood === "point")
      this.view.setMood(pet.mood)
      this.view.setPose(this.local(pet.pos), pet.heading)
    }
    this.view.hideCollectibles = this.cleanScreen
    this.view.setCollectibles(this.guide.spots.map((q) => this.local(q)), this.guide.got)
    this.hud.setScore(arrived ? treatsResult(this.guide.found, this.guide.total, this.companion)
      : treatsText(this.guide.found, this.guide.total, this.companion))
    this.hud.setPlayLine(this.playTime.idleLine(now))
  }












  // Multi-stop trip: the map's places named in multiStops, ordered for the shortest walk.
  private planStops(startId: string): MultiStopTrip | null {
    if (this.tourIds) return new MultiStopTrip(this.tourIds)
    if (this.destinationOverride || this.tripDestination) return null
    const ids = (this.stopsOverride !== null ? this.stopsOverride : this.multiStops).split(",").map((x) => x.trim()).filter((x) => x && !!findNode(this.map, x))
    if (ids.length < 2) return null
    const order = orderStops(startId, ids, this.stopDistance())
    print("[FYW] stops: " + order.join(" > "))
    return new MultiStopTrip(order)
  }

  private stopDistance(): (a: string, b: string) => number {
    const profile = this.profile as Profile
    return (a: string, b: string): number => {
      const r = new Navigator(this.map, a, b, profile).route
      return r.status === "route" || r.status === "arrived" ? (r.status === "route" ? r.length : 0) : Infinity
    }
  }

  private arrivalWords(at: string): string {
    const map = this.nav ? this.nav.map : this.map
    if (this.stops && this.stops.current() === at) {
      const last = this.stops.index === this.stops.total - 1
      if (this.appPanel) this.appPanel.setNextStop(last ? null : "Next stop")
      return this.stops.label((id) => nodeLabel(map, id)) + (last ? " · last stop" : "")
    }
    return arrivalText(map, at)
  }

  private endStops(): void {
    this.stops = null
    if (this.appPanel) this.appPanel.setNextStop(null)
  }

  // Next stop: the line to the next shop (Step-Free rules hold for every leg).
  nextStop(): void {
    if (!this.nav || !this.stops || this.stops.index >= this.stops.total - 1 || !this.stops.next()) return
    const to = this.stops.current() as string
    this.nav.setDestination(to)
    this.afterRouteChange(true)
    if (this.appPanel) this.appPanel.setNextStop(null)
    this.announce(this.stops.label((id) => nodeLabel(this.nav!.map, id)), "location_on")
    this.reportRoute("next stop " + to)
  }

  private followMappingPanel(): void {
    if (!this.mappingPanel) return
    this.panels.follow(this.mappingPanel.getSceneObject(), MAPPING_PANEL_OFFSET, this.mappingPanelPlaced)
    this.mappingPanelPlaced = true
  }

  private followAppPanel(): void {
    if (!this.appPanel) return
    const on = this.phase === "nav" || this.phase === "arrived" || this.phase === "free"
    const wasOn = this.appPanel.getSceneObject().enabled
    this.appPanel.show(on)
    this.dock.update(on, this.appPanel.isPlaying() || this.appPanel.isNextStopShown(), this.cleanScreen)
    this.hud.setCardsMuted(!cleanAllows("notice", this.cleanScreen, on))
    this.appPanel.setCollapsed(this.dock.isCollapsed())
    // A clear view while walking: no map badge, score chip or play hint until you stand still.
    // Almost screenless while walking: the pill, cue and badge live in the Control panel.
    const q = walkingHud(on, this.playTime.gate.canPlay || this.appPanel.isPlaying(), this.phase === "arrived", this.cleanScreen)
    this.hud.setQuiet(q.badge, q.score, q.playLine, q.pill, q.cue)
    this.appPanel.setInfo(on ? [this.hud.getPillWanted(), this.hud.getCueWanted(), this.hud.getScoreWanted(), this.hud.getBadgeWanted()].filter((x) => !!x).join("\n") : null)
    if (!on) this.showBoxes(null)
    if (!on) return
    const airport = this.getMapKey() === "airport"
    this.appPanel.setShowing(this.showingPreset, this.showingPreset && airport && !!this.nav && this.getDestinationId() !== "gateC3",
      this.showingPreset ? (airport ? "Map: Preview room" : "Map: Airport") : null)
    const offset = this.appPanel.isPlaying() ? this.playPanelOffset : global.deviceInfoSystem.isEditor() ? PREVIEW_PANEL_OFFSET : this.appPanelOffset
    this.panels.follow(this.appPanel.getSceneObject(), offset, wasOn)
  }

  private petRoutePoints(): Vec3[] {
    const pts = this.routeMapPoints()
    if (!this.petPtsCache || this.petPtsCache.pts !== pts) this.petPtsCache = {pts, out: walkableRoute(this.getMapData(), pts) as Vec3[]}
    return this.petPtsCache.out
  }

  private routeMapPoints(): Vec3[] {
    if (!this.nav) return []
    const key = this.routeKey()
    if (this.ptsCache && this.ptsCache.key === key && this.ptsCache.map === this.nav.map) return this.ptsCache.pts
    const pts = this.computeRoutePoints()
    this.ptsCache = {key, map: this.nav.map, pts}
    return pts
  }

  private computeRoutePoints(): Vec3[] {
    if (!this.nav) return []
    const r = this.nav.route
    if (r.status === "route") return routePoints(this.nav.map, r)
    if (r.status === "askStaff" && r.assistance) {
      return r.assistance.nodes.map((id) => {
        const n = findNode(this.nav!.map, id)!
        return {x: n.x, y: n.y, z: n.z}
      })
    }
    return []
  }

  private updateLine(pos: Vec3): void {
    // Only your floor: the line ends at the foot of the next floor change, with an up/down post.
    // Following the companion, the whole route is drawn; otherwise lineAheadM of it.
    const ahead = routeLineAheadM(this.guide.on, this.lineAheadM)
    const onLevel = lineOnLevel(lineAhead(this.routeMapPoints(), pos, ahead), this.trip ? this.trip.floorY : undefined)
    const pts = onLevel.line
    if (this.view) this.view.setPost(onLevel.marker ? this.local(onLevel.marker.at) : null, onLevel.marker ? onLevel.marker.up : true)
    const key = pts.map((p) => Math.round(p.x * 20) + "," + Math.round(p.y * 20) + "," + Math.round(p.z * 20)).join(";")
    if (key === this.lastLineKey && !this.pendingSwing) return
    this.lastLineKey = key
    this.lineMapPoints = pts
    const local = pts.map((p) => this.local(p, LINE_LIFT_CM))
    let fadeCm = this.lineAheadM * 100
    if (ahead === Infinity) {
      fadeCm = 0
      for (let i = 1; i < pts.length; i++) fadeCm += Math.sqrt((pts[i].x - pts[i - 1].x) ** 2 + (pts[i].z - pts[i - 1].z) ** 2) * 100
      fadeCm = Math.max(100, fadeCm * 1.35) // the fade only touches the last few metres
    }
    this.routeLine.setPath(local.length > 1 ? local : [], fadeCm, this.pendingSwing)
    this.pendingSwing = false
  }

  private updateArrow(pos: Vec3): void {
    const turn = nextTurnAlong(lineAhead(this.routeMapPoints(), pos, 100000))
    const heading = this.userHeading()
    if (!turn || !turnOutOfView(pos, heading, turn, this.halfViewDeg)) {
      this.turnArrow.hide()
      return
    }
    this.turnArrow.show(yawTo(pos, heading, turn) as number)
  }

  private followDemoControls(): void {
    const shown = (this.showDemoControls && !this.cleanScreen) || this.demoControlsForced
    const dso = this.demoControls.getSceneObject()
    if (dso.enabled !== shown) dso.enabled = shown
    if (!shown || !this.panels) return
    this.panels.follow(dso, this.demoOffset, this.demoInit)
    this.demoInit = true
  }

  // User position in map metres (feet), from the camera or a test override.
  private userPos(): Vec3 {
    if (this.debugPose) return this.debugPose.pos
    const inv = this.building.getTransform().getInvertedWorldTransform()
    const local = inv.multiplyPoint(this.cameraPos())
    return this.frame.toMap(local, this.eye())
  }

  // Heading in degrees clockwise from map north. Looking straight down or up gives no
  // horizontal direction, so keep the last valid heading then.
  private userHeading(): number {
    if (this.debugPose) return this.debugPose.heading
    const inv = this.building.getTransform().getInvertedWorldTransform()
    const d = inv.multiplyDirection(this.camera.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1)))
    const flat = Math.sqrt(d.x * d.x + d.z * d.z)
    if (flat < 0.25) return this.lastHeading
    this.lastHeading = (Math.atan2(d.x, -d.z) * 180) / Math.PI
    return this.lastHeading
  }

  private reportRoute(why: string): void {
    if (!this.nav) return
    const r = this.nav.route
    const nodes = r.status === "route" ? r.nodes.join(">") : r.status
    print("[FYW] route (" + why + ", " + this.nav.profile + "): " + nodes)
  }

  // ── Read-only state + test hooks (used by the LEAF scenarios) ────────────

  getPhase(): Phase { return this.phase }
  getProfile(): Profile | null { return this.profile }
  getMapKey(): string { const src = this.source(); return src ? src.key : MAPPED_KEY_NAME }
  getMapData(): MapData { return this.nav ? this.nav.map : this.map }
  getMapSource(): string | null { return this.mapSource }
  getDestinationId(): string { return this.nav ? this.nav.to : this.tripDestination || this.place.destination }
  getStartId(): string { return this.place.start }
  getRouteStatus(): string { return this.nav ? this.nav.route.status : "none" }
  getRouteNodes(): string[] { return this.nav && this.nav.route.status === "route" ? this.nav.route.nodes.slice() : [] }
  getRouteEdgeKinds(): string[] {
    return this.nav && this.nav.route.status === "route" ? this.nav.route.edges.map((e) => e.kind) : []
  }
  getRouteLength(): number { return this.nav && this.nav.route.status === "route" ? this.nav.route.length : -1 }
  isLineVisible(): boolean { return this.routeLine.isShowing() }
  getLineMapPoints(): Vec3[] { return this.lineMapPoints.slice() }
  getLineLocalPoints(): vec3[] { return this.routeLine.getPoints() }
  isTurnArrowVisible(): boolean { return this.turnArrow.isShown() }
  isLineSwinging(): boolean { return this.routeLine.isSwinging() }
  getLineSwingCount(): number { return this.routeLine.getSwingCount() }
  getHudCardText(): string | null { return this.hud.getCardText() }
  getBadgeText(): string | null { return this.hud.getBadgeText() }
  getArrivalText(): string | null { return this.arrivalCard.getShownText() }
  isScanSignVisible(): boolean { return this.buildingUI.isScanSignVisible() }
  getScanSignWorldPos(): vec3 | null { return this.buildingUI.getScanSignWorldPos() }
  isModePanelShown(): boolean { return this.modePanel.isShown() }
  getEyeHeightCm(): number { return this.eye() }
  getRideOffsetCm(): vec3 { return this.rideOffset }
  // Ride button ids ("r<n>_<node>") for a given start node, e.g. "escFoot".
  // The ride button id at a node for a given connection kind ("lift", "escalator", "stairs", "ramp").
  getRideIdFor(nodeId: string, kind: string): string | null {
    for (const id in this.rides) if (this.rides[id].at === nodeId && this.rides[id].edge.kind === kind) return id
    return null
  }
  getDebugPose(): {pos: Vec3; heading: number} | null { return this.debugPose }
  getRideIdsAt(nodeId: string): string[] {
    return Object.keys(this.rides).filter((id) => this.rides[id].at === nodeId)
  }
  // Building-local cm of a point given in map metres (for view-angle checks in tests).
  mapToLocal(x: number, y: number, z: number): vec3 { return this.local({x, y, z}) }

  debugSetPose(x: number, y: number, z: number, headingDeg: number): void {
    this.debugPose = {pos: {x, y, z}, heading: headingDeg}
  }

  getFeetY(): number { return this.userPos().y }
  getUserMapPos(): Vec3 { return this.userPos() }
  getHudCardTextOrEmpty(): string { return this.hud.getCardText() || "" }
  // State for the LEAF scenarios.
  // The pill's and cue's content (shown in the Control panel while walking; isPillShown: in view).
  getPillText(): string | null { return this.hud.getPillWanted() }
  getCueText(): string | null { return this.hud.getCueWanted() }
  isPillShown(): boolean { return this.hud.getPillText() !== null }
  getScoreText(): string | null { return this.hud.getScoreText() }
  getPlayLine(): string | null { return this.hud.getPlayLine() }
  isFloorPostShown(): boolean { return !!this.view && this.view.isPostShown() }
  isCompanionOn(): boolean { return this.guide.on }
  isCompanionShown(): boolean { return !!this.view && this.view.isVisible() }
  getCompanionModel(): string { return this.view ? this.view.getModel() : "" }
  getCompanionClip(): string { return this.view ? this.view.getClip() : "" }
  getPropCount(): number { return this.propsView ? this.propsView.getCount() : 0 }
  isCompanionAnimated(): boolean { return !!this.view && this.view.isAnimatedModel() }
  getCompanionName(): string { return this.companion.name }
  getModelButtonLabel(): string { return this.appPanel ? this.appPanel.getModelLabel() : "" }
  getCompanionMapPos(): Vec3 | null {
    if (this.free) return this.free.pet ? this.free.pet.pos : null
    return this.guide.pet ? this.guide.pet.pos : null
  }
  isFloorArrowShown(): boolean { return !!this.view && this.view.isFloorArrowShown() }
  getPointState(): string { return this.free ? this.free.pointState : this.guide.pointState }
  getUserHeading(): number { return this.userHeading() }
  getUserPos(): Vec3 { return this.userPos() }
  getCompanionMood(): string {
    if (this.free) return this.free.pet ? this.free.pet.mood : "none"
    return this.guide.pet ? this.guide.pet.mood : "none"
  }
  getTreats(): {found: number; total: number} { return {found: this.guide.found, total: this.guide.total} }
  getVisiblePlaceIds(): string[] { return this.placesUI ? this.placesUI.visibleIds() : [] }
  getPointedPlaceId(): string | null { return this.pointed ? this.pointed.place.id : null }
  getPlaceTag(id: string): string | null { return this.placesUI ? this.placesUI.tagOf(id) : null }
  isPlacesMuted(): boolean { return this.placesMuted }
  // A raised hand (or the Jump button): jump, or after a bump, play again.
  jump(): boolean { return this.playTime.jump() }
  throwTreat(): void { this.playTime.throwTreat() }
  canPlayNow(): boolean { return this.playTime.gate.canPlay }
  isSeatedNow(): boolean { return this.playTime.seated.seated }
  getHopLaneM(): number { return this.playTime.hop.lane }
  getHopOrigin(): Vec3 | null { return this.playTime.hopOrigin }
  getCatchSpot(): Vec3 | null { return this.playTime.catchSpot }
  isGrabTreatShown(): boolean { return !!this.view && this.view.isGrabShown() }
  isListening(): boolean { return this.voice.listening }
  debugHeard(text: string, final: boolean): void {
    this.voice.listening = true
    this.heard(text, final)
  }
  isPickMapShown(): boolean { return !!this.pickMap && this.pickMap.isShown() }
  getPickMapDots(): number { return this.pickMap ? this.pickMap.getDotCount() : 0 }
  getPickMapDotId(i: number): string | null { return this.pickMap ? this.pickMap.getDotId(i) : null }
  getPickMapFloor(): string { return this.pickMap ? this.pickMap.getFloorText() : "" }
  isTour(): boolean { return this.tourIds !== null }
  getHopPhase(): string { return this.playTime.hop.phase }
  getHopScore(): number { return this.playTime.hop.score }
  getHopObstacles(): number { return this.playTime.hop.obstacles.length }
  isHopLaneShown(): boolean { return !!this.view && this.view.isLaneShown() }
  getCatchPhase(): string { return this.playTime.catchGame.phase }
  getCatches(): number { return this.playTime.catchGame.catches }
  getStopLabel(): string | null { return this.stops ? this.stops.label((id) => nodeLabel(this.getMapData(), id)) : null }
  getStops(): string[] { return this.stops ? this.stops.stops.slice() : [] }
  isAppPanelPlaying(): boolean { return !!this.appPanel && this.appPanel.isPlaying() }
  isBackdropSolid(): boolean { return this.standIn.isSolid() }
  isAppPanelShown(): boolean { return !!this.appPanel && this.appPanel.getSceneObject().isEnabledInHierarchy }
  // Simulates one raised hand (LEAF can't move tracked hands); used on the next frame.
  debugRaiseHand(): void { this.playTime.debugRaise = true }
  debugGoHere(id: string): void { this.goHere(id) }
  debugShowDemoControls(on: boolean): void {
    this.demoControlsForced = on
    this.demoControls.getSceneObject().enabled = this.showDemoControls || on
  }
  // World position of the start sign's foot (where you stand with startAtSign).
  getStartWorldPos(): vec3 {
    const n = findNode(this.map, this.place.start)
    return this.building.getTransform().getWorldTransform().multiplyPoint(n ? this.local(n) : new vec3(0, 0, 0))
  }
  getCameraWorldPos(): vec3 { return this.camera.getTransform().getWorldPosition() }
  // Learn this place / peek ahead state and hooks.
  isHomePanelShown(): boolean { return !!this.homePanel && this.homePanel.isShown() }
  isPrefsShown(): boolean { return !!this.prefsPanel && this.prefsPanel.isShown() }
  getPrefsSummary(): string { return this.prefsPanel ? this.prefsPanel.getSummary() : "" }
  getPrefsCompanionLabel(): string { return this.prefsPanel ? this.prefsPanel.getCompanionLabel() : "" }
  getPrefsModelLabel(id: string): string { return this.prefsPanel ? this.prefsPanel.getModelLabel(id) : "" }
  getFreePrefs(): string[] { return this.free ? this.free.prefs.slice() : [] }
  getDotId(): string | null { return this.free ? this.free.dot() : null }
  // What the HUD would show if the view weren't kept clear while walking (quietView).
  getScoreWanted(): string | null { return this.hud.getScoreWanted() }
  getBadgeWanted(): string | null { return this.hud.getBadgeWanted() }
  isOptionsCollapsed(): boolean { return !!this.appPanel && this.appPanel.isCollapsed() }
  // The two offer boxes at the shop you look at.
  getOfferPeekTitle(): string | null { return this.hud.getOffers() ? this.boxesTitle : null }
  isOfferPeekShown(): boolean { return this.hud.getOffers() !== null }
  getOfferPeekLines(): string[] { const v = this.hud.getOffers(); return v ? v.lines.slice() : [] }
  getOfferBoxesId(): string | null { return this.hud.getOffers() && this.offersShown ? this.offersShown.id : null }
  getCaptionRows(): string[] { return this.hud.getCaptions() }
  isCaptionsOn(): boolean { return !!this.captions && this.captions.isOn() }
  isSpeakerShown(): boolean { return !!this.speaker && this.speaker.isShown() }
  getCompanionLeadM(): number { return this.companionLeadM }
  isDotShown(): boolean { return !!this.offerUI && this.offerUI.isDotShown() }
  getDotText(): string { return this.offerUI ? this.offerUI.getDotText() : "" }
  isOfferShown(): boolean { return !!this.offerUI && this.offerUI.isListShown() }
  getOfferList(): {title: string; tag: string; rows: {text: string; price: string}[]; more: boolean} | null {
    return this.offerUI ? this.offerUI.getList() : null
  }
  getBubbleText(): string | null { return this.bubble ? this.bubble.getText() : null }
  getStopId(): string | null { return this.free ? this.free.pointingAt() : null }
  isCompanionPointing(): boolean { return !!this.view && this.view.isPointing() }
  debugMarkPointed(ids: string[]): void { if (this.free) this.free.markDone(ids) }
  getDestinationLabel(): string { return this.modePanel.getDestinationText() }
  isWhereToShown(): boolean { return !!this.whereTo && this.whereTo.isShown() }
  getWhereToLabels(): string[] { return this.whereTo ? this.whereTo.getShownLabels() : [] }
  getFloorGuess(): string | null { return this.builder.floorGuess() }
  isMapModelShown(): boolean { return this.builder.isSeeingMap() && !!this.peekView && this.peekView.isShown() }
  isMappingPanelShown(): boolean { return !!this.mappingPanel && this.mappingPanel.isShown() }
  getMappingStatus(): string { return this.mappingPanel ? this.mappingPanel.getStatus() : "" }
  getMapPinCount(): number { return this.view ? this.view.getPinCount() : 0 }
  getMappedNodeCount(): number { return this.builder.nodeCount() }
  hasSavedMap(): boolean { return this.mappedText !== null }
  debugMapPointAt(x: number, y: number, z: number): string | null {
    this.debugPose = {pos: {x, y, z}, heading: this.debugPose ? this.debugPose.heading : 0}
    return this.builder.debugPointAt({x, y, z})
  }
  debugMapName(label: string): string | null { return this.builder.debugName(label) }
  debugMapTag(kind: string): boolean { return this.builder.debugTag(kind) }
  // Walked by the tests: one tracer sample, as a frame would give it.
  getMappedMapText(): string { return this.builder.mapText() || this.mappedText || "" }
  debugSaveMapping(): boolean { return this.saveMapping() }
  // Forgets the saved map (device storage too); the map switch then cycles the bundled maps only.
  debugForgetSavedMap(): void {
    this.mappedText = null
    try { global.persistentStorageSystem.store.remove(MAPPED_KEY) } catch (e) { /* none */ }
    if (this.mapIndex >= MAP_SOURCES.length) this.mapIndex = 0
  }
  debugPeek(on: boolean): void { this.peekForced = on }
  debugSeeMap(on: boolean): void { this.setMapShown(on) }
  isPeekShown(): boolean { return !!this.peekView && this.peekView.isShown() }
  isShowingPreset(): boolean { return this.showingPreset }
  isCleanScreen(): boolean { return this.cleanScreen }
  getDemoPreset(): string { return this.demoSet ? this.demo : "off" }
  getTalkHint(): string | null { return this.modePanel.getTalkHint() }
  isVoiceTyping(): boolean { return this.typing !== null }
  isAskTrip(): boolean { return this.askTrip }
  getStopIndex(): number { return this.stops ? this.stops.index : -1 }
  // Test hook: a demo preset (or "off"); takes effect on Restart showing (restartShowing()).
  debugSetDemo(preset: string): void {
    this.demo = preset
    if (preset === "off") {
      this.cleanScreen = false
      this.eyeHeightCm = this.authoredEyeCm
      this.tryOnlineMap = this.authoredOnline
    }
  }
  debugSetShowingPreset(on: boolean): void { this.showingPreset = on }
  getStartSettings(): StartSettings {
    return {mapKey: this.mapKey, startAtSign: this.startAtSign, showDemoControls: this.showDemoControls,
      companionModel: this.companionModel, companionOnAtStart: this.companionOnAtStart, preselect: this.preselect as StartSettings["preselect"]}
  }
  getPreselectedMode(): string | null { return this.modePanel.getPreselected() }
  getWalkButtonLabel(): string { return this.modePanel.getWalkLabel() }
  getNextMapKey(): string { const i = this.nextMapIndex(); return i < MAP_SOURCES.length ? MAP_SOURCES[i].key : MAPPED_KEY_NAME }
  getClosedEdges(): string[] { return Object.keys(this.closed).filter((k) => this.closed[k]) }
  areDemoControlsShown(): boolean { return this.demoControls.getSceneObject().enabled }
  debugSetInterests(ids: string[]): void { this.modePanel.setInterests(ids) }
  isEdgeOpen(edgeId: string): boolean {
    for (const e of this.getMapData().edges) if (e.id === edgeId) return e.open
    return false
  }
  isArrivalCardShown(): boolean { return this.arrivalCard.getShownText() !== null }
  getClosureSignText(edgeId: string): string | null { return this.buildingUI.getClosureSignText(edgeId) }
  getRideButtonText(rideId: string): string | null { return this.buildingUI.getRideButtonText(rideId) }
  isConnectionShownClosed(edgeId: string): boolean { return this.standIn.isConnectionShownClosed(edgeId) }
  // Height (cm) of a connection's red sign above its node's floor.
  getClosureSignHeightCm(edgeId: string): number {
    const ev = this.place.events.filter((e) => e.type === "connectionClosed" && e.edge === edgeId)[0]
    const n = ev && ev.at ? findNode(this.map, ev.at) : undefined
    const p = this.buildingUI.getClosureSignLocalPos(edgeId)
    return n && p ? p.y - this.local(n).y : -1
  }
  // World y of the floor the building stands on, and the drawn line in world space.
  // True while the world still re-anchors to the settling camera after a restart.
  isAnchorSettling(): boolean { return this.anchorFrames > 0 }
  getFloorWorldY(): number { return this.building.getTransform().getWorldPosition().y }
  getLineWorldPoints(): vec3[] {
    const m = this.building.getTransform().getWorldTransform()
    return this.routeLine.getPoints().map((p) => m.multiplyPoint(p))
  }

  // Test hooks: set before the sign is scanned (cleared by Restart).
  debugSetDownloadOverride(text: string | null, delayMs: number = 0): void {
    this.downloadOverride = text
    this.downloadDelayMs = delayMs
  }
  // Simulates sitting down / crouching: the camera reads this many cm lower than it is.
  debugSetCameraDropCm(cm: number): void { this.cameraDropCm = cm }
  debugSetStartOverride(signId: string | null): void { this.startOverride = signId }
  debugSetDestinationOverride(nodeId: string | null): void { this.destinationOverride = nodeId }
  debugSetStops(ids: string | null): void { this.stopsOverride = ids }
  // Closes any connection by edge id, exactly as pinching its red sign would.
  debugCloseEdge(edgeId: string): void { this.closeConnection(edgeId) }

  debugClearPose(): void {
    this.debugPose = null
    this.viewFollowsPose = false
    this.placeBuilding()
  }

  // Screenshot aid: the real camera sees the building from the debug pose.
  debugSetViewFollowsPose(on: boolean): void {
    this.viewFollowsPose = on
    if (!on) this.placeBuilding()
  }
}
