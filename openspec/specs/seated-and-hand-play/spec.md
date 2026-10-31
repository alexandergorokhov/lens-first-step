# Seated Play And Catch By Hand Specification

## Purpose

Extends `play` (Hop and catch). Seated play lets someone sitting down (a wheelchair user, or anyone
waiting on a bench) play on a closer, shorter lane. Catch by hand replaces the straight-ahead button
with a real grab and throw. Logic: play.ts (`SeatedDetector`, `seatedPlaySpot`, `seatedPlayAllowed`,
`landingSpot`, `releaseVelocity`). Lens: `FindYourWayMain.updateCompanion`, `updateGrabTreat`,
`grabEnded`; the treat is drawn by `FindYourWayCompanionView`. Test names below are in play.test.ts:
the "S1"-"S9" and "G1"-"G4" ones after the "Seated play" comment (play.test.ts also has older tests
with the names G1-G9 and P8-P9, covered by `play`).

## Requirements

### Requirement: Detecting a seat
The traveller SHALL count as seated when the head stays 0.4 m below their standing height
(`SEATED_DROP`), or under 1.3 m above the floor (`SEATED_HEAD_MAX`), for 2 s (`SEATED_SECONDS`).
Either rule alone seats. A shorter dip does not count. Standing up ends it on that frame.

#### Scenario: SP1 Sit and stand
- **WHEN** the head drops 50 cm for 1.5 s, then 2 s; then rises
- **THEN** not seated at 1.5 s, seated after 2 s, not seated on the first frame back up
- **AND** a tall person at 1.49 m (41 cm down) is seated; a short dip that ends sooner restarts the timer
- Verified by: S1 Seated is detected after 2 s low...; S2 Either rule seats you...; S3 A short dip... (Node) | sp1-seated-play

### Requirement: Seated lane
Seated play SHALL put the companion 1 m ahead of the seat (`SEATED_NEAR`), on the floor of the seat,
along the facing direction, and Hop SHALL use a 3 m lane (`SEATED_LANE`) instead of 6 m. Both ends
stay inside a 37 degree view (`SEATED_VIEW_DEG`) for seated eye heights up to 1.3 m. The standing lane
is unchanged: the same seed plays the same game.

#### Scenario: SP2 Close and short
- **GIVEN** a head at 1.0 to 1.3 m
- **THEN** the start is 1 m ahead, the far end 4 m ahead, the span under 37 degrees
- **AND** obstacles spawn at the 3 m lane's far end and a jump clears them
- Verified by: S4, S5, S6, S7 (Node) | sp1-seated-play

### Requirement: Seated throws and not missing the flight
A seated throw SHALL land at most 3 m away (`SEATED_THROW_MAX`); standing is 5 m. Seated play SHALL
run only while seated with the companion on and no card showing; a card (gate change, boarding, lift
out), standing up, or turning the companion off ends it. A change between seated and standing stops a
running Hop. A pinch jumps in the preview.

#### Scenario: SP3 A card ends it
- **GIVEN** seated play running
- **WHEN** a card shows or the traveller stands up
- **THEN** play ends and the route is unchanged
- Verified by: S8, S9 (Node) | sp1-seated-play

### Requirement: Catch by hand
The treat SHALL float by the traveller's hand (20 cm right, 28 cm below and 45 cm ahead of the head)
while a throw is allowed (companion on, standing still, not within 10 m of a floor change, no card,
no Hop running). Pinching it starts a grab; letting go throws with the hand's velocity over the last
0.15 s (`RELEASE_WINDOW`). Under 0.5 m/s (`THROW_MIN_SPEED`) there is no throw. At a low frame rate
the last two samples still count. The treat lands on the traveller's floor within 5 m (3 m seated);
the companion fetches it as in `play`. The "Throw a treat" button still throws straight ahead.

#### Scenario: GT1 Grab, swing, release
- **WHEN** the treat is pinched, swung and released
- **THEN** the companion fetches it from where it landed
- **AND** letting go without a swing, or with one sample, is no throw
- Verified by: G1 releaseVelocity reads the last moments of the swing; G2 letting go without a swing is no throw; G3 a throw from a swing lands within reach and on your floor; G4 at a low frame rate... (Node) | gt1-grab-and-throw

## Not tested

- Real hand tracking and how a swing feels: the preview's mouse stands in; feel unproven.
- Whether the sitting rule suits every body and chair on real Specs: untested.
- Raising a hand to jump while seated on glasses: only the pinch is tested.
