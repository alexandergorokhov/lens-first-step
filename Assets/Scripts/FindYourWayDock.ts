// Companion lead and the Options dock. Pure logic shared by the Lens and the Node tests: no imports
// and no Lens globals; the Lens keeps a byte-identical copy at Assets/Scripts/FindYourWayDock.ts.

// How far ahead of you the companion walks (m), on a guided trip and in Free walk.
export const COMPANION_LEAD_M = 6;

// The Options panel during a trip or walk. Once your choices are made and the trip starts it folds
// to a small tab so it doesn't cover the view; a tap on the tab opens it, Hide folds it again. When
// a button in it is needed now (Next stop at a stop, Stop while playing) it opens by itself, and
// folds back after if you had it folded. Off a trip it is never folded.
export class OptionsDock {
  private active = false;
  private folded = false;
  private forced = false;

  // tripActive: on a trip or walk; mustShow: a button in the panel is needed right now.
  update(tripActive: boolean, mustShow: boolean): void {
    if (tripActive && !this.active) this.folded = true;
    if (!tripActive) this.folded = false;
    this.active = tripActive;
    this.forced = mustShow;
  }

  toggle(): void {
    if (!this.active) return;
    this.folded = !this.isCollapsed();
  }

  isCollapsed(): boolean {
    return this.active && this.folded && !this.forced;
  }
}
