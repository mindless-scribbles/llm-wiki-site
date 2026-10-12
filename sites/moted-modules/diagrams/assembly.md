# assembly: the module tree

Page: concepts/assembly-and-connectors.md, section "The tree" (lines 17-31; the legacy Mermaid fence is lines 19-29, its caption sentence is line 31).
Type: Tree. viewBox 704 x 592.

## Nodes (name over module, as the fence writes "Name · Module")
- Root · FNRoot (21)
- Body · Body (21)
- Spine · SpineChain (22)
- Head · Head (23)
- Leg L/R · Limb (24)
- Clavicle L/R · FkChain (25)
- Arm L/R · Limb (26)
- Leg children, two modules (27): Upper/Lower Twist · LimbTwist; Ball · FkChain
- Arm children, two modules (28): Upper/Lower Twist · LimbTwist; 5 fingers · FkChain

## Edges (every arrow is a parent connector, line 31)
Root -> Body (21); Body -> Spine (22); Spine -> Head, Leg L/R, Clavicle L/R (23-25); Clavicle L/R -> Arm L/R (26); Leg L/R -> Upper/Lower Twist, Ball (27); Arm L/R -> Upper/Lower Twist, 5 fingers (28).

## Layout and the depth cap
- The hierarchy is 6 deep (Root, Body, Spine, Clavicle L/R, Arm L/R, then Arm's children). The Tree type caps depth at 4 and breadth at 5, and its anti-pattern list says a 5+ level tree should be split. This diagram is one faithful tree on purpose: the page draws one tree, the three upper levels are a plain chain, and the two deepest levels are short stacks of leaves. Splitting would hide the Spine -> limb link the page is about.
- 11 nodes, over the 9-node budget. Same reason. No box is invented or dropped.
- The two-module lines in the fence ("Upper/Lower Twist · LimbTwist<br/>Ball · FkChain") are drawn as one box per module, each with its own parent connector. The fence listed them as children of the limb in one box.
- The deepest levels are drawn as indented stacks (a vertical bus with a short arrow into each child) so the tree fits the 704 column. The three upper levels use the standard top-down bus.
- Sibling order left to right follows the fence (Head, Leg, Clavicle). The page says sibling order is spawn order (line 56), so the order is kept.

## Focal
Root · FNRoot. The Tree rule allows accent on the root or one critical leaf, never a middle node. The page's Spine -> limb argument ("Why parent to controls", line 52) would favour Spine, but Spine is neither, so the accent goes on the root, where every parent chain ends.

## Left out on purpose
- The chain-input connectors (`Start`, `End`) that target bones (table line 39): the tree shows parent connectors only.
- "30 modules on both Guardian and Zombie" (line 33): stays as prose on the page.
