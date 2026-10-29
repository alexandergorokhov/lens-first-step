// FindYourWayModePanelUI — the first panel: pick Walk or Step-Free once for the whole trip.
// Owns: the panel's UIKit surface and its two big buttons. Emits onWalk / onStepFree.
// Must not: decide routing or remember the choice (FindYourWayMain owns the profile).

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {addButton, addText, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

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

  private _onWalk = new Event<void>()
  private _onStepFree = new Event<void>()
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
  }

  show(): void { this.sceneObject.enabled = true }
  hide(): void { this.sceneObject.enabled = false }
  isShown(): boolean { return this.sceneObject.enabled }
}
