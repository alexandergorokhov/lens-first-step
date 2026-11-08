// The voice-over for the demo video (ROUND2.md R2-7): one line per beat of the take, each starting on
// the take's "[VID] <seconds> <what>" mark for that beat. The lines are the ROUND2.md voice-over table
// (the pitch session edits it there; test N1 keeps this copy equal). Pure logic shared by the Lens (the
// take waits for each line) and the Node tools (clips, mix): no imports and no Lens globals; the Lens
// keeps a byte-identical copy at Assets/Scripts/FindYourWayNarration.ts.

// beat: the start of the mark the line starts on.
export const NARRATION: { beat: string; line: string }[] = [
  { beat: "demo 1: airport, wheelchair", line: "There's no GPS indoors. Pathpal guides you on Snap Specs, hands free. Here, an airport, in a wheelchair." },
  { beat: "talk", line: "I say what I need, and my flight number, so it listens for my flight: coffee, a bathroom, my gate." },
  { beat: "leg 1", line: "It plans the stops in order, step-free: lifts only, never stairs or escalators. I just follow my robot." },
  { beat: "announcement", line: "An announcement in Spanish, captioned in English. It names a new gate." },
  { beat: "question", line: "Pathpal asks first; it never changes my trip on its own. Yes: re-routed to B14, still step-free." },
  { beat: "arrived", line: "The gate agent speaks Spanish; I read it in English. Captions help if you can't hear, too." },
  { beat: "demo 2: mall, follow the dog", line: "In a mall, I just follow my dog. Easier than reading a map." },
  { beat: "leg", line: "It leads the way to the bakery, and waits for me whenever I stop." },
  { beat: "arrived", line: "The baker speaks French; I read it in English." },
  { beat: "play", line: "Waiting for a table? A quick game with my dog." },
  { beat: "demo 3: Free walk with the robot", line: "No destination? Free walk. It asks what I'm into today, and I just say it." },
  { beat: "pointed", line: "It points at shops that match, and says why. A two-second look shows offers, always marked sponsored." },
  { beat: "END", line: "Pathpal. No GPS indoors? Follow your companion." },
];

// Speaking pace (words a second) when there is no clip yet, the quiet between two lines (s), and how far
// a line may start after its mark when the line before is still running (s); more than that is late.
export const NARRATION_WPS = 2.5;
export const NARRATION_GAP_S = 0.3;
export const NARRATION_SLIDE_MAX_S = 1.5;

export type Mark = { t: number; what: string };
export type Placed = { index: number; beat: string; line: string; start: number; end: number };

export function speakSeconds(line: string): number {
  return line.split(/\s+/).filter((w) => w !== "").length / NARRATION_WPS;
}

// The "[VID] <seconds> <what>" marks in a log, in order.
export function parseMarks(log: string): Mark[] {
  const out: Mark[] = [];
  for (const l of log.split("\n")) {
    const m = /\[VID\] (\d+(?:\.\d+)?) (.+)$/.exec(l.trim());
    if (m) out.push({ t: Number(m[1]), what: m[2].trim() });
  }
  return out;
}

// Is this mark the beat the next line waits for? (A beat matches a mark that starts with its name.)
export function isBeat(index: number, what: string): boolean {
  return index < NARRATION.length && what.startsWith(NARRATION[index].beat);
}

// Each line on the next mark (after the last matched one) that starts with its beat, or just after the
// line before when that one is still running. missing: beats with no mark; late: lines that start more
// than NARRATION_SLIDE_MAX_S after their mark (by: how far). seconds: each line's real length (its clip),
// by NARRATION index; else the estimate.
export function placeNarration(marks: Mark[], seconds?: number[]): { placed: Placed[]; missing: string[]; late: { beat: string; by: number }[] } {
  const placed: Placed[] = [];
  const missing: string[] = [];
  const late: { beat: string; by: number }[] = [];
  let from = 0;
  let free = -Infinity;
  NARRATION.forEach((n, index) => {
    let i = from;
    while (i < marks.length && !isBeat(index, marks[i].what)) i++;
    if (i >= marks.length) {
      missing.push(n.beat);
      return;
    }
    from = i + 1;
    const len = seconds && seconds[index] !== undefined ? seconds[index] : speakSeconds(n.line);
    const start = Math.max(marks[i].t, free);
    if (start - marks[i].t > NARRATION_SLIDE_MAX_S + 1e-9) late.push({ beat: n.beat, by: start - marks[i].t });
    placed.push({ index, beat: n.beat, line: n.line, start, end: start + len });
    free = start + len + NARRATION_GAP_S;
  });
  return { placed, missing, late };
}

// ── The edit (ROUND2.md R2-16: the video must be under 3 minutes) ─────────────────────────────────
// Quiet stretches (no voice-over line, no beat on screen) play faster; a lift ride ("ride in" .. "ride
// out" marks) is cut out and joined with a short dissolve. Everything said and every beat plays at 1x.
export const EDIT = { fast: 3, padS: 0.6, beatBeforeS: 0.8, beatAfterS: 1.6, minQuietS: 2.5, rideTrimS: 0.2, xfadeS: 0.5, maxS: 179 };
export type EditSeg = { from: number; to: number; speed: number; dissolve: boolean };

// Segments of the take (seconds since its T0, up to end) to keep, each at its speed; dissolve: joined to
// the one before by a dissolve. outAt maps a take second to the edited video's second.
export function editPlan(marks: Mark[], seconds: number[] | undefined, end: number): { segs: EditSeg[]; length: number; outAt: (t: number) => number; lines: { index: number; at: number }[] } {
  const placed = placeNarration(marks, seconds).placed;
  const busy: [number, number][] = placed.map((p) => [p.start - EDIT.padS, p.end + EDIT.padS]);
  const cuts: [number, number][] = [];
  let rideIn: number | null = null;
  for (const m of marks) {
    if (m.what === "ride in") { rideIn = m.t; continue; }
    if (m.what === "ride out" && rideIn !== null) { cuts.push([rideIn + EDIT.rideTrimS, m.t - EDIT.rideTrimS / 2]); rideIn = null; continue; }
    if (/^(T0|CUT)/.test(m.what)) continue;
    busy.push([m.t - EDIT.beatBeforeS, m.t + EDIT.beatAfterS]);
  }
  // Every boundary, then each piece: cut, 1x (busy) or fast (quiet and long enough).
  const edges = [0, end];
  for (const [a, b] of busy.concat(cuts)) edges.push(Math.max(0, Math.min(end, a)), Math.max(0, Math.min(end, b)));
  const xs = Array.from(new Set(edges)).sort((a, b) => a - b);
  type Piece = { from: number; to: number; kind: "cut" | "busy" | "quiet" };
  const pieces: Piece[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], mid = (a + b) / 2;
    if (b - a < 1e-6) continue;
    const kind = cuts.some(([c, d]) => mid > c && mid < d) ? "cut" : busy.some(([c, d]) => mid > c && mid < d) ? "busy" : "quiet";
    const last = pieces[pieces.length - 1];
    if (last && last.kind === kind) last.to = b;
    else pieces.push({ from: a, to: b, kind });
  }
  // Short quiet gaps stay at 1x (no flicker of speed).
  for (const p of pieces) if (p.kind === "quiet" && p.to - p.from < EDIT.minQuietS) p.kind = "busy";
  const segs: EditSeg[] = [];
  let dissolve = false;
  for (const p of pieces) {
    if (p.kind === "cut") { dissolve = segs.length > 0; continue; }
    const speed = p.kind === "quiet" ? EDIT.fast : 1;
    const last = segs[segs.length - 1];
    if (last && !dissolve && last.speed === speed && Math.abs(last.to - p.from) < 1e-9) last.to = p.to;
    else segs.push({ from: p.from, to: p.to, speed, dissolve });
    dissolve = false;
  }
  const starts: number[] = [];
  let acc = 0;
  for (const s of segs) {
    if (s.dissolve) acc -= EDIT.xfadeS;
    starts.push(acc);
    acc += (s.to - s.from) / s.speed;
  }
  const outAt = (t: number): number => {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (t <= s.to + 1e-9) return starts[i] + Math.max(0, t - s.from) / s.speed;
    }
    return acc;
  };
  return { segs, length: acc, outAt, lines: placed.map((p) => ({ index: p.index, at: outAt(p.start) })) };
}
