# CLAUDE.md

## Project
llm-wiki-site: the static site generator for llm-wiki markdown vaults. It renders every registered wiki (`sites/<id>/site.json`) into a DDC Reel styled HTML site under `~/sites/<id>`, and serves them all, with the review-notes overlay, at `http://127.0.0.1:4173/`. Zero dependencies.

## Session Continuity

At the start of every session, read STATUS.md before doing anything else. Orient yourself before writing any code.

At the end of every session (when I say "wrap up", "park this", "let's stop", "goodnight", or similar), *refresh* STATUS.md in place with:

- What we worked on this session
- Which files were created or modified
- Key decisions made
- Clear next steps (specific, not vague)

## Learning Loop

Read LESSONS.md at session start alongside STATUS.md.

After any correction or mistake:

1. Fix the immediate problem
2. Add a lesson to LESSONS.md that prevents the same mistake
3. Keep lessons concrete and short

## Keeping STATUS.md and LESSONS.md lean

These two files trend toward bloat because each session *appends* to them. They are not archives — git history is the archive. Maintain them so a fresh session can absorb both in one read.

**STATUS.md is a SNAPSHOT, not a log.** Refresh it *in place* each session — overwrite the existing sections; do not stack a new dated section on top of the old ones. Soft budget: **~200 lines.** When a piece of work is done-and-merged, collapse its detail into one line + a git/doc pointer. Per-session narrative belongs in commit messages; deep design/derivation detail belongs in dedicated docs, never inline in STATUS.

**LESSONS.md is a list of tight rules.** Format: `**[label]:** what to do (or not), and why (date; doc pointer).` Soft budget: **~8 lines per lesson, ~600 lines total.** If a lesson needs more, the derivation belongs in a doc and the lesson links to it. Before adding, check for an existing lesson to *update* rather than duplicate. **Delete superseded lessons** outright — do not keep `[SUPERSEDED]` blocks inline; the git log has them.

**Bloat check:** if STATUS.md exceeds ~250 lines or LESSONS.md exceeds ~700, prune before adding more.

## Planning

Enter Plan Mode for any task that touches more than 2 files. Do not start coding until I approve the plan. If something goes sideways mid-implementation, stop and re-plan instead of patching.

## Code Style
- Language: JavaScript, Node 18+ ES modules, no dependencies. `build-site.mjs` keeps its body unindented inside `build()` and its CSS/HTML as template literals (see the note at the top of `build()`).
- Test framework: none. A change is verified by building and looking at the result.
- Run tests with: `node --check build-site.mjs`, then `llm-wiki-site build --site <id>` on one wiki and check it in the browser at `http://127.0.0.1:4173/<id>/`. Before `build --all`, dry-build every wiki into a scratch folder (`llm-wiki-site build <wiki-path> --out <scratch>/<id>`): `build` wipes its out dir first, so a throw leaves a live site half-built.
- Lint with: `llm-wiki-site lint --site <id>` (STE-80 writing rules and each wiki's terminology; reports only).

## Design changes

Design changes reach every wiki. Make them in `build-site.mjs` (renderers and the `CSS` block), rebuild only the wiki the request came from, give Don the URL, and wait for his OK before `llm-wiki-site build --all`. Review notes are worked with the `work-notes` skill. Visual rules come from the DDC Reel skill (`~/.claude/skills/ddc-reel/`); the `CSS` block mirrors its `ddc-reel.css`.

## Verification

Never mark a task complete without building the affected wiki and confirming the pages render. There is no test suite; when a change has logic worth pinning down, say what you checked and how.

## Context Management

Use subagents for any investigation that requires reading more than 5 files (`explorer` for code, `researcher` for docs; see the Agents section in `~/.claude/CLAUDE.md`). Keep the main context clean. Run /compact proactively when context usage exceeds 50%.
