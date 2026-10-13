# lesson-flow: the reader's path through the lessons

Page: index.md, on its own line after the Start here line and before the first "##" (the wiki has no overview page; census: entry pages none).
Type: Service blueprint layout (stage columns, a line of visibility). viewBox 704 wide. Drawn for the nav-flow rollout (2026-10-12). Generator: a small Python script, not kept in the repo.

## Entry (accent)
Start here pages, from index.md: `**Start here:** [[concepts/vellum-pipeline-overview]] ... [[concepts/position-based-dynamics]] ... [[syntheses/vellum-node-chain]] ... [[tutorials/transcripts/lesson-02-exploring-distance-and-bend-constraints]]`. Four boxes, one accent frame. Lesson 01 is whiteboard theory, so the tutorials start at 02 (index.md).

## Stages (the eight lessons, grouped by what they build; census: sequence of 8, titles from summaries/)
1. Constraints: 01 What is Vellum, 02 Exploring Distance and Bend Constraints.
2. First DOP solver: 03 Creating Our First DOP Vellum Solver, 04 Combining Constraints.
3. Softbodies and solving: 05 Tetrahedral Softbodies and Vellum Configure Setups, 06 Substeps and Constraint Iterations.
4. SOP solver and post: 07 The SOP Vellum Solver, 08 The Post Process. The node chain synthesis splits the chain the same way: original DOP chain (L02-L06), final SOP chain (L07-L08).
Each lesson has a step-by-step tutorial and a summary; the stage boxes name the lesson once.

## Reference
Concepts (20), Syntheses (1), Entities (22): census counts; concepts and entities are linked from the lesson summaries.

## Behind the scenes
Transcripts (8, verbatim; census). Flashcards (1 Obsidian page, the Pages group). Analytics, Dashboard and journal/template are hidden by the keys, so they are not drawn. Presentations has no pages.

## Left out on purpose
Per-lesson links to concepts and entities.

## Redraw when
The lessons or the Start here line in index.md change, or the nav's tiers in `sites/dja-houdini-vellum-intro/site.json` change.
