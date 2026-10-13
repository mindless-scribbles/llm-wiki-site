# STATUS.md

<!-- Session-continuity SNAPSHOT, not a log. Refresh these sections in place each
     session — don't stack new dated sections on top of old ones. Soft budget ~200
     lines. Per-session narrative → commit messages; deep detail → dedicated docs. -->

## Last Session

- **Date:** 2026-10-12 (fourth session)
- **Summary:** Don could never read Moted's intended flow from its left nav, so we did a "nav diagnosis". The diagnosis page is the artifact https://claude.ai/artifact/PPhuUofKfXWryCWVZiQYwf, which has the flow diagram, the nav as it was beside a reader-order sketch, and the five problems. Then:
  - The `workshop-flow` diagram went on Moted's `workshop/overview`.
  - The builder gained opt-in nav shaping, and Moted's nav now reads Start here → The course → Reference → Behind the scenes (`17d98bd`).
  - `diagram-plugins` was fast-forwarded into `main`, and both are pushed.
- **Don's direction for next:** run the same nav diagnosis on every past wiki, and make it part of every future `/init-wiki`.

## Files Modified

- `build-site.mjs`:
  - Opt-in nav keys read from `site.config.json`: `sections` heading markers `{heading, quiet}`, `startHere` (a list, or `true` for index.md's Start here links), `labels`, `order`, `hide`.
  - `sectionPages()` orders each group, and `startHereLinks()` is shared with `renderHome`.
  - Tier CSS. Filtering hides the tiers through CSS `:has()`, so the page script is unchanged.
- `README.md`, `BUILD-SITE.md` ("How it maps"): the nav keys.
- `sites/moted-modules/diagrams/workshop-flow.{md,html,svg}`.
- Outside this repo:
  - Moted vault: `site.config.json` (the nav keys), `wiki/workshop/overview.md` (`@diagram[workshop-flow]`), `wiki/log.md` (two entries). Backups: `~/.cache/llm-wiki-site/backups/moted-2026-10-12-nav/`.

## Key Decisions

- **Nav shaping is opt-in per wiki.** A wiki without the keys builds byte-identical HTML. This was checked with before/after scratch builds of coloso, animation-blending and Moted on its old config; only `assets/wiki.css` differed.
- **`hide` keeps the page built** (links still work) but takes it out of the nav and Previous/Next. Hidden pages get the off-nav label "Hidden"; `log.md` keeps "Meta".
- **Previous/Next and `[NNN]` follow the nav order**, so a shaped nav also makes the pager walk the course.
- **Moted's Start here is an explicit list** (Overview, True Match). The `true` form would also pull in Six Into Four, which belongs above Day 4.
- Earlier today, still in force:
  - New diagrams are `@diagram` SVGs drawn with the `add-diagram` skill, never Mermaid.
  - Lessons share every page's shell.
  - Converting a lesson keeps its step numbers and budgets frozen.

## Next Steps

- [ ] **Nav diagnosis rollout (Don asked for this 2026-10-12).** Moted is the worked example: the artifact above, `sites/moted-modules/diagrams/workshop-flow.md`, and Moted's `site.config.json`.
  1. **Decide where the nav keys live for synced vaults.** They take lists, so they can't go in the `index.md` `site:` block, and Obsidian Sync doesn't carry `site.config.json`. Options:
     - Let `sites/<id>/site.json` (in this repo, in git) carry them. Today `pickBranding` in `bin/cli.mjs` passes only the branding keys.
     - Teach `readSiteFrontmatter` (`config.mjs`) to read nested lists.

     Ask Don which one.
  2. **Package the diagnosis as a skill** (e.g. `nav-flow`, or a mode of `add-diagram`) so each wiki runs the same steps:
     - Extract the built sidebar.
     - Find the entry point (the `**Start here:**` line, an overview page) and the path.
     - Map the link graph from path pages to each group.
     - Flag A-to-Z groups that have a real order, plugin pages (Dataview/Charts View print raw text), and back-room groups.
     - Draw a `<slug>-flow` diagram (the service-blueprint layout, 704 wide).
     - Propose the nav keys.
     - Show Don a diagnosis artifact for each wiki.
  3. **Run it on the 22 other registered wikis** (`ls sites/`). One wiki at a time, each with Don's OK before writing its config. Flat or reference-only wikis may only need `hide` plus `order`; say so rather than inventing a path. Dry-build each into scratch first.
  4. **Future wikis:** add the nav step to `~/.claude/commands/init-wiki.md` and to the llm-wiki template `CLAUDE.md`, so a new wiki gets a Start here line, the nav keys and a flow diagram. The template's `@diagram` work (`editorial-diagrams`) is merged to llm-wiki `main` and pushed (`ac05f29`).
- [ ] **Moted `index.md`, Don's call:** rename `## Theory` to match the nav's "Watch first"? Trim line 106 so it no longer links Analytics and Dashboard?
- [ ] **Don reviews the nine converted Moted days.** Start at `http://127.0.0.1:4173/moted-modules/workshop/day-1.html` and work the notes with `work-notes`. Open questions:
  - Day 3's Phases 2 to 5 have no `**Why:**`. Should they get one?
  - These budgets look tight: Day 2 Phase 4, Day 4 Phase 2, Day 6 Phase 6, Day 7 Phase 4.
  - Nobody has checked the capture briefs against the rig.
  - Three phases carry two captures (Day 1 Phase 2, Day 6 Phases 3 and 4). Keep both, or cut one?
- [ ] Lint flags five older long paragraphs on the animation-blending OverRig source code map. Fix them when that page is next touched.

## Active Context

- Review server: `http://127.0.0.1:4173/` (one hub, `/<wiki-id>/` per wiki). If it's down: `nohup llm-wiki-site serve > ~/.cache/llm-wiki-site/serve.log 2>&1 &`.
- Vault root: `/mnt/c/Users/Owner/Documents/Obsidian Vault`. The vault is not git, so log wiki edits in each wiki's `log.md`, and back up vault files before editing them (`~/.cache/llm-wiki-site/backups/`).
- Headless checks work here: `google-chrome --headless=new --screenshot` / `--dump-dom`. For DOM probes, put a probe page in the served out dir, run it, then delete it.
