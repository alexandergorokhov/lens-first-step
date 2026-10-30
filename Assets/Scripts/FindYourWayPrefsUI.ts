// FindYourWayPrefsUI — the Free walk pop-up: keep the saved preset (labelled as a demo stand-in),
// or view and change it (one checkbox per category of the map), with the companion on or off.
// Created at runtime by FindYourWayMain. The list comes from the map (place.interests).
// Must not: decide what matches (FindYourWayFreeWalk does) or remember anything between walks.

import {addButton, addRow, addText, LabeledButton, makePanel, obj} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

export interface PrefsHandlers {
  onStart: () => void
  onCompanion: () => void
}

const WIDTH = 30
const PER_ROW = 3
const TEXT = new vec4(1, 1, 1, 1)
const SOFT = new vec4(1, 1, 1, 0.85)
const DESTROY_DELAY_S = 1

@component
export class FindYourWayPrefsUI extends BaseScriptComponent {
  private h: PrefsHandlers
  private ask: SceneObject | null = null
  private change: SceneObject | null = null
  private summary: Text
  private companionBtn: LabeledButton | null = null
  private companionAsk: LabeledButton | null = null
  private boxes: {[id: string]: LabeledButton} = {}
  private list: {id: string; label: string}[] = []
  private picked: {[id: string]: boolean} = {}
  private companionName = "Pet"
  private companionOn = true
  private listKey = ""

  setup(h: PrefsHandlers): void {
    this.h = h
    this.sceneObject.enabled = false
  }

  // Builds the panels for this map's list, starting from the preset. They are rebuilt only when
  // the list changes, later than the pinch that may have led here.
  open(list: {id: string; label: string}[], preset: string[], companionName: string, companionOn: boolean): void {
    this.list = list
    this.companionName = companionName
    this.companionOn = companionOn
    const key = list.map((i) => i.id + ":" + i.label).join(",")
    if (key !== this.listKey) {
      this.listKey = key
      this.rebuild()
    }
    this.picked = {}
    for (const id of preset) this.picked[id] = true
    for (const i of this.list) this.paint(i.id)
    this.paintCompanion()
    this.refreshSummary()
    this.showStage(false)
    this.sceneObject.enabled = true
  }

  private rebuild(): void {
    const old = [this.ask, this.change].filter((so) => !!so) as SceneObject[]
    for (const so of old) so.enabled = false
    if (old.length > 0) {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => { for (const so of old) if (!isNull(so)) so.destroy() })
      ev.reset(DESTROY_DELAY_S)
    }
    this.boxes = {}
    const a = obj(this.sceneObject, "PrefsAsk")
    const p = makePanel(a, WIDTH + 4, 1.8, 1)
    addText(p.content, "PrefsTitle", "Your preferences", "Headline1", WIDTH, 3.6, TEXT, 100)
    addText(p.content, "PrefsPresetTag", "Saved preset (demo)", "Body", WIDTH, 2.2, SOFT, 100)
    this.summary = addText(p.content, "PrefsSummary", "", "Headline2", WIDTH, 3, TEXT, 100)
    addButton(p.content, "PrefsKeepButton", "Keep them and walk", WIDTH, 6, icon("directions_walk"), () => this.h.onStart(), TEXT, 100, "Headline1", "Primary")
    addButton(p.content, "PrefsViewButton", "View or change", WIDTH, 4.5, null, () => this.showStage(true), TEXT, 100, "Headline2")
    this.companionAsk = addButton(p.content, "PrefsCompanionAskButton", "Companion: on", WIDTH, 4.5, null, () => this.h.onCompanion(), TEXT, 100, "Headline2")
    this.ask = a
    const c = obj(this.sceneObject, "PrefsChange")
    const q = makePanel(c, WIDTH + 4, 1.8, 0.8)
    addText(q.content, "PrefsChangeTitle", "What do you like?", "Headline1", WIDTH, 3.6, TEXT, 100)
    const w = (WIDTH - 1) / PER_ROW
    for (let r = 0; r * PER_ROW < this.list.length; r++) {
      const row = addRow(q.content, "PrefsRow" + r, WIDTH, 5, 0.5)
      for (const i of this.list.slice(r * PER_ROW, (r + 1) * PER_ROW)) {
        this.boxes[i.id] = addButton(row, "Pref_" + i.id, i.label, w, 4.6, null, () => this.toggle(i.id), TEXT, 100, "Caption")
      }
    }
    this.companionBtn = addButton(q.content, "PrefsCompanionButton", "Companion: on", WIDTH, 4.5, null, () => this.h.onCompanion(), TEXT, 100, "Headline2")
    addButton(q.content, "PrefsStartButton", "Start walking", WIDTH, 6, icon("directions_walk"), () => this.h.onStart(), TEXT, 100, "Headline1", "Primary")
    this.change = c
  }

  private showStage(changing: boolean): void {
    if (this.ask) this.ask.enabled = !changing
    if (this.change) this.change.enabled = changing
  }

  private toggle(id: string): void {
    this.picked[id] = !this.picked[id]
    this.paint(id)
    this.refreshSummary()
  }

  private paint(id: string): void {
    const b = this.boxes[id]
    const item = this.list.filter((i) => i.id === id)[0]
    if (b && item) b.label.text = (this.picked[id] ? "✓ " : "") + item.label
  }

  private refreshSummary(): void {
    if (this.summary) this.summary.text = this.list.filter((i) => this.picked[i.id]).map((i) => i.label).join(", ") || "Nothing picked"
  }

  private paintCompanion(): void {
    const text = this.companionName + ": " + (this.companionOn ? "on" : "off")
    if (this.companionBtn) this.companionBtn.label.text = text
    if (this.companionAsk) this.companionAsk.label.text = text
  }

  setCompanion(name: string, on: boolean): void {
    this.companionName = name
    this.companionOn = on
    this.paintCompanion()
  }

  getPicked(): string[] { return this.list.filter((i) => this.picked[i.id]).map((i) => i.id) }
  getSummary(): string { return this.summary ? this.summary.text : "" }
  isChanging(): boolean { return !!this.change && this.change.enabled }
  show(on: boolean): void { this.sceneObject.enabled = on }
  isShown(): boolean { return this.sceneObject.enabled }
}
