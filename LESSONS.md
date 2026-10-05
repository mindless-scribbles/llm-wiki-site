# LESSONS.md

Project-specific lessons learned across sessions. Read at session start. Update after any correction or mistake.

<!-- Keep entries tight: ~8 lines per lesson, ~600 lines total. Derivations belong in
     dedicated docs — link to them, don't inline them. Update an existing lesson rather
     than duplicating it. Delete superseded lessons outright; the git log has them. -->

## Rules
<!-- Each rule should be concrete and actionable. Format:
     **[Short label]:** What to do (or not do), and why (date; doc pointer). -->

**Dry-build before `--all`:** build every registered wiki into a scratch folder first. `build()` wipes the out dir before rendering, so a throw on one wiki leaves its live site half-built (2026-10-04).

**The current page is not a link in old builds:** before the 2026-10-04 layout, `renderSidebar` emitted the current page as a plain `<li class="index-item current">` with no href. Anything that scrapes built HTML for the index must handle that case (2026-10-04).

**Remember only user toggles:** a `<details open>` fires `toggle` on load. Persisting state from `toggle` saves every visited group as "opened"; listen for clicks on `<summary>` instead (2026-10-04).

**Mermaid cache is keyed on the theme:** `diagramHash` hashes the source plus `MERMAID_CONFIG`, so a palette change in `mermaid.mjs` re-renders every diagram on the next build. No manual cache clear needed (2026-10-04).

**Browser checks under Hyprland:** `resize_window` does not change the viewport here. To check narrow layouts, load the page in fixed-width iframes from a page on the same origin. Animation frames do not run while a JS-tool call holds the page, so test scroll-driven UI with real wheel scrolls (2026-10-04).
