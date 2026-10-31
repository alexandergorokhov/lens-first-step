// FindYourWayWhereToUI — the "Where to?" list: the map's places by name, a page at a time. It does
// the same job as the voice stand-in. Created at runtime by FindYourWayMain.
// Must not: route (Main does, with the id it is given).

import {addButton, addText, LabeledButton, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

const WIDTH = 30
const PAGE = 5
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayWhereToUI extends BaseScriptComponent {
  private items: {id: string; label: string}[] = []
  private page = 0
  private rows: LabeledButton[] = []
  private ids: (string | null)[] = []
  private pageText: Text

  setup(onPick: (id: string) => void, onClose: () => void, onMap: () => void): void {
    const panel = makePanel(this.sceneObject, WIDTH + 4, 1.8, 0.7)
    addText(panel.content, "WhereToTitle", "Where to?", "Headline1", WIDTH, 3.6, TEXT, 100)
    this.pageText = addText(panel.content, "WhereToPage", "", "Caption", WIDTH, 1.8, TEXT, 100)
    for (let i = 0; i < PAGE; i++) {
      this.rows.push(addButton(panel.content, "WhereToRow" + i, "", WIDTH, 4.2, icon("location_on"), () => {
        const id = this.ids[i]
        if (id) onPick(id)
      }, TEXT, 100, "Button"))
      this.ids.push(null)
    }
    addButton(panel.content, "WhereToMoreButton", "More", WIDTH, 3.8, null, () => this.next(), TEXT, 100, "Button")
    addButton(panel.content, "WhereToMapButton", "Show on a map", WIDTH, 3.8, icon("map"), onMap, TEXT, 100, "Button")
    addButton(panel.content, "WhereToCloseButton", "Back", WIDTH, 3.8, null, onClose, TEXT, 100, "Button")
    this.sceneObject.enabled = false
  }

  open(items: {id: string; label: string}[]): void {
    this.items = items
    this.page = 0
    this.paint()
    this.sceneObject.enabled = true
  }

  private pages(): number {
    return Math.max(1, Math.ceil(this.items.length / PAGE))
  }

  private next(): void {
    this.page = (this.page + 1) % this.pages()
    this.paint()
  }

  private paint(): void {
    this.pageText.text = "Page " + (this.page + 1) + " of " + this.pages()
    for (let i = 0; i < PAGE; i++) {
      const it = this.items[this.page * PAGE + i]
      this.ids[i] = it ? it.id : null
      this.rows[i].label.text = it ? it.label : ""
    }
  }

  getShownLabels(): string[] { return this.rows.map((r) => r.label.text).filter((t) => t !== "") }
  show(on: boolean): void { this.sceneObject.enabled = on }
  isShown(): boolean { return this.sceneObject.enabled }
}
