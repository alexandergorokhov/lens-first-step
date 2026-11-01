// FindYourWayMapBuilder — one Map builder session: records the walk, marks shops, confirms floor
// changes, and keeps the panel, the pins and "See my map" in step. Owns: the recorder and the tracer.
// Must not: load a map or change the app's phase; FindYourWayMain does that with what save() returns.

import {MappedEdgeKind, MappedMap, MapRecorder, MappingTag, WalkTracer} from "./FindYourWayMapping"
import {FindYourWayMappingPanelUI} from "./FindYourWayMappingPanelUI"
import {peekMap} from "./FindYourWayPeek"
import {FindYourWayPeekView} from "./FindYourWayPeekView"
import {Vec3} from "./FindYourWayRouter"

export interface MapBuilderHost {
  panel: FindYourWayMappingPanelUI | null
  peek: FindYourWayPeekView | null
  userPos(): Vec3
  userHeading(): number
  showPins(spots: Vec3[]): void
  placeMapModel(): void // puts "See my map" by the hand, once a frame
}

export class FindYourWayMapBuilder {
  private recorder: MapRecorder | null = null
  private tracer: WalkTracer | null = null
  private seeing = false

  constructor(private host: MapBuilderHost) {}

  start(): void {
    this.recorder = new MapRecorder()
    this.tracer = new WalkTracer(this.recorder)
    this.tracer.start(this.host.userPos(), getTime())
    this.seeing = false
    const panel = this.host.panel
    if (panel) {
      panel.show(true)
      panel.setSeeMap(false)
      panel.setFloorGuess(null)
    }
    this.status("Just walk: the path records itself")
  }

  end(): void {
    if (this.host.panel) this.host.panel.show(false)
    if (this.seeing && this.host.peek) this.host.peek.showMap(null)
    this.seeing = false
    this.recorder = null
    this.tracer = null
    this.showPins()
  }

  // Keeps the tracer and the panel in step, once a frame.
  tick(): void {
    if (!this.tracer) return
    this.tracer.sample(this.host.userPos(), getTime())
    if (this.host.panel) this.host.panel.setFloorGuess(this.tracer.floorPending())
    if (this.seeing && this.host.peek) this.host.placeMapModel()
  }

  markShop(): void {
    if (!this.tracer) return
    const s = this.tracer.markShop(this.host.userPos(), this.host.userHeading())
    this.status(s ? (s.replaced ? "Moved " : "Marked ") + s.label : "Map is full")
    this.showPins()
    if (s) print("[FYW] mapping: " + s.label + (s.replaced ? " replaced" : " marked"))
  }

  // One pinch on the guess, or on another kind.
  confirmFloor(kind?: string): void {
    if (!this.tracer) return
    const guess = this.tracer.floorPending()
    if (this.tracer.confirmFloor(kind as MappedEdgeKind)) this.status("Floor change: " + (kind || guess))
    else this.status("No floor change to confirm")
  }

  nextFloor(): void {
    if (!this.tracer) return
    this.tracer.nextFloor(this.host.userPos(), getTime())
    this.status("New floor")
  }

  undo(): void {
    if (!this.tracer) return
    this.status(this.tracer.undo() ? "Undone" : "Nothing to undo")
  }

  // "See my map": the small model of the whole walk.
  toggleSeeMap(): void {
    if (!this.recorder || !this.host.peek) return
    this.seeing = !this.seeing
    this.host.peek.showMap(this.seeing ? peekMap(this.recorder.toMap(), this.host.userPos()) : null)
    if (this.host.panel) this.host.panel.setSeeMap(this.seeing)
  }

  // Ends the walk and hands back the map, or null with the reason on the panel.
  // How far up the map's floors are from the feet the camera reports: "Next floor" adds height
  // the tracking never saw, so a saved map needs the traveller lifted by this much (m).
  getFloorOffset(): number { return this.tracer ? this.tracer.floorOffset() : 0 }

  finish(valid: (text: string) => string | null): {map: MappedMap; text: string} | null {
    if (!this.recorder) return null
    if (this.tracer) this.tracer.finish(this.host.userPos())
    const map = this.recorder.toMap()
    const text = JSON.stringify(map)
    const error = valid(text)
    if (error) {
      this.status("Map not valid: " + error)
      return null
    }
    if (!map.nodes.some((n) => n.kind === "destination" || n.kind === "place")) {
      this.status("Mark a shop first")
      return null
    }
    return {map, text}
  }

  private status(text: string): void {
    if (!this.host.panel || !this.recorder) return
    const m = this.recorder.toMap()
    const shops = m.nodes.filter((n) => n.kind === "place").length
    this.host.panel.setStatus(text + " · " + m.place.levels.length + (m.place.levels.length === 1 ? " floor · " : " floors · ") + shops + (shops === 1 ? " shop" : " shops"))
  }

  private showPins(): void {
    this.host.showPins(this.recorder ? this.recorder.toMap().nodes.filter((n) => n.kind === "place") : [])
  }

  // Read-only state and test hooks.
  floorGuess(): string | null { return this.tracer ? this.tracer.floorPending() : null }
  isSeeingMap(): boolean { return this.seeing }
  nodeCount(): number { return this.recorder ? this.recorder.toMap().nodes.length : 0 }
  mapText(): string | null { return this.recorder ? this.recorder.toJson() : null }
  debugPointAt(p: Vec3): string | null {
    if (!this.recorder) return null
    this.recorder.walked(p)
    return this.recorder.pointHere(p)
  }
  debugName(label: string): string | null { return this.recorder ? this.recorder.name(label) : null }
  debugTag(kind: string): boolean { return !!this.recorder && this.recorder.tagLast(kind as MappingTag) }
}
