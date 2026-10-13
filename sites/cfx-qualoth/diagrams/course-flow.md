# course-flow: the reader's route through the CFX course

Page: index.md, on its own line after the Start here line and before "## Concepts" (the wiki has no overview page).
Type: Service blueprint layout (a start row, five stage columns, a reference row, a line of visibility). viewBox 704 x 440. Drawn for the nav rollout (2026-10-12).

## Start row
- index.md: `**Start here:** [[concepts/cfx-scope]] → [[concepts/cfx-production-planning]] → [[concepts/simulation-master-file]] → cloth track ([[concepts/input-and-cloth-mesh]]) or hair track ([[concepts/guide-curve-pipeline]]).`
- CFX Scope, CFX Production Planning and Simulation Master File run in order. Input Mesh, Cloth Mesh and Solver (cloth track) and Guide-Curve Hair Pipeline (hair track) are the fork after the master file; both arrows come from Simulation Master File.

## Stages
The eight weekly summaries are the course (the census: sequence `summaries/week-01` to `week-08`). The stages group them by what each week builds, from the week titles:
- Plan: Week 1, "CFX Scope, Terminology and Production Planning".
- Cloth setup: Week 2, "Marvelous Designer and Qualoth Basics"; Week 3, "Building a Qualoth Master File".
- Hair setup: Week 4, "Hair Structure, FX Hair Pipeline and Master Setup".
- Draping: Week 5, "Marvelous Designer Quick Start and Layered Draping".
- Shot work: Week 6, "FX Hair Master Setup and Shot Simulation"; Week 7, "Cloth Solver Structures and Qualoth Shot Simulation"; Week 8, "Q&A: Thickness, Layered Collision, Slow Motion, Multi-Patch Garments".
- Box sublabels are short forms of those titles.

## Reference
Concepts (23; 18 linked from the path), Entities (6; all linked), Syntheses (2; both linked). Counts from the census. The weeks link to each (dashed arrow).

## Behind the scenes
Flashcards (1 Obsidian page). Analytics, Dashboard and journal/template are hidden by `sites/cfx-qualoth/site.json`, so they are not drawn.

## Focal
CFX Scope: the first page of the index's Start here line.

## Left out on purpose
- Per-week links to concepts and entities.
- The raw transcripts: they are in raw/, outside the site.

## Redraw when
The Start here line in index.md changes, the weeks change, or the tiers in `sites/cfx-qualoth/site.json` change.
