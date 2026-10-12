# hero-statetree: content ledger

Page: wiki/Section06-EnemyAIsCounterattack/76-ManagingTheStateOfTheMainCharacter.md (line numbers below are its file lines; the twin under tutorials/ agrees and was used for names such as STT_ScifiSoo_Dodge, Tree Start/Tree Stop, Bool Compare). The scout's line estimates were all verified and are within a line or two.

Type: state machine (states + triggers + guards), with the few outside actors that feed it.

## States (inside ScifiSooHeroStateTree, line 79)
- Root: fixed, cannot be changed or removed (83). Does nothing; falls through to its first child (227-229, 391).
- Ready: first child of Root (85, 229, 391). Task Delay Task set to Run Forever, so it never ends (151, 219-220). "standing still and capable of performing any action" (85).
- Falling (169). Task Run Forever (172). Has no transition to Dodge (334-337, 340).
- Dodge (247). Task STT_ScifiSoo_Dodge (253). Returns Running until Is Completed is true (379-391).

## Transitions
1. Root -> Ready, automatic, "first child State" (227-229, 391).
2. Ready -> Falling: Trigger On Tick, Condition Bool Compare, Left bound to the evaluator's Is Falling, true (217-223).
3. Falling -> Root: Trigger On Tick, Bool Compare Is Falling false (226); then Root goes on to Ready (227-229).
4. Ready -> Dodge: Trigger On Event, Event Tag Character.Dodge (328-331, 333).
5. Dodge -> Root: Trigger On State Completed, no condition (373-376); then Ready (391).

## Outside the tree
- Evaluator CharacterStateTreeEval (178): output variable Is Falling (198-199), set from the Assign of Movement Mode Changed (205-210, 214-216), unbound in Tree Stop (212-214). Bound into the Bool Compare of transitions 2 and 3 (223, 226).
- IA_Dodge in C_ScifiSoo -> Try Action on the controller (IController interface, implemented in ActionHeroController) -> Send State Tree Event with tag Character.Dodge to HeroStateTree (313-316, 328).
- Play Montage On Completed in STT_ScifiSoo_Dodge sets Is Completed true (388-391); Tick then returns Succeeded and the task ends (385-391).

## Focal
Dodge, entered only by the On Event transition from Ready (334-337): the whole lesson is that the dodge rule lives in one visible edge and Falling has no such edge. Two accent elements: the Dodge state and the Ready -> Dodge transition.

## Not on the diagram (cut)
Motivation (stuck Is Sword Attacking after On Interrupted, 22-37), Debug Text Task, Context Actor Class, CanAction, CreateHeroStateTree/Add State Tree Component, GetMoveInput cast.
