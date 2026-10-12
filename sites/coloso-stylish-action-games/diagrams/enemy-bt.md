# enemy-bt: final BT_ScifiSoo Behavior Tree (lesson 78)

Page: Section06-EnemyAIsCounterattack/78-EnemyAIChoosingCloseRangeActionsProbabilistically.md
(line numbers are page lines; twin = tutorials/ same path, steps 35-86)

## Nodes
- Root (BT_ScifiSoo) - 417-ish ("I'll leave BT_ScifiSoo as is"), 222/225 "starts from the ROOT Node"
- Selector, Node Name "Action" (was Selector) - 216-225, 408-411
- Selector, Node Name "Melee" (second Selector under the first) - 339-342, 411
  - Decorator BotCheckFocusNear, Node Name "If Distance <= 300", Acceptance Distance 300 - 219-222, 339-342 (moved onto Melee by Ctrl+X/Ctrl+V), 408
  - Decorator BotRollDice (rolls a Random Float 0-1 into Blackboard key DiceValue) - 345-348, 357-363, 408 ("Leave BotRollDice as it is")
- BotActionTask "Dodge" (Action Tag Character.Dodge) - 22, 121, 414
  - Decorator BotCheckDice, Node Name "40%", DesiredPercentage 40 - 351-354, 369-375, 393-394, 411-414
- BotActionTask "Sword ATTACK" (Action Tag Character.Attack.Sword) - 298, 415
- BotActionTask "GunFire" (Action Tag Character.Attack.GunFire) - 28, 52, 225, 411
- Blackboard (BotBlackboard) key DiceValue, type Float - 334-337 (twin steps 71-73)

## Edges
- Root -> Action - 222, 225
- Action -> Melee (visited first, left) - 222, 225
- Action -> GunFire (visited next, right; runs when Melee's decorator fails, distance > 300) - 222-225
- Melee -> Dodge (first, left; runs when BotCheckDice true, 40%) - 354, 394
- Melee -> Sword ATTACK (second; the other 60%) - 354, 394
- BotRollDice writes DiceValue to the Blackboard - 357-364
- BotCheckDice reads DiceValue from the Blackboard - 364-367

## Rules shown
- Selector runs children left to right until one returns True; Sequence until one returns False - 258-262, 301
- BotCheckDice returns True when DiceValue - DesiredPercentage x 0.01 <= 0 - 376-388
- 40% dodge / 60% sword - 346, 394

## Focal
- Melee (the dice roll plus the 40/60 split is what this lesson adds). Secondary emphasis: none.
Cut: RemainingDiceValue / Max clamp (local variable detail), the node-rename story, the earlier Sequence version.

## Page ambiguity
- Line 393 says "with BotRollDice selected ... DesiredPercentage ... 40", but BotRollDice has no DesiredPercentage;
  the rename section (411-414) and the twin (step 84) put 40 on BotCheckDice (the Dodge's decorator). Drawn that way.
- The page text is silent on whether Dodge is left of Sword; "the one on the right is Sword ATTACK" (414-415) confirms Dodge left.
