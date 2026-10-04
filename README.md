# llm-wiki-site

Static site generator for [llm-wiki](https://github.com/mindless-scribbles/llm-wiki)
knowledge bases. Zero dependencies, Node 18+.

## Why this is a separate repo

An llm-wiki normally lives inside an Obsidian vault, and Obsidian Sync carries
only `*.md`. Build machinery (`*.mjs`, `*.js`, `*.json`) would never travel with
the vault, and thousands of generated HTML files have no business sitting in one.

So the vault holds nothing but markdown. This repo holds the generator, the shared
widget library, per-wiki widgets, and a registry of which wiki builds to where.
Neither side hardcodes the other:

- the wiki declares its own branding, in markdown (`site:` frontmatter in `index.md`)
- the built site records where it came from (`.llm-wiki-site.json` + a footer line)

## Install

```bash
git clone https://github.com/mindless-scribbles/llm-wiki-site.git
cd llm-wiki-site && npm link      # or just call: node bin/cli.mjs …
```

## Use

```bash
# one-off
llm-wiki-site build ~/Obsidian/Vault/trading-wiki --out ~/sites/trading-wiki

# or register it once, then just build
llm-wiki-site register trading-wiki ~/Obsidian/Vault/trading-wiki --out ~/sites/trading-wiki
llm-wiki-site build --site trading-wiki
llm-wiki-site build --all          # every registered wiki
llm-wiki-site list
```

### Several machines

Registrations are committed, so they travel with this repo. To keep them portable,
`site.json` stores the wiki's path **relative to a vault root** and the output under
`~`. Each machine names its vault root once (saved to the git-ignored `local.json`,
or set `LLM_WIKI_VAULT`):

```bash
llm-wiki-site vault ~/Obsidian/Vault   # once per machine
llm-wiki-site build --all              # sites land in ~/sites/<id>
```

Branding travels too, as long as it lives in the `site:` block of each wiki's
`wiki/index.md` (Obsidian Sync carries `*.md` but not `site.config.json`).

`<wiki-path>` may point at the wiki root (the folder containing `wiki/`) or at the
`wiki/` folder itself.

Branding resolves highest-precedence-first from CLI flags → `sites/<id>/site.json`
→ `<wiki-root>/site.config.json` → a `site:` block in `wiki/index.md` frontmatter.
Use the frontmatter form for synced vaults; it is the only one that is markdown.

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

## Lint (STE-80)

`llm-wiki-site lint <wiki-path>` (or `--site <id>`, or `--all`) checks the
measurable half of ASD-STE100 Part 1 and prints a per-page table plus a TOTAL line.
It is report-only and never writes: it exits 0 unless you pass `--strict`, which
exits 1 if any issue is found. `--detail` adds one line per issue
(`L<line> <kind> (<n>): <text>`); `--pages <substring>` limits it to matching pages.

- Procedural sentences (a numbered item, or an indented sub-bullet, under a heading
  matching step / phase / procedure / how to / build it / try it) have at most 20 words;
  descriptive sentences at most 25; paragraphs at most 6 sentences.
- Passive voice inside procedural steps.
- `word`: a built-in list of unapproved words (`in order to`, `utilize`, `ensure`, ...).
- `term`: the wiki's own banned terms, read from its `CLAUDE.md` (below).
- A `code span` counts as one word and is never searched for banned terms. Tables,
  block quotes, headings, fences, `@` markers and `(§x.y)` citations are skipped, as are
  the index, log, dashboard, analytics and flashcards pages.

Per-wiki terminology: under a `## Writing Rule` heading in `<wiki-root>/CLAUDE.md`,
add a table with a `Use` and a `Not` column (any other columns are ignored). Each
`Not` cell holds one or more terms separated by `,` or ` / `, optionally in backticks;
each is flagged with the `Use` cell as the suggestion. Matching ignores case and
respects word boundaries. Rows whose cells start with `[` (template placeholders) are skipped.

```markdown
## Writing Rule

| Use | Not | Note |
| --- | --- | --- |
| pole | PV, pole vector | one name for the control |
| one deterministic formula | compensates / best-fits | the solver does not adapt |
| `Bones` | skeleton chain | matches the node name |
```

## Layout

| Path | What |
| --- | --- |
| `bin/cli.mjs` | CLI: `build` (`--site`, `--all`), `register`, `list`, `vault` |
| `build-site.mjs` | the generator — `build({ wikiRoot, outDir, … })` |
| `config.mjs` | branding resolution across the three sources |
| `mermaid.mjs` | optional `mmdc` batch rendering and cache for mermaid fences |
| `widgets/_viz.js` | shared canvas library for concept visualizations |
| `sites/<id>/site.json` | where a wiki lives and where it builds to |
| `sites/<id>/widgets/*.js` | that wiki's concept widgets |
| `out/` | default build output (git-ignored) |

See `BUILD-SITE.md` for the full generator reference and `widgets/README.md` for
the widget API.

## History

`build-site.mjs` and `widgets/` were extracted from the `llm-wiki` template repo
with `git filter-repo`, so `git log` on them predates this repo.
