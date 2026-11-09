# Free Walk Specification

## Purpose

Browse a place with no destination. Logic: freewalk.ts (`FreeWalk`, `DotTracker`,
`lookTarget`, `offerView`, `AheadTracker`). Lens: `FindYourWayMain` (`chooseFreeWalk`, `tickFree`),
the offer dot and list, and the floor-change bubble. Shop names, categories, fronts and offers all
come from the map. There is no route, no distance pill and no Step-Free choice in Free walk.

## Requirements

### Requirement: Scan first, then three modes
After the sign scan the Lens SHALL offer Free walk, Go to a place and Map builder. Free walk SHALL
open a preferences pop-up first: a checkbox list from the map's `place.interests` (a map without one
keeps the Lens's own five: Coffee, Food, Shops, Toilets, Pharmacy), pre-ticked from the Inspector
`presetPreferences` ("coffee,clothes,hardware"), shown as a labelled demo preset. Ids the map does
not list are dropped from the preset.

#### Scenario: FW1 Modes after the scan, list from the map
- **GIVEN** the mall, scan done
- **THEN** the three modes show; Free walk shows the map's checkbox list with the preset ticked
- **AND** a map with no `interests` gets the five default ones
- Verified by: I1 the checkbox list comes from the map; maps without one keep today's interests (Node) | b3-modes-scan-first-preset

### Requirement: Dot when you look at a shop
Any node with a `front` line SHALL give a dot when the head direction crosses that line from its
outside, on the traveller's floor (within 1 m of height), within 12 m (`lookRangeM`); the nearest
front wins. The outside is the side the node's walk edge arrives from. A node with no `front` gets no
dot; stairs, escalators and lifts have one. The dot SHALL show after 0.5 s of looking and hide 2 s
after looking away; a glance under 0.5 s shows nothing. Companion on or off, matching or not, every
front gets a dot. The dot is a gold button that says what a pinch opens ("Offers: Bolt Hardware",
"Your picks upstairs"), so it can be seen against any shop. A sponsored shop's button says "Sponsored: <shop>". If it is not opened, nothing happens.

#### Scenario: FW2 Look, dot, open, ignore
- **WHEN** the traveller looks across a front from outside for 0.5 s
- **THEN** the dot shows; looking away for 2 s hides it; from inside the front, or looking away, nothing shows
- Verified by: L1, L2, L3, D1, D2, D4 (Node, freewalk.test.ts) | b3-dc5-companion-off-dots

### Requirement: Offer list, read-only
Opening the dot SHALL show the shop name and at most 3 offer rows (text, price, optional bundled
image). A shop with no offer opens with no rows. A sponsored shop always shows its "Sponsored" tag.
The list closes on the close pinch or after walking 5 m (`listAwayM`) from where it opened. There is
no "go here" in Free walk.

#### Scenario: FW3 Offers
- **WHEN** a dot is opened, then the traveller walks 5 m
- **THEN** the list shows at most 3 rows and closes; ignoring a dot changes nothing
- Verified by: D3, O1, O2 (Node, freewalk.test.ts) | b3-dc5-companion-off-dots

### Requirement: The companion walks ahead
With the companion on and no route, "ahead" SHALL be the walking direction while the traveller moves
(steps of 0.3 m), and the head direction after 1 s standing still. The companion's spot SHALL be 2.5 m
ahead (`aheadM`), kept on the walk edges of the traveller's floor, walking at 2.4 m/s. When the
traveller turns around it SHALL run around at 4.5 m/s, never closer than 1 m, and end ahead again. A
glance while walking SHALL NOT swing it. On a floor change it joins the traveller on the new floor.

#### Scenario: FW4 Ahead and turn around
- **WHEN** the traveller walks, glances sideways, then turns around
- **THEN** the companion stays ahead of the walking direction, then runs around and is ahead again
- Verified by: A1, A2, C5, C6, C7 (Node, freewalk.test.ts) | b3-dc3-turn-around

### Requirement: Stops at matching shops
The companion SHALL stop at a shop only if its category is picked, it is within 8 m (`pointRadiusM`)
and not more than 2 m behind. It stands 1.2 m outside the front, points for 3 s (`pointSeconds`), and
points at each shop once per walk. `maxStopsPerWalk` (0 = no limit) caps the stops. It gives up a stop
after 4 s or when the traveller is 15 m away. Paying (`sponsored`) SHALL NOT make it stop. With the
companion off nothing is pointed at and dots still come.

#### Scenario: FW5 Stops at matches only
- **GIVEN** the mall, preset coffee, clothes, hardware
- **THEN** it stops at matching shops, walks past the others, and never points twice at one
- Verified by: C1, C2, C3, C4 (Node, freewalk.test.ts) | b3-dc2-companion-stops-at-matches

### Requirement: Other-floor hint
At stairs, an escalator or a lift with matching shops on the other floor, the companion SHALL stop
and show a bubble ("3 picks upstairs", "1 pick downstairs") for 5 s (`bubbleSeconds`). The
connection's dot opens a list of the first 3 matching shops, paid ones first with the "Sponsored"
tag, then "and more" if there are others. There is no stop or bubble with no matches there, or at a
down-only escalator. Arriving, it never hints back the way the traveller came. The list works with
the companion off.

#### Scenario: FW6 Another floor
- **GIVEN** the mall, preset picks, ground floor
- **THEN** the companion stops at the stairs with the bubble; the stairs' dot lists 3 shops and "and more"
- Verified by: F1, F2, F3, H1, H1b, H2, H3 (Node, freewalk.test.ts) | b3-dc4-another-floor

## Not tested

- Comfort of the corner dot, and whether the traveller can tell which shop a dot belongs to: feel unproven.
- Real head direction and position drift on Specs: nothing has run on real hardware.
- The light chime when it stops at a match and the turn arrow pointing to an
  out-of-view companion: no test for this in Free walk.

### Requirement: Preferences in your own words (R2-15)
Free walk SHALL open with the companion's question: "Same as last time: <labels>? Or tell me what you're
into." (or "What are you into today?" with nothing saved). **Talk** listens; the words SHALL be mapped to
the map's own interest categories by plain words first (`parsePrefs`: generic words per category plus the
map's labels, never a shop name), and on Specs by the LLM when they name none (`prefsPrompt`,
`parsePrefsReply`: ids from the map only). "Same as last time" keeps the saved picks. The heard words and
the picks show under **Heard**; the walk starts after a short read. Picks are saved per map on the device
(not in the demo presets). In the preview the demo sentence types itself in.

#### Scenario: FW-R15 Say it, walk with it
- **GIVEN** the mall Free walk demo, last time Books
- **WHEN** "A coffee, and I'm into fashion today" is said
- **THEN** the picks are Café and Clothes and the walk starts with them
- Verified by: R15, R15b, R15c, R15d (Node, v3-review.test.ts) | demo-free-walk-robot

### Requirement: The pointer says why (R2-14)
While the companion points at a shop it SHALL show a small card at the pointer's tip naming the
preference that matched, by the map's label: "Clothes · your pick" (`pointReason`). Floor hints show no card.
The card SHALL be big enough to read from where it points (`REASON_CARD`, 160 cm wide; R2-35, R2-40), and the
companion SHALL point from about `pointNearM` (8 m) ahead, in view, so you see it and the shop together (R2-34, R2-39).

#### Scenario: FW-R14 Reason card
- **THEN** pointing at Threads with Clothes picked shows "Clothes · your pick"
- Verified by: R14, R14b, R34, R35 (Node) | demo-free-walk-robot

### Requirement: A calm companion (R2-17)
In Free walk the companion SHALL walk, never run: normal pace 1.5 m/s, catching up at most 2.6 m/s, its pace
easing with the distance to its spot, turning at most 120°/s. Looking around while standing SHALL NOT move
it: your head direction counts as "ahead" only once held within 25° for 2.5 s.

#### Scenario: FW-R17 No dashing
- **THEN** turning round and walking back, it walks round you calmly and leads again; a look left, right
  and behind while standing moves it less than 1.5 m
- Verified by: R17, R17b, C5, A1, D5, V15 (Node)
