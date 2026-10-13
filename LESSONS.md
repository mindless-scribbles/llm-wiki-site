# LESSONS.md

Project-specific lessons learned across sessions. Read at session start. Update after any correction or mistake.

<!-- Keep entries tight: ~8 lines per lesson, ~600 lines total. Derivations belong in
     dedicated docs — link to them, don't inline them. Update an existing lesson rather
     than duplicating it. Delete superseded lessons outright; the git log has them. -->

## Rules
<!-- Each rule should be concrete and actionable. Format:
     **[Short label]:** What to do (or not do), and why (date; doc pointer). -->

**Dry-build before `--all`:** build every registered wiki into a scratch folder first, with `build --site <id> --out <scratch>/<id>`. `build()` wipes the out dir before rendering, so a throw on one wiki leaves its live site half-built (2026-10-04). Build by `--site`, not by path: nav keys live in `sites/<id>/site.json`, and a by-path build never reads it, so the dry run would show the folder nav (2026-10-12).

**The current page is not a link in old builds:** before the 2026-10-04 layout, `renderSidebar` emitted the current page as a plain `<li class="index-item current">` with no href. Anything that scrapes built HTML for the index must handle that case (2026-10-04).

**Remember only user toggles:** a `<details open>` fires `toggle` on load. Persisting state from `toggle` saves every visited group as "opened"; listen for clicks on `<summary>` instead (2026-10-04).

**Mermaid cache is keyed on the theme:** `diagramHash` hashes the source plus `MERMAID_CONFIG`, so a palette change in `mermaid.mjs` re-renders every diagram on the next build. No manual cache clear needed (2026-10-04).

**A design change covers every renderer:** `renderPage` has three paths (home, lesson, article). The three-column layout and reading register only changed the article path, so the one lesson page (Moted Day 3) kept the old look for a week. Check a home page and a `type: lesson` page before calling a design change done (2026-10-12).

**Browser checks under Hyprland:** `resize_window` does not change the viewport here. To check narrow layouts, load the page in fixed-width iframes from a page on the same origin. Animation frames do not run while a JS-tool call holds the page, so test scroll-driven UI with real wheel scrolls (2026-10-04). A fresh tab can report `visibilityState: hidden` and time out the first screenshot or two; check the DOM with the JS tool meanwhile and retry (2026-10-12).

**Freeze step numbers when converting lessons:** Moted pages cite each other's steps by number ("Day 8 step 6", "Day 5 step 15", "Repeat 4 to 7"). A conversion that merges or drops a numbered step breaks those citations without warning. Before and after, diff the `^ *N. ` lines of each page (2026-10-12).

**A Why must not answer its phase's Ask:** the site hides a Decision behind a reveal, but a `**Why:**` sits above it in plain view. When the workers wrote Why lines from the Decisions, 18 of them gave the hidden answer away. Write the Why from what breaks, and leave out the answer (2026-10-12).

**Prove an opt-in builder change by diff:** before editing, build two or three wikis (`build --site <id> --out <scratch>/before/<id>`), rebuild after into `after/`, then `diff -r`. Pages must come out byte-identical; only `assets/wiki.css` and `.llm-wiki-site.json` (build time) may differ. Keep new behaviour out of the inline page script (use CSS such as `:has()`), or every page changes (2026-10-12; `17d98bd`).
