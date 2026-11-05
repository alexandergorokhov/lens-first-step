// Companion lead and the Options dock. Pure logic shared by the Lens and the Node tests: no imports
// and no Lens globals; the Lens keeps a byte-identical copy at Assets/Scripts/FindYourWayDock.ts.

// How far ahead of you the companion walks (m), on a guided trip and in Free walk.
export const COMPANION_LEAD_M = 7;

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

// How much of the route line is drawn (m ahead of you): the whole route while you follow the
// companion, so you always see where it leads; otherwise the usual stretch ahead.
export function routeLineAheadM(companionOn: boolean, aheadM: number): number {
  return companionOn ? Infinity : aheadM;
}

// A clear view while you walk a trip: only the floor line, the companion, the distance pill and the
// turn arrow. The map badge goes once the trip starts; the score chip and the play hint come back
// when you stand still (the score also at arrival). Off a trip nothing is hidden.
export function quietView(tripActive: boolean, standing: boolean, arrived: boolean): { badge: boolean; score: boolean; playLine: boolean } {
  if (!tripActive) return { badge: true, score: true, playLine: true };
  return { badge: false, score: standing || arrived, playLine: standing && !arrived };
}
