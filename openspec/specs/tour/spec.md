# Tour Specification

## Purpose

After the scan, the companion walks you through the shops your preferences match, one after another,
in the shortest order. Logic: tour.ts (`tourStops`, `TOUR_MAX_STOPS`); guiding is `MultiStopTrip`
(see `multi-stop`). Lens: `FindYourWayMain` (`chooseTour`, `startTour`). Tour does not change the
route rules.

## Requirements

### Requirement: Which shops
A tour SHALL use places whose category is one of the picks (the same rule as Free walk's matching),
skipping the start itself and places with no route (infinite distance). More than 6
(`TOUR_MAX_STOPS`, equal to trip.ts's `MAX_EXACT_STOPS`) keep the nearest 6. `orderStops` then puts
them in the order with the shortest walk. No match gives an empty list. Non-place nodes never count.
Sponsored shops are neither favoured nor dropped. The Lens tour uses the Walk profile.

#### Scenario: TR1 Stops from preferences
- **GIVEN** the mall, picks coffee, clothes, hardware
- **THEN** `tourStops` returns the matching places in shortest order; the airport has a tour too
- **AND** with more than 6 matches the nearest 6 are kept, still ordered; sponsored changes nothing
- Verified by: U1, U2, U3, U4, U5, U6, U7 (Node, tour.test.ts) | tr1-tour-stop-by-stop

### Requirement: Stop by stop in the Lens
Tour SHALL open the same preferences pop-up as Free walk, then start a multi-stop trip over the
returned stops ("Stop n of N", "Next stop"). With no match the Lens shows "No shops here match your
preferences" and returns to the mode choice. Restart ends the tour.

#### Scenario: TR2 Tour in the preview
- **WHEN** preferences are confirmed and the traveller reaches each stop and pinches Next stop
- **THEN** the trip visits each matching shop in turn
- Verified by: U2 (Node) | tr1-tour-stop-by-stop

## Not tested

- The empty-tour card ("No shops here match...") has no assertion of its own.
- Comfort of a long tour on real Specs: feel unproven.
