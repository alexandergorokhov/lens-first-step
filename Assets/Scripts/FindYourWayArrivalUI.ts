// FindYourWayArrivalUI — the card over the destination ("Gate C3. Boarding in 6 min.").
// Main positions it (building-local), picks the icon from the map and calls show/hide.
// Must not: detect arrival itself.

import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {addIcon, addRow, addText, easeOutCubic, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

@component
export class FindYourWayArrivalUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Arrival card – shown within 3 m of the destination</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Card scale (1 = sized for ~1.1 m reading distance; the card is read from ~3 m)")
  @widget(new SliderWidget(1, 5, 0.1))
  cardScale: number = 2.4

  @input("vec4", "{1,1,1,1}")
  @hint("Text colour")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private text: Text
  private img: Image
  private t = -1

  onAwake() {
    this.sceneObject.createComponent(Billboard.getTypeName())
    const panel = makePanel(this.sceneObject, 28, 1.4, 0.4)
    const row = addRow(panel.content, "Row", 26, 4.5, 0.8)
    this.img = addIcon(row, "Icon", icon(null), 3.2, this.textColor)
    this.text = addText(row, "ArrivalText", "Gate C3. Boarding in 6 min.", "Headline1", 21, 4.5,
      this.textColor, 110, HorizontalAlignment.Left)
    this.sceneObject.enabled = false
    this.createEvent("UpdateEvent").bind(() => {
      if (this.t < 0) return
      this.t += getDeltaTime()
      const s = this.cardScale * (0.8 + 0.2 * easeOutCubic(this.t / 0.4))
      this.sceneObject.getTransform().setLocalScale(new vec3(s, s, s))
      if (this.t > 0.4) this.t = -1
    })
  }

  show(text: string, localPos: vec3, iconName?: string | null): void {
    this.text.text = text
    if (this.img.mainMaterial) this.img.mainMaterial.mainPass.baseTex = icon(iconName)
    this.sceneObject.getTransform().setLocalPosition(localPos)
    if (!this.sceneObject.enabled) this.t = 0
    this.sceneObject.enabled = true
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  getShownText(): string | null {
    return this.sceneObject.enabled ? this.text.text : null
  }
}
