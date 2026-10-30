# Route Search (A*) Specification

## Purpose

A faster search for big maps, kept beside the plain Dijkstra the Lens uses (handoff item 11).

## Requirements

### Requirement: Exactly Dijkstra's result
`aStar` (astar.ts: binary heap, straight-line heuristic scaled by the smallest edge-to-straight-line
ratio, one-way escalators, injected `allowed(edge)`) SHALL return the same length as `findRoute` for
every pair of nodes on every bundled map, both profiles, and no route exactly when it finds none.

#### Scenario: A1 Every pair, every map
- Verified by: A1, A2, A3 (Node)
