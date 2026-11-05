// FindYourWayAppPanelUI — the small app panel at waist height to the left: the companion toggle
// (labelled with its name: "Pet" / "Robot" / "Rover"), swap model, Places on/off, and the play
// buttons (Play / Stop, Jump, Throw a treat) that show only while you can play, and Next stop on
// a multi-stop trip.
// Created at runtime by FindYourWayMain. Emits through the callbacks given to setup().
// Must not: decide when play is allowed or change the route (Main and the core logic do).

import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {addButton, addText, LabeledButton, makePanel, obj, Panel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"
import {OptionsDock} from "./FindYourWayDock"

export interface AppPanelHandlers {
  onCompanion: () => void
  onModel: () => void
  onPlaces: () => void
  onMap: () => void
  onPlay: () => void
  onJump: () => void
  onThrow: () => void
  onNextStop: () => void
  onEndWalk: () => void
  // Fold the panel to its small tab, or open it again.
  onToggleOptions?: () => void
  // The showing preset only: back to the showing state, the airport/room map switch, the gate change.
  onRestartShowing?: () => void
  onShowingMap?: () => void
  onShowingGate?: () => void
}

const WIDTH = 22
const BUTTON_H = 4.2
const TEXT = new vec4(1, 1, 1, 1)
const PLAY_SCALE = 0.7
const FONT = 110
// The folded panel: one small tab (cm).
const TAB_W = 12

@component
export class FindYourWayAppPanelUI extends BaseScriptComponent {
  private companion: LabeledButton
  private places: LabeledButton
  private seeMap: LabeledButton
  private play: LabeledButton
  private jump: LabeledButton
  private throwBtn: LabeledButton
  private nextStop: LabeledButton
  private endWalk: LabeledButton
  private model: LabeledButton
  private restartShowing: LabeledButton
  private showingMap: LabeledButton
  private showingGate: LabeledButton
  private baseScale = 1
  private placesOn = true
  private panel: Panel
  // Every row in order; hidden rows are taken out of the layout so they leave no gap.
  private rows: SceneObject[] = []
  private layoutKey = ""
  // The rows hidden while playing, and the scale that keeps the rest small at the side of the view.
  private optionRows: SceneObject[] = []
  private playing = false
  private hideBtn: LabeledButton
  private tabRoot: SceneObject
  private collapsed = false
  private info: Text

  setup(h: AppPanelHandlers): void {
    const panel = makePanel(this.sceneObject, WIDTH + 2, 1.2, 0.8)
    this.panel = panel
    const title = addText(panel.content, "AppTitle", OptionsDock.TITLE, "Headline2", WIDTH, 2.4, TEXT, FONT)
    // While walking: the floor, metres and time to go (the pill and cue that left the view).
    this.info = addText(panel.content, "ControlInfo", "", "Caption", WIDTH, 5, TEXT, FONT)
    this.companion = addButton(panel.content, "CompanionButton", "Pet: off", WIDTH, BUTTON_H, icon("directions_walk"),
      h.onCompanion, TEXT, FONT)
    this.model = addButton(panel.content, "ModelButton", "Swap model", WIDTH, BUTTON_H, null, h.onModel, TEXT, FONT)
    this.places = addButton(panel.content, "PlacesButton", "Places: on", WIDTH, BUTTON_H, icon("location_on"),
      h.onPlaces, TEXT, FONT)
    this.seeMap = addButton(panel.content, "MiniMallButton", "See map", WIDTH, BUTTON_H, icon("location_on"), h.onMap, TEXT, FONT)
    this.play = addButton(panel.content, "PlayButton", "Play while you wait", WIDTH, BUTTON_H, null, h.onPlay, TEXT, FONT)
    // On Specs you raise a hand; in the preview this button does the same.
    this.jump = addButton(panel.content, "JumpButton", "Jump (or raise a hand)", WIDTH, BUTTON_H, null, h.onJump, TEXT, FONT)
    this.throwBtn = addButton(panel.content, "ThrowButton", "Throw a treat", WIDTH, BUTTON_H, null, h.onThrow, TEXT, FONT)
    this.nextStop = addButton(panel.content, "NextStopButton", "Next stop", WIDTH, BUTTON_H, icon("location_on"),
      h.onNextStop, TEXT, FONT)
    this.endWalk = addButton(panel.content, "EndWalkButton", "End walk", WIDTH, BUTTON_H, null, h.onEndWalk, TEXT, FONT)
    const none = () => {}
    this.showingGate = addButton(panel.content, "ShowingGateChangeButton", "Demo: gate change", WIDTH, BUTTON_H, null,
      h.onShowingGate || none, TEXT, FONT)
    this.showingMap = addButton(panel.content, "ShowingMapButton", "Map: Preview room", WIDTH, BUTTON_H, icon("map"),
      h.onShowingMap || none, TEXT, FONT)
    this.restartShowing = addButton(panel.content, "RestartShowingButton", "Restart showing", WIDTH, BUTTON_H, icon("restart_alt"),
      h.onRestartShowing || none, TEXT, FONT)
    // Folded once the trip starts (Main's OptionsDock): only a small "Options" tab stays.
    const toggle = h.onToggleOptions || none
    this.hideBtn = addButton(panel.content, "HideOptionsButton", "Hide", WIDTH, BUTTON_H, null, toggle, TEXT, FONT)
    this.tabRoot = obj(this.sceneObject, "OptionsTab", new vec3(0, 0, 0.6))
    addButton(this.tabRoot, "OptionsTabButton", OptionsDock.TITLE, TAB_W, BUTTON_H, null, toggle, TEXT, FONT)
    this.tabRoot.enabled = false
    this.rows = [title.getSceneObject(), this.info.getSceneObject(), this.hideBtn.so, this.companion.so, this.model.so, this.places.so, this.seeMap.so, this.play.so, this.jump.so,
      this.throwBtn.so, this.nextStop.so, this.endWalk.so, this.showingGate.so, this.showingMap.so, this.restartShowing.so]
    this.optionRows = [title.getSceneObject(), this.hideBtn.so, this.companion.so, this.model.so, this.places.so, this.seeMap.so]
    this.setShowing(false, false, null)
    this.setPlay(false, false, false)
    this.setNextStop(null)
    this.setFreeWalk(false)
  }

  // Free walk has no place icons to mute. Every walk has a way back to the three modes.
  setFreeWalk(on: boolean): void {
    this.places.so.enabled = !on
    this.endWalk.label.text = on ? "End walk" : "End trip"
    this.relayout()
  }

  // Re-lays out the column with only the shown rows (FlexLayout keeps disabled items' space).
  private relayout(): void {
    if (this.rows.length === 0) return
    const key = this.rows.map((r) => (r.enabled ? "1" : "0")).join("")
    if (key === this.layoutKey) return
    this.layoutKey = key
    const items = this.rows.map((r) => r.getComponent(FlexItem.getTypeName()) as FlexItem).filter((i) => !!i)
    this.panel.flex.removeItems(items)
    this.panel.flex.addItems(items.filter((i) => i.getSceneObject().enabled))
  }

  // Multi-stop trips: shown at a stop that has a next one; null hides it.
  setNextStop(label: string | null): void {
    this.nextStop.so.enabled = label !== null
    if (label) this.nextStop.label.text = label
    this.relayout()
  }

  setCompanion(name: string, on: boolean, collectible: string): void {
    this.companion.label.text = name + ": " + (on ? "on" : "off")
    this.throwBtn.label.text = "Throw a " + collectible
  }

  getCompanionLabel(): string { return this.companion.label.text }

  setNextModel(label: string): void { this.model.label.text = "Change to " + label }

  getModelLabel(): string { return this.model.label.text }

  // Smaller where the panel has to sit in the view instead of at the waist.
  setBaseScale(scale: number): void {
    this.baseScale = scale
    this.getTransform().setLocalScale(vec3.one().uniformScale(scale * (this.playing ? PLAY_SCALE : 1)))
  }

  setMapShown(on: boolean): void { this.seeMap.label.text = on ? "Hide map" : "See map" }

  setPlaces(on: boolean): void { this.places.label.text = "Places: " + (on ? "on" : "off") }

  // canPlay: standing still with the companion on; playing: Hop is running; canThrow: catch allowed.
  setPlay(canPlay: boolean, playing: boolean, canThrow: boolean): void {
    this.play.so.enabled = canPlay || playing
    this.play.label.text = playing ? "Stop playing" : "Play while you wait"
    this.jump.so.enabled = playing
    this.throwBtn.so.enabled = canThrow && !playing
    // While playing only Stop and Jump stay, small, so nothing covers the game.
    if (playing !== this.playing) {
      this.playing = playing
      for (const r of this.optionRows) r.enabled = !playing
      this.setBaseScale(this.baseScale)
    }
    this.relayout()
  }

  // The showing preset's rows: Restart showing, Demo: gate change (airport trips only) and the map
  // switch (its label names the map it goes to; null hides it). Not demo controls: they stay with
  // the demo controls hidden.
  setShowing(restart: boolean, gate: boolean, mapLabel: string | null): void {
    if (!this.restartShowing) return
    const show = (b: LabeledButton, on: boolean) => { if (b.so.enabled !== on) b.so.enabled = on }
    show(this.restartShowing, restart && !this.playing)
    show(this.showingGate, gate && !this.playing)
    show(this.showingMap, mapLabel !== null && !this.playing)
    if (mapLabel !== null && this.showingMap.label.text !== mapLabel) this.showingMap.label.text = mapLabel
    this.relayout()
  }

  // Folded: the rows go and the plate shrinks to the tab; open: the column comes back as it was.
  setCollapsed(on: boolean): void {
    if (!this.tabRoot || on === this.collapsed) return
    this.collapsed = on
    this.panel.content.enabled = !on
    this.tabRoot.enabled = on
    if (on) this.panel.plate.size = new vec2(TAB_W + 2, BUTTON_H + 2)
    else {
      this.layoutKey = ""
      this.relayout()
    }
  }

  isCollapsed(): boolean { return this.collapsed }

  // The trip's floor, metres and time (null or empty hides the row).
  setInfo(text: string | null): void {
    if (!this.info) return
    const on = !!text && !this.playing
    if (on && this.info.text !== text) this.info.text = text!
    const so = this.info.getSceneObject()
    if (so.enabled !== on) {
      so.enabled = on
      this.relayout()
    }
  }

  getInfo(): string | null { return this.info && this.info.getSceneObject().enabled ? this.info.text : null }

  isNextStopShown(): boolean { return !!this.nextStop && this.nextStop.so.enabled }

  isPlaying(): boolean { return this.playing }

  isPlayOffered(): boolean { return this.play.so.isEnabledInHierarchy }

  show(on: boolean): void { this.sceneObject.enabled = on }
}
