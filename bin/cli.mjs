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
import { lintWiki, KINDS } from "../lint.mjs";
import { serve, formatContentNotes, formatDesignNotes, setNoteStatus, openCounts } from "../serve.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SITES = join(REPO, "sites");
// Per-machine settings (the vault root). Git-ignored: every machine has its own.
const LOCAL = join(REPO, "local.json");

const BRANDING_KEYS = ["title", "brandLetters", "footer", "accent"];

const USAGE = `llm-wiki-site — render an llm-wiki into a static site

  llm-wiki-site build <wiki-path> [options]
  llm-wiki-site build --site <wiki-id>      resolve everything from sites/<id>/site.json
  llm-wiki-site build --all                 build every registered wiki
  llm-wiki-site lint <wiki-path> [--detail] [--pages <substring>] [--strict]
  llm-wiki-site lint --site <wiki-id>       same, resolved from sites/<id>/site.json
  llm-wiki-site lint --all                  lint every registered wiki
  llm-wiki-site serve [--port 4173] [--host 127.0.0.1] [--no-review]
                                            hub for every registered wiki at /, each at /<id>/
  llm-wiki-site serve --site <id>           same hub; builds that wiki first, prints its URL
  llm-wiki-site notes                       summary: open content notes per wiki, open design notes
  llm-wiki-site notes --site <id> [--all]   content notes for one wiki (all with --all)
  llm-wiki-site notes --design [--all]      the shared design queue, with site and page
  llm-wiki-site notes resolve <note-id> -m "what changed"
  llm-wiki-site notes reopen <note-id>      (finds the note in any queue; --site is optional)
  llm-wiki-site list                        show registered wikis
  llm-wiki-site register <wiki-id> <wiki-path> [--out DIR]
  llm-wiki-site vault [<path>]              show or set this machine's vault root

Options
  --site <id>       use sites/<id>/site.json for source, out, widgets and branding
  --out <dir>       output directory (default: <repo>/out/<wiki-id>)
  --widgets <dir>   concept widgets (default: sites/<id>/widgets, else <repo>/widgets)
  --media <dir>     explainer videos for @video[slug] lines (default: sites/<id>/media)
  --no-review       serve: do not inject the review overlay (it is on by default)
  --design          notes: the design queue instead of one wiki's content notes
  --port, --host    serve: listen address (default 127.0.0.1:4173)
  -m, --message     notes resolve: what changed
  --all             notes: include resolved notes
  --detail          lint: print every issue as L<line> <kind> (<n>): <text>
  --pages <text>    lint: only pages whose path contains <text>
  --strict          lint: exit 1 if any issue is found (default: report only, exit 0)
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
    if (a === "--detail" || a === "--strict" || a === "--review" || a === "--no-build" || a === "--no-review" || a === "--design") { opts[a.slice(2)] = true; continue; }
    if (a === "-m") {
      if (argv[i + 1] === undefined) fail("-m needs a value");
      opts.m = argv[++i];
      continue;
    }
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

// Resolves source, out, widgets and media for a build; shared by build and serve.
function resolveBuild(positional, opts) {
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

  return {
    wikiRoot,
    wikiDir,
    outDir,
    widgetsDir,
    mediaDir,
    wikiId: id,
    overrides: { ...pickBranding(record), ...pickBranding(opts) },
  };
}

function cmdBuild(positional, opts) {
  const b = resolveBuild(positional, opts);
  const result = build(b);
  console.log(`Built ${result.pages} pages`);
  console.log(`  from ${b.wikiDir}`);
  console.log(`  to   ${result.outDir}`);
  console.log(`Open: ${join(result.outDir, "index.html")}`);
}

// Which registered wiki is the current directory inside, if any.
function siteForCwd() {
  const cwd = process.cwd();
  for (const s of listSites()) {
    try {
      const { wikiRoot } = normalizeWikiPath(resolveSource(s.source, s.id));
      const r = relative(wikiRoot, cwd);
      if (r === "" || (!r.startsWith("..") && !isAbsolute(r))) return s.id;
    } catch { /* source not resolvable on this machine */ }
  }
  return null;
}

async function cmdServe(opts) {
  if (opts.site) readSite(opts.site); // fail early on an unknown id
  const port = opts.port === undefined ? 4173 : Number(opts.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`bad --port ${opts.port}`);
  const host = opts.host ?? "127.0.0.1";
  const here = opts.site ?? siteForCwd();
  await serve({
    repo: REPO,
    siteApi: {
      ids: () => listSites().map((s) => s.id),
      resolve: (id) => resolveBuild([], { site: id }),
      // Re-import the generator on every rebuild, so a change to build-site.mjs
      // shows up on the next REBUILD without restarting the server.
      runBuild: async (id) => (await import(new URL(`../build-site.mjs?t=${Date.now()}`, import.meta.url))).build(resolveBuild([], { site: id })),
    },
    review: !opts["no-review"],
    host,
    port,
    prebuild: opts.site,
    onListening: (base) => { if (here) console.log(`Open this wiki: ${base}${here}/`); },
  });
}

function cmdNotes(positional, opts) {
  const ids = listSites().map((s) => s.id);
  const [sub, noteId] = positional;
  if (sub === "resolve" || sub === "reopen") {
    if (!noteId) fail(`usage: llm-wiki-site notes ${sub} <note-id>${sub === "resolve" ? ' -m "what changed"' : ""}`);
    const n = setNoteStatus(REPO, opts.site ? [opts.site] : ids, noteId, sub === "resolve" ? "resolved" : "open", opts.m ?? opts.message);
    console.log(`${n.id} ${n.status} (${n.kind}${n.site ? `, ${n.site}` : ""})`);
  } else if (sub !== undefined) {
    fail(`unknown notes subcommand "${sub}"`);
  } else if (opts.design) {
    console.log(formatDesignNotes(REPO, !!opts.all));
  } else if (opts.site) {
    readSite(opts.site);
    console.log(formatContentNotes(REPO, opts.site, !!opts.all));
  } else {
    const c = openCounts(REPO, ids);
    const withNotes = ids.filter((id) => c.content[id]);
    console.log("Open content notes");
    if (withNotes.length) for (const id of withNotes) console.log(`  ${id.padEnd(34)} ${c.content[id]}`);
    else console.log("  none");
    console.log(`Open design notes: ${c.design}`);
    console.log("\nllm-wiki-site notes --site <id> [--all]   content notes for one wiki");
    console.log("llm-wiki-site notes --design [--all]      the shared design queue");
  }
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

// Prints the report for one wiki; returns its issue total.
function cmdLint(positional, opts) {
  let sourcePath = positional[0];
  if (opts.site) {
    const record = readSite(opts.site);
    sourcePath ??= resolveSource(record.source, opts.site);
  }
  if (!sourcePath) fail("need a <wiki-path> or --site <wiki-id>");
  const { wikiRoot, wikiDir } = normalizeWikiPath(sourcePath);
  const r = lintWiki({ wikiRoot, wikiDir, pages: opts.pages });

  const heads = ["proc>20", "desc>25", "para>6", "terms", "words", "passive"];
  console.log(`${"page".padEnd(34)}${"sent".padStart(5)}${"avg".padStart(6)}  ` + heads.map((h) => h.padStart(8)).join(""));
  for (const p of r.pages) {
    console.log(`${p.path.padEnd(34)}${String(p.nSent).padStart(5)}${p.avg.toFixed(1).padStart(6)}  ` +
      KINDS.map((k) => String(p.counts[k]).padStart(8)).join(""));
    if (opts.detail) for (const x of p.issues) console.log(`    L${x.line} ${x.kind}${x.n ? ` (${x.n})` : ""}: ${x.text}`);
  }
  console.log(`TOTAL ${r.sentences} sentences  ` + KINDS.map((k) => `${k} ${r.totals[k]}`).join(" · "));
  return KINDS.reduce((n, k) => n + r.totals[k], 0);
}

function cmdLintAll(opts) {
  const sites = listSites();
  if (!sites.length) fail("no registered wikis");
  let issues = 0;
  for (const s of sites) {
    console.log(`\n== ${s.id}`);
    try { issues += cmdLint([], { ...opts, all: false, site: s.id }); }
    catch (e) { console.error(`   failed: ${e.message}`); }
  }
  return issues;
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
  else if (cmd === "lint") {
    const issues = opts.all ? cmdLintAll(opts) : cmdLint(positional, opts);
    if (opts.strict && issues) process.exit(1);
  }
  else if (cmd === "serve") await cmdServe(opts);
  else if (cmd === "notes") cmdNotes(positional, opts);
  else if (cmd === "vault") cmdVault(positional);
  else if (cmd === "list") cmdList();
  else if (cmd === "register") cmdRegister(positional, opts);
  else { console.error(USAGE); fail(`unknown command "${cmd}"`); }
} catch (e) {
  fail(e.message);
}
