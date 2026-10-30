// FindYourWayMappingPanelUI — the Map builder panel. The walk records itself; here you Mark shop
// (stand in front of it, face it, one pinch), confirm a detected floor change (one pinch on the
// guess, or pick another kind), fall back to Next floor, Undo, See my map and Upload. Created at
// runtime by FindYourWayMain, which follows it with the head. Emits through the callbacks given to
// setup(). Must not: build the map (FindYourWayMapping's WalkTracer does).

import {addButton, addRow, addText, LabeledButton, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

export interface MappingHandlers {
  onMarkShop: () => void
  onConfirmFloor: () => void
  onTag: (kind: string) => void
  onNextFloor: () => void
  onUndo: () => void
  onSeeMap: () => void
  onUpload: () => void
  onCancel: () => void
}

const WIDTH = 30
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayMappingPanelUI extends BaseScriptComponent {
  private status: Text
  private confirm: LabeledButton
  private seeMap: LabeledButton

  setup(h: MappingHandlers): void {
    const panel = makePanel(this.sceneObject, WIDTH + 2, 1.4, 0.8)
    addText(panel.content, "MappingTitle", "Map builder", "Title2", WIDTH, 3.6, TEXT, 80)
    this.status = addText(panel.content, "MappingStatus", "Just walk: the path records itself", "Body", WIDTH, 2.4, TEXT, 80)
    addButton(panel.content, "MarkShopButton", "Mark shop", WIDTH, 6.5, icon("location_on"), h.onMarkShop, TEXT, 80, "HeadlineXL", "Primary")
    this.confirm = addButton(panel.content, "ConfirmFloorButton", "No floor change yet", WIDTH, 4.2, icon("stairs"), h.onConfirmFloor, TEXT, 80, "Button")
    const tags = addRow(panel.content, "TagRow", WIDTH, 4, 0.4)
    const w = (WIDTH - 1.5) / 4
    addButton(tags, "TagStairsButton", "Stairs", w, 3.6, null, () => h.onTag("stairs"), TEXT, 80, "Caption")
    addButton(tags, "TagEscalatorButton", "Escalator", w, 3.6, null, () => h.onTag("escalator"), TEXT, 80, "Caption")
    addButton(tags, "TagLiftButton", "Lift", w, 3.6, null, () => h.onTag("lift"), TEXT, 80, "Caption")
    addButton(tags, "TagRampButton", "Ramp", w, 3.6, null, () => h.onTag("ramp"), TEXT, 80, "Caption")
    const more = addRow(panel.content, "MoreRow", WIDTH, 4, 0.4)
    const w3 = (WIDTH - 1) / 3
    addButton(more, "NextFloorButton", "Next floor", w3, 3.6, null, h.onNextFloor, TEXT, 80, "Caption")
    addButton(more, "UndoButton", "Undo", w3, 3.6, null, h.onUndo, TEXT, 80, "Caption")
    addButton(more, "CancelMappingButton", "Cancel", w3, 3.6, null, h.onCancel, TEXT, 80, "Caption")
    const end = addRow(panel.content, "EndRow", WIDTH, 5, 0.4)
    const w2 = (WIDTH - 0.5) / 2
    this.seeMap = addButton(end, "SeeMapButton", "See my map", w2, 4.5, icon("map"), h.onSeeMap, TEXT, 80, "Button")
    addButton(end, "UploadMapButton", "Upload", w2, 4.5, null, h.onUpload, TEXT, 80, "Headline2", "Primary")
  }

  setStatus(text: string): void { this.status.text = text }
  getStatus(): string { return this.status.text }
  // guess: the detected kind waiting to be confirmed, or null.
  setFloorGuess(guess: string | null): void {
    this.confirm.label.text = guess ? "Confirm floor change: " + guess : "No floor change yet"
  }
  getConfirmLabel(): string { return this.confirm.label.text }
  setSeeMap(on: boolean): void { this.seeMap.label.text = on ? "Hide my map" : "See my map" }
  show(on: boolean): void { this.sceneObject.enabled = on }
  isShown(): boolean { return this.sceneObject.enabled }
}
