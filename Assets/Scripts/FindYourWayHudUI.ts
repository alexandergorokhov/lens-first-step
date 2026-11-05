// FindYourWayHudUI — head-locked HUD (child of the camera): the short-lived notice card in
// the top-right corner ("Gate change B12 → C3", lift closed, ask staff) and the small
// online/offline map badge; the distance pill (bottom centre, floor badge first), the floor-change
// cue just above it, the companion's score chip under the map badge and the play line (Hop /
// catch hints and score). Must not: decide when a gate changes or which map is used.

import {cardClock} from "./FindYourWayPlace"
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

  @input("vec3", "{0,-9,-70}")
  @hint("Distance pill position relative to the camera, cm (bottom centre)")
  pillPosition: vec3 = new vec3(0, -9, -70)

  @input("vec3", "{0,-5.6,-70}")
  @hint("Floor-change cue position (just above the pill), cm")
  cuePosition: vec3 = new vec3(0, -5.6, -70)

  @input("vec3", "{-8,5.2,-70}")
  @hint("Companion score chip position (under the map badge), cm")
  scorePosition: vec3 = new vec3(-8, 5.2, -70)

  @input("vec3", "{0,-12.2,-70}")
  @hint("Play line position (Hop / catch), cm")
  playPosition: vec3 = new vec3(0, -12.2, -70)

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
  private pill: SceneObject
  private pillText: Text
  private cue: SceneObject
  private cueText: Text
  private score: SceneObject
  private scoreText: Text
  private play: SceneObject
  private playText: Text
  private showBadge = true
  private showPill = true
  private showCue = true
  private pillWanted: string | null = null
  private cueWanted: string | null = null
  private showScore = true
  private showPlay = true
  private badgeWanted: string | null = null
  private scoreWanted: string | null = null
  private playWanted: string | null = null
  private cardTime = -1
  private cardFresh = false
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

    const line = (name: string, pos: vec3, width: number, value: string): [SceneObject, Text] => {
      const so = obj(this.sceneObject, name, pos)
      const p = makePanel(so, width, 0.4, 0.2)
      const t = addText(p.content, name + "Text", value, "Headline2", width - 1, 2, this.textColor, 70)
      so.enabled = false
      return [so, t]
    }
    ;[this.pill, this.pillText] = line("DistancePill", this.pillPosition, 26, "Gate B12 · 140 m · 3 min")
    ;[this.cue, this.cueText] = line("FloorCue", this.cuePosition, 24, "In 15 m: escalator up")
    ;[this.score, this.scoreText] = line("ScoreChip", this.scorePosition, 9, "Treats 0 of 0")
    ;[this.play, this.playText] = line("PlayLine", this.playPosition, 24, "Raise your hand: Pet jumps")

    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // One-line chips: null hides; same text = no work.
  private setLine(so: SceneObject, t: Text, text: string | null): void {
    if (text === null) {
      so.enabled = false
      return
    }
    if (t.text !== text) t.text = text
    so.enabled = true
  }

  setPill(text: string | null): void {
    this.pillWanted = text
    this.setLine(this.pill, this.pillText, this.showPill ? text : null)
  }
  getPillText(): string | null { return this.pill.enabled ? this.pillText.text : null }
  getPillWanted(): string | null { return this.pillWanted }
  setCue(text: string | null): void {
    this.cueWanted = text
    this.setLine(this.cue, this.cueText, this.showCue ? text : null)
  }
  getCueText(): string | null { return this.cue.enabled ? this.cueText.text : null }
  getCueWanted(): string | null { return this.cueWanted }
  setScore(text: string | null): void {
    this.scoreWanted = text
    this.setLine(this.score, this.scoreText, this.showScore ? text : null)
  }
  getScoreText(): string | null { return this.score.enabled ? this.scoreText.text : null }
  getScoreWanted(): string | null { return this.scoreWanted }
  getBadgeWanted(): string | null { return this.badgeWanted }
  setPlayLine(text: string | null): void {
    this.playWanted = text
    this.setLine(this.play, this.playText, this.showPlay ? text : null)
  }
  getPlayLine(): string | null { return this.play.enabled ? this.playText.text : null }

  // A clear view while walking (core quietView): rows hidden here keep their text and come back.
  setQuiet(badge: boolean, score: boolean, play: boolean, pill: boolean = true, cue: boolean = true): void {
    if (pill !== this.showPill) {
      this.showPill = pill
      this.setPill(this.pillWanted)
    }
    if (cue !== this.showCue) {
      this.showCue = cue
      this.setCue(this.cueWanted)
    }
    if (badge !== this.showBadge) {
      this.showBadge = badge
      this.setBadge(this.badgeWanted)
    }
    if (score !== this.showScore) {
      this.showScore = score
      this.setScore(this.scoreWanted)
    }
    if (play !== this.showPlay) {
      this.showPlay = play
      this.setPlayLine(this.playWanted)
    }
  }

  showCard(text: string, iconName?: string | null, seconds?: number): void {
    this.cardText.text = text
    const m = this.cardIcon.mainMaterial
    if (m) m.mainPass.baseTex = icon(iconName || "info")
    this.cardDuration = seconds !== undefined ? seconds : this.cardSeconds
    this.cardTime = 0
    this.cardFresh = true
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
    this.badgeWanted = text
    if (text === null || !this.showBadge) {
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
    // The first tick's delta is the frame before the card existed.
    if (!this.cardFresh) this.cardTime = cardClock(this.cardTime, getDeltaTime())
    this.cardFresh = false
    // Gentle pop-in, then hide after cardDuration.
    const s = 0.85 + 0.15 * easeOutCubic(this.cardTime / 0.35)
    this.card.root.getTransform().setLocalScale(new vec3(s, s, s))
    if (this.cardTime >= this.cardDuration) this.hideCard()
  }
}
