// FindYourWayPickMapUI — "Where to?" as a map: the places on one floor where they really are; pinch
// one to go there. Created at runtime by FindYourWayMain, which places it.
// Must not: route (Main does, with the id it is given).

import {addPopIn} from "./FindYourWayPopIn"
import {addButton, addText, LabeledButton, makePanel, obj} from "./FindYourWayWidgetsUI"
import {mapLevels, MapDot, MapLevel, pickMapLayout, TourMap} from "./FindYourWayTour"

const WIDTH = 62
const AREA_H = 36
const MARGIN = 4
const MAX_DOTS = 24
const DOT_W = 10.5
const DOT_H = 3.2
const AREA_Y = -3.2
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayPickMapUI extends BaseScriptComponent {
  private dots: LabeledButton[] = []
  private ids: (string | null)[] = []
  private floorText: Text
  private map: TourMap | null = null
  private levels: MapLevel[] = []
  private level = 0

  setup(onPick: (id: string) => void, onClose: () => void): void {
    const panel = makePanel(this.sceneObject, WIDTH + 4, 1.6, 0.7)
    addPopIn(this.sceneObject)
    addText(panel.content, "PickMapTitle", "Pick a place", "Headline1", WIDTH, 3.4, TEXT, 100)
    this.floorText = addText(panel.content, "PickMapFloor", "", "Caption", WIDTH, 1.8, TEXT, 100)
    addText(panel.content, "PickMapArea", " ", "Caption", WIDTH, AREA_H, TEXT, 100)
    addButton(panel.content, "PickMapFloorButton", "Other floor", WIDTH, 3.6, null, () => this.nextFloor(), TEXT, 100, "Button")
    addButton(panel.content, "PickMapCloseButton", "Back", WIDTH, 3.6, null, onClose, TEXT, 100, "Button")
    const area = obj(this.sceneObject, "PickMapDots", new vec3(0, AREA_Y, 1.2))
    for (let i = 0; i < MAX_DOTS; i++) {
      this.ids.push(null)
      const b = addButton(area, "PickDot" + i, "", DOT_W, DOT_H, null, () => {
        const id = this.ids[i]
        if (id) onPick(id)
      }, TEXT, 100, "Caption")
      b.so.enabled = false
      this.dots.push(b)
    }
    this.sceneObject.enabled = false
  }

  open(map: TourMap, y: number): void {
    this.map = map
    this.levels = mapLevels(map)
    this.level = 0
    for (let i = 0; i < this.levels.length; i++) {
      if (Math.abs(this.levels[i].y - y) < Math.abs(this.levels[this.level].y - y)) this.level = i
    }
    this.sceneObject.enabled = true
    this.paint()
  }

  private nextFloor(): void {
    if (this.levels.length === 0) return
    this.level = (this.level + 1) % this.levels.length
    this.paint()
  }

  private paint(): void {
    const at = this.levels[this.level]
    this.floorText.text = at ? at.label + " (north is up)" : ""
    const shown: MapDot[] = this.map && at
      ? pickMapLayout(this.map, at.y, WIDTH - DOT_W, AREA_H - DOT_H, MARGIN).slice(0, MAX_DOTS) : []
    for (let i = 0; i < MAX_DOTS; i++) {
      const d = shown[i]
      this.ids[i] = d ? d.id : null
      this.dots[i].so.enabled = !!d
      if (!d) continue
      this.dots[i].label.text = d.label
      this.dots[i].so.getTransform().setLocalPosition(new vec3(d.x, d.y, 0))
    }
  }

  getDotCount(): number { return this.ids.filter((x) => x !== null).length }
  getDotId(i: number): string | null { return this.ids[i] }
  getFloorText(): string { return this.floorText.text }
  show(on: boolean): void { this.sceneObject.enabled = on }
  isShown(): boolean { return this.sceneObject.enabled }
}
