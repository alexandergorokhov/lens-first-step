// Multi-stop trips for "Find Your Way Inside": the traveller picks several shops, the Lens orders
// them for the shortest total walk and guides stop by stop ("Stop 2 of 4: Pharmacy").
// Plain TypeScript with no imports: the distance between two nodes is injected (the Lens and the
// tests pass findRoute's length for the chosen profile, so Step-Free rules hold for every leg),
// which keeps this file copyable into Assets/Scripts as is.

// Up to this many stops every order is tried (6! = 720); beyond it, nearest-neighbour.
export const MAX_EXACT_STOPS = 6;

export type StopDistance = (from: string, to: string) => number;

// Total distance of visiting `order` from `start`, leg by leg (Infinity if a leg has no route).
export function tripLength(start: string, order: string[], dist: StopDistance): number {
  let total = 0;
  let at = start;
  for (const stop of order) {
    total += at === stop ? 0 : dist(at, stop);
    at = stop;
  }
  return total;
}

// The stops in the order with the least total distance from `start`. Duplicate stops are visited
// once. Ties keep the earliest order found (the picked order first), so the result is stable.
export function orderStops(start: string, stops: string[], dist: StopDistance): string[] {
  const unique: string[] = [];
  for (const s of stops) if (unique.indexOf(s) < 0) unique.push(s);
  if (unique.length <= 1) return unique;

  // Distances are looked up once per pair (each is a route search).
  const cache: { [key: string]: number } = Object.create(null);
  const d = (a: string, b: string): number => {
    if (a === b) return 0;
    const key = a + "\u0000" + b;
    if (cache[key] === undefined) {
      const v = dist(a, b);
      cache[key] = typeof v === "number" && !isNaN(v) ? v : Infinity;
    }
    return cache[key];
  };

  if (unique.length > MAX_EXACT_STOPS) {
    const left = unique.slice();
    const out: string[] = [];
    let at = start;
    while (left.length > 0) {
      let best = 0;
      for (let i = 1; i < left.length; i++) if (d(at, left[i]) < d(at, left[best])) best = i;
      at = left[best];
      out.push(at);
      left.splice(best, 1);
    }
    return out;
  }

  // Every order, depth first, dropping a partial order as soon as it is no better than the best.
  let best: string[] = unique.slice();
  let bestLen = tripLength(start, best, d);
  const used: boolean[] = unique.map(() => false);
  const path: string[] = [];
  const visit = (at: string, sofar: number) => {
    if (sofar >= bestLen) return;
    if (path.length === unique.length) {
      bestLen = sofar;
      best = path.slice();
      return;
    }
    for (let i = 0; i < unique.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      path.push(unique[i]);
      visit(unique[i], sofar + d(at, unique[i]));
      path.pop();
      used[i] = false;
    }
  };
  visit(start, 0);
  return best;
}

// Stop-by-stop guidance through stops already in order: current() is the stop the line goes to,
// next() moves on (arrival, then Next), done once past the last stop.
export class MultiStopTrip {
  stops: string[];
  index: number = 0;

  constructor(stops: string[]) {
    this.stops = stops.slice();
  }

  get total(): number {
    return this.stops.length;
  }

  get done(): boolean {
    return this.index >= this.stops.length;
  }

  current(): string | null {
    return this.done ? null : this.stops[this.index];
  }

  // Moves to the next stop; false once there is none (the trip is then done).
  next(): boolean {
    if (this.done) return false;
    this.index++;
    return !this.done;
  }

  // "Stop 2 of 4: Pharmacy", with the stop's name from `name` (e.g. the map node's label).
  label(name: (id: string) => string): string {
    const id = this.current();
    if (id === null) return "All stops done";
    return "Stop " + (this.index + 1) + " of " + this.total + ": " + name(id);
  }
}
