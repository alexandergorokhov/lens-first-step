# Preview Backdrop And Companion Models Specification

## Purpose

Two looks of the Lens that change nothing about routing. (1) In Lens Studio only, the stand-in
building turns solid and a backdrop hides the preview room so the place can be walked through
(`Assets/Scripts/FindYourWayStandIn.ts`). (2) The companion uses a generated 3D model when one is set,
and boxes when not (`FindYourWayCompanionView.ts`, inputs on `FindYourWayMain`).

## Requirements

### Requirement: Solid backdrop, Lens Studio only
When the Inspector input `previewBackdrop` is on (default) and `deviceInfoSystem.isEditor()` is true,
the stand-in SHALL turn its slabs, ramps and shafts solid and add a backdrop: a shell around the map
with 4 m of margin (`BACKDROP_MARGIN_M`), floor tiles, lights, and shop fronts. On Specs
(`isEditor()` false) it SHALL stay see-through, because the display only adds light. The backdrop is
drawing only: the route is the same either way.

#### Scenario: PB1 Solid in the preview
- **WHEN** a map is loaded in the preview
- **THEN** the stand-in is solid and the preview room is hidden; the same trip routes the same
- Verified by: none (Node) | bg1-backdrop-solid-in-preview

### Requirement: Shops along the walls
A map with at least 10 named places or destinations (`RETAIL_MIN_PLACES`), not outdoors, SHALL get a
run of shop fronts along its walls (bays of about 7 m (`BAY_M`) with pilasters, a floor border, banners
and a planter by every third shop); on the lowest floor the plain perimeter wall is then left out.
Each place or destination also gets its own shop front 1.7 m in front of the node, facing its approach
direction. Maps with fewer places (airport, room) get the plain walls. Everything comes from the map;
no shop is named in code.

#### Scenario: PB2 The mall is lined with shops
- **GIVEN** the mall (14 places) in the preview
- **THEN** shop fronts line the walls; a map with under 10 places gets plain walls
- Verified by: none (Node) | bg1-backdrop-solid-in-preview (checks solid only; the shop look is judged by eye)

### Requirement: Companion models with a box fallback
The companion view SHALL use the model prefab set for the active companion (`dogPrefab`,
`robotPrefab`, `roverPrefab` on `FindYourWayMain`) and build the companion from light boxes when the
input is empty. A wrapper object keeps the model's own import scale away from the per-frame
transforms. The collectibles, floor post, Hop lane and treat are always boxes.

#### Scenario: PB3 Any model, or none
- **WHEN** a companion is chosen with or without a prefab
- **THEN** it appears (model or boxes) and plays the same game
- Verified by: none (Node; pet.test.ts P1-P7 cover the companion's behaviour, not its model) | p1-companion-toggle-and-models, pc1-throw-and-fetch-any-model

## Not tested

- The look: how the backdrop and the generated models read is judged by eye in the preview.
- Specs-only behaviour (`isEditor()` false) has not run on real hardware.
