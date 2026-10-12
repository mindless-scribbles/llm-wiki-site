# anim-threads: content (page: 44-UnderstandingAnimationProgramming.md; line numbers are the page's; "T" = tutorial twin)

Verified against the page. Scout notes confirmed, with two corrections: the tutorial twin and page agree; "Pre-Event Graph" is a label on the Property Access node (page 109), not a thread.

## Lanes
- Game Thread, runs the Event Graph (page 90-91, 112; T step 14).
- Animation Thread, runs the AnimGraph (page 90-91; T step 14).
- Not drawn: Render Thread, Worker threads (page 67, 82; T step 10), GPU.

## Nodes
Game Thread lane
- Event Blueprint Update Animation, "called every Tick" (page 115-116)
- Try Get Pawn Owner, then Get Velocity (page 118-121). Same node name is the unsafe one in AnimGraph.
- Vector Length XY, moved into the Event Graph (page 133)
- GroundSpeed, variable of type Float, set in the Event Graph (page 129-133). FOCAL: it is the thing that crosses the lane boundary.
Animation Thread lane
- BS_Walk, Speed pin fed by GroundSpeed; lightning icon = Fast Path after compile (page 136-139)
- Try Get Pawn Owner called directly in AnimGraph, gives the thread-unsafe warning (page 28, 97-100)
Aside (italic callout, not a node)
- Property Access node: label "Pre-Event Graph", runs before the Event Graph on the Game Thread and stores the result for the AnimGraph (page 109-112, 127)

## Edges
1. Event Blueprint Update Animation -> Try Get Pawn Owner (page 115-121)
2. Try Get Pawn Owner -> Vector Length XY, via Get Velocity (page 121, 133)
3. Vector Length XY -> GroundSpeed (page 133)
4. GroundSpeed -> BS_Walk Speed: the Game->Animation handoff, "safe" (page 124-127, 136). FOCAL edge.
5. Try Get Pawn Owner (AnimGraph) -> Game Thread's Try Get Pawn Owner: the unsafe cross-thread read (page 96-100). Dashed.

## Focal (2 accent elements)
GroundSpeed node + the GroundSpeed -> BS_Walk handoff. The page's whole point is the one safe crossing: write on the Game Thread, read on the Animation Thread.

## Dropped (peripheral or over budget)
- Toggles: Project Settings "Allow Multi Threaded Animation Update" (global) and class "Use Multi Threaded Animation Update" (page 34-43; T 3-5). They switch the lanes off/on rather than being steps in the flow.
- Render Thread / Worker threads / GPU (page 64-67).
- GroundVelocity (Vector) intermediate variable, deleted by the end (page 115, 133).
- Property Access as a node (kept only as one callout).
- Is Valid / Character Actor / Event Blueprint Initialize Animation / Anim Preview material (page 141-190): a different topic of the same lesson.
- Unreal Insights, Anim Preview, trace clean-up (page 49-64, 195-207).
