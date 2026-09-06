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
llm-wiki-site list
```

`<wiki-path>` may point at the wiki root (the folder containing `wiki/`) or at the
`wiki/` folder itself.

Branding resolves highest-precedence-first from CLI flags → `sites/<id>/site.json`
→ `<wiki-root>/site.config.json` → a `site:` block in `wiki/index.md` frontmatter.
Use the frontmatter form for synced vaults; it is the only one that is markdown.

## Layout

| Path | What |
| --- | --- |
| `bin/cli.mjs` | CLI: `build`, `register`, `list` |
| `build-site.mjs` | the generator — `build({ wikiRoot, outDir, … })` |
| `config.mjs` | branding resolution across the three sources |
| `widgets/_viz.js` | shared canvas library for concept visualizations |
| `sites/<id>/site.json` | where a wiki lives and where it builds to |
| `sites/<id>/widgets/*.js` | that wiki's concept widgets |
| `out/` | default build output (git-ignored) |

See `BUILD-SITE.md` for the full generator reference and `widgets/README.md` for
the widget API.

## History

`build-site.mjs` and `widgets/` were extracted from the `llm-wiki` template repo
with `git filter-repo`, so `git log` on them predates this repo.
