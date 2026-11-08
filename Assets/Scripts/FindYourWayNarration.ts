// The voice-over for the demo video (ROUND2.md R2-7): one line per beat of the take, each starting on
// the take's "[VID] <seconds> <what>" mark for that beat. The lines are the ROUND2.md voice-over table
// (the pitch session edits it there; test N1 keeps this copy equal). Pure logic shared by the Lens (the
// take waits for each line) and the Node tools (clips, mix): no imports and no Lens globals; the Lens
// keeps a byte-identical copy at Assets/Scripts/FindYourWayNarration.ts.

// beat: the start of the mark the line starts on.
export const NARRATION: { beat: string; line: string }[] = [
  { beat: "demo 1: airport, wheelchair", line: "There's no GPS indoors. Pathpal guides you on Snap Specs, hands free. Here, an airport, in a wheelchair." },
  { beat: "talk", line: "I just say what I need: coffee, a bathroom, then my gate." },
  { beat: "leg 1", line: "It plans the stops in order, step-free: lifts only, never stairs or escalators. I just follow my robot." },
  { beat: "announcement", line: "An announcement in Spanish, captioned in English. It names a new gate." },
  { beat: "question", line: "Pathpal asks first; it never changes my trip on its own. Yes: re-routed to B14, still step-free." },
  { beat: "arrived", line: "The gate agent speaks Spanish; I read it in English. Captions help if you can't hear, too." },
  { beat: "demo 2: mall, follow the dog", line: "In a mall, I just follow my dog. Easier than reading a map." },
  { beat: "leg", line: "It waits for me at the escalator, then leads on to the food court." },
  { beat: "arrived", line: "The host speaks French; I read it in English." },
  { beat: "demo 3: Free walk with the robot", line: "No destination? Free walk. The robot suggests places I'll like." },
  { beat: "pointed", line: "I look at a shop for two seconds and its offers appear, always labelled as sponsored." },
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
