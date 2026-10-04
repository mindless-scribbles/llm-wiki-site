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

## Notes and review

`serve` runs one local hub for every registered wiki, with a notes overlay on every
page. Start it once per session and leave it running.

```bash
llm-wiki-site serve                      # hub at http://127.0.0.1:4173/
llm-wiki-site serve --site moted-modules # same hub; builds that wiki, prints its URL
llm-wiki-site notes                      # open content notes per wiki, open design notes
llm-wiki-site notes --site moted-modules [--all]   # content notes for one wiki
llm-wiki-site notes --design [--all]               # the shared design queue
llm-wiki-site notes resolve <note-id> -m "what changed"   # finds the note in any queue
llm-wiki-site notes reopen <note-id>
```

- `/` lists every wiki (from `sites/*/site.json`) with its open content notes and last
  build time, and the open design-note count. `/<id>/` serves that wiki's out dir. A
  wiki that is not built yet is built on its first request. All builds run one at a
  time. Nothing is built at startup. From inside a registered wiki's folder, `serve`
  also prints that wiki's URL.
- `--port` (default 4173) and `--host` (default 127.0.0.1, which a Windows browser
  reaches on WSL2 as `localhost`) override the address. If the port is busy, `serve`
  says so and exits with an error. `--no-review` turns the overlay off. Range
  requests work, so video seeking works.
- The overlay is injected into each html response at request time. `build` never
  writes it, so `~/sites/<id>` stays clean: that folder is the copy to share. The
  vault is not watched. Use the overlay's REBUILD button (that wiki only) to pick up
  edits. REBUILD re-imports `build-site.mjs`, so builder changes apply too.
- In the page: `REVIEW` (or key `n`) turns annotate mode on. Click a block, pick
  `CONTENT` or `DESIGN`, type a note, paste or drop an image, then `SAVE`
  (Ctrl/Cmd+Enter). `PAGE NOTE` adds a note with no element. `NOTES` opens the side
  panel, where you can resolve or reopen. Numbered markers sit on annotated blocks;
  design notes carry a `DESIGN` tag. `Esc` cancels.
- Two kinds of note, kept apart:
  - **Content** (default): what one page says. Fixed in that wiki's markdown. Stored in
    `sites/<id>/review/notes/<note-id>.json`, images in `sites/<id>/review/img/`.
  - **Design**: how every page of a kind is laid out. Fixed in the builder, so it
    affects every wiki. One shared queue in `design-notes/notes/<note-id>.json`,
    images in `design-notes/img/`. Each records `site` and `page`.
  Notes without a `kind` read as content. Both live in this repo, never in an out dir
  or the vault. Commit them like any other file.
- Each note records the kind, site, page, the source markdown path (`wiki/<page>.md`),
  the source line when the page carries `data-line`, the nearest heading, and an
  excerpt.
- Endpoints, review on only: `GET/POST /__review/<id>/notes`,
  `POST /__review/<id>/notes/<note-id>`, `POST /__review/<id>/rebuild`,
  `GET /__review/<id>/img/<file>`, and the overlay assets at `/__review/overlay.js|css`.

## Page layout

Every page uses three columns:

- **Left: the master index.** One collapsible group per section, with a page
  count. The current page's group opens by itself; the groups a reader opens are
  remembered per wiki. The header search box (or `/`) filters the index by page
  title. The header button collapses the index on wide screens.
- **Center: the page.** A breadcrumb (`WIKI / SECTION / [NNN]`), the accent
  kicker, the title, and a **Copy page ▾** split button: copy the page's
  markdown (to paste into Claude), view it, copy the link, or open the note in
  Obsidian (shown when the wiki sits inside a vault, the nearest folder holding
  `.obsidian/`). Then the meta row, the content, and previous / next links in
  index order.
- **Right: On this page.** The page's `##` and `###` headings, marking the one
  being read. Shown on ordinary pages with two or more sections; lessons use
  their phase rail and the landing page is its own map.

Below 1280px the right column becomes an **On this page** dropdown above the
content. Below 1024px the index becomes a drawer opened from the header button.
A body that opens with the page title as its `# H1` drops it (the head already
shows it); anything the H1 adds after the title becomes the subtitle.

## Landing page

`index.md` stays the master catalog in Obsidian. On the site, `index.html` opens as a
landing page instead of a list of links:

- a hero: the site title, the first paragraph as the lede, and a `START HERE ›` button;
- a **Start here** path, made from the links in a `**Start here:**` paragraph, in order;
- a grid of cards for every catalog table of 12 rows or fewer where each row links a
  page. A card shows the linked page's first visual (a video poster, an `@image`, or
  its first Mermaid diagram), else the number from a short cell such as `Day`;
- bigger tables stay tables, further down.

## Lessons (`type: lesson`)

A page with `type: lesson` renders as a workshop lesson instead of an article. The
markdown stays plain, so Obsidian shows it unchanged; the builder reads these markers:

| Markdown | On the site |
|---|---|
| `## Phase N — Title (75 min)` | a phase; the minutes size its bar on the phase rail |
| `**Why:**` at the top of a phase | the phase's lead: what it teaches and what breaks without it |
| `**Ask:**` then `**Decision:**` | a question card; the decision hides behind a reveal |
| `**Predict:**` | a prediction box (kept per reader in localStorage) |
| `**Read:**` | the read-off; hidden behind "check your prediction" when the phase had a Predict |
| a line starting `⚠️` | a trap callout |
| `> quote` | the line to remember |
| a Mermaid fence, `@video`, `@image`, `@viz` | the phase's visual, beside the steps (click to enlarge) |
| `**Goal:**`, `**Result:**`, `**Open beside this page:**` or `**Open in <app>:**` (one line split by ` · `, or a lead line and a list) before the first phase | the brief |
| `## Related` / `## Sources` | the tail, rendered as normal |

A short paragraph ending in `:` just before a visual becomes its title, and one sentence
just after it becomes its caption. Readers see one phase at a time (arrow keys or the
rail) or all phases, and can mark phases done. In review mode, a phase with no visual
shows an empty "NO VISUAL YET" slot.

## Stills (`@image`)

`@image[slug] optional caption` on a line of its own mounts `sites/<id>/media/<slug>.png`
(or `.webp`, `.jpg`, `.gif`), like `@video`. A screenshot from a review note is promoted
by copying it into the media folder under a slug, never into the vault. An `@image` whose
file does not exist yet renders as a "screenshot needed" slot in review mode only, so a page
can ask for a capture where the reviewer will paste it.

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
| `bin/cli.mjs` | CLI: `build` (`--site`, `--all`), `serve`, `notes`, `lint`, `register`, `list`, `vault` |
| `serve.mjs` | hub server, review notes storage and the `notes` summaries |
| `review/overlay.{js,css}` | the review overlay, injected only by `serve` |
| `sites/<id>/review/` | review notes (`notes/*.json`) and pasted images (`img/`) |
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
