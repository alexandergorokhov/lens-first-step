/plan-lens

SETUP FIRST (do this yourself before planning, no questions):
1. Create the folder C:\Sasha\Projects\specs\find-your-way-inside (and its "devpost" subfolder) if it doesn't exist. Use that folder for everything in this session.
2. Save this whole prompt as C:\Sasha\Projects\specs\find-your-way-inside\devpost\IDEA.md.
3. Write the design brief to C:\Sasha\Projects\specs\find-your-way-inside\devpost\design-brief.md. If the plan-lens skill writes it anywhere else (for example the folder this session started in), move it there. If a design-brief.md already exists in that folder, don't overwrite it: save the new one as design-brief-2.md (then -3, and so on).
4. When you finish, tell me the full path of the brief.

I'm entering Learn AR with SPECS (Devpost, due Nov 9 22:00 UTC). Plan this Lens with me.

Idea: "Find Your Way Inside", indoor navigation for everyone. There is no GPS indoors, so on real Specs you look at the "you are here" sign at the entrance. Its code tells the Lens where you stand, and its web address downloads that building's map. A line on the floor then leads you to your gate. Two modes: Walk (fastest, escalators OK) and Step-Free (wheelchair, stroller, crutches, luggage cart: lifts and ramps only). The line re-routes when the gate changes or a lift is out of service (pinch the red sign). The line fades 10 m ahead, with an arrow when the next turn is out of view.

Hero moment for the video: two travellers, same sign, same gate. One walks up the escalator; the other switches to Step-Free and the line jumps to the lift. Then "Gate change B12 → C3" and both lines swing round.

Preview limits (must design around them):
- No camera feed: the sign scan is SIMULATED and labelled "on real Specs: look at the sign". Everything after it must be real.
- Map: try to download a small map JSON from a web address in the preview. If that fails, ship the map inside the Lens (well under 1 MB of the 25 MB limit).
- The building is a stand-in model of one airport floor (simple boxes), labelled "stand-in building". Walk it with WASD; Q drops the eye to seated height for the Step-Free run. Also show the line on the sample room's real floor.
- Never claim it finds you in a real airport.

Technical beats for judges: the agent turns a floor-plan image into the route graph and the stand-in model. LEAF tests: a Step-Free route never uses a stair or escalator; a Walk route is the shortest.

Please decide with me: the route-graph format (nodes + edges JSON, or simplified IMDF); how the line is drawn on the floor; how the gate change and lift-out events are triggered in the demo; what goes into the 3-minute video, beat by beat; what to cut first if I fall behind (staff/porter mode and a hospital skin are stretches).
