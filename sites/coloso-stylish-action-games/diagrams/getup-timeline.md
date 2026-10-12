# getup-timeline: content

Page: Section07-CreatingAComboAttack/104-... (lecture, L = line in the lecture page; T = step in the tutorial twin).
Subject: one enemy (Squid, C_SquidCharacter) after an Air Combo hit.

## Events, in time order
1. Air Launch: set IsAirDamage to true (L31, L34, L37; T2)
2. Air Strike Down: Can Be Damaged set false; only if the combo gets this far, "Air Hit may not necessarily go all the way to Air StrikeDown" (L43, L49; T4, T5)
3. Event On Landed: Branch on IsAirDamage; false on a normal landing, "nothing will be executed" (L34, L37; T3). Then IsAirDamage reset to false (L31, T3). Can Be Damaged set false on landing so an Air Hit ending is also protected (L49; T5).
4. Activate(PhysicalAnimation): MainBoneName Get Body Bone Name, Include Main Bone, Physical Weight 1, Constraint Profile Ragdoll, gravity on, Trace Move later on (L52-58; T6, T7). This is t = 0 of the lie.
5. Lie on the ground, Retriggerable Delay, final values (L439; T86):
   - after Strike Down (IsDamageStrikeDown): random 3-5 s
   - Air Hit only: random 0.5-2 s
   (Earlier fixed values 3 s / 1 s at L322 are superseded. 5 s at L58 and 3 s at L85 were test values.)
6. At the end of the delay, in order: Blend From Current Pose with BlendTime 0.7 s (L178; T33), Deactivate Physical Anim (L58, L178), Play Action Montage with AM_SquidG_Standup (L88; T17). Can Be Damaged set true after Deactivate Physical Anim (L58; T7).
7. During the 0.7 s blend: FinalPoseAlpha runs 1 to 0, = FinalPoseRemainingTime / FinalPoseBlendOutTime, FinalPoseRemainingTime reduced by Get Delta Time each tick (L202-223; T38-41). A plain Blend node (A normal pose, B Save Pose Snapshot) replaces Blend Poses by bool (L196-199; T36).

## Focal
The 0.7 s Blend From Current Pose with FinalPoseAlpha 1 to 0: it is the lesson's subject (physics to animation) and the one place the diagram's time scale matters for a fixed value. Nothing else accented.

## Not shown (cut)
Pose Watch debugging, Trace Move and the -1 rotation fix, IsBellyUp Up/Down section choice, Impulse Physics Body, Overlap responses, Set Movement Mode (all L61-L436, other topics).

## Type decision
Timeline (vertical, time runs down). Only the lie durations and the 0.7 s blend carry real times, so the scale is honest only there: one scale from landing (0-5 s), an axis break, a second scale from the end of the delay. Two lanes (Strike Down, Air Hit) because the ranges differ. Gantt rejected: no calendar tasks; flowchart rejected: the page's point is when, not which branch.
