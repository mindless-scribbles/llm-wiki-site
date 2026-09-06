#!/usr/bin/env node
// llm-wiki-site — build an llm-wiki markdown vault into a static HTML site.
//
// The wiki lives wherever the human keeps it (typically an Obsidian vault, which
// only syncs *.md). This repo holds the generator, the widget library, and the
// registry of which wiki builds to where — so no build machinery has to sit in
// the vault, and no HTML output lands there either.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../build-site.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SITES = join(REPO, "sites");

const BRANDING_KEYS = ["title", "brandLetters", "footer", "accent"];

const USAGE = `llm-wiki-site — render an llm-wiki into a static site

  llm-wiki-site build <wiki-path> [options]
  llm-wiki-site build --site <wiki-id>      resolve everything from sites/<id>/site.json
  llm-wiki-site list                        show registered wikis
  llm-wiki-site register <wiki-id> <wiki-path> [--out DIR]

Options
  --site <id>       use sites/<id>/site.json for source, out, widgets and branding
  --out <dir>       output directory (default: <repo>/out/<wiki-id>)
  --widgets <dir>   concept widgets (default: sites/<id>/widgets, else <repo>/widgets)
  --title, --brandLetters, --footer, --accent
                    branding overrides, highest precedence of all

<wiki-path> may point at the wiki root (the folder containing wiki/) or at the
wiki/ folder itself.
`;

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") { opts.help = true; continue; }
    if (a.startsWith("--")) {
      const [k, inlineV] = a.slice(2).split(/=(.*)/s);
      const v = inlineV ?? argv[++i];
      if (v === undefined) fail(`--${k} needs a value`);
      opts[k] = v;
      continue;
    }
    positional.push(a);
  }
  return { opts, positional };
}

function fail(msg) {
  console.error(`llm-wiki-site: ${msg}`);
  process.exit(1);
}

function siteFile(id) {
  return join(SITES, id, "site.json");
}

function readSite(id) {
  const f = siteFile(id);
  if (!existsSync(f)) fail(`no registered site "${id}" (looked for ${f})`);
  return JSON.parse(readFileSync(f, "utf8"));
}

function listSites() {
  if (!existsSync(SITES)) return [];
  return readdirSync(SITES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(siteFile(e.name)))
    .map((e) => ({ id: e.name, ...readSite(e.name) }));
}

// A wiki path may name the root or the markdown folder itself. Normalize to both.
function normalizeWikiPath(p) {
  const abs = resolve(p);
  if (existsSync(join(abs, "wiki"))) return { wikiRoot: abs, wikiDir: join(abs, "wiki") };
  if (basename(abs) === "wiki") return { wikiRoot: dirname(abs), wikiDir: abs };
  // A bare folder of markdown: treat it as both.
  return { wikiRoot: abs, wikiDir: abs };
}

function pickBranding(src) {
  const out = {};
  for (const k of BRANDING_KEYS) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

// --- commands ---------------------------------------------------------------

function cmdList() {
  const sites = listSites();
  if (!sites.length) {
    console.log("No registered wikis. Add one with:\n  llm-wiki-site register <id> <wiki-path>");
    return;
  }
  for (const s of sites) console.log(`${s.id.padEnd(20)} ${s.source}\n${" ".repeat(20)} -> ${s.out}`);
}

function cmdRegister(positional, opts) {
  const [id, path] = positional;
  if (!id || !path) fail("usage: llm-wiki-site register <wiki-id> <wiki-path>");
  const { wikiRoot } = normalizeWikiPath(path);
  if (!existsSync(wikiRoot)) fail(`${wikiRoot} does not exist`);
  const rec = {
    source: wikiRoot,
    out: resolve(opts.out ?? join(REPO, "out", id)),
    ...pickBranding(opts),
  };
  mkdirSync(join(SITES, id), { recursive: true });
  writeFileSync(siteFile(id), JSON.stringify(rec, null, 2) + "\n");
  console.log(`Registered ${id}:\n  source ${rec.source}\n  out    ${rec.out}`);
}

function cmdBuild(positional, opts) {
  let id = opts.site;
  let record = {};
  let sourcePath = positional[0];

  if (id) {
    record = readSite(id);
    sourcePath ??= record.source;
  }
  if (!sourcePath) fail("need a <wiki-path> or --site <wiki-id>");

  const { wikiRoot, wikiDir } = normalizeWikiPath(sourcePath);
  id ??= basename(wikiRoot);

  const outDir = resolve(opts.out ?? record.out ?? join(REPO, "out", id));

  // Per-wiki widgets live here, not in the vault, so a synced vault stays pure
  // markdown. Fall back to the shared library alone.
  const widgetsDir = resolve(
    opts.widgets ?? record.widgets ?? (existsSync(join(SITES, id, "widgets"))
      ? join(SITES, id, "widgets")
      : join(REPO, "widgets")),
  );

  const result = build({
    wikiRoot,
    wikiDir,
    outDir,
    widgetsDir,
    wikiId: id,
    overrides: { ...pickBranding(record), ...pickBranding(opts) },
  });

  console.log(`Built ${result.pages} pages`);
  console.log(`  from ${wikiDir}`);
  console.log(`  to   ${result.outDir}`);
  console.log(`Open: ${join(result.outDir, "index.html")}`);
}

// --- entry ------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);
const { opts, positional } = parseArgs(rest);

if (!cmd || opts.help || cmd === "help") {
  console.log(USAGE);
  process.exit(cmd && cmd !== "help" ? 1 : 0);
}

try {
  if (cmd === "build") cmdBuild(positional, opts);
  else if (cmd === "list") cmdList();
  else if (cmd === "register") cmdRegister(positional, opts);
  else { console.error(USAGE); fail(`unknown command "${cmd}"`); }
} catch (e) {
  fail(e.message);
}
