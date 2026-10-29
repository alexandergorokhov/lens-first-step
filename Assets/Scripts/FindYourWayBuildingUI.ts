// FindYourWayBuildingUI — every UI surface that lives inside the stand-in building:
// place signage (destination / lift / connector labels, the "stand-in building" label), the
// "you are here" scan sign, red out-of-service signs and the ride buttons (lift floor
// button, "ride escalator up", "take stairs down"…). Built at runtime from the map (positions
// are building-local cm, passed in by Main). Emits onScan / onClosure(id) / onRide(id).
// Must not: route, or know what a map means.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {ALERT_TINT, addButton, addIcon, addRow, addText, LabeledButton, makePanel, obj} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

@component
export class FindYourWayBuildingUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Building UI – signs and pinch targets inside the stand-in</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input("vec4", "{1,1,1,1}")
  @hint("Sign text colour (light — the display is additive)")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Scale of the scan sign and ride / closure controls (1 = sized for ~1.1 m reading distance)")
  @widget(new SliderWidget(0.5, 3, 0.1))
  controlScale: number = 2.0

  @input
  @hint("Scale of overhead place signs (gates, lifts) read from several metres away")
  @widget(new SliderWidget(1, 6, 0.1))
  placeSignScale: number = 3.2
  @ui.group_end

  private _onScan = new Event<void>()
  private _onClosure = new Event<string>()
  private _onRide = new Event<string>()
  get onScan(): PublicApi<void> { return this._onScan.publicApi() }
  get onClosure(): PublicApi<string> { return this._onClosure.publicApi() }
  get onRide(): PublicApi<string> { return this._onRide.publicApi() }

  private items: SceneObject[] = []
  private scanSign: SceneObject | null = null
  private closures: {[id: string]: LabeledButton} = {}
  private rides: {[id: string]: LabeledButton} = {}

  clear(): void {
    for (const so of this.items) so.destroy()
    this.items = []
    this.scanSign = null
    this.closures = {}
    this.rides = {}
  }

  private root(name: string, localPos: vec3, scale: number): SceneObject {
    const so = obj(this.sceneObject, name, localPos)
    so.getTransform().setLocalScale(new vec3(scale, scale, scale))
    so.createComponent(Billboard.getTypeName())
    this.items.push(so)
    return so
  }

  private faded(a: number): vec4 {
    return new vec4(this.textColor.x, this.textColor.y, this.textColor.z, a)
  }

  // Overhead place sign ("Gate B12", "Lift 1", "Escalator ↑"…) with an icon.
  addPlaceSign(name: string, localPos: vec3, title: string, caption: string | null, iconName: string | null): void {
    const so = this.root("Sign_" + name, localPos, this.placeSignScale)
    const width = Math.max(12, title.length * 1.4 + 7)
    const p = makePanel(so, width, 1, 0.3)
    const row = addRow(p.content, "Row", width - 2, 3.4, 0.8)
    if (iconName) addIcon(row, "Icon", icon(iconName), 2.8, this.textColor)
    addText(row, "Title", title, "Headline1", width - (iconName ? 6 : 2), 3.4, this.textColor,
      110, iconName ? HorizontalAlignment.Left : HorizontalAlignment.Center)
    if (caption) addText(p.content, "Caption", caption, "Body", width - 2, 2, this.faded(0.8))
  }

  // The "you are here" sign at the entrance with the simulated scan button.
  setScanSign(localPos: vec3, title: string, buttonLabel: string, hint: string, standIn: string): void {
    const so = this.root("ScanSign", localPos, this.controlScale)
    const p = makePanel(so, 28, 1.8, 1)
    addText(p.content, "Title", title, "Title2", 25, 4, this.textColor)
    addText(p.content, "StandIn", standIn, "Body", 25, 2.2, this.faded(0.75))
    addButton(p.content, "ScanSignButton", buttonLabel, 24, 6.5, icon("qr_code_scanner"),
      () => this._onScan.invoke(), this.textColor, 110, "HeadlineXL", "Primary")
    addText(p.content, "Hint", hint, "Subheadline", 25, 2.4, this.faded(0.9))
    this.scanSign = so
    so.enabled = false
  }

  setScanSignVisible(visible: boolean): void {
    if (this.scanSign) this.scanSign.enabled = visible
  }

  isScanSignVisible(): boolean {
    return this.scanSign !== null && this.scanSign.enabled
  }

  // Red sign on a lift door (or any closable connection). Pinch = mark it out of service.
  addClosureSign(id: string, localPos: vec3, text: string): void {
    const so = this.root("ClosureSign_" + id, localPos, this.controlScale)
    const p = makePanel(so, 24, 1.2, 0.6, undefined, ALERT_TINT)
    const row = addRow(p.content, "AlertRow", 21, 3, 0.8)
    addIcon(row, "Icon", icon("block"), 2.6, this.textColor)
    addText(row, "AlertTitle", "Out of service?", "Headline1", 16, 3, this.textColor,
      110, HorizontalAlignment.Left)
    this.closures[id] = addButton(p.content, "ClosureButton_" + id, text, 21, 5.5, null,
      () => this._onClosure.invoke(id), this.textColor, 110, "Headline2")
  }

  setClosureClosed(id: string, closedText: string): void {
    const b = this.closures[id]
    if (b) b.label.text = closedText
  }

  // Ride button: lift floor button, "Ride escalator up", "Take stairs down"… The preview can't
  // ride a moving lift or escalator, so a pinch moves the traveller to the other end.
  addRideButton(id: string, localPos: vec3, text: string, iconName: string): void {
    const so = this.root("RidePanel_" + id, localPos, this.controlScale)
    const p = makePanel(so, 24, 1.2, 0.6)
    this.rides[id] = addButton(p.content, "RideButton_" + id, text, 22, 6, icon(iconName),
      () => this._onRide.invoke(id), this.textColor, 110, "Headline2", "Primary")
  }

  setRideButtonText(id: string, text: string): void {
    const b = this.rides[id]
    if (b) b.label.text = text
  }
}
