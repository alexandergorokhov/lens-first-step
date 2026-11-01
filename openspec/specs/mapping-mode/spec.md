# Learn This Place (Mapping Mode) Specification

## Purpose

Who makes the map? The traveller, by walking it (brief 2, feature 5). Logic: mapping.ts
(`MapRecorder`). Lens: `FindYourWayMappingPanelUI`, `FindYourWayMain.startMapping/saveMapping`.

## Requirements

### Requirement: Map by walking
Verified by the M1–M5 scenarios below.

"Learn this place" on the mode panel SHALL start mapping where the traveller stands (that spot is
the entrance sign). "Point here" adds a point at the feet joined to the previous one (length = the
distance walked, never less than the straight line; < 0.5 m apart is ignored). Stairs / Lift / Ramp
/ Step-free tag the last stretch; "Next name" + "Name it" names the last point from the short list
(duplicates numbered; named points become destinations); "Next floor" starts a new level; Undo;
Cancel returns to the mode panel.

### Requirement: Save and route at once
"Save and route" SHALL check the map with `parseMap`, refuse with a message when it is invalid or
nothing is named, keep it in persistent storage (`fyw.mappedMap`), load it as "My place" (after the
bundled maps in the map switch, also after a reload) and return to the mode panel with the last
named point as the destination.

#### Scenario: M1–M5 Four points in the room
- **WHEN** the traveller maps 3 points after the sign, tags one stretch, names the last "Room", saves
- **THEN** the map key is "mine", the mode panel shows, and after Walk + scan there is a route and a line
- Verified by: M1–M5 (Node) | m5-learn-this-place-save-route; the reload: manual
