// FindYourWayPlacesUI — small place icons on the shop fronts (~1.75 m up, building-local cm):
// one per map place, hidden until Main says which are visible (visiblePlaces: ≤3, your floor,
// near you and the route). The place the companion points at brightens and shows its name, its
// tag ("Sponsored · demo" for sponsored places, always) and a "Go here?" button.
// Created at runtime by FindYourWayMain (child of the building). Must not: choose places or
// change the route (Main does, on "Go here?").

import {addButton, addIcon, addRow, addText, makePanel, obj} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

const ICON_HEIGHT_CM = 175
const DIM = new vec4(1, 1, 1, 0.6)
const BRIGHT = new vec4(1, 1, 1, 1)

const CATEGORY_ICON: {[category: string]: string} = {
  lift: "elevator",
  accessibleToilet: "accessible",
  toilet: "info",
  pharmacy: "local_hospital",
}

interface Sign {
  root: SceneObject
  name: Text
  tag: Text
  label: string
  tagText: string
  sponsored: boolean
}

// Pinched buttons are destroyed a moment later: the interactor still holds them for a few frames.
const DESTROY_DELAY_S = 1

@component
export class FindYourWayPlacesUI extends BaseScriptComponent {
  private signs: {[id: string]: Sign} = {}
  private goHere: SceneObject | null = null
  private goHereId: string | null = null
  private onGoHere: (id: string) => void = () => {}
  private lastKey = ""

  setup(onGoHere: (id: string) => void): void {
    this.onGoHere = onGoHere
  }

  clear(): void {
    this.dropGoHere()
    const old: SceneObject[] = []
    for (const id in this.signs) old.push(this.signs[id].root)
    this.later(old)
    this.signs = {}
    this.lastKey = ""
  }

  private later(objs: SceneObject[]): void {
    for (const so of objs) if (!isNull(so)) so.enabled = false
    if (objs.length === 0) return
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => { for (const so of objs) if (!isNull(so)) so.destroy() })
    ev.reset(DESTROY_DELAY_S)
  }

  private dropGoHere(): void {
    if (this.goHere) this.later([this.goHere])
    this.goHere = null
    this.goHereId = null
  }

  // One hidden sign per place; pos = the place node in building-local cm (floor level),
  // facing = yaw (radians) toward the walkway.
  addPlace(id: string, pos: vec3, yaw: number, label: string, category: string, tag: string, sponsored: boolean): void {
    const root = obj(this.sceneObject, "Place_" + id, pos.add(new vec3(0, ICON_HEIGHT_CM, 0)))
    root.getTransform().setLocalRotation(quat.angleAxis(yaw, vec3.up()))
    const p = makePanel(root, 16, 0.5, 0.2)
    const row = addRow(p.content, "Row", 15, 3, 0.4)
    addIcon(row, "Icon", icon(CATEGORY_ICON[category] || "location_on"), 2.4, DIM)
    const name = addText(row, "Name", label, "Headline2", 11, 3, DIM, 110, HorizontalAlignment.Left)
    const tagT = addText(p.content, "Tag", tag, "Caption", 15, 1.8, DIM, 110)
    tagT.text = tag
    root.enabled = false
    this.signs[id] = {root, name, tag: tagT, label, tagText: tag, sponsored}
  }

  // Shows exactly these places (ids); pointed = the one the companion points at (or null).
  show(ids: string[], pointed: string | null): void {
    const key = ids.join(",") + "|" + pointed
    if (key === this.lastKey) return
    this.lastKey = key
    for (const id in this.signs) {
      const s = this.signs[id]
      const on = ids.indexOf(id) >= 0 || id === pointed
      s.root.enabled = on
      const c = id === pointed ? BRIGHT : DIM
      s.name.textFill.color = c
      s.tag.textFill.color = c
      // Sponsored tags always show; other places show their name only when pointed at.
      s.tag.getSceneObject().enabled = s.tagText !== "" && (id === pointed || s.sponsored)
    }
    this.showGoHere(pointed)
  }

  private showGoHere(id: string | null): void {
    if (id === this.goHereId) return
    this.dropGoHere()
    this.goHereId = id
    const s = id ? this.signs[id] : null
    if (!s || !id) return
    this.goHere = obj(s.root, "GoHere", new vec3(0, -8, 0))
    const p = makePanel(this.goHere, 14, 0.4, 0.2)
    addButton(p.content, "GoHereButton", "Go here?", 13, 3.6, icon("location_on"), () => this.onGoHere(id), BRIGHT, 110)
  }

  visibleIds(): string[] {
    return Object.keys(this.signs).filter((id) => this.signs[id].root.enabled)
  }

  tagOf(id: string): string | null {
    const s = this.signs[id]
    return s && s.tag.getSceneObject().enabled ? s.tagText : null
  }

  goHereShownFor(): string | null { return this.goHereId }
}
