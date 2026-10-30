// FindYourWayAppPanelUI — the small app panel at waist height to the left: the companion toggle
// (labelled with its name: "Pet" / "Robot" / "Rover"), swap model, Places on/off, and the play
// buttons (Play / Stop, Jump, Throw a treat) that show only while you can play, and Next stop on
// a multi-stop trip.
// Created at runtime by FindYourWayMain. Emits through the callbacks given to setup().
// Must not: decide when play is allowed or change the route (Main and the core logic do).

import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {addButton, addText, LabeledButton, makePanel, Panel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

export interface AppPanelHandlers {
  onCompanion: () => void
  onModel: () => void
  onPlaces: () => void
  onPlay: () => void
  onJump: () => void
  onThrow: () => void
  onNextStop: () => void
}

const WIDTH = 22
const BUTTON_H = 4.2
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayAppPanelUI extends BaseScriptComponent {
  private companion: LabeledButton
  private places: LabeledButton
  private play: LabeledButton
  private jump: LabeledButton
  private throwBtn: LabeledButton
  private nextStop: LabeledButton
  private panel: Panel
  // Every row in order; hidden rows are taken out of the layout so they leave no gap.
  private rows: SceneObject[] = []
  private layoutKey = ""

  setup(h: AppPanelHandlers): void {
    const panel = makePanel(this.sceneObject, WIDTH + 2, 1.2, 0.8)
    this.panel = panel
    const title = addText(panel.content, "AppTitle", "Options", "Headline2", WIDTH, 2.4, TEXT, 70)
    this.companion = addButton(panel.content, "CompanionButton", "Pet: off", WIDTH, BUTTON_H, icon("directions_walk"),
      h.onCompanion, TEXT, 70)
    const model = addButton(panel.content, "ModelButton", "Swap model", WIDTH, BUTTON_H, null, h.onModel, TEXT, 70)
    this.places = addButton(panel.content, "PlacesButton", "Places: on", WIDTH, BUTTON_H, icon("location_on"),
      h.onPlaces, TEXT, 70)
    this.play = addButton(panel.content, "PlayButton", "Play while you wait", WIDTH, BUTTON_H, null, h.onPlay, TEXT, 70)
    // On Specs you raise a hand; in the preview this button does the same.
    this.jump = addButton(panel.content, "JumpButton", "Jump (or raise a hand)", WIDTH, BUTTON_H, null, h.onJump, TEXT, 70)
    this.throwBtn = addButton(panel.content, "ThrowButton", "Throw a treat", WIDTH, BUTTON_H, null, h.onThrow, TEXT, 70)
    this.nextStop = addButton(panel.content, "NextStopButton", "Next stop", WIDTH, BUTTON_H, icon("location_on"),
      h.onNextStop, TEXT, 70)
    this.rows = [title.getSceneObject(), this.companion.so, model.so, this.places.so, this.play.so, this.jump.so,
      this.throwBtn.so, this.nextStop.so]
    this.setPlay(false, false, false)
    this.setNextStop(null)
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

  setPlaces(on: boolean): void { this.places.label.text = "Places: " + (on ? "on" : "off") }

  // canPlay: standing still with the companion on; playing: Hop is running; canThrow: catch allowed.
  setPlay(canPlay: boolean, playing: boolean, canThrow: boolean): void {
    this.play.so.enabled = canPlay || playing
    this.play.label.text = playing ? "Stop playing" : "Play while you wait"
    this.jump.so.enabled = playing
    this.throwBtn.so.enabled = canThrow && !playing
    this.relayout()
  }

  isPlayOffered(): boolean { return this.play.so.isEnabledInHierarchy }

  show(on: boolean): void { this.sceneObject.enabled = on }
}
