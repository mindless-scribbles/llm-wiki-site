# workshop-flow: the reader's path through the wiki

Page: workshop/overview.md, top of the page (after "What you take home", before "Who this is for").
Type: Service blueprint layout (stage columns, layer rows, a line of visibility), with arrows added for the path and the links out of each day. viewBox 704 x 600.

## Stages (columns, left to right)
- Workshop Overview: the index's "Start here" (index.md line 19).
- Day 1: bench, FK kit (overview table, Day 1 row).
- Days 2-6: the limb (Day 2 to Day 6 rows; each links modules/limb).
- Days 7-9: the spine (Day 7 to Day 9 rows; each links modules/spine-chain).
- Day 10: head, whole biped (Day 10 row).

## Rows
- Watch first: the overview's "Watch first" column. Day 4: six-into-four, swing-twist, pole-loop. Day 7: three-knots. Day 10: bend-weights. Names are the page titles before the colon ("Count What a Curve Can Reach" is three-knots' title).
- The path: the overview's day table, in order.
- Modules: the modules each day page links (link graph, 2026-10-12): Day 1 FNRoot, Body, FkChain; Days 2-6 Limb, LimbTwist (Day 6); Days 7-9 SpineChain; Day 10 Head.
- Concepts: The True FK/IK Match is the second "Start here" step (index.md line 19), drawn under the Overview with a THEN arrow. The bar carries "count, carry, key" (overview, "The three questions").
- Solves: in run order: construction, forward, backward, FK/IK match.
- Prove on: Guardian 257 bones, Zombie 80 bones; "Day 7 brings in the second" (overview, "What you already need to know").
- Behind the scenes, under the line of visibility: summaries/ (4), journal/ (1), Flashcards. No day links to any of them. Analytics and Dashboard are hidden from the nav (`hide` in site.config.json), so they are not drawn.

## Focal
Workshop Overview: the entry point. It heads the nav's "Start here" group.

## Left out on purpose
- The index's third "Start here" step (theory/six-into-four): it already sits above Day 4.
- Concept-by-concept links per day: concepts and solves are drawn as full-width bars, because every day links some of them.
- Exceeds the 9-node budget (26 boxes) on purpose: it is a census of every nav group, zoned by row.

## Redraw when
The nav's groups or order change in Moted's site.config.json: the rows mirror its tiers (The course, Reference, Behind the scenes).
