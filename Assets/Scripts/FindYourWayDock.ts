// Companion lead and the Options dock. Pure logic shared by the Lens and the Node tests: no imports
// and no Lens globals; the Lens keeps a byte-identical copy at Assets/Scripts/FindYourWayDock.ts.

// How far ahead of you the companion walks (m), on a guided trip and in Free walk.
export const COMPANION_LEAD_M = 7;

// The Options panel during a trip or walk. Once your choices are made and the trip starts it folds
// to a small tab so it doesn't cover the view; a tap on the tab opens it, Hide folds it again. When
// a button in it is needed now (Next stop at a stop, Stop while playing) it opens by itself, and
// folds back after if you had it folded. Off a trip it is never folded.
export class OptionsDock {
  // The one panel left on screen while you walk: everything else lives in it.
  static readonly TITLE = "Control";
  private active = false;
  private folded = false;
  private forced = false;

  // tripActive: on a trip or walk; mustShow: a button in the panel is needed right now.
  // clean: the clean screen (demo presets): it never opens by itself, only on a tap.
  update(tripActive: boolean, mustShow: boolean, clean: boolean = false): void {
    if (tripActive && !this.active) this.folded = true;
    if (!tripActive) this.folded = false;
    this.active = tripActive;
    this.forced = mustShow && !clean;
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

// Almost screenless while you walk a trip: only the floor line and the companion (and the turn
// arrow). The distance pill, floor cue and map badge move into the Control panel; the score chip and
// the play hint come back when you stand still (the score also at arrival). Off a trip nothing is hidden.
// With the clean screen on (the demo presets) none of them ever shows.
export function walkingHud(tripActive: boolean, standing: boolean, arrived: boolean, clean: boolean = false): { pill: boolean; cue: boolean; badge: boolean; score: boolean; playLine: boolean } {
  if (clean) return { pill: false, cue: false, badge: false, score: false, playLine: false };
  if (!tripActive) return { pill: true, cue: true, badge: true, score: true, playLine: true };
  return { pill: false, cue: false, badge: false, score: standing || arrived, playLine: standing && !arrived };
}

// A preference button in Free walk: picked ones carry a check and full colour, the rest are dimmed,
// so what you picked is plain to see at a glance.
export const UNPICKED_ALPHA = 0.45;
export function pickChip(label: string, picked: boolean): { text: string; alpha: number; highlight: boolean } {
  return picked ? { text: "✓ " + label, alpha: 1, highlight: true } : { text: label, alpha: UNPICKED_ALPHA, highlight: false };
}

// The clean screen (on in the demo presets): while you walk, the view holds only the floor line, the
// companion, the turn arrow when needed and the offer boxes. Of the texts that can show by themselves,
// only these may: the offers card, the arrival card (for CLEAN_ARRIVAL_S), the voice caption, live
// captions and the folded Control tab. A notice before a trip (the map failed to load) still shows.
const CLEAN_ALLOWED = ["offerBoxes", "offerCard", "arrival", "voiceCaption", "controlTab", "captions"];
export function cleanAllows(kind: string, clean: boolean, tripActive: boolean): boolean {
  if (!clean) return true;
  if (kind === "notice") return !tripActive;
  return CLEAN_ALLOWED.indexOf(kind) >= 0;
}

export const CLEAN_ARRIVAL_S = 3;
// Whether the arrival card still shows, this long after arriving.
export function arrivalCardOn(secondsSinceArrival: number, clean: boolean): boolean {
  return !clean || secondsSinceArrival < CLEAN_ARRIVAL_S;
}

// The folded Control tab is see-through (ROUND2.md R2-12, R2-33): the view stays visible behind it.
export const CONTROL_TAB_OPACITY = 0.25;
// No ring (R2-37, "really annoying"): the chime on notices, stops and catches stays off; the cards and
// the companion's voice carry the news.
export const CHIME_ON = false;
// In the preview the folded tab sits in the upper-left corner of the view, out of the way (R2-33):
// its offset from the camera (cm; x right, y up, -z ahead).
export const CONTROL_TAB_CORNER = { x: -18, y: 21, z: -100 };
// The folded tab's size (cm) and its label's text role: big enough to read (R2-45).
export const CONTROL_TAB_SIZE = { wCm: 18, hCm: 6, role: "Headline1" };

// Offline mode (ROUND2.md R2-18): simulates no internet. The map stays (bundled with the Lens or the last
// copy); the LLM and the map download are off. Voice still works: the plain matcher reads the map itself.
export function connectivity(offline: boolean, llmAvailable: boolean): { llm: boolean; downloadMap: boolean; label: string } {
  if (offline) return { llm: false, downloadMap: false, label: "Offline: map on this device, no AI" };
  return { llm: llmAvailable, downloadMap: true, label: llmAvailable ? "Online" : "Online (no AI here)" };
}

// What Talk says when nothing matched; offline it points to the no-voice ways.
export function notCaught(offline: boolean): string {
  return offline ? "Didn't catch that (offline). Try Where to? or Pick on the map." : "didn't catch that: try Where to?";
}

// See map (R2-20): the mini map at the left of your view, semi-transparent, so the way ahead stays clear.
export const SEE_MAP = { sideCm: -30, belowCm: 6, aheadCm: 110, alpha: 0.55 };

// What a mode button (Walk / Step-Free) starts toward (R2-23): the Inspector's override, else the place you
// picked (Talk, Where to?, the map), else a planned trip or tour ("tour"); nothing picked: null, and the Lens
// asks you to pick a place first instead of guessing one.
export function tripTarget(s: { picked: string | null; override: string | null; tour: boolean }): string | null {
  if (s.override) return s.override;
  if (s.picked) return s.picked;
  return s.tour ? "tour" : null;
}
