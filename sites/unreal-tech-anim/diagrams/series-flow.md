# series-flow: the three-part series and what each part adds

Page: index.md, on its own line before the first heading ("Comparison"). The index has no overview page and no Start here line, so this is the wiki's front page diagram.
Type: Service blueprint layout (a path row, a reference row, an entities bar), with arrows for the reading order. viewBox 704 x 386. Drawn for the nav-flow rollout (2026-10-12).

## Columns
- Start here: the two pages the index's "Recommendations" tell the reader to start with: "Start with [[concepts/locomotion-state-machine-architecture]] and [[concepts/thread-safe-update-animation]]". Both are in `startHere` in `sites/unreal-tech-anim/site.json`.
- Parts 1 to 3: the three video summaries, in the index's Summaries table order (census: Part 1, Part 2, Part 3).

## Rows
- The series: Part 1 "Beginners Course" (summaries/ue5-tech-anim-beginners-course-part-1), Part 2 "Distance Matching & Foot Sync Markers", Part 3 "Creating AAA Run Locomotion Pivots" (shown as "AAA Run Locomotion Pivots"). Sublabels come from the index's "Covers" column: base state machine, direction detection, mesh-to-capsule (Part 1); 180° bug fix (v1), cycle loops, inertialization (Part 2); 180° bug fix (v2), pivot detection, state aliases (Part 3).
- Concepts new in each part: the concepts a summary lists under "Relevant Concepts" that no earlier part lists, less the two start pages. Part 1: Movement Start Direction, Mesh-to-Capsule Root Yaw Offset & Alignment, Animation Modifiers. Part 2: 180-Degree Turn Ambiguity Fix, Foot Sync Markers, Which Foot Is Forward, Distance Matching, Inertialization vs. Dead Blending. Part 3: Run Locomotion Pivots, State Aliases. 10 concepts plus the 2 start pages is the 12 the census counts.
- Entities: 7 in all (census), linked from every summary's "Related entities", so one full-width bar. Names shown: Animation Blueprint, Character Movement Component, Sequence Player Node.
- No back room: Journal, Presentations and Syntheses are empty folders, so nothing is drawn under a line of visibility.

## Focal
The two start pages: the index tells the reader to read them first, and Part 1 builds on them.

## Left out on purpose
- Links from a concept to other concepts (the index's Analysis names several).
- The 12 concepts' Part 3 re-use (Part 3 lists Movement Start Direction and others again; they are drawn once, where they first appear).

## Redraw when
The index's Recommendations or the Summaries table change, or the nav's tiers in `sites/unreal-tech-anim/site.json` change.
