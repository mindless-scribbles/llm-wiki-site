# combo-wait: content (lesson 92, Section07)
Line numbers are lines of Section07-CreatingAComboAttack/92-ImplementingWaitActionsForComboAttackInputs.md ("tut" = the twin under tutorials/).

## Lifelines (actors)
- AM_ScifiSoo_GroundComboAttack, Animation Montage that carries the notify (22, 40)
- ANS_ComboWaiting, AnimNotifyState Blueprint (37, 40)
- CharacterBase (67): only a pass-through. Folded into ANS's self-message (see note).
- ActionHeroController, implements the IController interface (70, 73, 91, 94)
- STT_GroundComboAttack, Combo Action task; Act the Next lives here (106; tut line 63 names the IAction interface)
- Player, the left-click (19, 22, 112, 115). "Player" is a role, not a Blueprint.

## Messages, in order
1. AM -> ANS: Received Notify Begin (64)
2. ANS self: Get Owner, Cast To CharacterBase, Get Controller (67, 70). Page also casts to ActionHeroController here, then removes the cast and calls through IController (76).
3. ANS -> ActionHeroController: BeginComboWaiting(Self), through IController; input ComboWaiting = Self (70, 76, 88, 91)
4. ActionHeroController self: save to the Combo Waiting variable (94)
5. Player -> ActionHeroController: left-click, enters Try Player Action (100, 112, 115)
6. ActionHeroController self: Is Valid on Combo Waiting (100)
7. ALT region "Combo Waiting valid and Action Tags match" (100, 118): ActionHeroController -> STT_GroundComboAttack: Act the Next(ComboWaiting) (100, 103, 106)
8. STT self: jump to the Get Next Section value, replacing Section Index; NextSection is Combo2 on the first window, Combo3 on the second (52, 55, 106, 109)
9. ALT region "Combo Waiting not valid": ActionHeroController runs the existing code (103)
10. AM -> ANS: Received Notify End (79)
11. ANS -> ActionHeroController: EndComboWaiting(Self), through IController (79, 82, 91)
12. ActionHeroController self: clear Combo Waiting, only if it equals the stored one (97)

## Left out on purpose
- Frame numbers 29 and 91 (46, 49): the page is ambiguous whether they are start/end of one window or of two windows ("around 91" on the back part). Not drawn.
- Tag mismatch while valid (121): page says "think about what to do" and resolves it later (148+, End Action). Out of this lesson step.
- Section Index removal, Dummy outputs, Get Notify Name override: authoring detail, not message order.
- The wait window itself: shown as the ANS activation bar (state live from Begin to End).

## Focal
- Message 7, Act the Next(ComboWaiting): the one call the window exists to gate (100-106, 112).
- ANS_ComboWaiting: the new object the lesson creates (37).
