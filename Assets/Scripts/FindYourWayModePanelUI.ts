// FindYourWayModePanelUI — the Go to a place panel: say where to (the labelled "Say it" stand-in for
// speech, or the "Where to?" list), then pick Walk or Step-Free once for the whole trip.
// Owns: the panel's UIKit surface, its buttons and the interests row (what the companion may point
// out: none picked by default). Emits onWalk / onStepFree / onSayIt / onWhereTo.
// Must not: decide routing or remember the choice (FindYourWayMain owns the profile).

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {addButton, addRow, addText, LabeledButton, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

const INTEREST_LABEL: {[id: string]: string} = {
  coffee: "Coffee", food: "Food", shopping: "Shops", toilet: "Toilets", pharmacy: "Pharmacy",
  accessibleToilet: "Acc. toilets",
}

@component
export class FindYourWayModePanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Mode panel – Walk or Step-Free, chosen once</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Panel title")
  title: string = "How are you getting there?"

  @input
  @hint("Line under the title")
  subtitle: string = "Choose once for the whole trip"

  @input
  @hint("Label of the walking button")
  walkLabel: string = "Walk"

  @input
  @hint("Label of the wheelchair / step-free button")
  stepFreeLabel: string = "Step-Free (wheelchair)"

  @input
  @hint("Width of each mode button, cm")
  @widget(new SliderWidget(16, 40, 1))
  buttonWidthCm: number = 30

  @input
  @hint("Height of each mode button, cm (big targets)")
  @widget(new SliderWidget(4, 10, 0.5))
  buttonHeightCm: number = 7.5

  @input("vec4", "{1,1,1,1}")
  @hint("Text and icon colour (keep light — the display is additive)")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private picked: {[interest: string]: boolean} = {}
  private interestButtons: {[interest: string]: LabeledButton} = {}
  private _onWalk = new Event<void>()
  private _onStepFree = new Event<void>()
  private _onSayIt = new Event<void>()
  private _onWhereTo = new Event<void>()
  private _onTalk = new Event<void>()
  private destText: Text
  private sayIt: LabeledButton
  get onSayIt(): PublicApi<void> { return this._onSayIt.publicApi() }
  get onWhereTo(): PublicApi<void> { return this._onWhereTo.publicApi() }
  get onTalk(): PublicApi<void> { return this._onTalk.publicApi() }
  get onWalk(): PublicApi<void> { return this._onWalk.publicApi() }
  get onStepFree(): PublicApi<void> { return this._onStepFree.publicApi() }

  onAwake() {
    const width = this.buttonWidthCm + 4
    const panel = makePanel(this.sceneObject, width, 2.2, 1.4)
    addText(panel.content, "Title", this.title, "Title2", width - 3, 4, this.textColor, 100)
    this.destText = addText(panel.content, "Subtitle", this.subtitle, "Headline2", width - 3, 2.8,
      new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85), 100)
    this.sayIt = addButton(panel.content, "SayItButton", "Say it", this.buttonWidthCm, 4.2, null,
      () => this._onSayIt.invoke(), this.textColor, 100, "Button")
    addText(panel.content, "SayItHint", "stand-in: a preset phrase", "Caption", width - 3, 1.8,
      new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85), 100)
    addButton(panel.content, "TalkButton", "Talk: say a place", this.buttonWidthCm, 4.2, null,
      () => this._onTalk.invoke(), this.textColor, 100, "Button")
    addButton(panel.content, "WhereToButton", "Where to?", this.buttonWidthCm, 4.2, icon("location_on"),
      () => this._onWhereTo.invoke(), this.textColor, 100, "Button")
    addButton(panel.content, "WalkButton", this.walkLabel, this.buttonWidthCm, this.buttonHeightCm - 1.5,
      icon("directions_walk"), () => this._onWalk.invoke(), this.textColor, 100, "HeadlineXL", "Primary")
    addButton(panel.content, "StepFreeButton", this.stepFreeLabel, this.buttonWidthCm,
      this.buttonHeightCm - 1.5, icon("accessible"), () => this._onStepFree.invoke(), this.textColor, 100,
      "Headline1", "Primary")
    addText(panel.content, "InterestsTitle", "Point out (optional):", "Caption", width - 3, 2,
      new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85), 100)
    const rows = [["coffee", "food", "shopping"], ["toilet", "pharmacy", "accessibleToilet"]]
    const w = (this.buttonWidthCm - 1) / 3
    for (let r = 0; r < rows.length; r++) {
      const row = addRow(panel.content, "InterestsRow" + r, this.buttonWidthCm, 4, 0.5)
      for (const id of rows[r]) {
        this.interestButtons[id] = addButton(row, "Interest_" + id, INTEREST_LABEL[id], w, 3.6, null,
          () => this.toggleInterest(id), this.textColor, 100, "Caption")
      }
    }
  }

  // The destination line ("To: Bolt Hardware") and the phrase on the "Say it" button.
  setDestination(label: string): void { this.destText.text = "To: " + label }
  setNote(text: string): void { this.destText.text = text }
  getDestinationText(): string { return this.destText.text }
  setSayItPhrase(phrase: string): void { this.sayIt.label.text = phrase ? 'Say it: "' + phrase + '"' : "Say it" }

  private toggleInterest(id: string): void {
    this.picked[id] = !this.picked[id]
    const b = this.interestButtons[id]
    if (b) b.label.text = (this.picked[id] ? "✓ " : "") + INTEREST_LABEL[id]
  }

  // The picked interests (category ids as in the map: coffee, food, shopping, toilet, pharmacy,
  // accessibleToilet), in a fixed order.
  getInterests(): string[] {
    return Object.keys(INTEREST_LABEL).filter((k) => this.picked[k])
  }

  // Test hook: set the picked interests directly (the same state the buttons toggle).
  setInterests(ids: string[]): void {
    for (const k of Object.keys(INTEREST_LABEL)) if (!!this.picked[k] !== (ids.indexOf(k) >= 0)) this.toggleInterest(k)
  }

  show(): void { this.sceneObject.enabled = true }
  hide(): void { this.sceneObject.enabled = false }
  isShown(): boolean { return this.sceneObject.enabled }
}
