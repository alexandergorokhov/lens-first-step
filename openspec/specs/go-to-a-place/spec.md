# Go To A Place Specification

## Purpose

Say or pick where to go, then today's flow runs (line, pill, floor cues, Walk or Step-Free, companion
optional). Matcher and map layout are pure code: freewalk.ts (`matchDestination`, `sayItPhrase`,
`destinationsOf`) and tour.ts (`pickMapLayout`, `mapLevels`). Lens: `FindYourWayMain` (`sayIt`,
`talk`, `heard`, `openWhereTo`, `openPickMap`), `FindYourWayVoice.ts`, `FindYourWayPickMapUI.ts`.

## Requirements

### Requirement: Say it
The "Say it" button SHALL stand in for speech: it takes the map's `place.sayIt`, or "Take me to
<default destination>", and runs the real matcher on it. The matcher drops filler words (take, me, to,
the, go, find, where, is, ...), then a name matches when every word left is in it. Case and accents
are ignored. The exact name wins, then the shortest. No match gives "didn't catch that: try Where to?".

#### Scenario: GP1 Say it
- **GIVEN** the mall
- **WHEN** Say it is pinched
- **THEN** the phrase "Take me to Bolt Hardware" (or the map's own) matches that shop and the line leads to it
- **AND** a map with no `sayIt` says its default destination's name
- Verified by: G1, G2 (Node, freewalk.test.ts) | b3-dc6-go-to-a-place

### Requirement: Talk
The Talk button SHALL start Snap's ASR module (`LensStudio:AsrModule`, high accuracy, ends after 1.2 s
of silence). Live text shows as "Heard: ..."; the finished phrase goes to the same matcher. Listening
stops after 8 s with no finished phrase, on an error, on a second pinch, or on restart. The voice
class SHALL NOT match names or route; Main does.

#### Scenario: GP2 Words reach the matcher
- **WHEN** the words of a place's name arrive as a finished phrase
- **THEN** the matcher picks that place; words that match nothing say so
- Verified by: G1 (Node, matcher only) | v1-voice-reaches-the-matcher

Not tested: real speech has not been spoken into a microphone. v1 feeds the words in through the test
hook `debugHeard`; the live ASR session, the 8 s timeout and the error path are untested. Nothing has
run on real Specs hardware.

### Requirement: Where to? as a list
"Where to?" SHALL list the map's places, destinations and gates that have a name (sorted by name),
not lifts or junctions.

#### Scenario: GP3 List
- **THEN** only named places, destinations and gates are listed
- Verified by: G3 (Node, freewalk.test.ts) | b3-dc6-go-to-a-place

### Requirement: Where to? on a map
The "Where to?" panel SHALL offer a floor-by-floor map (the no-voice way). One dot per named place,
destination or gate on the chosen floor (within 0.5 m of its height), placed where it really is: one
scale on both axes, centred, inside the margin, and nudged apart until no two are closer than 3 cm
(`MAP_DOT_MIN_CM`). The layout is the same every time. A single point, a line, stacked points and a
tiny panel SHALL NOT divide by zero. "Other floor" steps through the floors (`place.levels` names,
lowest first; else "Level 1", ...). A pinch on a dot picks that place; Back returns. The panel has
room for 24 dots.

#### Scenario: GP4 Pick on the map
- **GIVEN** the mall
- **WHEN** Where to? is opened as a map and a dot is pinched
- **THEN** that place becomes the destination and the line leads to it; Other floor shows the other floor's dots
- Verified by: U8, U9, U10, U11, U12, U13 (Node, tour.test.ts) | pm1-pick-a-place-on-the-map

## Not tested

- Whether the laptop microphone reaches ASR in the Lens Studio preview, and recognition quality in a
  noisy mall: manual only.
- Step-Free stays an option in Go to a place; its rules are in `accessibility` and `routing`.

### Requirement: Pick a place first (R2-23)
Walk or Step-Free SHALL start a trip only toward a place that was picked (Talk, Where to?, Pick on the map,
or the Inspector's override) or a planned multi-stop trip (`tripTarget`). With nothing picked the Lens SHALL
say "Pick a place first" and open **Where to?**; it never guesses a route.

#### Scenario: GT-R23 Walk with nothing picked
- **WHEN** Walk is pressed before a place is picked
- **THEN** no trip starts and Where to? opens
- Verified by: R23 (Node)

### Requirement: Every place reachable (R2-24)
Every place and destination on every map SHALL route from the map's start, walking and step-free.

#### Scenario: GT-R24 All maps
- Verified by: R24 every place and destination on every map can be reached (Node)

### Requirement: Offline mode (R2-18)
The Control panel's **Offline** switch SHALL simulate no internet: the map stays (built in or last copy),
the map download and the LLM are off (`connectivity`). Voice SHALL still work from the map's own data
(names, categories, interest words, codes such as "12C"). Not understood offline, it SHALL say "Didn't catch
that (offline). Try Where to? or Pick on the map." (`notCaught`).

#### Scenario: GT-R18 Talk offline
- **GIVEN** Offline on, the mall demo
- **WHEN** "Take me to the food court" is said
- **THEN** the food court is picked with no LLM
- Verified by: R18, R18b, R18c (Node) | offline-mode
