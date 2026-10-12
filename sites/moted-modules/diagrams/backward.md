# backward: one frame of a stock bake

Page: solves/backward.md, section "How it works" (the legacy sequenceDiagram fence is lines 29-41, its caption sentence is line 43; the lead-in "One frame of a stock bake:" is line 27).
Type: Sequence. viewBox 704 x 472. 5 lifelines, 4 messages, 1 note.

## Lifelines (fence "participant X as Y")
Take (T), Bones (B), Backward event (E), Controls (C), Section (S). Order as in the fence.

## Messages, in order
1. Take -> Bones: "pose the frame" (36)
2. Bones -> Backward event: "run InverseExecution" (37)
3. Backward event -> Controls: "write each control it knows" (38)
4. Controls -> Section: "key the controls" (39)
5. Note over Controls, Section: "a control nothing wrote is keyed at its initial value" (40)

## Focal
Message 3, "write each control it knows": the backward event is the mapping (line 43), and the bake keys only what it writes (line 25). The note is drawn as a dashed accent box, the gotcha. Two accent elements.

## Left out on purpose
- Activation bars: the fence has none, and the page makes no claim about how long a part holds control.
- Return messages: the fence has none.
- Everything after the fence ("write parents before children", the missing-write mistake): prose.
