# lesson-flow: the reader's path through the wiki

Page: index.md, on its own line after the Start here line (line 18), before "## Concepts". The wiki has no overview page apart from the index.
Type: Service blueprint layout (a start row, a stage row, reference and back-room rows, a line of visibility), with arrows for the path. viewBox 704 x 392. Drawn for the nav rollout (2026-10-12).

## Start here row
- Grain Simulation Basics, Sand Castle Node Chain, Key ideas, Lesson 02: the index's Start here line (index.md line 18). The node chain is the "map of the whole chapter"; Key ideas are shape-match-constraints, glue-constraints-for-grains and grain-up-res-by-point-deform (one box, "3 concepts"); the tutorials start at Lesson 02, because "Lesson 01 is scene setup" (the line itself).

## Stages (the lessons row, left to right)
1. Lessons 1-5: Scene and grains (L01 Setting Up the Scene, L02 Setting Up Grains Manually, L03 The Grain Source Node, L04 Vellum Configure Grains, L05 Setting Up Colliders).
2. Lessons 6-8: Shape match and impact (L06 Shape Match Constraints, L07 Beach Ball Sim, L08 Breaking Our Shape Match Constraints).
3. Lessons 9-10: Glue and wet sand (L09 Attraction and Repulsion Weight, L10 Glue Constraints).
4. Lessons 11-12: Finish the low-res sim (L11 and L12 Finishing the Sim Low-Rez).
5. Lessons 13-14: High-res and up-res (L13 Finishing Our High-Rez Sim, L14 Hacking a Higher Rez).
6. Lesson 15: Final render tweaks (L15 Final Render Tweaks). The order follows the index's Start here line: grains, shape match, beach ball impact, glue and wet-sand clumping, high-res and up-res, render.

Each stage is a group of consecutive lessons. Every lesson has a step-by-step tutorial and a lesson summary, both in "The lessons" tier. Stage names come from the lesson titles.

## Reference row
- Concepts (22), Syntheses (1: Sand Castle Node Chain), Entities (25): the census counts.

## Behind the scenes, under the line of visibility
- Transcripts (15): verbatim, in the "Behind the scenes" tier.
- Flashcards: the one page left in the catch-all "Pages" group. Analytics and Dashboard are hidden by `hide`; journal/template is hidden too (a template only); presentations/ holds only a .gitkeep. None of these are drawn.

## Focal
Grain Simulation Basics: the first Start here page.

## Left out on purpose
- Per-lesson boxes: the stages carry lesson numbers, so the row has 6 boxes instead of 15.
- Links from each lesson to concepts and entities: most lessons link some of each (census).

## Redraw when
The tiers or order change in `sites/dja-houdini-vellum-sand-castle/site.json`, or the index's Start here line changes.
