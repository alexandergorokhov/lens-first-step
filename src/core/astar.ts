// A* route search for big maps (a mall, a mapped campus) for "Find Your Way Inside". Gives the
// same route length as the plain Dijkstra in router.ts (shortestTree, kept as the reference),
// but explores toward the goal first and keeps its open set in a binary heap: O(E log V).
// Plain TypeScript with no imports (copyable into Assets/Scripts as is): it takes any
// MapData-shaped graph and an `allowed(edge)` predicate, e.g. e => edgeAllowed(e, profile).
// Same conventions as the router: edges are two-way except escalators (from -> to only), and
// the returned length is rounded to the millimetre like findRoute's.

export interface AStarNode {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface AStarEdge {
  from: string;
  to: string;
  length: number;
  kind: string;
}

export interface AStarPath<E extends AStarEdge> {
  nodes: string[];
  edges: E[];
  length: number;
}

function straight(a: AStarNode, b: AStarNode): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Min-heap of node indexes keyed by f = g + h.
class Heap {
  items: number[] = [];
  keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    const a = this.items;
    const k = this.keys;
    let i = a.length;
    a.push(item);
    k.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      a[i] = a[p];
      k[i] = k[p];
      i = p;
    }
    a[i] = item;
    k[i] = key;
  }

  pop(): number {
    const a = this.items;
    const k = this.keys;
    const top = a[0];
    const lastItem = a.pop() as number;
    const lastKey = k.pop() as number;
    const n = a.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && k[r] < k[l] ? r : l;
        if (k[c] >= lastKey) break;
        a[i] = a[c];
        k[i] = k[c];
        i = c;
      }
      a[i] = lastItem;
      k[i] = lastKey;
    }
    return top;
  }
}

// Shortest path from -> to over the allowed edges, or null when there is none (or an id is unknown).
export function aStar<E extends AStarEdge>(
  graph: { nodes: AStarNode[]; edges: E[] },
  from: string,
  to: string,
  allowed: (edge: E) => boolean,
): AStarPath<E> | null {
  const index: { [id: string]: number } = Object.create(null);
  graph.nodes.forEach((n, i) => {
    index[n.id] = i;
  });
  const s = index[from];
  const t = index[to];
  if (s === undefined || t === undefined) return null;
  if (s === t) return { nodes: [from], edges: [], length: 0 };

  // Adjacency over allowed edges. The heuristic is the straight line to the goal, scaled by the
  // smallest length / straight-line ratio of any allowed edge (1 on a map that passes parseMap
  // to the centimetre; a little under 1 when a hand-made edge uses parseMap's rounding slack).
  // That keeps it consistent, so A* stays exact even on such maps.
  const count = graph.nodes.length;
  const adjTo: number[][] = [];
  const adjEdge: E[][] = [];
  for (let i = 0; i < count; i++) {
    adjTo.push([]);
    adjEdge.push([]);
  }
  let scale = 1;
  for (const e of graph.edges) {
    const a = index[e.from];
    const b = index[e.to];
    if (a === undefined || b === undefined || !allowed(e)) continue;
    const line = straight(graph.nodes[a], graph.nodes[b]);
    if (line > 0 && e.length / line < scale) scale = Math.max(0, e.length / line);
    adjTo[a].push(b);
    adjEdge[a].push(e);
    if (e.kind !== "escalator") {
      adjTo[b].push(a);
      adjEdge[b].push(e);
    }
  }

  const goal = graph.nodes[t];
  const g: number[] = [];
  const prev: number[] = [];
  const prevEdge: (E | null)[] = [];
  const closed: boolean[] = [];
  for (let i = 0; i < count; i++) {
    g.push(Infinity);
    prev.push(-1);
    prevEdge.push(null);
    closed.push(false);
  }
  const h = (i: number) => scale * straight(graph.nodes[i], goal);
  const open = new Heap();
  g[s] = 0;
  open.push(s, h(s));

  while (open.size > 0) {
    const u = open.pop();
    if (closed[u]) continue; // stale heap entry
    if (u === t) break;
    closed[u] = true;
    const tos = adjTo[u];
    for (let k = 0; k < tos.length; k++) {
      const v = tos[k];
      if (closed[v]) continue;
      const d = g[u] + adjEdge[u][k].length;
      if (d < g[v]) {
        g[v] = d;
        prev[v] = u;
        prevEdge[v] = adjEdge[u][k];
        open.push(v, d + h(v));
      }
    }
  }
  if (g[t] === Infinity) return null;

  const nodes: string[] = [to];
  const edges: E[] = [];
  for (let at = t; at !== s; at = prev[at]) {
    edges.unshift(prevEdge[at] as E);
    nodes.unshift(graph.nodes[prev[at]].id);
  }
  return { nodes, edges, length: Math.round(g[t] * 1000) / 1000 };
}
