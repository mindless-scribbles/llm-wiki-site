# Static HTML site for the wiki

`build-site.mjs` converts every markdown page under a wiki's `wiki/` folder into
a self-contained static HTML site styled with the **DDC Reel** design system
([artifact](https://claude.ai/artifact/QBTm2jQ8DC1f9bjhwiuDvw); skill at `~/.claude/skills/ddc-reel/`): dark and monochrome,
Syne headings, Space Mono labels, Hanken Grotesk reading text, one orange accent
per page (the hero kicker), and a numbered catalog sidebar. It is domain-agnostic:
the same script works for any llm-wiki. When DDC Reel changes, update the `CSS`
block in `build-site.mjs` (it mirrors `ddc-reel.css`) and rebuild every registered site.

The wiki being built lives elsewhere: usually inside an Obsidian vault, which
syncs only `*.md`. Nothing here is ever copied into the vault, and no HTML output
lands there.

## Build

```bash
llm-wiki-site build ~/Obsidian/Vault/trading-wiki --out ~/sites/trading-wiki
llm-wiki-site build --site trading-wiki          # after `register`
```

Requires Node 18+. No dependencies, no network needed to build (web fonts load
from Google Fonts at view time).

The output directory is wiped and rebuilt each run, so it is never hand-edited.
As a safety rail the build refuses to wipe a directory that is non-empty and does
not carry a `.llm-wiki-site.json` marker from a previous build.

## Branding

Resolved from three places, highest precedence first:

1. CLI flags — `--title`, `--brandLetters`, `--footer`, `--accent`
2. `sites/<id>/site.json` in this repo
3. the wiki itself:
   - `<wiki-root>/site.config.json`, or
   - a `site:` block in `wiki/index.md` frontmatter

Use the frontmatter form for any wiki that lives in a synced Obsidian vault — it
is markdown, so it is the only one that actually travels with the wiki:

```yaml
---
title: "Knowledge Base Index"
site:
  title: "Trading Field Logs"
  brandLetters: "TF"
  footer: "SYS.TRADING_WIKI / 2026"
  accent: "#33ccff"
---
```

The equivalent `site.config.json`:

```json
{
  "title": "Knowledge Base",
  "brandLetters": "KB",
  "footer": "SYS.WIKI / 2026",
  "accent": "#ff3300"
}
```

- `title` — site name (header brand, `<title>`, meta description)
- `brandLetters` — the short brand shown in the header on phone widths (the full `title` shows elsewhere)
- `footer` — the mono status line at the bottom of the sidebar
- `accent` — the single accent color (DDC Reel `#ff3300`); used once per page, on the hero kicker

## View

Open `<out>/index.html` directly in a browser (`file://` works — links are relative
and the stylesheet is shared at `<out>/assets/wiki.css`). Or serve the folder:

```bash
npx serve <out>       # or: python3 -m http.server -d <out>
```

## How it maps

- `wiki/index.md` → `<out>/index.html` (the landing catalog)
- `wiki/concepts/*.md` → `<out>/concepts/*.html`, and likewise for
  `entities/`, `syntheses/`, `summaries/`, `presentations/`
- **Any wiki layout works.** Pages are discovered recursively and grouped by
  their top-level folder: the canonical sections above keep their labels and
  order, any other folder becomes its own sidebar group (named after the
  folder), and loose `*.md` at the wiki root fall under a catch-all "Pages"
  group. Structured, custom-folder, and flat wikis all build with no config.
- `wiki/log.md` is included, as is every other `*.md` — including the
  Obsidian-plugin pages (`dashboard.md`, `analytics.md`, `flashcards.md`), which
  land in the catch-all "Pages" group
- `[[wikilinks]]` (with or without `|alias` and `#anchor`) resolve to relative
  HTML links
- Frontmatter drives the hero kicker (type + confidence) and the meta row (type,
  tags, updated, source count)
- Tables, code fences, blockquotes, and nested lists are all supported

Re-run the build whenever the wiki changes. The output folder is fully
regenerated each run, so it is safe to delete.

## Provenance

Every build writes `<out>/.llm-wiki-site.json` and a footer line naming the wiki
it came from:

```json
{
  "wikiId": "trading-wiki",
  "source": "/home/you/Obsidian/Vault/trading-wiki",
  "sourceGitRemote": "git@github.com:you/trading-wiki.git",
  "builtAt": "2026-09-06T19:11:31.523Z",
  "builder": { "repo": "llm-wiki-site", "commit": "73d7d52" },
  "pages": 42
}
```

A site folder therefore always names its source wiki, and the marker is what lets
a rebuild safely wipe the directory.

## Interactive concept visualizations (optional)

Any concept page can get a bespoke interactive canvas widget by dropping a
`sites/<wiki-id>/widgets/<slug>.js` file whose name matches the concept filename.
The build injects an **INTERACTIVE** panel automatically, pairing it with the
shared `widgets/_viz.js` library from this repo. See `widgets/README.md` for the
shared `VIZ` API and the widget skeleton. No widget file → no panel (the page
still builds).

## Mermaid diagrams (optional)

A ```` ```mermaid ```` fence renders as an inline SVG diagram when `mmdc`
([@mermaid-js/mermaid-cli](https://github.com/mermaid-js/mermaid-cli)) is on
`PATH` (or `LLM_WIKI_MMDC` points at the binary). Without it, or if a render
fails, the fence stays a plain code block and the build prints one warning line
with the count; diagrams never fail a build.

- All new diagrams in a build are rendered in one `mmdc` run (Chromium starts once).
- SVGs are cached in `~/.cache/llm-wiki-site/mermaid/<sha256>.svg`, keyed by the
  fence source plus the theme config, so a theme change re-renders everything.
- The theme is DDC Reel (dark, monochrome, no orange). Opt in to the accent per
  diagram with `classDef accent stroke:#ff3300`.
- Snap caveat: a snap-packaged `mmdc` cannot see `/tmp`, so staging files live under
  `~/.cache/llm-wiki-site/`, never `os.tmpdir()`.
