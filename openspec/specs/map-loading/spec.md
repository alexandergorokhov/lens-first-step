# Map Loading Specification

## Purpose

After the sign scan the Lens tries to download the building's `map.json` from a web address with
a 5 s timeout and otherwise uses the copy built into the Lens, so routing always works; a badge
tells the user which map is in use.

## Requirements

### Requirement: Download with a 5 second timeout
On the sign scan the Lens SHALL request the current map's download URL and wait at most
`DOWNLOAD_TIMEOUT_MS = 5000` ms. While waiting, the badge SHALL read "loading map…". If no URL is
configured (or `tryOnlineMap` is off), the built-in map SHALL be used immediately.

#### Scenario: S9 Map download works
- **GIVEN** the map's URL serves a valid `map.json`
- **WHEN** the user pinches "Scan sign" and the download arrives within 5 s
- **THEN** the downloaded map is used (`source: "online"`, no notice)
- **AND** the badge reads "online map"
- Verified by: S9/E1 logic: a valid download is used online; a failed or timed-out download uses the built-in map offline; S9/E1 logic: loadMapWithTimeout uses the download when it arrives in time; TODO S9 Lens: a real map.json download from a public URL shows the 'online map' badge (needs the repo to be public) | none (gap: no LEAF run with a reachable URL)

### Requirement: Fallback to the built-in map
If the download fails, rejects, throws synchronously, returns a non-string, or takes longer than
the timeout, the Lens SHALL use the built-in map with `source: "offline"`, show the badge
"offline map", and route normally. A late response after the timeout SHALL be ignored.

#### Scenario: E1 Download fails or takes more than 5 s
- **GIVEN** the download rejects (e.g. HTTP 404) or is slower than 5000 ms
- **WHEN** the map is loaded
- **THEN** the built-in map is used, the badge reads "offline map", no notice card is shown
- **AND** the Walk route `sign → gateB12` is still found
- Verified by: E1 logic: a download slower than the timeout falls back to the built-in map; E1 logic: a failed or throwing download falls back to the built-in map; S9/E1 logic: a valid download is used online; a failed or timed-out download uses the built-in map offline | dc1-scan-sign-line-appears (real request fails → "offline map", route works)

### Requirement: Invalid downloaded map
If a download arrives in time but fails `parseMap`, the Lens SHALL fall back to the built-in map,
show the notice card "Map couldn't load", show the badge "offline map", and not crash.

#### Scenario: E2 Invalid map.json
- **GIVEN** the download returns `{"nodes": [ broken`
- **WHEN** the user scans the sign in Walk mode
- **THEN** the notice card reads "Map couldn't load", the badge reads "offline map", the map
  source is "offline"
- **AND** the built-in route `sign>hall>escFoot>escTop>concourse>bJunction>gateB12` is drawn
- Verified by: E2 Invalid map.json: 'Map couldn't load', falls back to the built-in map, no crash; E2 logic: an invalid download in time still falls back with 'Map couldn't load' | e2-broken-map-fallback

### Requirement: Broken built-in map is a build error
If the built-in map itself does not parse, `chooseMap` SHALL throw "built-in map is broken: <error>"
(this can only be a packaging mistake; the Node map tests prevent it).

#### Scenario: X5 Built-in maps always parse
- **WHEN** every bundled map is parsed
- **THEN** each parses without error
- Verified by: airport/hospital/campus/room: map file is valid and its Lens copy (Assets/Maps/<map>.json) is identical | rule-stepfree-no-stairs-escalator (bundledMaps() throws on an invalid map)

### Requirement: Closures and stale loads survive the map load
Connections the user closed before the load finished SHALL stay closed in the loaded map. A load
that completes after the user restarted or switched map SHALL be ignored.

#### Scenario: X6 A load finishing after a map switch is ignored
- **GIVEN** a map load is in progress
- **WHEN** the user presses Restart trip or switches map before it completes
- **THEN** the late result does not start a trip
- Verified by: c12-stale-load-and-closures-kept (part a: a 2.5 s download from a restarted trip is ignored; trip generation counter)

#### Scenario: X58 A downloaded map that differs keeps what the traveller already did
- **GIVEN** Lift 1 closed before the scan and a downloaded map that differs from the built-in one
- **WHEN** the place is rebuilt for the downloaded map
- **THEN** Lift 1 stays closed and still shows it: sign "Closed — re-routing", red plate, ride
  button "Out of service"; a destination change made before the scan is kept too; and the scan
  button that started the load is not destroyed under the pinch (removed signs are hidden, then
  destroyed a second later)
- Verified by: c12-stale-load-and-closures-kept, dest-change-before-scan-sticks

## Known gaps

- **S9 real download unproven.** The Lens downloads `mapBaseUrl` + the map's file name. The default
  `http://localhost:8787/` (`npm run maps`) is refused by the Lens ("URL is not secure") and the
  GitHub raw folder returns 404 while the repo is private, so the preview shows "offline map". The
  Node test for a real download is a TODO.
- **Fixed (review round):** a slow load from an earlier trip is ignored (X6) and a rebuild for a
  downloaded map keeps closures and the destination change (X58).
- The brief says "Map couldn't load" is shown; the Lens shows it as a notice card (5 s) with no
  chime. The brief does not say whether a chime should play.
