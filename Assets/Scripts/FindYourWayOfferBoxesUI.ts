// FindYourWayOfferBoxesUI — the two small boxes at a shop while you look at it: one offer each,
// "Sponsored" on the first for a paid place, and a small x on each that closes them for that shop.
// Created at runtime by FindYourWayMain under the building; Main places them (building-local) at the
// shop's front. Must not: choose the offers or remember what was closed (the core does).

import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {addButton, addText, CARD_TINT, LabeledButton, makePanel, obj} from "./FindYourWayWidgetsUI"
import {addPopIn} from "./FindYourWayPopIn"
import {THEME} from "./FindYourWayTheme"

const BOX_W = 26
const TEXT = new vec4(1, 1, 1, 1)
const SPONSOR = new vec4(THEME.sponsored[0], THEME.sponsored[1], THEME.sponsored[2], 1)
// The theme's card glass (no dark backing: it would vanish on Specs), white text with a thin outline.
const TINT = CARD_TINT
// Side by side, this far apart (cm, before scaling). Read from 3 to 6 m away: at SCALE the text is
// at least as large in view as the distance pill's at its 1 m.
const GAP_CM = 29
const SCALE = 4.4
// The shop's name sits this high above the middle of the boxes (cm, before scaling).
const TITLE_UP_CM = 9
const TITLE_W = BOX_W * 2 + 3

export interface OfferBoxesView {
  id: string
  // The shop's name, shown above the boxes so you see which shop you are looking at.
  title?: string
  tag: string
  boxes: string[]
}

// A thin dark outline keeps the white text readable over a bright shop front.
function outlined(t: Text): Text {
  t.outlineSettings.enabled = true
  t.outlineSettings.size = 0.12
  t.outlineSettings.fill.color = new vec4(0, 0, 0, 0.85)
  return t
}

@component
export class FindYourWayOfferBoxesUI extends BaseScriptComponent {
  private roots: SceneObject[] = []
  private texts: Text[] = []
  private tags: Text[] = []
  private closes: LabeledButton[] = []
  private shown: OfferBoxesView | null = null
  private titleRoot: SceneObject | null = null
  private title: Text | null = null

  setup(onClose: (id: string) => void): void {
    this.sceneObject.createComponent(Billboard.getTypeName())
    for (let i = 0; i < 2; i++) {
      const root = obj(this.sceneObject, "OfferBox" + i, new vec3((i - 0.5) * GAP_CM, 0, 0))
      const p = makePanel(root, BOX_W, 0.6, 0.2, undefined, TINT)
      this.tags.push(outlined(addText(p.content, "OfferBoxTag" + i, "", "Headline2", BOX_W - 1, 2.6, SPONSOR, 170)))
      this.texts.push(outlined(addText(p.content, "OfferBoxText" + i, "", "Headline1", BOX_W - 1, 5, TEXT, 220)))
      this.closes.push(addButton(p.content, "OfferBoxClose" + i, "x", 5, 3.2, null, () => {
        if (this.shown) onClose(this.shown.id)
      }, TEXT, 100, "Button"))
      this.roots.push(root)
    }
    this.titleRoot = obj(this.sceneObject, "OfferBoxTitle", new vec3(0, TITLE_UP_CM, 0))
    const tp = makePanel(this.titleRoot, TITLE_W, 0.6, 0.2, undefined, TINT)
    this.title = outlined(addText(tp.content, "OfferBoxTitleText", "", "Headline1", TITLE_W - 1, 4.2, TEXT, 220))
    this.getTransform().setLocalScale(new vec3(SCALE, SCALE, SCALE))
    addPopIn(this.sceneObject)
    this.sceneObject.enabled = false
  }

  // null hides them. localPos: building-local cm, where the boxes stand.
  show(v: OfferBoxesView | null, localPos: vec3 | null): void {
    const changed = !v || !this.shown || v.id !== this.shown.id || v.title !== this.shown.title || v.boxes.join("|") !== this.shown.boxes.join("|")
    this.shown = v
    this.sceneObject.enabled = v !== null
    if (!v) return
    if (localPos) this.getTransform().setLocalPosition(localPos)
    if (!changed) return
    if (this.title && this.titleRoot) {
      this.titleRoot.enabled = !!v.title
      this.title.text = v.title || ""
    }
    for (let i = 0; i < 2; i++) {
      const on = i < v.boxes.length
      this.roots[i].enabled = on
      if (!on) continue
      this.texts[i].text = v.boxes[i]
      this.tags[i].text = i === 0 && v.tag ? v.tag.split(" · ")[0] : ""
    }
  }

  isShown(): boolean { return this.sceneObject.enabled }
  getShown(): OfferBoxesView | null { return this.sceneObject.enabled ? this.shown : null }
}
