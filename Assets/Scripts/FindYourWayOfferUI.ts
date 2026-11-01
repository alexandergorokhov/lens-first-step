// FindYourWayOfferUI — the gold button in the view, saying what it opens, and the short list: the
// shop's name on top, at most 3 rows ("and more" at stairs), a Close button. Created at runtime by
// FindYourWayMain, which places both every frame. Must not: choose what shows (FindYourWayFreeWalk
// does); offers are read-only.

import {addButton, addIcon, addRow, addText, LabeledButton, makePanel, obj} from "./FindYourWayWidgetsUI"
import {icon, pictureFor} from "./FindYourWayIconsUI"

const LIST_WIDTH = 24
const DOT_W = 22
const DOT_H = 4.6
const ROWS = 3
const TEXT = new vec4(1, 1, 1, 1)
const SOFT = new vec4(1, 1, 1, 0.85)
const SPONSOR = new vec4(1, 0.85, 0.5, 1)

export interface OfferRowView {
  text: string
  price: string
  image?: string
}

export interface OfferListView {
  title: string
  tag: string
  rows: OfferRowView[]
  more: boolean
}

interface Row {
  picture: Image
  text: Text
  price: Text
}

@component
export class FindYourWayOfferUI extends BaseScriptComponent {
  private dotRoot: SceneObject
  private dot: LabeledButton
  private listRoot: SceneObject
  private title: Text
  private tag: Text
  private more: Text
  private rows: Row[] = []
  private shown: OfferListView | null = null

  setup(onDot: () => void, onClose: () => void): void {
    this.dotRoot = obj(this.sceneObject, "OfferDot")
    this.dotRoot.createComponent("Component.Canvas")
    this.dot = addButton(this.dotRoot, "DotButton", "", DOT_W, DOT_H, icon("location_on"), onDot, TEXT, 100, "Headline2", "Gold")
    this.dotRoot.enabled = false
    this.listRoot = obj(this.sceneObject, "OfferList")
    const p = makePanel(this.listRoot, LIST_WIDTH, 1.2, 0.5)
    this.title = addText(p.content, "OfferTitle", "Shop name up to here", "Headline1", LIST_WIDTH - 2, 3, TEXT, 100)
    this.tag = addText(p.content, "OfferTag", "", "Caption", LIST_WIDTH - 2, 1.6, SPONSOR, 100)
    for (let i = 0; i < ROWS; i++) {
      const row = addRow(p.content, "OfferRow" + i, LIST_WIDTH - 2, 2.8, 0.4)
      const picture = addIcon(row, "Picture", icon(null), 2.2, TEXT)
      const text = addText(row, "Text", "", "Body", 13.5, 2.8, TEXT, 100, HorizontalAlignment.Left)
      const price = addText(row, "Price", "", "Body", 5.5, 2.8, SOFT, 100, HorizontalAlignment.Right)
      this.rows.push({picture, text, price})
    }
    this.more = addText(p.content, "OfferMore", "", "Caption", LIST_WIDTH - 2, 1.6, SOFT, 100)
    addButton(p.content, "OfferCloseButton", "Close", LIST_WIDTH - 2, 3.6, icon("block"), onClose, TEXT, 100, "Button")
    this.listRoot.enabled = false
  }

  showDot(on: boolean): void { this.dotRoot.enabled = on }
  setDotText(text: string): void { if (this.dot.label.text !== text) this.dot.label.text = text }
  getDotText(): string { return this.dot.label.text }
  isDotShown(): boolean { return this.dotRoot.enabled }

  placeDot(pos: vec3, rot: quat): void {
    const t = this.dotRoot.getTransform()
    t.setWorldPosition(pos)
    t.setWorldRotation(rot)
  }

  // Shows the list (null hides it). An empty list says so, so opening a dot always answers.
  showList(v: OfferListView | null): void {
    this.shown = v
    this.listRoot.enabled = v !== null
    if (!v) return
    this.title.text = v.title
    this.tag.text = v.tag
    for (let i = 0; i < ROWS; i++) {
      const r = this.rows[i]
      const row = i < v.rows.length ? v.rows[i] : null
      r.text.text = row ? row.text : i === 0 ? "Nothing to show right now" : ""
      r.price.text = row ? row.price : ""
      const pic = row && row.image ? pictureFor(row.image) : null
      r.picture.enabled = pic !== null
      if (pic) r.picture.mainPass.baseTex = pic
    }
    this.more.text = v.more ? "and more" : ""
  }

  listRootObject(): SceneObject { return this.listRoot }
  isListShown(): boolean { return this.listRoot.enabled }
  getList(): OfferListView | null { return this.shown }
}
