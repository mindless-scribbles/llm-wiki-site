# course-flow: the Rigging with Matrices series, stage by stage

Page: summaries/rigging-matrices-part01-intro.md, after "Key Points" (Part 01 is the series intro; the wiki has no other overview page, and index.md is a catalog). Drawn for the nav-flow diagnosis (2026-10-12).
Type: Service blueprint layout (step columns, reference row, a line of visibility), with arrows for the order. viewBox 704 x 304.

## Columns
- Start here: "Foundational" (index.md heading): summaries/mastering-matrices-3d-animation (the theory video) and summaries/rigging-matrices-part01-intro. Part 01's Key Points name the theory video as the prerequisite.
- Stage 1, FK: Part 02, "guided FK control rig via offsetParentMatrix" (index.md).
- Stage 2, IK: Parts 03 to 07: Maya ikHandle (03), joint-free custom node solver (04), soft IK (05), Pythagorean shortcut (06), Bifrost solver (07). Index.md calls them the three solvers in "IK Solver Comparison": Maya, custom node, Bifrost.
- Stage 3, IK/FK blending: Part 08, "local-space blending for IK/FK switch + flat joint hierarchy".
- Stage 4, Animator features: Parts 09 to 13: segment length scaling, space switching, driving shape data, IK elbow locker, control space scaling. The index's concept group "Animator-facing features" holds the same five topics.

## Rows
- The series: the five columns above. Part pages link to concepts and entities (census; e.g. Part 02 links offset-parent-matrix-workflow and module-based-rig).
- Reference: Concepts (27, in the index's order: foundational matrix theory, rig architecture, limb mechanics, animator-facing features), Entities (8), Syntheses (2: "IK Solver Comparison", "Clusters vs Direct CV Driving"). Dashed arrows go to Concepts and Entities, which every stage links. Syntheses get no arrow: no summary links them.
- Behind the scenes, under the line of visibility: Presentations (12: Parts 02 to 13, "step-by-step walkthroughs", verbatim and timestamped; index.md). No summary links them.

## Focal
Foundational: the entry, theory video then Part 01.

## Left out on purpose
- The three deformer and proximity summaries ("placeholder; raw source has no narration"): not on the series.
- Per-part links to concepts and entities.

## Redraw when
The series changes, or the nav's tiers in `sites/mastering-matrices/site.json` change.
