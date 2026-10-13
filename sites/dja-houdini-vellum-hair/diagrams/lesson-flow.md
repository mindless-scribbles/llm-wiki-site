# lesson-flow: the reader's path through the wiki

Page: index.md, on its own line after the Start here line (line 18), before "## Concepts". The wiki has no overview page apart from the index.
Type: Service blueprint layout (a start row, a stage row, reference and back-room rows, a line of visibility), with arrows for the path. viewBox 704 x 392. Drawn for the nav rollout (2026-10-12).

## Start here row
- Hair Pipeline Overview, Hair Node Chain, Lesson 01: the index's Start here line (index.md line 18), in that order. The first two are "the big picture" and "your map"; the third is the step-by-step tutorial for Lesson 01 ("to build along").

## Stages (the lessons row, left to right)
1. Lessons 1-2: Scene and mask (L01 Building Our Scene, L02 Attribute Painting Our Hair Mask). Node chain sections 1 and 2.
2. Lessons 3-6: Guides and groom (L03 Creating Guide Hairs, L04 The Guide Groom, L05 Guide Groom Workalong, L06 The Guide Process). Node chain sections 3 and 4.
3. Lessons 7-10: Simulate the guides (L07 Creating a Pin Group and Deforming the Guides, L08 Creating Hair Constraints, L09 Creating Custom Masks, L10 Using Glue Constraints). Node chain sections 5 and 6.
4. Lessons 11-13: Render hair and masks (L11 Creating Our Render Hairs, L12 The Hair Clump and Guide Mask, L13 Applying Our Masks). Node chain section 7.
5. Lessons 14-15: USD pipeline (L14 and L15 Optimizing the USD Pipeline). Node chain section 8.
6. Lessons 16-20: Karma look and finish (L16 Setting Up Our Scene in Karma, L17 Creating Our Hair Material, L18 Using Masks and Uprezing Hair, L19 Final Tweaks, L20 Final Review). Node chain section 9.

Each stage is a group of consecutive lessons. Every lesson has a step-by-step tutorial and a lesson summary, both in "The lessons" tier. Stage names come from the lesson titles.

## Reference row
- Concepts (20), Syntheses (1: Hair Node Chain), Entities (21): the census counts.

## Behind the scenes, under the line of visibility
- Transcripts (20): verbatim, in the "Behind the scenes" tier.
- Flashcards: the one page left in the catch-all "Pages" group. Analytics and Dashboard are hidden by `hide`; journal/template is hidden too (a template only); presentations/ holds only a .gitkeep. None of these are drawn.

## Focal
Hair Pipeline Overview: the first Start here page.

## Left out on purpose
- Per-lesson boxes: the stages carry lesson numbers, so the row has 6 boxes instead of 20.
- Links from each lesson to concepts and entities: most lessons link some of each (census).

## Redraw when
The tiers or order change in `sites/dja-houdini-vellum-hair/site.json`, or the index's Start here line changes.
