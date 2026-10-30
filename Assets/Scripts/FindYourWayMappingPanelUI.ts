// FindYourWayMappingPanelUI — the "Learn this place" panel: walk, pinch Point here at corners,
// doors, lifts and stairs; tag the last stretch (stairs / lift / ramp / step-free), name the last
// point from a short list, mark the next floor, undo, Save (route on it at once) or Cancel.
// Created at runtime by FindYourWayMain, which follows it with the head. Emits through the
// callbacks given to setup(). Must not: build the map (FindYourWayMapping's MapRecorder does).

import {addButton, addRow, addText, LabeledButton, makePanel} from "./FindYourWayWidgetsUI"
import {icon} from "./FindYourWayIconsUI"

export interface MappingHandlers {
  onPoint: () => void
  onTag: (kind: string) => void
  onNameNext: () => void
  onName: () => void
  onNextFloor: () => void
  onUndo: () => void
  onSave: () => void
  onCancel: () => void
}

const WIDTH = 30
const TEXT = new vec4(1, 1, 1, 1)

@component
export class FindYourWayMappingPanelUI extends BaseScriptComponent {
  private status: Text
  private nameBtn: LabeledButton

  setup(h: MappingHandlers): void {
    const panel = makePanel(this.sceneObject, WIDTH + 2, 1.4, 0.8)
    addText(panel.content, "MappingTitle", "Learn this place", "Title2", WIDTH, 3.6, TEXT, 80)
    this.status = addText(panel.content, "MappingStatus", "Stand at the entrance sign", "Body", WIDTH, 2.4, TEXT, 80)
    addButton(panel.content, "PointHereButton", "Point here", WIDTH, 5.5, icon("location_on"), h.onPoint, TEXT, 80,
      "HeadlineXL", "Primary")
    const tags = addRow(panel.content, "TagRow", WIDTH, 4, 0.4)
    const w = (WIDTH - 1.5) / 4
    addButton(tags, "TagStairsButton", "Stairs", w, 3.6, null, () => h.onTag("stairs"), TEXT, 80, "Caption")
    addButton(tags, "TagLiftButton", "Lift", w, 3.6, null, () => h.onTag("lift"), TEXT, 80, "Caption")
    addButton(tags, "TagRampButton", "Ramp", w, 3.6, null, () => h.onTag("ramp"), TEXT, 80, "Caption")
    addButton(tags, "TagStepFreeButton", "Step-free", w, 3.6, null, () => h.onTag("stepFree"), TEXT, 80, "Caption")
    const names = addRow(panel.content, "NameRow", WIDTH, 4, 0.4)
    addButton(names, "NameNextButton", "Next name", (WIDTH - 0.5) / 2, 3.6, null, h.onNameNext, TEXT, 80, "Caption")
    this.nameBtn = addButton(names, "NameButton", "Name it: Room", (WIDTH - 0.5) / 2, 3.6, null, h.onName, TEXT, 80, "Caption")
    const more = addRow(panel.content, "MoreRow", WIDTH, 4, 0.4)
    const w3 = (WIDTH - 1) / 3
    addButton(more, "NextFloorButton", "Next floor", w3, 3.6, icon("stairs"), h.onNextFloor, TEXT, 80, "Caption")
    addButton(more, "UndoButton", "Undo", w3, 3.6, null, h.onUndo, TEXT, 80, "Caption")
    addButton(more, "CancelMappingButton", "Cancel", w3, 3.6, null, h.onCancel, TEXT, 80, "Caption")
    addButton(panel.content, "SaveMapButton", "Save and route", WIDTH, 4.5, icon("map"), h.onSave, TEXT, 80, "Headline1", "Primary")
  }

  setStatus(text: string): void { this.status.text = text }
  getStatus(): string { return this.status.text }
  setNameLabel(name: string): void { this.nameBtn.label.text = "Name it: " + name }
  show(on: boolean): void { this.sceneObject.enabled = on }
  isShown(): boolean { return this.sceneObject.enabled }
}
