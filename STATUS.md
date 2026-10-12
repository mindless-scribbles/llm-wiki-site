# STATUS.md

<!-- Session-continuity SNAPSHOT, not a log. Refresh these sections in place each
     session — don't stack new dated sections on top of old ones. Soft budget ~200
     lines. Per-session narrative → commit messages; deep detail → dedicated docs. -->

## Last Session

- **Date:** 2026-10-12 (two sessions; the first crashed mid-work and the second recovered it)
- **Summary:** Mermaid is retired for editorial `@diagram` SVGs drawn by the diagram-design plugin (DDC Reel profile, 704 wide). There are 11 diagrams so far: Moted Modules (5, converted from Mermaid) and Coloso Stylish Action Games (6 new), commit `0a64724`, and every wiki was rebuilt. Then `type: lesson` pages moved into the approved three-column shell, with markers as callouts and reveals and visuals inline (`6d0a899`). Don approved Moted Day 3 in the new layout.

## Files Modified

- `build-site.mjs`: `@diagram[slug] caption` (`cleanDiagramSvg`, `diagramSvgs`, a review-only "Diagram needed" slot, landing cards). `renderLesson` was rewritten to emit callouts in the reading column. `LESSON_SCRIPT` only keeps predictions. The rail/grid/zoom lesson CSS is gone.
- `bin/cli.mjs`: `--diagrams <dir>` / site.json `diagrams`. `review/overlay.js`: dropped the paged-phase unhide.
- `README.md`, `BUILD-SITE.md`: Diagrams section, Lessons table. `LESSONS.md`: two lessons.
- `sites/{moted-modules,coloso-stylish-action-games}/diagrams/`: `<slug>.svg` + `.html` source + `.md` spec.
- Outside this repo:
  - `~/.claude/skills/add-diagram/SKILL.md`: loads `diagram-design:diagram-design` from the plugin cache.
  - `~/.claude/skills/add-lesson/SKILL.md`: the layout wording, and a caption goes on the marker line.
  - llm-wiki template `CLAUDE.md` (`ac05f29`, branch `editorial-diagrams`).
  - Moted vault `CLAUDE.md` + `log.md`.
  - Coloso vault: six tutorial pages with `@diagram` lines (+ `log.md`).

## Key Decisions

- New diagrams are `@diagram` SVGs via the `add-diagram` skill, never Mermaid. Don: "there is no version where the mermaid default wins." The plugin `diagram-design@diagram-design` is installed at user scope (marketplace `cathrynlavery/diagram-design`).
- Lessons share every page's shell: phases are ordinary h2s (listed in "On this page") and their minutes add up in the hero kicker. Why / Ask / Predict / Read / Trap / Goal / Result / Open in are `.callout`s. Decision and Read sit behind `<details>`. A visual's caption goes on its marker line, so the old `:` title paragraph is now just a lead-in.
- Text pages follow uiarc.dev/docs/introduction (16px body in `#b4b4bb`, Syne headings, charcoal `#141416` ground). DDC Reel is Don's own system, independent of dondecastro.com.

## Next Steps

- [ ] **Convert Moted Modules Days 1, 2, 4–10 to `type: lesson`** (Don, 2026-10-12; Day 3 is the approved pilot and model). Vault: `wiki_projects/Moted_Modules/wiki/workshop/day-N.md`. Use the `add-lesson` skill: §"Converting an existing page", then §3 "Fan out" with one `worker` per day, given Day 3's path as the model.
  - Keep every fact, name, number and step number.
  - Set `type: lesson` and bump `updated:`.
  - Add a `**Why:**` lead to each phase (only Day 3 has one now).
  - Change `**Open beside this page:**` to `**Open in Unreal:**` plus a list, as Day 3 has it.
  - Keep `**Ask:**`/`**Decision:**` only for a real call the room could get wrong; turn the rest into bold-lead facts.
  - Add an `@image[dayN-...]` capture slot per phase where a graph shows the how.
  - Don't invent diagrams in this pass; use `@diagram` slots only where a page describes structure.
  - Review every result yourself (Why lines, no fake Asks, budgets match the work). Run `llm-wiki-site lint --site moted-modules`, build `--site moted-modules`, check a couple of days in Chrome, log the change in the wiki's `log.md`, and give Don the URLs.
  - Moted's `CLAUDE.md` "Lesson pages" section has the marker rules.
- [ ] Lint flags five older long paragraphs on the animation-blending OverRig source code map (lines ~136, 180, 235, 341, 358). Fix them when that page is next touched.
- [ ] `diagram-plugins` is not merged to `main`, and llm-wiki `editorial-diagrams` is not merged either. Ask Don before merging.

## Active Context

- Review server: `http://127.0.0.1:4173/` (one hub, `/<wiki-id>/` per wiki). If it's down: `nohup llm-wiki-site serve > ~/.cache/llm-wiki-site/serve.log 2>&1 &`. Notes: `llm-wiki-site notes`, `--design`, `--site <id>`.
- Vault root: `/mnt/c/Users/Owner/Documents/Obsidian Vault` (`local.json`). The vault is not a git repo; wiki edits are logged in each wiki's `log.md`. Back up a vault file to the scratchpad before editing it.
- A stale shell from the crashed session (pid 28286, a Mermaid-vs-diagram comparison page on port 4181) may still be running; it's safe to kill.
