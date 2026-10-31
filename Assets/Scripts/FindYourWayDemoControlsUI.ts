// FindYourWayDemoControlsUI — "Demo controls" panel (clearly not part of the real app):
// the map's destination-change button (e.g. "Gate change B12 → C3"), Restart trip, and a
// map switcher that proves the same Lens runs another building. Main moves the panel so it
// follows the user low and to the left. Must not: hold trip state.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {addButton, addText, LabeledButton, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

@component
export class FindYourWayDemoControlsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Demo controls – low-left panel, not part of the real app</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Panel title")
  title: string = "Demo controls"

  @input
  @hint("Line under the title")
  note: string = "Not part of the real app"

  @input
  @hint("Panel width, cm")
  @widget(new SliderWidget(12, 36, 1))
  widthCm: number = 13

  @input
  @hint("Distance the panel is read from, cm (sizes the text)")
  @widget(new SliderWidget(40, 110, 1))
  readingDistanceCm: number = 80

  @input("vec4", "{1,1,1,1}")
  @hint("Text colour")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private _onEvent = new Event<void>()
  private _onRestart = new Event<void>()
  private _onNextMap = new Event<void>()
  private _onPlayDemo = new Event<void>()
  private _onPlayFreeWalk = new Event<void>()
  get onEvent(): PublicApi<void> { return this._onEvent.publicApi() }
  get onRestart(): PublicApi<void> { return this._onRestart.publicApi() }
  get onNextMap(): PublicApi<void> { return this._onNextMap.publicApi() }
  // Play / Stop the autoplay demo (one button; its label shows which).
  get onPlayDemo(): PublicApi<void> { return this._onPlayDemo.publicApi() }
  get onPlayFreeWalk(): PublicApi<void> { return this._onPlayFreeWalk.publicApi() }

  private eventButton: LabeledButton
  private mapButton: LabeledButton
  private playButton: LabeledButton
  private freeWalkButton: LabeledButton
  private status: Text

  onAwake() {
    const w = this.widthCm
    const d = this.readingDistanceCm
    const panel = makePanel(this.sceneObject, w, 1, 0.6)
    addText(panel.content, "Title", this.title, "Headline1", w - 2, 2.2, this.textColor, d)
    addText(panel.content, "Note", this.note, "Body", w - 2, 1.4,
      new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.75), d)
    this.eventButton = addButton(panel.content, "GateChangeButton", "Gate change B12 → C3",
      w - 1.5, 3.4, icon("location_on"), () => this._onEvent.invoke(), this.textColor, d, "Callout", "Primary")
    addButton(panel.content, "RestartButton", "Restart trip", w - 1.5, 3.4, icon("restart_alt"),
      () => this._onRestart.invoke(), this.textColor, d, "Callout")
    this.mapButton = addButton(panel.content, "NextMapButton", "Map: Airport", w - 1.5, 3.4, icon("map"),
      () => this._onNextMap.invoke(), this.textColor, d, "Callout")
    this.playButton = addButton(panel.content, "PlayDemoButton", "Play demo", w - 1.5, 3.4, icon("directions_walk"),
      () => this._onPlayDemo.invoke(), this.textColor, d, "Callout", "Primary")
    this.freeWalkButton = addButton(panel.content, "FreeWalkDemoButton", "Free walk demo", w - 1.5, 3.4, icon("directions_walk"),
      () => this._onPlayFreeWalk.invoke(), this.textColor, d, "Callout", "Primary")
    this.status = addText(panel.content, "Status", "offline map", "Body", w - 2, 1.4,
      new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85), d)
  }

  // label null hides the button (a map without a destination-change event).
  setEventLabel(text: string | null, iconName?: string | null): void {
    if (text === null) {
      this.eventButton.so.enabled = false
      return
    }
    this.eventButton.label.text = text
    const img = this.eventButton.icon
    if (img && img.mainMaterial) img.mainMaterial.mainPass.baseTex = icon(iconName)
    this.eventButton.so.enabled = true
  }

  setMapName(name: string): void {
    this.mapButton.label.text = "Map: " + name + " (switch)"
  }

  setPlayDemoLabel(text: string): void {
    this.playButton.label.text = text
  }

  setFreeWalkLabel(text: string): void {
    this.freeWalkButton.label.text = text
  }

  setStatus(text: string): void {
    this.status.text = text
  }
}
