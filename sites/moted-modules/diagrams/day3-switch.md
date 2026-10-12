# day3-switch: Forward Limb, one evaluation

Page: workshop/day-3.md, Phase 2 (the legacy sequenceDiagram fence is lines 64-78, its caption sentence is line 80). The raw Mermaid is the authority: the extractor drops the `else` branch, which is drawn here.
Type: Sequence with one `alt` fragment. viewBox 704 x 504. 4 lifelines, 4 messages, 1 note, 1 fragment with 2 regions.

## Lifelines
IK on channel (Sw), FK controls (FK), IK + PV (IK), Bones (B).
The fence declares them in the order Sw, FK, IK, B. They are drawn Sw, FK, Bones, IK + PV so that every message runs between neighbours and no arrow crosses a third lifeline. The order of lifelines is layout, not a claim.

## Messages
- Note over IK on channel: "Get Bool Channel, Not" (70)
- alt "FK mode" (71): FK controls -> Bones "Forward FK" (72); Bones -> IK + PV "Backward IK (project, pole)" (73)
- else "IK mode" (74): IK + PV -> Bones "Basic IK (aim at Effector null)" (75); Bones -> FK controls "Backward FK" (76)

## Focal
Backward IK (project, pole): the call Phase 1 built and Phase 2 runs every evaluation in FK mode (page line 91). The Sequence type forbids accent on both `alt` branches, so only this one message is accent. Backward FK, its mirror, is plain.

## Left out on purpose
- Step 6's Sequence boxes (A: IK FK Control Visibility, B: the Branch, Day 5's C and D): the fence shows only the branch.
- The Draw Line step (line 98) and the metadata read of `Effector` (line 95): prose.
