# limb-state: FK mode and IK mode

Page: modules/limb.md, section "Forward" (the legacy stateDiagram-v2 fence is lines 51-62, its caption sentence is line 64).
Type: State machine. viewBox 704 x 272.

## States
- FK mode: "FK controls drive the bones" (55); "Backward IK readies IK + pole" (56). Matches the Forward table, FK column (lines 42-46).
- IK mode: "TwoBoneIK drives the bones" (57); "Backward FK readies FK controls" (58). Matches the Forward table, IK column.

## Transitions
- Start -> FK mode (59). `Initial IK FK Mode` is true, and true = FK (settings table).
- FK mode -> IK mode, "tick IK on, auto-key" (60).
- IK mode -> FK mode, "untick IK on, auto-key" (61).

## Focal
The two Backward lines, drawn as accent chips inside each state: they are why "each mode keeps the other side ready" (line 64), the point of the page's caption. Two accent elements.

## Left out on purpose
- The rest of the Forward table rows (stretch via child offset, apply rolls, capture rolls): they sit in the table, which carries detail the diagram does not.
- The auto-key item list (line 49 and Decision 6): the diagram only names that a flip auto-keys.

## Notes
- Both transitions are straight horizontals between the two boxes (endpoints share a y), at two y levels 40px apart, so neither crosses a label.
