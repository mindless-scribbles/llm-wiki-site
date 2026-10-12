# day3-match: Backward IK matches the controls to the FK pose

Page: workshop/day-3.md, Phase 1 (the legacy flowchart TD fence is lines 30-41, its caption sentence is line 43; lines 47-50 explain the A/B/C outputs of the `Sequence`).
Type: Flowchart with two zones. viewBox 704 x 472.

## Nodes
- Bones, "posed by FK" (32: "Bones, posed by FK"). Input pill.
- Zone B, "B · Match Pole Vector Control" (35):
  - Compute Pole Vector Location, "Day 2" (36)
  - Set Transform, "on PV Control, translation only" (36)
- Zone A, "A · Match IK Control" (38):
  - At −1 of Bones, "the wrist" (39)
  - Project to new Parent, "keep the control's rest offset" (39)
  - Set Transform, "on IK Control, propagate on" (39)

## Edges
Bones -> Compute Pole Vector Location (33); Bones -> At −1 of Bones (34); Compute Pole Vector Location -> Set Transform (36); At −1 of Bones -> Project to new Parent -> Set Transform (39).

## Focal
Project to new Parent: the page's "Project, don't copy" (line 52), the step a copy would break. One accent element.

## Notes
- The fence draws zone B above zone A; this diagram puts zone A on top and zone B below, so a top-down read matches the `Sequence` order (A, then B; line 43). Bones sits above both zones; its two connectors leave the bottom edge, one straight down into A, one down the left gutter and right into B.
- Zone A, step C (returns, line 50) is not in the fence and is not drawn.

## Left out on purpose
- The `Initial` flag detail of `Project to new Parent` (step 3, line 58) and the `Effector` null explanation (line 48): prose.
