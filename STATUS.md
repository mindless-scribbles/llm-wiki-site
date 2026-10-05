# STATUS.md

<!-- Session-continuity SNAPSHOT, not a log. Refresh these sections in place each
     session — don't stack new dated sections on top of old ones. Soft budget ~200
     lines. Per-session narrative → commit messages; deep detail → dedicated docs. -->

## Last Session

- **Date:** 2026-10-04
- **Summary:** Moved every wiki site to a three-column docs layout modelled on uiarc.dev (`4906157`). Then worked Don's review notes on animation-blending's OverRig source code map: two content notes fixed in the vault, three design notes rolled out to all 22 sites (callouts, text-page typography, charcoal palette), and DDC Reel updated to match. Notes queue is empty.

## Files Modified

- `build-site.mjs` — three-column layout; blockquote → pull quote or callout; reading register (`--color-body`, Syne 700 sentence-case title, 24/18px Syne 600 headings, 16px body); charcoal palette with `--color-bg-rgb`; meta-row widths.
- `mermaid.mjs`, `widgets/_viz.js`, `review/overlay.css` — the charcoal palette.
- `README.md`, `BUILD-SITE.md` — Page layout, reading register and callouts.
- `CLAUDE.md`, `STATUS.md`, `LESSONS.md` — session-loop docs (new).
- `design-notes/`, `sites/animation-blending/review/` — the resolved review notes.
- Outside this repo: `~/.claude/skills/ddc-reel/` (SKILL.md, `assets/ddc-reel.css`); the DDC Reel design-system artifact (version 6: tokens, bundle.css, README, Prose); vault page `wiki_projects/Animation_Blending/wiki/syntheses/overrig-source-code-map.md` and its `log.md`.

## Key Decisions

- Text pages follow uiarc.dev/docs/introduction: body 16px in `#b4b4bb`, off-white kept for emphasis; title Syne 700 sentence case; h2/h3 Syne 600 at 24/18px with no rules.
- Blockquotes: one short paragraph (≤240 chars, no bold or ⚠️ lead) is a pull quote; anything else is a callout, with a `**Label:**` lead as its mono label and ⚠️ as a warning.
- Ground is charcoal `#141416` (surfaces `#1a1a1d` / `#222226`, ink `#f2f2f3`) for all DDC Reel work, approved by Don.
- DDC Reel is Don's own system for internal work and the wikis. It started from dondecastro.com but is independent: never sync from the site, and leave the site alone (it gets its own design system).

## Next Steps

- [ ] Lint flags five older long paragraphs on the OverRig source code map (lines ~136, 180, 235, 341, 358). Fix them when that page is next touched.
- [ ] No wiki has a `type: lesson` page yet. Check the lesson layout on the first real one (it was only tested on a throwaway wiki).

## Active Context

- Review server: `http://127.0.0.1:4173/` (one hub, `/<wiki-id>/` per wiki). Notes: `llm-wiki-site notes`, `--design`, `--site <id>`.
- Vault root: `/home/ddc/Documents/DDC Vault` (`local.json`). The vault is not a git repo here; wiki edits are logged in each wiki's `log.md`.
