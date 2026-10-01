// build-site.mjs — Convert an llm-wiki (markdown under <wiki>/wiki/) into a
// self-contained static HTML site styled with the DDC Reel design system
// (dark, mono, accent-driven, serif headlines). Domain-agnostic: branding comes
// from config.mjs, which reads it out of the wiki itself.
//
// The wiki being built lives somewhere else entirely — typically inside an
// Obsidian vault that only ever holds markdown. Nothing here resolves paths
// relative to this script; every path arrives through build().
//
// Usage:  see bin/cli.mjs  (llm-wiki-site build <wiki-path> --out <dir>)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveConfig } from "./config.mjs";

const MARKER = ".llm-wiki-site.json";

// An --out directory is user-supplied and gets wiped, so only ever wipe one we
// know is ours: empty, or carrying the provenance marker from a previous build.
function assertSafeOut(outDir) {
  if (!existsSync(outDir)) return;
  if (!statSync(outDir).isDirectory()) throw new Error(`--out ${outDir} exists and is not a directory`);
  const entries = readdirSync(outDir);
  if (entries.length === 0 || entries.includes(MARKER)) return;
  throw new Error(
    `refusing to wipe ${outDir}: not empty and has no ${MARKER}.\n` +
    `If this really is a previous site build, delete it by hand first.`,
  );
}

function gitOut(dir, args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch { return null; }
}

function gitRemote(dir) {
  return gitOut(dir, ["remote", "get-url", "origin"]);
}

const BUILDER_DIR = dirname(fileURLToPath(import.meta.url));

function builderCommit() {
  return gitOut(BUILDER_DIR, ["rev-parse", "--short", "HEAD"]);
}

/**
 * Render a wiki to a static site.
 *
 * @param {object}  o
 * @param {string}  o.wikiRoot    Folder containing wiki/ (and maybe site.config.json).
 * @param {string} [o.wikiDir]    The markdown root. Defaults to <wikiRoot>/wiki.
 * @param {string}  o.outDir      Where the HTML goes. Wiped and rebuilt.
 * @param {string} [o.widgetsDir] Folder of per-wiki <slug>.js concept widgets.
 * @param {string} [o.vizLib]     The shared _viz.js library. Defaults to the copy
 *                                shipped alongside this generator.
 * @param {string} [o.wikiId]     Name recorded in the provenance marker.
 * @param {object} [o.overrides]  Branding overrides (CLI flags / site.json).
 */
export function build(o) {
  const WIKI_ROOT = resolve(o.wikiRoot);
  const WIKI = resolve(o.wikiDir ?? join(WIKI_ROOT, "wiki"));
  const OUT = resolve(o.outDir);
  const WIDGETS = o.widgetsDir ? resolve(o.widgetsDir) : null;
  // Per-wiki widgets and the shared library are separate: a wiki registers its own
  // widgets/ folder, but _viz.js always comes from this repo.
  const VIZ_LIB = resolve(o.vizLib ?? join(BUILDER_DIR, "widgets", "_viz.js"));
  const WIKI_ID = o.wikiId ?? basename(WIKI_ROOT);

  if (!existsSync(WIKI)) throw new Error(`no markdown found at ${WIKI}`);
  assertSafeOut(OUT);

  const CONFIG = resolveConfig(WIKI_ROOT, WIKI, o.overrides ?? {});

  // Where this site came from. Written to the output as a marker file and shown
  // in the page footer, so a site folder is never orphaned from its wiki.
  const PROVENANCE = {
    wikiId: WIKI_ID,
    source: WIKI_ROOT,
    sourceGitRemote: gitRemote(WIKI_ROOT),
    builtAt: new Date().toISOString(),
    builder: { repo: "llm-wiki-site", commit: builderCommit() },
  };

  // Interactive widgets: <widgets>/<slug>.js (excluding the shared _viz.js library).
  const widgetSlugs = new Set(
    WIDGETS && existsSync(WIDGETS)
      ? readdirSync(WIDGETS)
          .filter((f) => f.endsWith(".js") && f !== "_viz.js")
          .map((f) => f.replace(/\.js$/, ""))
      : []
  );

  // Explainer videos: <media>/<slug>.mp4 (+ optional <slug>.jpg poster), mounted
  // in a page body by a line of its own reading "@video[slug] optional caption".
  // Per-wiki like widgets: the vault holds only markdown, the mp4s live beside
  // the site record.
  const MEDIA = o.mediaDir ? resolve(o.mediaDir) : null;
  const mediaSlugs = new Set(
    MEDIA && existsSync(MEDIA)
      ? readdirSync(MEDIA)
          .filter((f) => f.endsWith(".mp4"))
          .map((f) => f.replace(/\.mp4$/, ""))
      : []
  );
  const mediaPosters = new Set(
    MEDIA && existsSync(MEDIA)
      ? readdirSync(MEDIA)
          .filter((f) => f.endsWith(".jpg"))
          .map((f) => f.replace(/\.jpg$/, ""))
      : []
  );

  // NOTE: the body below is deliberately left at its original (unindented) level
  // rather than re-indented into this function. It keeps `git blame` intact and,
  // more importantly, keeps the CSS/HTML template literals byte-identical to what
  // the pre-split generator emitted.

// ---------------------------------------------------------------------------
// 1. Discover source pages
// ---------------------------------------------------------------------------

// Sections in sidebar order. `dir` is relative to wiki/. index.md + log.md are
// handled separately (they live at the wiki root).
const SECTIONS = [
  { dir: "summaries", label: "Summaries" },
  { dir: "concepts", label: "Concepts" },
  { dir: "entities", label: "Entities" },
  { dir: "syntheses", label: "Syntheses" },
  { dir: "presentations", label: "Presentations" },
];

// Parse YAML-ish frontmatter (only the flat keys we use).
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: raw };
  const body = raw.slice(m[0].length);
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    data[key] = val;
  }
  return { data, body };
}

// Build the page registry: wikilink target ("concepts/basis-vectors") -> page.
const pages = [];
const byTarget = new Map();

function register(srcRel, sectionLabel) {
  const raw = readFileSync(join(WIKI, srcRel), "utf8");
  const { data, body } = parseFrontmatter(raw);
  const target = srcRel.replace(/\.md$/, ""); // e.g. concepts/basis-vectors ; index ; log
  const outRel = target + ".html";
  const title = data.title || humanize(basename(target));
  const page = { srcRel, target, outRel, title, data, body, section: sectionLabel };
  pages.push(page);
  byTarget.set(target, page);
  return page;
}

function humanize(slug) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Register home first (order matters for the registry, not for nav).
const home = register("index.md", "Home");

// Discover every *.md under wiki/ (recursively) and group it:
//   - files in a canonical section folder keep that section's label + order
//   - files in any other folder form a group named after the folder
//   - loose files at the wiki root go to a catch-all "Pages" group
// This makes the generator work for structured, custom-folder, and flat wikis
// alike, with no per-project configuration.
const CANON = new Map(SECTIONS.map((s) => [s.dir, s.label]));
function walkMd(absDir) {
  const out = [];
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, e.name);
    if (e.isDirectory()) out.push(...walkMd(abs));
    else if (e.name.endsWith(".md")) out.push(relative(WIKI, abs).split("\\").join("/"));
  }
  return out;
}
const extraDirs = new Set();
for (const rel of walkMd(WIKI).sort()) {
  if (rel === "index.md" || rel === "log.md") continue;
  const slash = rel.indexOf("/");
  const seg = slash === -1 ? null : rel.slice(0, slash);
  let label;
  if (!seg) label = "Pages";
  else if (CANON.has(seg)) label = CANON.get(seg);
  else { label = humanize(seg); extraDirs.add(seg); }
  register(rel, label);
}
const log = existsSync(join(WIKI, "log.md")) ? register("log.md", "Meta") : null;

// Sidebar groups: canonical sections in order, then any custom folders
// (alphabetical), then the flat "Pages" catch-all. Empty groups are skipped.
const DEFAULT_SIDEBAR_SECTIONS = [
  ...SECTIONS,
  ...[...extraDirs].sort().map((d) => ({ dir: d, label: humanize(d) })),
  { dir: null, label: "Pages" },
];
// A wiki may fix its own order with `"sections": ["workshop", "theory", ...]` in
// site.config.json (or the index.md `site:` block): named folders first, in that
// order, then everything else in the default order.
const ORDERED = Array.isArray(CONFIG.sections) ? CONFIG.sections.map(String) : [];
const SIDEBAR_SECTIONS = [
  ...ORDERED.map((d) => DEFAULT_SIDEBAR_SECTIONS.find((s) => s.dir === d)).filter(Boolean),
  ...DEFAULT_SIDEBAR_SECTIONS.filter((s) => !ORDERED.includes(s.dir)),
];

// ---------------------------------------------------------------------------
// 2. Markdown -> HTML  (small, purpose-built converter)
// ---------------------------------------------------------------------------

function relHref(fromOutRel, toOutRel) {
  let rel = relative(dirname(fromOutRel), toOutRel).split("\\").join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Inline formatting. `page` is the current page (for relative wikilink hrefs).
function inline(text, page) {
  // 1. Protect inline code spans.
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\uE000CODE${codes.length - 1}\uE000`;
  });

  // 2. Escape everything else.
  text = escapeHtml(text);

  // 2.5 Timecode tokens: @[MM:SS] or @[HH:MM:SS] -> a clickable accent "pill"
  // that links to the matching heading anchor on the page's transcript AND (on
  // the site) pops up that transcript chunk inline. Only active on pages that
  // declare a `transcript:` frontmatter target; `page._tc` carries the resolved
  // href + timecode->chunk index, and `page._tcUsed` records which chunks to embed.
  if (page && page._tc) {
    text = text.replace(/@\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, (_, tc) => {
      const has = page._tc.index.has(tc);
      const key = has ? noteTimecodeUse(page, page._tcDefault, tc) : null;
      const anchor = "#" + timecodeAnchor(tc);
      const href = page._tc.href + anchor;
      const cls = has ? "tc" : "tc tc-missing";
      const data = has ? ` data-tc="${tc}" data-tck="${key}"` : "";
      return `<a class="${cls}" href="${escapeHtml(href)}"${data}>${tc}</a>`;
    });
  }

  // 3. Wikilinks: [[target|alias]] or [[target]]
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, tgtRaw, alias) => {
    let tgt = tgtRaw.trim();
    let anchor = "";
    const hash = tgt.indexOf("#");
    if (hash !== -1) {
      anchor = tgt.slice(hash);
      tgt = tgt.slice(0, hash);
    }

    // Timecode wikilink -> transcript popover pill. Authored as
    // [[wiki/<transcript>#MM:SS|MM:SS]] so it also resolves as a heading link in
    // Obsidian; on the site it renders as a pill that pops up the transcript chunk.
    const tcm = /^#(\d{1,2}:\d{2}(?::\d{2})?)$/.exec(anchor);
    if (tcm && page && page._tcSrc) {
      // The link's own target decides which transcript is indexed, so one page
      // can carry timecodes from several videos. Falls back to the page's
      // `transcript:` frontmatter when the target names no known transcript.
      const named = tgt.startsWith("wiki/") ? tgt.slice(5) : tgt;
      let srcTarget = tcSource(page, named) ? named : page._tcDefault;
      const src = srcTarget ? tcSource(page, srcTarget) : null;
      if (src) {
        const tc = tcm[1];
        const has = src.index.has(tc);
        const key = has ? noteTimecodeUse(page, srcTarget, tc) : null;
        const href = src.href + "#" + timecodeAnchor(tc);
        const cls = has ? "tc" : "tc tc-missing";
        const data = has ? ` data-tc="${tc}" data-tck="${key}"` : "";
        const label = (alias || tc).trim();
        return `<a class="${cls}" href="${escapeHtml(href)}"${data}>${escapeHtml(label)}</a>`;
      }
    }

    // Obsidian disambiguates same-basename files by path; tutorials prefix
    // transcript targets with "wiki/". Strip it so the wiki-root registry resolves.
    if (tgt.startsWith("wiki/")) tgt = tgt.slice(5);
    const dest = byTarget.get(tgt);
    const label = (alias || (dest ? dest.title : humanize(basename(tgt)))).trim();
    if (!dest) return `<span class="wl-missing">${label}</span>`;
    const href = relHref(page.outRel, dest.outRel) + anchor;
    return `<a class="wl" href="${href}">${label}</a>`;
  });

  // 4. Standard markdown links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) => {
    const ext = /^https?:/.test(url);
    const attrs = ext ? ' target="_blank" rel="noopener"' : "";
    return `<a class="lnk" href="${url}"${attrs}>${t}</a>`;
  });

  // 5. Bare URLs
  text = text.replace(/(^|[\s(])((https?:\/\/)[^\s)]+)(?=[\s).,]|$)/g,
    (_, pre, url) => `${pre}<a class="lnk" href="${url}" target="_blank" rel="noopener">${url}</a>`);

  // 6. Bold then italic.
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  // 7. Restore code spans (escaped).
  text = text.replace(/\uE000CODE(\d+)\uE000/g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  return text;
}

function mdToHtml(body, page) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Blank
    if (/^\s*$/.test(line)) { i++; continue; }

    // Code fence
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre class="code"><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      out.push('<hr class="rule">');
      i++;
      continue;
    }

    // Inline widget marker: a line of its own shaped "@viz[slug]" mounts an
    // interactive visualization right here in the body (not just at the top of
    // concept pages). Records the slug on page._vizUsed so renderPage() knows to
    // load _viz.js + the widget script. Unknown slugs render a small notice.
    const vm = line.match(/^\s*@viz\[([a-z0-9][a-z0-9-]*)\]\s*$/);
    if (vm && page) {
      const slug = vm[1];
      if (widgetSlugs.has(slug)) {
        (page._vizUsed || (page._vizUsed = new Set())).add(slug);
        out.push(`<div class="viz-block" data-viz="${slug}"></div>`);
      } else {
        out.push(`<div class="viz-error">Widget "${escapeHtml(slug)}" not found.</div>`);
      }
      i++;
      continue;
    }

    // Inline video marker: "@video[slug] optional caption" on a line of its own
    // mounts an explainer video from the per-wiki media folder. Unknown slugs
    // render a small notice instead of failing the build.
    const vd = line.match(/^\s*@video\[([a-z0-9][a-z0-9-]*)\](?:\s+(.*))?$/);
    if (vd && page) {
      const slug = vd[1];
      const cap = (vd[2] || "").trim();
      if (mediaSlugs.has(slug)) {
        const src = relHref(page.outRel, "assets/media/" + slug + ".mp4");
        const poster = mediaPosters.has(slug)
          ? ` poster="${relHref(page.outRel, "assets/media/" + slug + ".jpg")}"`
          : "";
        out.push(
          `<figure class="video-block"><div class="viz"><div class="viz-label">Explainer</div>` +
            `<video class="video" controls preload="metadata" playsinline src="${src}"${poster}></video></div>` +
            (cap ? `<figcaption class="video-caption">${inline(cap, page)}</figcaption>` : "") +
            `</figure>`
        );
      } else {
        out.push(`<div class="viz-error">Video "${escapeHtml(slug)}" not found.</div>`);
      }
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.push(`<h${lvl} id="${id}" class="h${lvl}">${inline(h[2], page)}</h${lvl}>`);
      i++;
      continue;
    }

    // Table (header row + separator + body)
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      // Split a row on *unescaped* pipes. GFM lets `\|` stand for a literal pipe
      // inside a cell, which is what makes aliased wikilinks ([[target|alias]])
      // and timecode pills authorable in tables — a naive split("|") would tear
      // them in half. Escaped pipes are unescaped as they are consumed.
      const cells = (r) => {
        const s = r.trim().replace(/^\|/, "").replace(/(?<!\\)\|\s*$/, "");
        const parts = [];
        let cur = "";
        for (let k = 0; k < s.length; k++) {
          if (s[k] === "\\" && s[k + 1] === "|") { cur += "|"; k++; continue; }
          if (s[k] === "|") { parts.push(cur); cur = ""; continue; }
          cur += s[k];
        }
        parts.push(cur);
        return parts.map((c) => c.trim());
      };
      const header = cells(rows[0]);
      const bodyRows = rows.slice(2).map(cells);
      let t = '<div class="table-wrap"><table class="tbl"><thead><tr>';
      t += header.map((c) => `<th>${inline(c, page)}</th>`).join("");
      t += "</tr></thead><tbody>";
      for (const r of bodyRows) {
        t += "<tr>" + r.map((c) => `<td>${inline(c, page)}</td>`).join("") + "</tr>";
      }
      t += "</tbody></table></div>";
      out.push(t);
      continue;
    }

    // Blockquote (group consecutive > lines; blank line ends it)
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      // Split into paragraphs on blank inner lines.
      const paras = buf.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      out.push(
        `<blockquote class="quote">${paras
          .map((p) => `<p>${inline(p.replace(/\n/g, " "), page)}</p>`)
          .join("")}</blockquote>`
      );
      continue;
    }

    // Lists (unordered / ordered), one level of nesting via indent
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const html = parseList(lines, i, page);
      out.push(html.html);
      i = html.next;
      continue;
    }

    // Paragraph: gather until blank / block starter
    const buf = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6}\s|```|>|\s*\||---+\s*$|\s*([-*]|\d+\.)\s+)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    // Guarantee forward progress. If the line matched a block-starter above but no
    // branch consumed it — e.g. a table row orphaned from its header by a stray blank
    // line — buf is empty and `i` never advances, spinning until `out.push` throws
    // "RangeError: Invalid array length". Emit the line as a paragraph and move on.
    if (buf.length === 0) {
      out.push(`<p>${inline(lines[i], page)}</p>`);
      i++;
      continue;
    }
    out.push(`<p>${inline(buf.join(" ").trim(), page)}</p>`);
  }

  return out.join("\n");
}

// Recursive-ish list parser supporting one nested level by indentation.
function parseList(lines, start, page) {
  const baseIndent = lines[start].match(/^(\s*)/)[1].length;
  const ordered = /^\s*\d+\.\s+/.test(lines[start]);
  let i = start;
  let html = ordered ? '<ol class="list ol">' : '<ul class="list ul">';

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      // allow a single blank line inside a list only if next line continues it
      if (i + 1 < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i + 1]) &&
          lines[i + 1].match(/^(\s*)/)[1].length >= baseIndent) {
        i++;
        continue;
      }
      break;
    }
    const m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (!m) break;
    const indent = m[1].length;
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      // nested list — attach to previous <li>
      const nested = parseList(lines, i, page);
      html = html.replace(/<\/li>$/, nested.html + "</li>");
      i = nested.next;
      continue;
    }
    html += `<li>${inline(m[3], page)}</li>`;
    i++;
  }
  html += ordered ? "</ol>" : "</ul>";
  return { html, next: i };
}

// ---------------------------------------------------------------------------
// 2b. Timecode index (for @[MM:SS] popovers on tutorial pages)
// ---------------------------------------------------------------------------

// Slug of a timecode, matching how mdToHtml() ids a "## [MM:SS]" heading:
//   "00:30"    -> "00-30"
//   "01:00:39" -> "01-00-39"
function timecodeAnchor(tc) {
  return tc.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Resolve (and cache on the page) a transcript target's href + timecode index.
// Returns null when the target is unknown or carries no timecoded headings.
function tcSource(page, target) {
  if (!target || !page._tcSrc) return null;
  if (page._tcSrc.has(target)) return page._tcSrc.get(target);
  let src = null;
  if (byTarget.has(target)) {
    const tp = byTarget.get(target);
    const index = buildTimecodeIndex(tp);
    if (index.size) src = { href: relHref(page.outRel, tp.outRel), index };
  }
  page._tcSrc.set(target, src);
  return src;
}

// Record that this page cites <target>#<tc>, and return the DOM key the pill and
// its data-island chunk share. Keys are namespaced by transcript so two videos
// can contribute the same timecode to one page without colliding.
function noteTimecodeUse(page, target, tc) {
  const key = String(target).replace(/[^a-zA-Z0-9]+/g, "-") + "~" + tc;
  if (!page._tcUsed.has(key)) page._tcUsed.set(key, { target, tc });
  return key;
}

// Parse a transcript page (headings shaped "## [MM:SS]") into a
// Map<timecodeString, chunkHtml>. Cached on the transcript page object.
function buildTimecodeIndex(tp) {
  if (tp._tcIndex) return tp._tcIndex;
  const idx = new Map();
  const lines = tp.body.replace(/\r\n/g, "\n").split("\n");
  const isTc = (l) => /^##\s+\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*$/.exec(l);
  let i = 0;
  while (i < lines.length) {
    const m = isTc(lines[i]);
    if (!m) { i++; continue; }
    const tc = m[1];
    i++;
    const buf = [];
    // Collect until the next timecode heading (or any other heading).
    while (i < lines.length && !isTc(lines[i]) && !/^#{1,6}\s/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    idx.set(tc, mdToHtml(buf.join("\n").trim(), tp));
  }
  tp._tcIndex = idx;
  return idx;
}

// Client script (inlined once per page that uses timecodes): click a .tc pill to
// float a popover containing the referenced transcript chunk from #tc-data.
const TC_SCRIPT = `(function(){
  var data=document.getElementById('tc-data'); if(!data) return;
  var pop=null;
  function close(){ if(pop){pop.remove();pop=null;} document.removeEventListener('click',onDoc,true); }
  function onDoc(e){ if(pop && !pop.contains(e.target) && !(e.target.closest&&e.target.closest('a.tc'))) close(); }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a.tc[data-tck]'); if(!a) return;
    e.preventDefault();
    var tc=a.getAttribute('data-tc'), k=a.getAttribute('data-tck');
    var esc=(window.CSS&&CSS.escape)?CSS.escape(k):k.replace(/[^a-zA-Z0-9_-]/g,'\\\\$&');
    var src=data.querySelector('[data-tck="'+esc+'"]'); if(!src) return;
    close();
    pop=document.createElement('div'); pop.className='tc-pop';
    pop.innerHTML='<div class="tc-pop-head"><span class="tc-pop-time">'+tc+'</span>'+
      '<a class="tc-pop-full" href="'+a.getAttribute('href')+'">open full &#8599;</a>'+
      '<button class="tc-pop-x" aria-label="Close">&times;</button></div>'+
      '<div class="tc-pop-body">'+src.innerHTML+'</div>';
    document.body.appendChild(pop);
    var r=a.getBoundingClientRect();
    pop.style.top=(window.scrollY+r.bottom+8)+'px';
    var left=window.scrollX+r.left;
    var maxLeft=window.scrollX+document.documentElement.clientWidth-pop.offsetWidth-16;
    if(left>maxLeft) left=Math.max(window.scrollX+12,maxLeft);
    pop.style.left=left+'px';
    pop.querySelector('.tc-pop-x').addEventListener('click',close);
    setTimeout(function(){document.addEventListener('click',onDoc,true);},0);
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
})();`;

// ---------------------------------------------------------------------------
// 3. Page template (DDC Reel style)
// ---------------------------------------------------------------------------

const TYPE_LABELS = {
  concept: "CONCEPT",
  entity: "ENTITY",
  summary: "SUMMARY",
  synthesis: "SYNTHESIS",
  presentation: "WALKTHROUGH",
};

// DDC Reel type: Syne (display), Space Mono (labels), Hanken Grotesk (reading text).
const FONTS =
  "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600&family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap";

// Sidebar catalog, links relative to the current page.
function renderSidebar(page) {
  let items = "";
  for (const s of SIDEBAR_SECTIONS) {
    const secPages = pages.filter((p) => p.section === s.label);
    if (!secPages.length) continue;
    items += `<div class="idx-group"><div class="idx-group-label">${s.label}</div><ol class="index-list">`;
    secPages.forEach((p, n) => {
      const num = String(n + 1).padStart(3, "0");
      const current = p.target === page.target;
      if (current) {
        items += `<li class="index-item current" aria-current="page"><span class="num">${num}</span><span class="title">${escapeHtml(p.title)}</span></li>`;
      } else {
        items += `<li class="index-item"><a class="index-link" href="${relHref(page.outRel, p.outRel)}"><span class="num">${num}</span><span class="title">${escapeHtml(p.title)}</span></a></li>`;
      }
    });
    items += "</ol></div>";
  }
  const homeHref = relHref(page.outRel, home.outRel);
  return `<aside class="field-logs" id="master-index">
  <div class="top">
    <a class="brand" href="${homeHref}">MASTER INDEX</a>
    ${items}
  </div>
  <div class="status-footer">${CONFIG.footer}</div>
</aside>`;
}

function renderHeader(page) {
  const homeHref = relHref(page.outRel, home.outRel);
  // Header links: the wiki's first three ordered sections that have pages
  // (anchored to the matching heading on the index page), else the template's.
  const ordered = SIDEBAR_SECTIONS.filter(
    (s) => s.dir && ORDERED.includes(s.dir) && pages.some((p) => p.section === s.label)
  ).slice(0, 3);
  const navItems = ordered.length
    ? [["Home", homeHref], ...ordered.map((s) => [s.label, homeHref + "#" + s.dir])]
    : [
        ["Home", homeHref],
        ["Concepts", homeHref + "#concepts"],
        ["Entities", homeHref + "#entities"],
        ["Walkthroughs", homeHref + "#presentations-step-by-step-walkthroughs"],
      ];
  return `<header class="site-header">
  <div class="header-left">
    <button type="button" class="sidebar-toggle" aria-label="Toggle the index" aria-controls="master-index" aria-expanded="true"><span class="sb-icon" aria-hidden="true"></span></button>
    <a href="${homeHref}" class="brand-mark" aria-label="${escapeHtml(CONFIG.title)} — home">
      <span class="brand-name">${escapeHtml(CONFIG.title)}</span>
      <span class="brand-short" aria-hidden="true">${escapeHtml(CONFIG.brandA + CONFIG.brandB)}</span>
    </a>
  </div>
  <nav class="nav">
    ${navItems.map(([l, h]) => `<a href="${h}" class="nav-link">${l}</a>`).join("")}
  </nav>
</header>`;
}

function renderHero(page) {
  const t = page.data.type;
  const kicker = TYPE_LABELS[t] || (page.target === "index" ? "MASTER INDEX" : "PAGE");
  const conf = page.data.confidence ? ` · CONFIDENCE ${String(page.data.confidence).toUpperCase()}` : "";
  // Split "Title: Subtitle" so the part after the colon reads as a subtitle line.
  const raw = page.title;
  const colon = raw.indexOf(":");
  let headline;
  if (colon !== -1 && colon < raw.length - 1) {
    headline = `${escapeHtml(raw.slice(0, colon))}<span class="headline-sub">${escapeHtml(raw.slice(colon + 1).trim())}</span>`;
  } else {
    headline = escapeHtml(raw);
  }
  return `<header class="hero">
  <div class="hero-kicker">${kicker}${conf}</div>
  <h1 class="headline">${headline}</h1>
</header>`;
}

function renderMeta(page) {
  const d = page.data;
  const bits = [];
  if (d.type) bits.push(`<span>Type <b>${escapeHtml(String(d.type).toUpperCase())}</b></span>`);
  if (Array.isArray(d.tags) && d.tags.length)
    bits.push(`<span>Tags <b>${d.tags.map(escapeHtml).join(" · ")}</b></span>`);
  if (d.updated) bits.push(`<span>Updated <b>${escapeHtml(d.updated)}</b></span>`);
  if (Array.isArray(d.sources) && d.sources.length)
    bits.push(`<span>Sources <b>${d.sources.length}</b></span>`);
  if (!bits.length) return "";
  return `<div class="article-meta">${bits.join("")}</div>`;
}

// Sidebar collapse: open by default. Persist the reader's choice in localStorage
// under "sb" ("0" = collapsed). The head snippet runs before paint to set the
// class up front (no flash); the body snippet wires the header toggle button.
const SB_HEAD =
  `try{if(localStorage.getItem('sb')==='0')document.documentElement.classList.add('sidebar-collapsed')}catch(e){}`;
const SB_SCRIPT =
  `(function(){var b=document.querySelector('.sidebar-toggle');if(!b)return;var r=document.documentElement;` +
  `function sync(){b.setAttribute('aria-expanded',String(!r.classList.contains('sidebar-collapsed')));}sync();` +
  `b.addEventListener('click',function(){var c=r.classList.toggle('sidebar-collapsed');` +
  `try{localStorage.setItem('sb',c?'0':'1')}catch(e){}sync();});})();`;

function renderPage(page) {
  // Timecode popovers: if this page names a transcript, resolve it and build the
  // timecode index so inline() can turn @[MM:SS] tokens into popover pills.
  page._tcSrc = new Map();
  page._tcUsed = new Map();
  page._vizUsed = new Set();
  const tcTarget = page.data.transcript;
  page._tcDefault = tcTarget && tcSource(page, tcTarget) ? tcTarget : null;
  page._tc = page._tcDefault ? tcSource(page, page._tcDefault) : null;

  const bodyHtml = mdToHtml(page.body, page);

  // Hidden data island holding each referenced transcript chunk + its wiring script.
  let tcData = "";
  let tcScript = "";
  if (page._tcUsed.size) {
    const parts = [...page._tcUsed].map(([key, { target, tc }]) => {
      const src = tcSource(page, target);
      return `<div data-tck="${escapeHtml(key)}">${(src && src.index.get(tc)) || ""}</div>`;
    });
    tcData = `<div id="tc-data" hidden>${parts.join("")}</div>`;
    tcScript = `<script>${TC_SCRIPT}</script>`;
  }

  const cssHref = relHref(page.outRel, "assets/wiki.css");
  const isHome = page.target === "index";

  // Interactive visualizations. Two ways a page gets one:
  //   1. a concept page whose slug matches a widget file -> panel under the meta row;
  //   2. any page with an inline "@viz[slug]" marker -> panel at that spot in the body
  //      (recorded in page._vizUsed during mdToHtml above).
  // Either way we load _viz.js once plus one script per distinct widget used.
  const slug = basename(page.target);
  const conceptViz = page.data.type === "concept" && widgetSlugs.has(slug);
  const vizBlock = conceptViz ? `<div class="viz-block" data-viz="${slug}"></div>` : "";
  const usedSlugs = new Set(page._vizUsed);
  if (conceptViz) usedSlugs.add(slug);
  const vizScripts = usedSlugs.size
    ? [
        `<script src="${relHref(page.outRel, "assets/_viz.js")}"></script>`,
        ...[...usedSlugs].map(
          (sl) => `<script src="${relHref(page.outRel, "assets/widgets/" + sl + ".js")}"></script>`
        ),
      ].join("\n")
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${escapeHtml(page.data.title || CONFIG.title + " wiki")}">
<title>${escapeHtml(page.title)} — ${escapeHtml(CONFIG.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="${cssHref}">
<script>${SB_HEAD}</script>
</head>
<body>
<div class="wiki-root">
  ${renderHeader(page)}
  <div class="entry-shell">
    ${renderSidebar(page)}
    <main class="entry-main${isHome ? " is-home" : ""}">
      ${renderHero(page)}
      <article class="article-container">
        ${renderMeta(page)}
        ${vizBlock}
        <section class="content-body">
${bodyHtml}
        </section>
        ${tcData}
      </article>
      <footer class="entry-footer">
        <div>${escapeHtml(CONFIG.footer)}</div>
        <a class="ddc-btn proceed" href="${relHref(page.outRel, home.outRel)}"><span class="ddc-btn__fill" aria-hidden="true"></span>RETURN TO MASTER INDEX ›</a>
        <div class="entry-source">source: ${escapeHtml(PROVENANCE.source)} · built ${PROVENANCE.builtAt.slice(0, 10)}</div>
      </footer>
    </main>
  </div>
</div>
${vizScripts}
${tcScript}
<script>${SB_SCRIPT}</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 4. Stylesheet
// ---------------------------------------------------------------------------

// DDC Reel (https://claude.ai/artifact/QBTm2jQ8DC1f9bjhwiuDvw): dark only, monochrome,
// Syne / Space Mono / Hanken Grotesk. The accent appears once per page, on the hero
// kicker; everything else is off-white and grays. Widgets may use it for one
// highlighted data series.
const CSS = `:root{
  color-scheme:dark;
  --color-bg:#070709;
  --color-surface:#111114;
  --color-surface-raised:#1a1a1e;
  --color-text:#f4f4f5;
  --color-secondary:#a1a1aa;
  --color-nav:#71717a;
  --color-muted:#52525b;
  --color-hover:rgba(244,244,245,.55);
  --color-border:rgba(244,244,245,.1);
  --color-border-strong:rgba(244,244,245,.3);
  --color-selection:rgba(244,244,245,.25);
  --color-accent:${CONFIG.accent};
  --color-accent-rgb:${CONFIG.accentRgb};
  --font-display:"Syne",ui-sans-serif,system-ui,sans-serif;
  --font-mono:"Space Mono",ui-monospace,monospace;
  --font-body:"Hanken Grotesk",ui-sans-serif,system-ui,sans-serif;
  --radius-sm:4px;--radius-md:8px;--radius-lg:16px;
  --page-margin:16px;--header-h:72px;--touch-target:48px;
}
@media(min-width:768px){:root{--page-margin:32px}}
@media(min-width:1024px){:root{--page-margin:40px}}
@media(min-width:1280px){:root{--page-margin:48px}}
*{box-sizing:border-box}
html{background:var(--color-bg);color:var(--color-text);font-family:var(--font-mono);-webkit-font-smoothing:antialiased}
body{margin:0;min-height:100vh;background:var(--color-bg);color:var(--color-text);overflow-x:clip}
::selection{background:var(--color-selection);color:var(--color-text)}
:focus-visible{outline:2px solid var(--color-text);outline-offset:2px}
a{color:inherit}

.wiki-root{position:relative;min-height:100vh}

/* Header */
.site-header{display:flex;align-items:center;justify-content:space-between;gap:16px;
  height:var(--header-h);padding:0 var(--page-margin);position:sticky;top:0;z-index:20;
  background:rgba(7,7,9,.8);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--color-border)}
.header-left{display:flex;align-items:center;gap:16px;min-width:0}
.brand-mark{text-decoration:none;color:var(--color-text);min-width:0;display:inline-flex;align-items:center;min-height:var(--touch-target)}
.brand-name,.brand-short{font-family:var(--font-display);font-weight:700;text-transform:uppercase;white-space:nowrap;font-size:14px;line-height:24px}
.brand-name{overflow:hidden;text-overflow:ellipsis}
.brand-short{display:none}
@media(min-width:768px){.brand-name{font-size:20px;line-height:28px}}
@media(max-width:479px){.brand-name{display:none}.brand-short{display:inline}}
.nav{display:flex;gap:16px;flex-wrap:nowrap;justify-content:flex-end;overflow-x:auto}
.nav-link{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--color-nav);text-decoration:none;display:inline-flex;align-items:center;min-height:var(--touch-target);white-space:nowrap;transition:color .2s}
@media(max-width:767px){.nav-link:not(:first-child){display:none}}
.sidebar-toggle{flex:none;display:inline-flex;align-items:center;justify-content:center;width:var(--touch-target);height:var(--touch-target);
  padding:0;background:transparent;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);cursor:pointer;transition:border-color .2s}
.sb-icon,.sb-icon::before,.sb-icon::after{display:block;width:16px;height:2px;background:var(--color-secondary);transition:background .2s}
.sb-icon{position:relative}
.sb-icon::before,.sb-icon::after{content:"";position:absolute;left:0}
.sb-icon::before{top:-5px}.sb-icon::after{top:5px}
@media(hover:hover){
  .nav-link:hover{color:var(--color-hover)}
  .sidebar-toggle:hover{border-color:var(--color-text)}
  .sidebar-toggle:hover .sb-icon,.sidebar-toggle:hover .sb-icon::before,.sidebar-toggle:hover .sb-icon::after{background:var(--color-text)}
}

/* Sidebar collapsed (reader toggled it shut; open by default) */
html.sidebar-collapsed .field-logs{display:none}
html.sidebar-collapsed .entry-shell{grid-template-columns:minmax(0,1fr)}

/* Shell */
.entry-shell{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:calc(100vh - var(--header-h));align-items:start}
.entry-main{min-width:0}

/* Sidebar */
.field-logs{border-right:1px solid var(--color-border);padding:32px 24px;
  display:flex;flex-direction:column;justify-content:space-between;gap:32px;min-height:100%}
@media(min-width:1024px){.field-logs{position:sticky;top:var(--header-h);height:calc(100vh - var(--header-h));overflow-y:auto}}
.field-logs .brand{display:block;font-family:var(--font-display);font-size:14px;line-height:24px;font-weight:700;text-transform:uppercase;
  color:var(--color-text);text-decoration:none;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--color-border)}
.idx-group{margin-bottom:24px}
.idx-group-label{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--color-secondary);margin-bottom:8px}
.index-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.index-item{font-family:var(--font-mono);font-size:12px;line-height:16px;display:grid;
  grid-template-columns:40px 1fr;align-items:baseline;gap:8px;color:var(--color-nav);transition:color .2s}
.index-item .num{color:var(--color-muted)}
.index-item .num::before{content:"["}.index-item .num::after{content:"]"}
.index-link{display:contents;color:inherit;text-decoration:none}
.index-item.current{color:var(--color-text);font-weight:700;cursor:default}
.index-item.current .num{color:var(--color-text)}
@media(hover:hover){
  .field-logs .brand:hover{color:var(--color-hover)}
  .index-item:not(.current):hover{color:var(--color-text)}
  .index-item:not(.current):hover .num{color:var(--color-secondary)}
}
.status-footer{font-family:var(--font-mono);font-weight:700;font-size:10px;line-height:16px;letter-spacing:.2em;color:var(--color-muted);text-transform:uppercase}

/* Hero: left aligned, Syne 800 uppercase, the page's one accent on the kicker */
.hero{max-width:1040px;padding:64px var(--page-margin) 32px;border-bottom:1px solid var(--color-border)}
.hero-kicker{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.3em;text-transform:uppercase;
  color:var(--color-accent);margin-bottom:24px}
.headline{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.02em;line-height:1;
  font-size:clamp(32px,4.8vw,72px);margin:0;color:var(--color-text);text-wrap:balance;overflow-wrap:anywhere}
.headline-sub{display:block;margin-top:16px;font-family:var(--font-body);font-weight:400;text-transform:none;letter-spacing:0;
  font-size:24px;line-height:1.4;color:var(--color-secondary)}
@media(min-width:768px){.hero{padding-top:96px;padding-bottom:48px}}

/* Article: a 720px reading column */
.article-container{max-width:calc(720px + 2 * var(--page-margin));padding:32px var(--page-margin) 0}
.is-home .article-container{max-width:calc(880px + 2 * var(--page-margin))}
.article-meta{font-family:var(--font-mono);font-size:12px;line-height:16px;color:var(--color-muted);text-transform:uppercase;font-weight:700;
  letter-spacing:.2em;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px;margin-bottom:48px;
  padding:16px 0;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border)}
@media(min-width:768px){.article-meta{grid-template-columns:repeat(4,minmax(0,1fr))}}
.article-meta span{display:flex;flex-direction:column;gap:4px;min-width:0}
.article-meta b{color:var(--color-text);font-weight:400;letter-spacing:0;text-transform:none;font-size:14px;line-height:24px;overflow-wrap:anywhere}

.content-body{font-family:var(--font-body);font-size:18px;line-height:1.7;color:var(--color-text)}
@media(max-width:767px){.content-body{font-size:16px;line-height:1.6}}
.content-body p{margin:0 0 1em}

.content-body .h1,.content-body .h2{font-family:var(--font-display);color:var(--color-text);text-wrap:balance}
.content-body .h1{font-weight:800;text-transform:uppercase;letter-spacing:-.02em;font-size:32px;line-height:40px;margin:64px 0 24px}
.content-body .h2{font-weight:600;font-size:28px;line-height:1.25;margin:64px 0 24px;padding-bottom:16px;border-bottom:1px solid var(--color-border)}
.content-body .h3{font-family:var(--font-mono);font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:14px;line-height:24px;margin:40px 0 8px;color:var(--color-text)}
.content-body .h4{font-family:var(--font-mono);font-weight:700;text-transform:uppercase;letter-spacing:.2em;font-size:12px;line-height:16px;margin:32px 0 8px;color:var(--color-secondary)}

.content-body a.wl,.content-body a.lnk{color:var(--color-text);text-decoration:underline;text-decoration-color:var(--color-border-strong);
  text-underline-offset:3px;transition:text-decoration-color .2s}
.content-body a.lnk[target="_blank"]::after{content:" \\2197";font-family:var(--font-mono);font-size:.8em;color:var(--color-secondary)}
@media(hover:hover){.content-body a.wl:hover,.content-body a.lnk:hover{text-decoration-color:var(--color-text)}}
.wl-missing{color:var(--color-nav);text-decoration:underline dotted var(--color-muted);text-underline-offset:3px}

.content-body ul,.content-body ol{margin:0 0 1em;padding-left:1.2em}
.content-body li{margin:0 0 .4em}
.content-body li::marker{color:var(--color-secondary)}
.content-body ol li::marker{font-family:var(--font-mono);font-size:.85em}

.content-body code{font-family:var(--font-mono);font-size:.85em;background:var(--color-surface-raised);
  padding:2px 4px;border-radius:var(--radius-sm);color:var(--color-text)}
.content-body pre.code{background:var(--color-surface);border:1px solid var(--color-border);
  padding:16px;overflow-x:auto;margin:0 0 1.6em;border-radius:var(--radius-md)}
.content-body pre.code code{background:none;padding:0;color:var(--color-text);font-size:13px;line-height:1.6}

.content-body blockquote.quote{margin:1.6em 0;padding:24px 0;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border);
  font-family:var(--font-display);font-weight:600;font-size:22px;line-height:1.45;color:var(--color-text)}
.content-body blockquote.quote p{margin:0 0 .6em}
.content-body blockquote.quote p:last-child{margin-bottom:0}

.content-body hr.rule{border:none;border-top:1px solid var(--color-border);margin:48px 0}

.table-wrap{overflow-x:auto;margin:0 0 1.8em;border:1px solid var(--color-border);border-radius:var(--radius-md)}
.content-body table.tbl{border-collapse:collapse;width:100%;font-size:15px;line-height:1.5}
.content-body table.tbl th,.content-body table.tbl td{border-bottom:1px solid var(--color-border);padding:12px 16px;text-align:left;vertical-align:top}
.content-body table.tbl tr:last-child td{border-bottom:none}
.content-body table.tbl th{font-family:var(--font-mono);font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:12px;line-height:16px;
  color:var(--color-secondary);background:var(--color-surface)}

/* Footer */
.entry-footer{padding:96px var(--page-margin) 64px;max-width:calc(720px + 2 * var(--page-margin));
  display:flex;flex-direction:column;align-items:flex-start;gap:24px;
  font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;color:var(--color-muted);text-transform:uppercase}
.entry-source{font-weight:400;font-size:10px;letter-spacing:.1em;color:var(--color-muted);word-break:break-all}

/* Button: off-white fill sweeps in from the left */
.ddc-btn{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:var(--touch-target);padding:16px 32px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);
  background:rgba(7,7,9,.4);color:var(--color-text);font-family:var(--font-mono);font-weight:700;text-transform:uppercase;
  letter-spacing:.2em;font-size:12px;line-height:16px;text-decoration:none;cursor:pointer;transition:border-color .3s ease,color .3s ease}
.ddc-btn__fill{position:absolute;inset:0;z-index:-1;background:var(--color-text);transform:scaleX(var(--fill-scale,0));transform-origin:left;transition:transform .3s ease}
@media(hover:hover){.ddc-btn:hover{border-color:var(--color-text);color:var(--color-bg);--fill-scale:1}}
@media(prefers-reduced-motion:reduce){.ddc-btn,.ddc-btn__fill{transition:none}}

/* Home page: index.md is a big set of nested link lists */
.is-home .content-body ul{list-style:none;padding-left:0}
.is-home .content-body li{border-bottom:1px solid var(--color-border);padding:8px 0;margin:0}

@media(max-width:1023px){
  .entry-shell{grid-template-columns:minmax(0,1fr)}
  .field-logs{border-right:none;border-bottom:1px solid var(--color-border);padding:24px var(--page-margin)}
}

/* ---- Interactive visualizations ---- */
.viz-block{margin:0 0 48px}
.video-block{margin:0 0 48px}
.video-block .video{display:block;width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-md)}
.video-caption{font-family:var(--font-mono);font-size:13px;line-height:20px;color:var(--color-secondary);padding:12px 8px 0}
.viz{border:1px solid var(--color-border);background:var(--color-surface);border-radius:var(--radius-lg);overflow:hidden;padding:8px}
.viz-label{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-secondary);padding:8px 8px 4px}
.viz-stage{position:relative;width:100%;padding:4px 0}
.viz-canvas{display:block;width:100%;border-radius:var(--radius-md);touch-action:none}
.viz-controls{display:flex;flex-wrap:wrap;gap:16px 24px;align-items:flex-end;padding:16px 8px;border-top:1px solid var(--color-border)}
.viz-ctl{display:flex;flex-direction:column;gap:8px;font-family:var(--font-mono)}
.viz-slider{min-width:150px;flex:1 1 150px;max-width:260px}
.viz-ctl-head{display:flex;justify-content:space-between;gap:16px;align-items:baseline}
.viz-ctl-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-secondary)}
.viz-ctl-val{font-size:12px;color:var(--color-text);font-weight:700}
.viz-range{-webkit-appearance:none;appearance:none;width:100%;height:2px;background:var(--color-border-strong);border-radius:2px;outline:none}
.viz-range::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--color-text);cursor:pointer;border:2px solid var(--color-surface)}
.viz-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--color-text);cursor:pointer;border:2px solid var(--color-surface)}
.viz-toggle{flex-direction:row;align-items:center;gap:8px;cursor:pointer}
.viz-toggle input{position:absolute;opacity:0;width:0;height:0}
.viz-switch{width:32px;height:16px;border-radius:8px;background:var(--color-surface-raised);border:1px solid var(--color-border-strong);position:relative;transition:background .2s;flex:none}
.viz-switch::after{content:"";position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:var(--color-secondary);transition:transform .2s,background .2s}
.viz-toggle input:checked + .viz-switch{background:var(--color-text)}
.viz-toggle input:checked + .viz-switch::after{transform:translateX(16px);background:var(--color-bg)}
.viz-toggle input:focus-visible + .viz-switch{outline:2px solid var(--color-text);outline-offset:2px}
.viz-seg{display:inline-flex;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);overflow:hidden}
.viz-seg-btn{font-family:var(--font-mono);font-weight:700;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--color-secondary);background:transparent;border:none;padding:8px 12px;cursor:pointer;transition:all .15s;border-right:1px solid var(--color-border)}
.viz-seg-btn:last-child{border-right:none}
.viz-seg-btn.active{background:var(--color-text);color:var(--color-bg)}
.viz-btn{font-family:var(--font-mono);font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-text);background:transparent;border:1px solid var(--color-border-strong);padding:8px 16px;cursor:pointer;border-radius:var(--radius-md);transition:all .15s}
@media(hover:hover){.viz-seg-btn:not(.active):hover{color:var(--color-text)}.viz-btn:hover{border-color:var(--color-text);background:var(--color-text);color:var(--color-bg)}}
.viz-readout{font-family:var(--font-mono);font-size:12px;line-height:1.6;color:var(--color-secondary);padding:0 8px 16px}
.viz-readout:empty{display:none}
.viz-readout b{color:var(--color-text);font-weight:700}
.viz-readout .k{color:var(--color-nav);text-transform:uppercase;letter-spacing:.1em;font-size:10px}
.viz-note{font-family:var(--font-mono);font-size:12px;line-height:1.5;color:var(--color-nav);padding:0 8px 8px}
.viz-note:empty{display:none}
.viz-error{padding:24px;color:var(--color-nav);font-size:12px}

/* ---- Timecode pills + transcript popover ---- */
.content-body a.tc{display:inline-block;font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.05em;
  color:var(--color-text);background:var(--color-surface-raised);border:1px solid var(--color-border);border-radius:var(--radius-sm);
  padding:4px 8px;text-decoration:none;cursor:pointer;white-space:nowrap;vertical-align:1px;transition:border-color .15s,background .15s}
.content-body a.tc::before{content:"\\25B8";margin-right:4px;color:var(--color-secondary)}
@media(hover:hover){.content-body a.tc:hover{border-color:var(--color-text);background:rgba(244,244,245,.12)}}
.content-body a.tc.tc-missing{color:var(--color-muted);border-style:dashed;background:transparent}
.tc-pop{position:absolute;z-index:60;max-width:min(520px,92vw);background:var(--color-surface);
  border:1px solid var(--color-border-strong);border-radius:var(--radius-lg);overflow:hidden}
.tc-pop-head{display:flex;align-items:center;gap:16px;padding:8px 8px 8px 16px;
  border-bottom:1px solid var(--color-border);font-family:var(--font-mono)}
.tc-pop-time{color:var(--color-text);font-size:12px;letter-spacing:.1em;font-weight:700}
.tc-pop-full{margin-left:auto;color:var(--color-secondary);font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;text-decoration:none}
.tc-pop-x{background:none;border:none;color:var(--color-secondary);font-size:20px;line-height:1;cursor:pointer;min-width:40px;min-height:40px}
@media(hover:hover){.tc-pop-full:hover{color:var(--color-text)}.tc-pop-x:hover{color:var(--color-text)}}
.tc-pop-body{padding:16px;max-height:min(50vh,420px);overflow-y:auto;
  font-family:var(--font-body);font-size:15px;line-height:1.6;color:var(--color-text)}
.tc-pop-body p{margin:0 0 .7em}
.tc-pop-body p:last-child{margin-bottom:0}
`;

// ---------------------------------------------------------------------------
// 5. Write output
// ---------------------------------------------------------------------------

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
writeFileSync(join(OUT, "assets", "wiki.css"), CSS);

// Copy the shared viz library + any concept widgets into assets/.
if (widgetSlugs.size) {
  if (existsSync(VIZ_LIB)) writeFileSync(join(OUT, "assets", "_viz.js"), readFileSync(VIZ_LIB));
  else console.warn(`viz library not found at ${VIZ_LIB}; widgets will not run`);
  mkdirSync(join(OUT, "assets", "widgets"), { recursive: true });
  for (const f of readdirSync(WIDGETS)) {
    if (!f.endsWith(".js") || f === "_viz.js") continue;
    writeFileSync(join(OUT, "assets", "widgets", f), readFileSync(join(WIDGETS, f)));
  }
}

// Copy explainer videos (+ posters) into assets/media/.
if (mediaSlugs.size) {
  mkdirSync(join(OUT, "assets", "media"), { recursive: true });
  for (const f of readdirSync(MEDIA)) {
    if (!f.endsWith(".mp4") && !f.endsWith(".jpg")) continue;
    writeFileSync(join(OUT, "assets", "media", f), readFileSync(join(MEDIA, f)));
  }
}

for (const page of pages) {
  const dest = join(OUT, page.outRel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, renderPage(page));
}

writeFileSync(
  join(OUT, MARKER),
  JSON.stringify({ ...PROVENANCE, pages: pages.length }, null, 2) + "\n",
);

return { outDir: OUT, pages: pages.length, provenance: PROVENANCE, config: CONFIG };
}
