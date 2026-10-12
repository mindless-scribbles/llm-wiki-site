# controller-arch: content

Pages: P11 = Section02/11-MakingTheCharacterControllerSwapFunction.md, P13 = Section02/13-ControllingCharactersWitnAnAiController.md. Line numbers are page lines. Twin (tutorials/11) is a checklist of P11 and adds nothing new except two imprecisions noted at the end.

## Nodes (names verbatim)
Controllers ("soul")
- Controller: parent of PlayerController, "AController" (P11 l.166: "inheriting a Class called AController"; l.169 "inherits from the Controller Class")
- PlayerController: "will take the input from the user and move" (P13 l.28); "think of PlayerController as the soul" (P11 l.40); in the Outliner as PlayerController0 (P11 l.37)
- HeroController: child of PlayerController, made in lesson 11 (P11 l.160-172); set as PlayerController Class in Project Settings (P11 l.208)
- AIController: "makes its own decisions and moves independently of user input" (P13 l.28); also listed in the Outliner (P11 l.37)
- RoamingController: child of AI Controller, "goes back and forth in the World" (P13 l.40); set as the AI Controller Class of the enemies (P13 l.82-85)
Pawns ("body")
- Pawn: what a controller possesses; "all Child Classes that inherited the Pawn Class can be possessed or unpossessed" (P11 l.148-151, 169); "think of this character as a body" (P11 l.40)
- Character: child of Pawn (P11 l.136, 145)
- C_Hero: child of Character (P11 l.133, 145); possessed by PlayerController0 at start (P11 l.37-40)
- C_Enemy: child of Character (P11 l.133, 145); possessed by RoamingController (P13 l.85, 106-109)

## Edges
Inheritance (child -> parent), P11 l.133-136 (Character > Pawn > Actor > Object), l.163-166 (HeroController > PlayerController > AController > Actor), P13 l.34-40 (RoamingController from AI Controller), P13 l.28 ("PlayerController ... AIController"):
- PlayerController -> Controller; AIController -> Controller; HeroController -> PlayerController; RoamingController -> AIController; Character -> Pawn; C_Hero -> Character; C_Enemy -> Character
Possess:
- Controller can possess Pawn (class-level rule), P11 l.169 ("the target this controller possesses is the Pawn class"), P13 l.25
- HeroController possesses C_Hero (soul possesses body, input moves the character), P11 l.40-43, l.172-176, l.208-211
- RoamingController possesses C_Enemy (AI moves it, no user input), P13 l.85, l.106-109
Unpossess / Possess functions are on the controller, not the character (P11 l.55); F8 toggles (P11 l.46).

## Focal
HeroController and its possess edge to C_Hero: the soul/body pair is the thing page 11 builds and lesson 13 then pairs with a second controller. Everything else is context.

## Left out on purpose
- GameModeBase / SoulGameMode (P11 l.37, 202-208): registers HeroController but is not part of the controller-pawn relation.
- Actor, Object (above Pawn and Controller): both chains end there (P11 l.130-136, 166); omitted to stay on the controller/pawn relation.
- CharacterBase (P13 l.52, 73): named on P13, but P13 never says what it inherits from, so no edge can be drawn faithfully.
- Debug Key G, V, Input Action, Get Player Controller, F8: events/steps, not architecture.
- The runtime controller swap (P13 l.97-106) is a sequence, not structure.

## Page vs scout / twin discrepancies
- Scout's "GameModeBase" appears on the page as "GameMoodBase" (P11 l.37, caption typo).
- Twin step 29 says Possess/Unpossess "are defined on the Pawn class"; the transcript (P11 l.55) says they are controller functions. Used the transcript.
- Twin says the Player Controller Class field is "Player Controller Class" under Maps & Modes; transcript agrees (P11 l.199).
