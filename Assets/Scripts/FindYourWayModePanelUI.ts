// FindYourWayModePanelUI — the first panel: pick Walk or Step-Free once for the whole trip.
// Owns: the panel's UIKit surface, its two big buttons and the interests row (what the companion
// may point out: none picked by default). Emits onWalk / onStepFree.
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
  private _onMapping = new Event<void>()
  get onMapping(): PublicApi<void> { return this._onMapping.publicApi() }
  get onWalk(): PublicApi<void> { return this._onWalk.publicApi() }
  get onStepFree(): PublicApi<void> { return this._onStepFree.publicApi() }

  onAwake() {
    const width = this.buttonWidthCm + 4
    const panel = makePanel(this.sceneObject, width, 2.2, 1.4)
    addText(panel.content, "Title", this.title, "Title2", width - 3, 4, this.textColor, 100)
    addText(panel.content, "Subtitle", this.subtitle, "Headline2", width - 3, 2.8,
      new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85), 100)
    addButton(panel.content, "WalkButton", this.walkLabel, this.buttonWidthCm, this.buttonHeightCm,
      icon("directions_walk"), () => this._onWalk.invoke(), this.textColor, 100, "HeadlineXL", "Primary")
    addButton(panel.content, "StepFreeButton", this.stepFreeLabel, this.buttonWidthCm,
      this.buttonHeightCm, icon("accessible"), () => this._onStepFree.invoke(), this.textColor, 100,
      "Headline1", "Primary")
    addButton(panel.content, "MapThisPlaceButton", "Learn this place (map it by walking)", this.buttonWidthCm, 4.2,
      icon("map"), () => this._onMapping.invoke(), this.textColor, 100, "Caption")
    addText(panel.content, "InterestsTitle", "Point out (optional):", "Headline2", width - 3, 2.6,
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
