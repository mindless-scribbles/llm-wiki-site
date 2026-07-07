# Static HTML site for the wiki

`build-site.mjs` converts every markdown page under `wiki/` into a self-contained
static HTML site styled after the **Field Logs** journal aesthetic (dark theme,
accent color, Playfair Display headlines, Space Mono body, noise + frame texture,
numbered catalog sidebar). It is domain-agnostic — the same script works for any
llm-wiki; only `site.config.json` changes.

## Build

```bash
node build-site.mjs
```

Output goes to `site/` (git-ignored — it is regenerated, never hand-edited).
Requires Node 18+. No dependencies, no network needed to build (web fonts load
from Google Fonts at view time).

## Branding — `site.config.json`

Optional. If present at the project root, it overrides these defaults:

```json
{
  "title": "Knowledge Base",
  "brandLetters": "KB",
  "footer": "SYS.WIKI / 2026",
  "accent": "#ff3300"
}
```

- `title` — site name (header brand, `<title>`, meta description)
- `brandLetters` — the two glyphs in the header mark
- `footer` — the mono status line at the bottom of the sidebar
- `accent` — the single accent color used throughout

## View

Open `site/index.html` directly in a browser (`file://` works — links are relative
and the stylesheet is shared at `site/assets/wiki.css`). Or serve the folder:

```bash
npx serve site        # or: python3 -m http.server -d site
```

## How it maps

- `wiki/index.md` → `site/index.html` (the landing catalog)
- `wiki/concepts/*.md` → `site/concepts/*.html`, and likewise for
  `entities/`, `syntheses/`, `summaries/`, `presentations/`
- **Any wiki layout works.** Pages are discovered recursively and grouped by
  their top-level folder: the canonical sections above keep their labels and
  order, any other folder becomes its own sidebar group (named after the
  folder), and loose `*.md` at the wiki root fall under a catch-all "Pages"
  group. Structured, custom-folder, and flat wikis all build with no config.
- `wiki/log.md` is included; the Obsidian-plugin files (`dashboard.md`,
  `analytics.md`, `flashcards.md`) are ignored
- `[[wikilinks]]` (with or without `|alias` and `#anchor`) resolve to relative
  HTML links
- Frontmatter drives the hero kicker (type + confidence) and the meta row (type,
  tags, updated, source count)
- Tables, code fences, blockquotes, and nested lists are all supported

Re-run the build whenever the wiki changes. The `site/` folder is fully
regenerated each run, so it is safe to delete.

## Interactive concept visualizations (optional)

Any concept page can get a bespoke interactive canvas widget by dropping a
`widgets/<slug>.js` file whose name matches the concept filename. The build
injects an **INTERACTIVE** panel automatically. See `widgets/README.md` for the
shared `VIZ` API and the widget skeleton. No widget file → no panel (the page
still builds).
