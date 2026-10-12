# STATUS.md

<!-- Session-continuity SNAPSHOT, not a log. Refresh these sections in place each
     session — don't stack new dated sections on top of old ones. Soft budget ~200
     lines. Per-session narrative → commit messages; deep detail → dedicated docs. -->

## Last Session

- **Date:** 2026-10-12 (three sessions)
- **Summary:** editorial `@diagram` SVGs replaced Mermaid (`0a64724`), and lesson pages moved into the reading shell (`6d0a899`). Then Moted Days 1, 2 and 4–10 were converted to `type: lesson` with Day 3 as the model. One `worker` per day, run from a shared brief. Steps and budgets were frozen, then checked by diff. Every Decision sentence was checked against backups. Moted was rebuilt and all ten days render, each phase with its Why callout. That last change is all in the vault, so this repo only has a STATUS commit for it.

## Files Modified

- `build-site.mjs`: `@diagram[slug] caption` (`cleanDiagramSvg`, `diagramSvgs`, a review-only "Diagram needed" slot, landing cards). `renderLesson` was rewritten to emit callouts in the reading column. `LESSON_SCRIPT` only keeps predictions. The rail/grid/zoom lesson CSS is gone.
- `bin/cli.mjs`: `--diagrams <dir>` / site.json `diagrams`. `review/overlay.js`: dropped the paged-phase unhide.
- `README.md`, `BUILD-SITE.md`: Diagrams section, Lessons table. `LESSONS.md`: two lessons.
- `sites/{moted-modules,coloso-stylish-action-games}/diagrams/`: `<slug>.svg` + `.html` source + `.md` spec.
- Outside this repo:
  - Moted vault: `wiki/workshop/day-{1,2,4..10}.md` (lessons), `log.md`, `CLAUDE.md` (the pilot note). Pre-edit backups are in the session scratchpad.
  - `~/.claude/skills/add-diagram/SKILL.md`: loads `diagram-design:diagram-design` from the plugin cache.
  - `~/.claude/skills/add-lesson/SKILL.md`: the layout wording, and a caption goes on the marker line.
  - llm-wiki template `CLAUDE.md` (`ac05f29`, branch `editorial-diagrams`).
  - Moted vault `CLAUDE.md` + `log.md`.
  - Coloso vault: six tutorial pages with `@diagram` lines (+ `log.md`).

## Key Decisions

- New diagrams are `@diagram` SVGs via the `add-diagram` skill, never Mermaid. Don: "there is no version where the mermaid default wins." The plugin `diagram-design@diagram-design` is installed at user scope (marketplace `cathrynlavery/diagram-design`).
- Lessons share every page's shell: phases are ordinary h2s (listed in "On this page") and their minutes add up in the hero kicker. Why / Ask / Predict / Read / Trap / Goal / Result / Open in are `.callout`s. Decision and Read sit behind `<details>`. A visual's caption goes on its marker line, so the old `:` title paragraph is now just a lead-in.
- Converting a lesson page leaves its numbered steps and `(NN min)` budgets frozen. Other pages cite steps by number ("Day 8 step 6"), so the skill's "collapse the wiring" rewrite waits for Don's review of each day. An Ask stays only when its wrong answer fails visibly.
- Text pages follow uiarc.dev/docs/introduction (16px body in `#b4b4bb`, Syne headings, charcoal `#141416` ground). DDC Reel is Don's own system, independent of dondecastro.com.

## Next Steps

- [ ] **Don reviews the nine converted Moted days** (converted 2026-10-12; vault-only change, logged in Moted `log.md`). Start at `http://127.0.0.1:4173/moted-modules/workshop/day-1.html`. Steps and budgets are unchanged; Asks went 125 → 31; there are 50 `@image` capture slots. Work his notes with `work-notes`. Open questions for him:
  - Day 3's Phases 2 to 5 have no `**Why:**`. Should they get one, like the other days?
  - Budgets that look tight (not changed): Day 2 Phase 4, Day 4 Phase 2, Day 6 Phase 6, Day 7 Phase 4.
  - The capture briefs name boxes from the page text; nobody checked them against the rig.
- [ ] Lint flags five older long paragraphs on the animation-blending OverRig source code map (lines ~136, 180, 235, 341, 358). Fix them when that page is next touched.
- [ ] `diagram-plugins` is not merged to `main`, and llm-wiki `editorial-diagrams` is not merged either. Ask Don before merging.

## Active Context

- Review server: `http://127.0.0.1:4173/` (one hub, `/<wiki-id>/` per wiki). If it's down: `nohup llm-wiki-site serve > ~/.cache/llm-wiki-site/serve.log 2>&1 &`. Notes: `llm-wiki-site notes`, `--design`, `--site <id>`.
- Vault root: `/mnt/c/Users/Owner/Documents/Obsidian Vault` (`local.json`). The vault is not a git repo; wiki edits are logged in each wiki's `log.md`. Back up a vault file to the scratchpad before editing it.
- A stale shell from the crashed session (pid 28286, a Mermaid-vs-diagram comparison page on port 4181) may still be running; it's safe to kill.
