#!/usr/bin/env node
// llm-wiki-site — build an llm-wiki markdown vault into a static HTML site.
//
// The wiki lives wherever the human keeps it (typically an Obsidian vault, which
// only syncs *.md). This repo holds the generator, the widget library, and the
// registry of which wiki builds to where — so no build machinery has to sit in
// the vault, and no HTML output lands there either.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, basename, relative, isAbsolute, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "../build-site.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SITES = join(REPO, "sites");
// Per-machine settings (the vault root). Git-ignored: every machine has its own.
const LOCAL = join(REPO, "local.json");

const BRANDING_KEYS = ["title", "brandLetters", "footer", "accent"];

const USAGE = `llm-wiki-site — render an llm-wiki into a static site

  llm-wiki-site build <wiki-path> [options]
  llm-wiki-site build --site <wiki-id>      resolve everything from sites/<id>/site.json
  llm-wiki-site build --all                 build every registered wiki
  llm-wiki-site list                        show registered wikis
  llm-wiki-site register <wiki-id> <wiki-path> [--out DIR]
  llm-wiki-site vault [<path>]              show or set this machine's vault root

Options
  --site <id>       use sites/<id>/site.json for source, out, widgets and branding
  --out <dir>       output directory (default: <repo>/out/<wiki-id>)
  --widgets <dir>   concept widgets (default: sites/<id>/widgets, else <repo>/widgets)
  --media <dir>     explainer videos for @video[slug] lines (default: sites/<id>/media)
  --title, --brandLetters, --footer, --accent
                    branding overrides, highest precedence of all

<wiki-path> may point at the wiki root (the folder containing wiki/) or at the
wiki/ folder itself.

Registrations are portable across machines: site.json stores the wiki's path
relative to the vault root and the output under ~. Each machine sets its own
vault root once (\`llm-wiki-site vault <path>\`, saved to the git-ignored
local.json) or via the LLM_WIKI_VAULT environment variable.
`;

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") { opts.help = true; continue; }
    if (a === "--all") { opts.all = true; continue; }
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

function readLocal() {
  try { return JSON.parse(readFileSync(LOCAL, "utf8")); } catch { return {}; }
}

function vaultRoot() {
  const v = process.env.LLM_WIKI_VAULT || readLocal().vault;
  return v ? resolve(expandHome(v)) : null;
}

function expandHome(p) {
  return p === "~" || p.startsWith("~/") ? join(homedir(), p.slice(1)) : p;
}

// Inverse of expandHome/vault resolution: store paths so they travel.
function underRoot(root, abs) {
  if (!root) return null;
  const r = relative(root, abs);
  return r && !r.startsWith("..") && !isAbsolute(r) ? r.split(sep).join("/") : null;
}
function portableOut(abs) {
  const r = underRoot(homedir(), abs);
  return r ? "~/" + r : abs;
}

// A registered source is either absolute or relative to this machine's vault root.
function resolveSource(src, id) {
  const p = expandHome(src);
  if (isAbsolute(p)) return p;
  const root = vaultRoot();
  if (!root) throw new Error(`"${id}" is registered relative to the vault root, but none is set on this machine.\n  Run: llm-wiki-site vault <path-to-your-vault>   (or set LLM_WIKI_VAULT)`);
  return join(root, p);
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
  const root = vaultRoot();
  console.log(`vault root: ${root ?? "(not set; run llm-wiki-site vault <path>)"}\n`);
  for (const s of sites) {
    const src = isAbsolute(expandHome(s.source)) || root ? resolveSource(s.source, s.id) : s.source;
    const ok = existsSync(src) ? "" : "   [missing on this machine]";
    console.log(`${s.id.padEnd(20)} ${src}${ok}\n${" ".repeat(20)} -> ${s.out ? expandHome(s.out) : "(default)"}`);
  }
}

function cmdVault(positional) {
  const [p] = positional;
  if (!p) {
    console.log(vaultRoot() ?? "No vault root set. Run: llm-wiki-site vault <path>");
    return;
  }
  const abs = resolve(expandHome(p));
  if (!existsSync(abs)) fail(`${abs} does not exist`);
  writeFileSync(LOCAL, JSON.stringify({ ...readLocal(), vault: abs }, null, 2) + "\n");
  console.log(`Vault root for this machine: ${abs}`);
}

function cmdRegister(positional, opts) {
  const [id, path] = positional;
  if (!id || !path) fail("usage: llm-wiki-site register <wiki-id> <wiki-path>");
  const { wikiRoot } = normalizeWikiPath(path);
  if (!existsSync(wikiRoot)) fail(`${wikiRoot} does not exist`);
  const rec = {
    source: underRoot(vaultRoot(), wikiRoot) ?? wikiRoot,
    out: portableOut(resolve(expandHome(opts.out ?? join(homedir(), "sites", id)))),
    ...pickBranding(opts),
  };
  mkdirSync(join(SITES, id), { recursive: true });
  writeFileSync(siteFile(id), JSON.stringify(rec, null, 2) + "\n");
  console.log(`Registered ${id}:\n  source ${rec.source}\n  out    ${rec.out}`);
  if (isAbsolute(rec.source)) console.log("  (absolute source: set a vault root first to make this registration portable)");
}

function cmdBuild(positional, opts) {
  let id = opts.site;
  let record = {};
  let sourcePath = positional[0];

  if (id) {
    record = readSite(id);
    sourcePath ??= resolveSource(record.source, id);
  }
  if (!sourcePath) fail("need a <wiki-path> or --site <wiki-id>");

  const { wikiRoot, wikiDir } = normalizeWikiPath(sourcePath);
  id ??= basename(wikiRoot);

  const outDir = resolve(expandHome(opts.out ?? record.out ?? join(REPO, "out", id)));

  // Per-wiki widgets live here, not in the vault, so a synced vault stays pure
  // markdown. Fall back to the shared library alone.
  const widgetsDir = resolve(
    opts.widgets ?? record.widgets ?? (existsSync(join(SITES, id, "widgets"))
      ? join(SITES, id, "widgets")
      : join(REPO, "widgets")),
  );

  // Explainer videos (mp4 + jpg poster) mounted by "@video[slug]" lines.
  const mediaDir = resolve(opts.media ?? record.media ?? join(SITES, id, "media"));

  const result = build({
    wikiRoot,
    wikiDir,
    outDir,
    widgetsDir,
    mediaDir,
    wikiId: id,
    overrides: { ...pickBranding(record), ...pickBranding(opts) },
  });

  console.log(`Built ${result.pages} pages`);
  console.log(`  from ${wikiDir}`);
  console.log(`  to   ${result.outDir}`);
  console.log(`Open: ${join(result.outDir, "index.html")}`);
}

function cmdBuildAll(opts) {
  const sites = listSites();
  if (!sites.length) fail("no registered wikis");
  let failed = 0;
  for (const s of sites) {
    console.log(`\n== ${s.id}`);
    try { cmdBuild([], { ...opts, all: false, site: s.id }); }
    catch (e) { failed++; console.error(`   failed: ${e.message}`); }
  }
  console.log(`\n${sites.length - failed}/${sites.length} built`);
  if (failed) process.exit(1);
}

// --- entry ------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);
const { opts, positional } = parseArgs(rest);

if (!cmd || opts.help || cmd === "help") {
  console.log(USAGE);
  process.exit(cmd && cmd !== "help" ? 1 : 0);
}

try {
  if (cmd === "build" && opts.all) cmdBuildAll(opts);
  else if (cmd === "build") cmdBuild(positional, opts);
  else if (cmd === "vault") cmdVault(positional);
  else if (cmd === "list") cmdList();
  else if (cmd === "register") cmdRegister(positional, opts);
  else { console.error(USAGE); fail(`unknown command "${cmd}"`); }
} catch (e) {
  fail(e.message);
}
