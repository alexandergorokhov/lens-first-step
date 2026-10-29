// FindYourWayHudUI — head-locked HUD (child of the camera): the short-lived notice card in
// the top-right corner ("Gate change B12 → C3", lift closed, ask staff) and the small
// online/offline map badge. Must not: decide when a gate changes or which map is used.

import {addIcon, addRow, addText, easeOutCubic, makePanel, obj, Panel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

@component
export class FindYourWayHudUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HUD – notice card (top-right) and map badge</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input("vec3", "{7,7,-70}")
  @hint("Notice card position relative to the camera, cm (top-right, inside the ~32° view)")
  cardPosition: vec3 = new vec3(7, 7, -70)

  @input("vec3", "{-8,8,-70}")
  @hint("Map badge position relative to the camera, cm")
  badgePosition: vec3 = new vec3(-8, 8, -70)

  @input("vec3", "{0,11.5,-70}")
  @hint("Demo caption position relative to the camera, cm (top centre)")
  captionPosition: vec3 = new vec3(0, 11.5, -70)

  @input
  @hint("Seconds the notice card stays up")
  @widget(new SliderWidget(1, 15, 0.5))
  cardSeconds: number = 5

  @input("vec4", "{1,1,1,1}")
  @hint("Card text colour")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private card: Panel
  private cardText: Text
  private cardIcon: Image
  private badge: SceneObject
  private caption: SceneObject
  private captionText: Text
  private badgeText: Text
  private cardTime = -1
  private cardDuration = 5

  onAwake() {
    const cardRoot = obj(this.sceneObject, "NoticeCard", this.cardPosition)
    this.card = makePanel(cardRoot, 14, 0.8, 0.3)
    const row = addRow(this.card.content, "Row", 13, 4, 0.5)
    this.cardIcon = addIcon(row, "Icon", icon("info"), 2.2, this.textColor)
    this.cardText = addText(row, "CardText", "Gate change B12 → C3", "Headline1", 10, 4,
      this.textColor, 70, HorizontalAlignment.Left)
    cardRoot.enabled = false

    this.badge = obj(this.sceneObject, "MapBadge", this.badgePosition)
    const b = makePanel(this.badge, 8, 0.4, 0.2)
    const brow = addRow(b.content, "Row", 7.5, 2, 0.4)
    addIcon(brow, "Icon", icon("map"), 1.5, this.textColor)
    this.badgeText = addText(brow, "BadgeText", "offline map", "Headline2", 5.5, 2,
      this.textColor, 70, HorizontalAlignment.Left)
    this.badge.enabled = false

    // Demo caption: one short line, top centre, only while the autoplay demo runs.
    this.caption = obj(this.sceneObject, "DemoCaption", this.captionPosition)
    const c = makePanel(this.caption, 24, 0.5, 0.2)
    this.captionText = addText(c.content, "CaptionText", "Find Your Way Inside", "Headline2", 23, 2.4,
      this.textColor, 70)
    this.caption.enabled = false

    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  showCard(text: string, iconName?: string | null, seconds?: number): void {
    this.cardText.text = text
    const m = this.cardIcon.mainMaterial
    if (m) m.mainPass.baseTex = icon(iconName || "info")
    this.cardDuration = seconds !== undefined ? seconds : this.cardSeconds
    this.cardTime = 0
    this.card.root.enabled = true
  }

  hideCard(): void {
    this.cardTime = -1
    this.card.root.enabled = false
  }

  getCardText(): string | null {
    return this.card.root.enabled ? this.cardText.text : null
  }

  setCaption(text: string | null): void {
    if (text === null) {
      this.caption.enabled = false
      return
    }
    this.captionText.text = text
    this.caption.enabled = true
  }

  getCaption(): string | null {
    return this.caption.enabled ? this.captionText.text : null
  }

  setBadge(text: string | null): void {
    if (text === null) {
      this.badge.enabled = false
      return
    }
    this.badgeText.text = text
    this.badge.enabled = true
  }

  getBadgeText(): string | null {
    return this.badge.enabled ? this.badgeText.text : null
  }

  private tick(): void {
    if (this.cardTime < 0) return
    this.cardTime += getDeltaTime()
    // Gentle pop-in, then hide after cardDuration.
    const s = 0.85 + 0.15 * easeOutCubic(this.cardTime / 0.35)
    this.card.root.getTransform().setLocalScale(new vec3(s, s, s))
    if (this.cardTime >= this.cardDuration) this.hideCard()
  }
}
