# STATUS.md

<!-- Session-continuity SNAPSHOT, not a log. Refresh these sections in place each
     session — don't stack new dated sections on top of old ones. Soft budget ~200
     lines. Per-session narrative → commit messages; deep detail → dedicated docs. -->

## Last Session

- **Date:** 2026-10-12 (fifth session)
- **Summary:** The nav diagnosis we did by hand for Moted now covers every registered wiki.
  - The nav keys moved from the vault to `sites/<id>/site.json` (`825e72c`).
  - The builder gained a nav census, `llm-wiki-site nav` (`402c9ae`).
  - The diagnosis became the `nav-flow` skill (skills repo `f1ca585`, `d637e54`). `add-diagram` is now committed in the skills repo too (`68bbcfa`).
  - We ran it on Agora (`7505475`) and animation-blending (`5770068`), each with a diagnosis page.
  - Don then approved a batch run with no diagnosis pages. Seven worker agents applied it to the remaining 19 wikis (`f95b1b4`). Everything is pushed.
- **Result:**
  - 13 wikis passed the path test and have a `<path>-flow` diagram mounted on their entry page: animation-blending, cfx-qualoth, both coloso wikis, the six dja-houdini wikis, mastering-matrices, mgear and unreal-tech-anim. Moted already had one.
  - 7 are shaped as references, with nav settings and no diagram: Agora, animation-mentor-notes, davinci-blurs, puppeteer-lounge, riggingworkshop-breakdowns, unreal-control-rig and zebra-face-breakdown.
  - motion-stitchtool (1 page) is unchanged.
  - Every wiki's `log.md` names its backup folder: `~/.cache/llm-wiki-site/backups/<id>-2026-10-12-nav/`.

## Files Modified

- **Builder:**
  - `bin/cli.mjs`: `NAV_KEYS` pass from `site.json` into the build; new `nav` command and `--json` flag.
  - `nav.mjs`: the census.
  - `wiki-model.mjs`: `SECTIONS`, `parseFrontmatter`, `humanize`, `natural`, `walkMd` and `startHereBlock`, now shared by the builder and the census.
  - `build-site.mjs` imports them. Proven byte-identical by diff.
  - `config.mjs`: comments.
  - `README.md`: the "Nav census" section and the nav-key paragraph. `BUILD-SITE.md`: "Shaping the nav". `CLAUDE.md`: dry-build with `--site`, and the census line.
  - `sites/*/site.json`: nav keys for 21 wikis. `sites/*/diagrams/<path>-flow.{md,html,svg}` for the 13 path wikis.
- **Skills repo:**
  - `nav-flow/SKILL.md` and `nav-flow/assets/diagnosis-template.html`.
  - `add-diagram/` (newly tracked).
  - `add-lesson` and `work-notes`: diagram wording.
- **Vault (per wiki):**
  - `log.md` entries.
  - One `@diagram` line on each path wiki's entry page: `index.md`, or the guide, intro or part-01 page.
  - Moted's `site.config.json` lost its nav keys.

## Key Decisions

- **Nav keys live in `sites/<id>/site.json`** (Don). Obsidian Sync doesn't carry `site.config.json`. A build by path still reads `site.config.json`.
- **A path wiki gets its flow diagram drawn and mounted** (Don). A wiki that fails the path test (fewer than two of: numbered pages, an ordering overview, a Start here line, path pages linking out) gets nav settings only, never an invented path.
- **Batch runs skip the diagnosis page** (Don: "no need for artifacts for each"). The skill keeps the page for a single wiki Don wants to review first.
- **Agora is reference until it becomes a course.** Turning it into one is `add-lesson` work, and it needs a source for how the rig assembles its modules.
- **The dja convention:** The lessons (Step by step, then Lesson summaries) → Reference → Behind the scenes (transcripts). Each has a `lesson-flow` diagram on `index.md`.

## Next Steps

- [ ] **Don's call: flashcards stubs.** Ten wikis still have the untouched 43-line `flashcards.md` template (4 example cards). Only Moted (31 cards) and cfx-qualoth (19) have real ones. zebra-face-breakdown hides its stub; the rest show it behind the scenes. Should the stubs be hidden everywhere?
- [ ] **Start here lines in `index.md` (content, per wiki).** The home page's Start here button reads only the index intro. animation-blending's line sits under Statistics (move it). Agora, animation-mentor-notes, coloso-stylish, davinci, mgear, mastering-matrices, puppeteer, riggingworkshop, unreal-control-rig, unreal-tech-anim and zebra have no line, so their `startHere` is a list. Adding the line gives each home page its button and lets `startHere` become `true`.
- [ ] **Builder: sub-headings inside a group.** Several wikis want them:
  - Agora's module families
  - animation-blending's three watch routes
  - coloso-stylish's 8 sections inside Tutorials (112 pages)
  - puppeteer's concept clusters

  Also: `order` can't reach the root "Pages" group (`dir` is null), which blocks riggingworkshop-breakdowns and unreal-control-rig. A design change, so it needs Don's OK.
- [ ] **Census fixes:** treat `partNN` anywhere in a slug as a sequence (mastering-matrices' `rigging-matrices-part02-fk` was missed). After keys are applied, report the shaped nav, not the folder nav.
- [ ] **STATUS rollout step 4:** add the nav step to `~/.claude/commands/init-wiki.md` and the llm-wiki template `CLAUDE.md`. A new wiki should get a Start here line in its intro, nav keys and a flow diagram.
- [ ] **Index content gaps seen by the workers:**
  - Stale counts and callouts in the animation-blending, davinci-blurs, cfx-qualoth and mgear indexes.
  - animation-mentor-notes' index lists only 55 of its 122 concepts.
  - Agora's `syntheses/` folder is empty, and its index suggests five comparisons.
- [ ] Carried over:
  - Moted `index.md`: rename `## Theory`, and trim line 106 (Don's call).
  - Don's review of the nine converted Moted days (open questions in the Moted log, 2026-10-12).
  - The animation-blending OverRig map lint (five long paragraphs).

## Active Context

- Review server: `http://127.0.0.1:4173/` (one hub, `/<wiki-id>/` per wiki). If it's down: `nohup llm-wiki-site serve > ~/.cache/llm-wiki-site/serve.log 2>&1 &`.
- Vault root: `/mnt/c/Users/Owner/Documents/Obsidian Vault`. It is not git: log wiki edits in each wiki's `log.md`, and back up vault files first (`~/.cache/llm-wiki-site/backups/`).
- Diagnosis pages: Moted https://claude.ai/artifact/PPhuUofKfXWryCWVZiQYwf, Agora https://claude.ai/artifact/3TQWPUzWBnNowTF1XXydgH, animation-blending https://claude.ai/artifact/Eue8zqcpMZz64fvo5XuVEU.
- Headless checks work here: `google-chrome --headless=new --screenshot` / `--dump-dom`. For DOM probes, put a probe page in the served out dir, run it, then delete it.
