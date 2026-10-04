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
import { findMermaidFences, renderMermaid, findDiagramFont } from "./mermaid.mjs";

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

  // The Obsidian vault the wiki lives in (the nearest folder holding .obsidian/),
  // for the "Open in Obsidian" page action. Null when the wiki is not in a vault.
  const OBSIDIAN = (() => {
    for (let d = WIKI; ; d = dirname(d)) {
      if (existsSync(join(d, ".obsidian"))) return { name: basename(d), root: d };
      if (dirname(d) === d) return null;
    }
  })();

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
  // Stills: <media>/<slug>.(png|webp|jpg|gif), mounted by "@image[slug] caption".
  // A screenshot from the review loop is promoted here, never into the vault.
  const IMAGE_EXT = ["png", "webp", "jpg", "gif"];
  const mediaImages = new Map();
  if (MEDIA && existsSync(MEDIA)) {
    const files = new Set(readdirSync(MEDIA));
    for (const f of files) {
      const m = f.match(/^(.+)\.(png|webp|jpg|gif)$/);
      if (!m || mediaImages.has(m[1])) continue;
      const ext = IMAGE_EXT.find((e) => files.has(`${m[1]}.${e}`));
      mediaImages.set(m[1], `${m[1]}.${ext}`);
    }
  }
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
  // Lines the frontmatter used, so body line i is source line lineBase + i + 1.
  const lineBase = raw.slice(0, raw.length - body.length).split("\n").length - 1;
  const page = { srcRel, target, outRel, title, data, raw, body, lineBase, section: sectionLabel };
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
// Natural order, so day-10 follows day-9 rather than day-1.
const natural = (a, b) => a.localeCompare(b, "en", { numeric: true });
for (const rel of walkMd(WIKI).sort(natural)) {
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

// Split a table row on *unescaped* pipes. GFM lets `\|` stand for a literal pipe
// inside a cell, which is what makes aliased wikilinks ([[target|alias]]) and
// timecode pills authorable in tables: a naive split("|") would tear them in
// half. Escaped pipes are unescaped as they are consumed.
function splitRow(r) {
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
}

// `base`, when given, stamps each block with data-line="<source line>" so a review
// note can point at the markdown line it is about. Body line i is source line
// base + i + 1.
function mdToHtml(body, page, base = null) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const dl = (k) => (base == null ? "" : ` data-line="${base + k + 1}"`);

  while (i < lines.length) {
    let line = lines[i];

    // Blank
    if (/^\s*$/.test(line)) { i++; continue; }

    // Code fence
    if (/^```/.test(line)) {
      const buf = [];
      const at = dl(i);
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      if (/^```\s*mermaid\s*$/.test(line) && DIAGRAMS.has(buf.join("\n"))) {
        out.push(
          `<figure class="diagram-block"${at}><div class="viz"><div class="viz-label">Diagram</div>` +
          `${DIAGRAMS.get(buf.join("\n"))}</div></figure>`,
        );
        continue;
      }
      out.push(`<pre class="code"${at}><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
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
        out.push(`<div class="viz-block" data-viz="${slug}"${dl(i)}></div>`);
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
          `<figure class="video-block"${dl(i)}><div class="viz"><div class="viz-label">Explainer</div>` +
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

    // Inline still: "@image[slug] optional caption", same rules as @video.
    const im = line.match(/^\s*@image\[([a-z0-9][a-z0-9-]*)\](?:\s+(.*))?$/);
    if (im && page) {
      const file = mediaImages.get(im[1]);
      const cap = (im[2] || "").trim();
      if (file) {
        const src = relHref(page.outRel, "assets/media/" + file);
        out.push(
          `<figure class="image-block"${dl(i)}><div class="viz">` +
            `<img class="still" src="${src}" alt="${escapeHtml(cap || im[1])}" loading="lazy"></div>` +
            (cap ? `<figcaption class="video-caption">${inline(cap, page)}</figcaption>` : "") +
            `</figure>`
        );
      } else {
        // Not shot yet: a slot only review mode shows, so the request is visible
        // where the screenshot will be pasted, and the public site stays clean.
        out.push(`<figure class="image-wanted"${dl(i)}><div class="image-wanted-box">` +
          `<span class="image-wanted-label">Screenshot needed · ${escapeHtml(im[1])}</span>` +
          (cap ? `<span class="image-wanted-cap">${inline(cap, page)}</span>` : "") + `</div></figure>`);
      }
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.push(`<h${lvl} id="${id}" class="h${lvl}"${dl(i)}>${inline(h[2], page)}</h${lvl}>`);
      i++;
      continue;
    }

    // Table (header row + separator + body)
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = [];
      const at = dl(i);
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const header = splitRow(rows[0]);
      const bodyRows = rows.slice(2).map(splitRow);
      let t = `<div class="table-wrap"${at}><table class="tbl"><thead><tr>`;
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
      const at = dl(i);
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      // Split into paragraphs on blank inner lines.
      const paras = buf.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      out.push(
        `<blockquote class="quote"${at}>${paras
          .map((p) => `<p>${inline(p.replace(/\n/g, " "), page)}</p>`)
          .join("")}</blockquote>`
      );
      continue;
    }

    // Lists (unordered / ordered), one level of nesting via indent
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const html = parseList(lines, i, page, base);
      out.push(html.html);
      i = html.next;
      continue;
    }

    // Paragraph: gather until blank / block starter
    const buf = [];
    const at = dl(i);
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
      out.push(`<p${at}>${inline(lines[i], page)}</p>`);
      i++;
      continue;
    }
    out.push(`<p${at}>${inline(buf.join(" ").trim(), page)}</p>`);
  }

  return out.join("\n");
}

// Recursive-ish list parser supporting one nested level by indentation.
function parseList(lines, start, page, base = null) {
  const baseIndent = lines[start].match(/^(\s*)/)[1].length;
  const ordered = /^\s*\d+\.\s+/.test(lines[start]);
  let i = start;
  // Keep the source's numbering: a list split by prose ("4." after an Ask block)
  // must not restart at 1, or "repeat step 24" points at nothing.
  const first = ordered ? parseInt(lines[start].match(/^\s*(\d+)\./)[1], 10) : 1;
  let html = ordered
    ? `<ol class="list ol"${first !== 1 ? ` start="${first}"` : ""}>`
    : '<ul class="list ul">';

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
      const nested = parseList(lines, i, page, base);
      html = html.replace(/<\/li>$/, nested.html + "</li>");
      i = nested.next;
      continue;
    }
    html += `<li${base == null ? "" : ` data-line="${base + i + 1}"`}>${inline(m[3], page)}</li>`;
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
  lesson: "LESSON",
};

// DDC Reel type: Syne (display), Space Mono (labels), Hanken Grotesk (reading text).
const FONTS =
  "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600&family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap";

// Pages in master-index order (the sidebar's groups, top to bottom), and where a
// page sits in it: its group and its number within the group.
let indexOrder = null;
function indexFlat() {
  return (indexOrder ??= SIDEBAR_SECTIONS.flatMap((s) => pages.filter((p) => p.section === s.label)));
}
function indexPos(page) {
  const secPages = pages.filter((p) => p.section === page.section);
  const n = secPages.indexOf(page);
  if (n === -1 || !SIDEBAR_SECTIONS.some((s) => s.label === page.section)) return null;
  return { label: page.section, num: String(n + 1).padStart(3, "0") };
}

// Master index: one collapsible group per section, links relative to the current
// page. The current page's group starts open; the page script restores any other
// group the reader opened, and filters the list from the header search box.
function renderSidebar(page) {
  let groups = "";
  for (const s of SIDEBAR_SECTIONS) {
    const secPages = pages.filter((p) => p.section === s.label);
    if (!secPages.length) continue;
    const open = secPages.includes(page);
    groups += `<details class="idx-group" data-group="${escapeHtml(s.label)}"${open ? " open" : ""}>` +
      `<summary class="idx-group-label"><span class="chev" aria-hidden="true"></span><span class="idx-group-name">${s.label}</span><span class="idx-count">${secPages.length}</span></summary><ol class="index-list">`;
    secPages.forEach((p, n) => {
      const num = String(n + 1).padStart(3, "0");
      const current = p === page ? ' aria-current="page"' : "";
      groups += `<li class="index-item"><a class="index-link" href="${relHref(page.outRel, p.outRel)}"${current}><span class="num">${num}</span><span class="title">${escapeHtml(p.title)}</span></a></li>`;
    });
    groups += "</ol></details>";
  }
  const total = indexFlat().length;
  return `<aside class="field-logs" id="master-index" aria-label="Master index" data-site="${escapeHtml(WIKI_ID)}">
  <div class="idx-head"><a class="brand" href="${relHref(page.outRel, home.outRel)}">Master index</a><span class="idx-total">[${String(total).padStart(3, "0")}]</span></div>
  <div class="idx-groups">${groups}</div>
  <p class="idx-empty" hidden>No page titles match.</p>
  <div class="status-footer">${CONFIG.footer}</div>
</aside>`;
}

function renderHeader(page) {
  const homeHref = relHref(page.outRel, home.outRel);
  return `<header class="site-header">
  <div class="header-left">
    <button type="button" class="sidebar-toggle" aria-label="Toggle the index" aria-controls="master-index" aria-expanded="true"><span class="sb-icon" aria-hidden="true"></span></button>
    <a href="${homeHref}" class="brand-mark" aria-label="${escapeHtml(CONFIG.title)} — home">
      <span class="brand-name">${escapeHtml(CONFIG.title)}</span>
      <span class="brand-short" aria-hidden="true">${escapeHtml(CONFIG.brandA + CONFIG.brandB)}</span>
    </a>
  </div>
  <label class="idx-search">
    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="idx-q" type="search" placeholder="Filter the index" autocomplete="off" aria-controls="master-index">
    <kbd aria-hidden="true">/</kbd>
  </label>
</header>`;
}

// Page head: breadcrumb, the accent kicker, the title, and the page actions.
function renderHero(page, override, sub = "") {
  const t = page.data.type;
  const kicker = override?.kicker || TYPE_LABELS[t] || "PAGE";
  const conf = page.data.confidence && !override ? ` · CONFIDENCE ${String(page.data.confidence).toUpperCase()}` : "";
  // Split "Title: Subtitle" so the part after the colon reads as a subtitle line.
  const raw = override?.title || page.title;
  const colon = raw.indexOf(":");
  let headline;
  if (colon !== -1 && colon < raw.length - 1) {
    headline = `${escapeHtml(raw.slice(0, colon))}<span class="headline-sub">${escapeHtml(raw.slice(colon + 1).trim())}</span>`;
  } else {
    headline = escapeHtml(raw) + (sub ? `<span class="headline-sub">${sub}</span>` : "");
  }
  const pos = indexPos(page);
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${relHref(page.outRel, home.outRel)}">${escapeHtml(CONFIG.title)}</a>` +
    (pos ? `<span class="sep">/</span><span>${escapeHtml(pos.label)}</span><span class="sep">/</span><span class="here">[${pos.num}]</span>` : "") +
    `</nav>`;
  return `<header class="hero">
  ${crumbs}
  <div class="hero-kicker">${kicker}${conf}</div>
  <h1 class="headline">${headline}</h1>
  ${renderActions(page)}
</header>`;
}

// "Copy page ▾": copy the page's markdown (to paste into Claude), view it, copy
// the link, or open the note in Obsidian. The markdown ships in the page as JSON.
function renderActions(page) {
  const src = OBSIDIAN ? relative(OBSIDIAN.root, join(WIKI, page.srcRel)).split("\\").join("/") : null;
  const obsidian = src
    ? `<a role="menuitem" href="obsidian://open?vault=${encodeURIComponent(OBSIDIAN.name)}&amp;file=${encodeURIComponent(src.replace(/\.md$/, ""))}"><span>Open in Obsidian<span class="menu-sub">${escapeHtml(src)}</span></span><span class="menu-ext" aria-hidden="true">↗</span></a>`
    : "";
  return `<div class="page-actions">
    <div class="split">
      <button type="button" class="split-main" data-act="copy"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/></svg><span class="split-label">Copy page</span></button>
      <button type="button" class="split-more" aria-label="More page actions" aria-haspopup="menu" aria-expanded="false" aria-controls="page-menu"><span class="chev" aria-hidden="true"></span></button>
      <div class="page-menu" id="page-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-act="copy"><span>Copy page<span class="menu-sub">The markdown source, ready to paste into Claude</span></span></button>
        <button type="button" role="menuitem" data-act="view"><span>View as Markdown<span class="menu-sub">The page as the wiki stores it</span></span></button>
        <hr>
        <button type="button" role="menuitem" data-act="link"><span>Copy link to this page</span></button>
        ${obsidian}
      </div>
    </div>
  </div>`;
}

// The page's h2/h3 headings, for "On this page". Read from the rendered body so
// the ids are the ones the headings actually carry.
function tocItems(html) {
  const out = [];
  for (const m of html.matchAll(/<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
    out.push({ level: +m[1], id: m[2], text: m[3].replace(/<[^>]+>/g, "").trim() });
  }
  return out;
}
const tocList = (items) =>
  `<ul class="toc-list">${items.map((i) => `<li><a class="toc-h${i.level}" href="#${i.id}" data-toc="${i.id}">${i.text}</a></li>`).join("")}</ul>`;

// Previous / next page in master-index order, across groups.
function renderPager(page) {
  const flat = indexFlat();
  const i = flat.indexOf(page);
  if (i === -1) return "";
  const link = (p, cls, label) => {
    if (!p) return "";
    const pos = indexPos(p);
    return `<a class="pager-link ${cls}" href="${relHref(page.outRel, p.outRel)}"><span class="pager-k">${label}</span>` +
      `<span class="pager-t">${escapeHtml(p.title)}</span><span class="pager-s">${escapeHtml(pos.label)} / [${pos.num}]</span></a>`;
  };
  return `<nav class="pager" aria-label="Previous and next page">${link(flat[i - 1], "prev", "‹ Previous")}${link(flat[i + 1], "next", "Next ›")}</nav>`;
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

// ---------------------------------------------------------------------------
// 3b. Lesson layout (pages with `type: lesson`)
// ---------------------------------------------------------------------------

// A lesson is the same markdown as any page, read for its teaching structure:
//   "## Phase N — Title (75 min)"  -> a phase, with its time budget on the rail
//   **Why:**                       -> the phase's lead: what it teaches, what breaks without it
//   **Ask:** + **Decision:**      -> a question card; the decision hides behind a reveal
//   **Predict:** / **Read:**      -> a prediction box; the read-off hides until checked
//   ⚠️ line                        -> a trap callout
//   > quote                        -> the line to remember
//   mermaid / @video / @image / @viz -> the phase's visual, beside the steps
//   **Goal:** / **Result:** / **Open beside this page:** or **Open in Unreal:** (a list may
//   follow on the next lines) before the first phase -> the brief
//   @image[slug] with no file yet  -> a "screenshot needed" slot, shown in review mode only
// Obsidian sees plain markdown; only the site reads the markers.

const MARKER_RE = /^(\*\*(Ask|Decision|Predict|Read|Why|Goal|Result|Open beside this page|Open in [A-Za-z ]+):\*\*|⚠️)/;
const TAIL_RE = /^(related|sources|see also)\b/i;

const headingId = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Split body lines into "## " sections (outside code fences).
function splitSections(lines) {
  const secs = [{ head: null, headLine: null, start: 0, lines: [] }];
  let fence = false;
  lines.forEach((l, i) => {
    if (/^```/.test(l)) fence = !fence;
    if (!fence && /^##\s+/.test(l)) {
      secs.push({ head: l.replace(/^##\s+/, "").trim(), headLine: i, start: i + 1, lines: [] });
      return;
    }
    secs[secs.length - 1].lines.push(l);
  });
  return secs;
}

// Split a section into blocks: blank-line separated chunks (fences kept whole),
// then split again before every marker line, so "**Ask:**" and "**Decision:**"
// on consecutive lines become two blocks.
function lessonBlocks(sec) {
  const chunks = [];
  let buf = null;
  let fence = false;
  sec.lines.forEach((l, k) => {
    const i = sec.start + k;
    if (/^```/.test(l)) fence = !fence;
    else if (!fence && /^\s*$/.test(l)) { if (buf) chunks.push(buf); buf = null; return; }
    if (!buf) buf = { start: i, lines: [] };
    buf.lines.push(l);
  });
  if (buf) chunks.push(buf);

  const blocks = [];
  for (const c of chunks) {
    const first = c.lines[0];
    if (/^```|^\s*([-*]|\d+\.)\s|^\s*\||^\s*>/.test(first)) { blocks.push(c); continue; }
    let cur = null;
    c.lines.forEach((l, k) => {
      if (!cur || MARKER_RE.test(l)) { cur = { start: c.start + k, lines: [] }; blocks.push(cur); }
      cur.lines.push(l);
    });
  }
  for (const b of blocks) {
    const f = b.lines[0];
    const mk = f.match(/^\*\*([A-Za-z ]+):\*\*\s*/);
    b.label = mk ? mk[1] : "";
    b.text = b.lines.join("\n");
    if (/^```\s*mermaid\s*$/.test(f) || /^\s*@(video|image|viz)\[/.test(f)) b.kind = "visual";
    else if (/^\s*>/.test(f)) b.kind = "remember";
    else if (/^⚠️/.test(f)) { b.kind = "trap"; b.text = b.text.replace(/^⚠️️?\s*/, "").replace(/^[a-z]/, (c) => c.toUpperCase()); }
    else if (mk && MARKER_RE.test(f)) {
      b.kind = mk[1].toLowerCase();
      // "**Ask:** read the switch" reads as a sentence once the label is gone.
      b.text = b.text.slice(mk[0].length).replace(/^[a-z]/, (c) => c.toUpperCase());
    }
    else if (/^\s*\d+\.\s/.test(f)) b.kind = "steps";
    else b.kind = "md";
  }
  return blocks;
}

// A short plain paragraph next to a visual reads as its title (ends with ":")
// or caption (one sentence after it).
const isTitleFor = (b) => b && b.kind === "md" && b.lines.length === 1 && b.text.length < 160 && /:\s*$/.test(b.text);
const isCaptionFor = (b) => b && b.kind === "md" && b.lines.length === 1 && b.text.length < 200 && !/:\s*$/.test(b.text) && !/^\*\*/.test(b.text);

function renderLesson(page) {
  const lines = page.body.replace(/\r\n/g, "\n").split("\n");
  const base = page.lineBase;
  const md = (b) => mdToHtml(b.text, page, base + b.start);
  const at = (k) => ` data-line="${base + k + 1}"`;
  const label = (t) => `<div class="lesson-label">${t}</div>`;
  const secs = splitSections(lines);

  // ---- brief: everything before the first "## ", minus the H1 (the hero has it)
  const intro = { ...secs[0], lines: secs[0].lines.map((l) => (/^#\s/.test(l) ? "" : l)) };
  let briefCards = "";
  let openList = "";
  let briefMd = "";
  for (const b of lessonBlocks(intro)) {
    if (b.kind === "goal" || b.kind === "result") {
      briefCards += `<div class="lesson-brief-card"${at(b.start)}>${label(b.kind)}<p>${inline(b.text, page)}</p></div>`;
    } else if (b.kind === "open beside this page" || b.kind.startsWith("open in ")) {
      // Either "a · b · c" on one line, or a lead line followed by a list.
      const body = /\n\s*[-*]\s/.test(b.text)
        ? `<div class="lesson-open-md">${md(b)}</div>`
        : `<ul class="lesson-open-list">${b.text.replace(/\.\s*$/, "").split(/\s+·\s+/).map((t) => `<li>${inline(t, page)}</li>`).join("")}</ul>`;
      openList = `<div class="lesson-open"${at(b.start)}>${label(b.label)}${body}</div>`;
    } else briefMd += md(b);
  }

  // ---- phases and tail
  const phases = [];
  let tail = "";
  for (const sec of secs.slice(1)) {
    if (TAIL_RE.test(sec.head)) {
      tail += `<h2 id="${headingId(sec.head)}" class="h2"${at(sec.headLine)}>${inline(sec.head, page)}</h2>` +
        mdToHtml(sec.lines.join("\n"), page, base + sec.start);
      continue;
    }
    const pm = sec.head.match(/^Phase\s+(\d+)\s*[—–:-]\s*(.*)$/i);
    let title = pm ? pm[2] : sec.head;
    const bud = title.match(/\s*\((\d+)\s*min\)\s*$/i);
    if (bud) title = title.slice(0, bud.index);
    phases.push({ sec, title, minutes: bud ? +bud[1] : null, id: headingId(sec.head) });
  }
  const n = phases.length;
  const total = phases.reduce((t, p) => t + (p.minutes || 0), 0);
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} H${m % 60 ? ` ${String(m % 60).padStart(2, "0")} M` : ""}` : `${m} MIN`);

  const phaseHtml = phases.map((p, idx) => {
    const num = idx + 1;
    const blocks = lessonBlocks(p.sec);
    const visuals = [];
    const used = new Set();
    // Lift each visual (with its title/caption paragraphs) out of the flow.
    blocks.forEach((b, k) => {
      if (b.kind !== "visual") return;
      const prev = blocks[k - 1], next = blocks[k + 1];
      const t = !used.has(k - 1) && isTitleFor(prev) ? prev : null;
      const c = isCaptionFor(next) ? next : null;
      if (t) used.add(k - 1);
      if (c) used.add(k + 1);
      used.add(k);
      visuals.push(
        `<figure class="lesson-figure" tabindex="0" title="Click to enlarge">` +
          (t ? `<div class="lesson-figure-title"${at(t.start)}>${inline(t.text.replace(/:\s*$/, ""), page)}</div>` : "") +
          md(b) +
          (c ? `<figcaption class="lesson-figure-caption"${at(c.start)}>${inline(c.text, page)}</figcaption>` : "") +
          `</figure>`
      );
    });

    let flow = "";
    let predicted = false;
    let predictN = 0;
    for (let k = 0; k < blocks.length; k++) {
      if (used.has(k)) continue;
      const b = blocks[k];
      if (b.kind === "ask") {
        const d = blocks[k + 1] && blocks[k + 1].kind === "decision" ? blocks[++k] : null;
        flow += `<div class="lesson-ask"${at(b.start)}>${label("Ask the room")}<p class="lesson-q">${inline(b.text, page)}</p>` +
          (d ? `<details class="lesson-reveal"${at(d.start)}><summary>Reveal the decision</summary><div class="lesson-reveal-body">${md({ ...d, text: d.text })}</div></details>` : "") +
          `</div>`;
      } else if (b.kind === "why") {
        flow += `<div class="lesson-why"${at(b.start)}>${label("Why this phase")}${md(b)}</div>`;
      } else if (b.kind === "decision") {
        flow += `<div class="lesson-ask"${at(b.start)}>${label("Decision")}${md(b)}</div>`;
      } else if (b.kind === "predict") {
        predicted = true;
        const key = `p${num}-${++predictN}`;
        flow += `<div class="lesson-predict"${at(b.start)}>${label("Predict")}<p class="lesson-q">${inline(b.text, page)}</p>` +
          `<textarea class="lesson-predict-input" data-key="${key}" rows="2" placeholder="Write your call before you run it"></textarea></div>`;
      } else if (b.kind === "read") {
        flow += predicted
          ? `<details class="lesson-read"${at(b.start)}><summary>Check your prediction</summary><div class="lesson-reveal-body">${label("Read-off")}${md(b)}</div></details>`
          : `<div class="lesson-read is-open"${at(b.start)}>${label("Read-off")}${md(b)}</div>`;
      } else if (b.kind === "trap") {
        flow += `<div class="lesson-trap"${at(b.start)}>${label("Trap")}${md(b)}</div>`;
      } else if (b.kind === "remember") {
        flow += `<div class="lesson-remember"${at(b.start)}>${label("Remember")}${md({ ...b, text: b.text.replace(/^\s*>\s?/gm, "") })}</div>`;
      } else if (b.kind === "steps") {
        flow += md(b).replace(/<ol class="list ol"(?: start="(\d+)")?/g, (_, st) => `<ol class="list ol lesson-steps"${st ? ` start="${st}"` : ""} style="--start:${(st ? +st : 1) - 1}"`);
      } else {
        flow += md(b);
      }
    }

    const visual = visuals.length
      ? visuals.join("")
      : `<div class="lesson-visual-empty">No visual yet · phase ${num}</div>`;
    const nextP = phases[idx + 1];
    const prevP = phases[idx - 1];
    return `<section class="lesson-phase" id="phase-${num}" data-phase="${num}">
  <header class="lesson-phase-head"${at(p.sec.headLine)}>
    <div class="lesson-phase-kicker">Phase ${num} / ${n}${p.minutes ? ` · ${p.minutes} min` : ""}</div>
    <h2 class="lesson-phase-title" id="${p.id}">${inline(p.title, page)}</h2>
  </header>
  <div class="lesson-phase-grid ${visuals.some((v) => !v.includes('class="image-wanted"')) ? "has-visual" : "no-visual"}">
    <div class="lesson-flow">${flow}</div>
    <aside class="lesson-visual">${visual}</aside>
  </div>
  <footer class="lesson-phase-foot">
    <button type="button" class="lesson-done" data-done="${num}" aria-pressed="false">Mark phase done</button>
    <div class="lesson-pager">
      ${prevP ? `<a class="lesson-prev" href="#phase-${num - 1}" data-phase-link="${num - 1}">‹ Phase ${num - 1}</a>` : ""}
      ${nextP ? `<a class="ddc-btn" href="#phase-${num + 1}" data-phase-link="${num + 1}"><span class="ddc-btn__fill" aria-hidden="true"></span>Next · ${escapeHtml(nextP.title.replace(/`/g, ""))} ›</a>` : ""}
    </div>
  </footer>
</section>`;
  }).join("\n");

  const rail = n
    ? `<nav class="lesson-rail" aria-label="Phases">
  <div class="lesson-rail-track">${phases.map((p, idx) =>
      `<a class="lesson-rail-item" href="#phase-${idx + 1}" data-phase-link="${idx + 1}" style="flex:${p.minutes || 60} 1 0">` +
      `<span class="lesson-rail-bar" aria-hidden="true"></span>` +
      `<span class="lesson-rail-k">Phase ${idx + 1}${p.minutes ? ` · ${p.minutes} min` : ""}</span>` +
      `<span class="lesson-rail-t">${inline(p.title, page).replace(/<[^>]+>/g, "")}</span></a>`).join("")}</div>
  <div class="lesson-rail-tools">${total ? `<span class="lesson-rail-total">Total ${fmtMin(total)}</span>` : ""}` +
      `<div class="lesson-view" role="group" aria-label="View"><button type="button" class="lesson-view-btn" data-view="one" aria-pressed="true">One phase</button>` +
      `<button type="button" class="lesson-view-btn" data-view="all" aria-pressed="false">All phases</button></div></div>
</nav>`
    : "";

  const brief = briefCards || openList || briefMd
    ? `<section class="lesson-brief">${briefCards ? `<div class="lesson-brief-grid">${briefCards}</div>` : ""}${openList}${briefMd ? `<div class="lesson-brief-md content-body">${briefMd}</div>` : ""}</section>`
    : "";

  const t = splitTitle(page.title);
  return {
    kicker: [t.eyebrow, "Lesson", n ? `${n} phases` : "", total ? fmtMin(total) : ""].filter(Boolean).join(" · "),
    title: t.eyebrow ? t.main + (t.sub ? `: ${t.sub}` : "") : page.title,
    html: `<div class="lesson" data-lesson>
${brief}
${rail}
<div class="lesson-phases content-body">
${phaseHtml}
</div>
${tail ? `<section class="lesson-tail content-body">${tail}</section>` : ""}
</div>`,
  };
}

// Client script for lesson pages: one phase at a time (or all), the rail, done
// marks and prediction text, kept per page in localStorage. Without JS every
// phase shows and every reveal still works (they are <details>).
const LESSON_SCRIPT = `(function(){
  var root=document.querySelector('[data-lesson]'); if(!root) return;
  var html=document.documentElement, key='lesson:'+location.pathname, st={};
  try{st=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){}
  st.done=st.done||{}; st.p=st.p||{};
  function save(){try{localStorage.setItem(key,JSON.stringify(st))}catch(e){}}
  var phases=[].slice.call(root.querySelectorAll('.lesson-phase'));
  if(!phases.length) return;
  var rail=root.querySelector('.lesson-rail'), viewBtns=[].slice.call(root.querySelectorAll('.lesson-view-btn'));
  var paged=st.mode!=='all', cur=1;
  function phaseOf(hash){
    if(!hash) return 0; var m=/^#phase-(\\d+)$/.exec(hash); if(m) return +m[1];
    var el=document.getElementById(decodeURIComponent(hash.slice(1)));
    var p=el&&el.closest&&el.closest('.lesson-phase'); return p?+p.dataset.phase:0;
  }
  function mark(){
    [].forEach.call(root.querySelectorAll('.lesson-rail-item'),function(a){
      var k=+a.dataset.phaseLink; a.classList.toggle('is-current',k===cur);
      a.classList.toggle('is-done',!!st.done[k]);
      if(k===cur) a.setAttribute('aria-current','step'); else a.removeAttribute('aria-current');
    });
    [].forEach.call(root.querySelectorAll('.lesson-done'),function(b){
      var d=!!st.done[b.dataset.done]; b.setAttribute('aria-pressed',String(d));
      b.textContent=d?'Phase done':'Mark phase done';
    });
  }
  function show(n,scroll){
    cur=Math.min(Math.max(1,n),phases.length);
    phases.forEach(function(p){p.classList.toggle('is-current',+p.dataset.phase===cur)});
    st.cur=cur; save(); mark();
    if(scroll&&rail){var y=rail.getBoundingClientRect().top+window.scrollY-parseInt(getComputedStyle(html).getPropertyValue('--header-h')||72);
      if(window.scrollY>y) window.scrollTo(0,y);}
  }
  function setMode(p){
    paged=p; html.classList.toggle('lesson-paged',p);
    viewBtns.forEach(function(b){b.setAttribute('aria-pressed',String((b.dataset.view==='one')===p));});
    st.mode=p?'paged':'all'; save();
  }
  root.addEventListener('click',function(e){
    if(html.classList.contains('llm-review-annotating')) return;
    var a=e.target.closest&&e.target.closest('[data-phase-link]');
    if(a){ var n=+a.dataset.phaseLink;
      if(paged){e.preventDefault(); show(n,true); history.replaceState(null,'','#phase-'+n);}
      else { cur=n; mark(); }
      return; }
    var d=e.target.closest&&e.target.closest('.lesson-done');
    if(d){ var k=d.dataset.done; st.done[k]=!st.done[k]; save(); mark(); }
  });
  // Click a visual to see it full screen; click again or Esc to close.
  root.addEventListener('click',function(e){
    if(html.classList.contains('llm-review-annotating')) return;
    var f=e.target.closest&&e.target.closest('.lesson-figure');
    if(!f||e.target.closest('video,a,button,.viz-controls')) return;
    var z=f.classList.toggle('is-zoomed'); html.classList.toggle('lesson-zoomed',z);
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){var z=root.querySelector('.lesson-figure.is-zoomed'); if(z){z.classList.remove('is-zoomed');html.classList.remove('lesson-zoomed');}}
    if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('lesson-figure')){e.target.click();}
  });
  viewBtns.forEach(function(b){ b.addEventListener('click',function(){
    var p=b.dataset.view==='one'; if(p===paged) return;
    setMode(p); if(paged) show(cur,true);
    else { var el=document.getElementById('phase-'+cur); if(el) el.scrollIntoView(); }
  }); });
  [].forEach.call(root.querySelectorAll('.lesson-predict-input'),function(t){
    t.value=st.p[t.dataset.key]||'';
    t.addEventListener('input',function(){st.p[t.dataset.key]=t.value;save();});
  });
  document.addEventListener('keydown',function(e){
    if(!paged||html.classList.contains('lesson-zoomed')||e.altKey||e.ctrlKey||e.metaKey) return;
    var t=e.target; if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if(e.key==='ArrowRight'&&cur<phases.length){show(cur+1,true);history.replaceState(null,'','#phase-'+cur);}
    if(e.key==='ArrowLeft'&&cur>1){show(cur-1,true);history.replaceState(null,'','#phase-'+cur);}
  });
  window.addEventListener('hashchange',function(){var n=phaseOf(location.hash); if(n) show(n,false);});
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ if(paged) return;
      es.forEach(function(en){ if(en.isIntersecting){cur=+en.target.dataset.phase; mark();} });
    },{rootMargin:'-40% 0px -55% 0px'});
    phases.forEach(function(p){io.observe(p)});
  }
  setMode(paged);
  show(phaseOf(location.hash)||st.cur||1,false);
  var h=location.hash&&document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if(h&&!/^#phase-/.test(location.hash)) h.scrollIntoView();
})();`;

// ---------------------------------------------------------------------------
// 3c. Landing page (index.md)
// ---------------------------------------------------------------------------

// index.md stays the master catalog in Obsidian. On the site it opens as a
// landing page: a hero with the first paragraph as its lede, the "Start here"
// links as a path, and every small catalog table (12 rows or fewer, each row
// a link) as a grid of cards. Bigger tables stay tables, lower down.

// A page's first visual, for its card: a video poster, else its first diagram.
function cardMedia(dest, page) {
  const v = dest.body.match(/^\s*@video\[([a-z0-9][a-z0-9-]*)\]/m);
  if (v && mediaPosters.has(v[1])) {
    return `<img class="home-card-img" src="${relHref(page.outRel, "assets/media/" + v[1] + ".jpg")}" alt="" loading="lazy">`;
  }
  const im = dest.body.match(/^\s*@image\[([a-z0-9][a-z0-9-]*)\]/m);
  if (im && mediaImages.has(im[1])) {
    return `<img class="home-card-img" src="${relHref(page.outRel, "assets/media/" + mediaImages.get(im[1]))}" alt="" loading="lazy">`;
  }
  const fence = findMermaidFences(dest.body).find((f) => DIAGRAMS.has(f));
  return fence ? `<div class="home-card-svg" aria-hidden="true">${DIAGRAMS.get(fence)}</div>` : "";
}

function splitTitle(t) {
  let eyebrow = "", rest = t;
  const dash = t.indexOf(" — ");
  if (dash !== -1 && dash < 24) { eyebrow = t.slice(0, dash); rest = t.slice(dash + 3); }
  const colon = rest.indexOf(":");
  return colon !== -1 && colon < rest.length - 1
    ? { eyebrow, main: rest.slice(0, colon), sub: rest.slice(colon + 1).trim() }
    : { eyebrow, main: rest, sub: "" };
}

function renderCards(rows, header, page) {
  const cards = rows.map((cells) => {
    const li = cells.findIndex((c) => /\[\[/.test(c));
    const m = cells[li].match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/);
    let tgt = m[1].trim();
    if (tgt.startsWith("wiki/")) tgt = tgt.slice(5);
    const dest = byTarget.get(tgt);
    if (!dest) return null;
    const t = splitTitle(dest.title);
    const others = cells.map((c, k) => ({ c, h: header[k] || "", k })).filter((x) => x.k !== li && x.c);
    const short = others.find((x) => x.c.length <= 12 && !/\[\[/.test(x.c));
    const eyebrow = t.eyebrow || (short ? `${short.h} ${short.c}`.trim() : "");
    const type = TYPE_LABELS[dest.data.type] || (dest.data.type ? String(dest.data.type).toUpperCase() : "");
    const tags = others.find((x) => /^tags?$/i.test(x.h));
    const texts = others.filter((x) => x !== short && x !== tags && x.c.length > 12);
    const text = texts.length ? texts[texts.length - 1].c : "";
    const num = (eyebrow.match(/\d+/) || [""])[0];
    return {
      media: cardMedia(dest, page), num,
      html: (media) =>
        `<a class="home-card" href="${relHref(page.outRel, dest.outRel)}">` +
        (media !== null ? `<div class="home-card-media">${media || (num ? `<span class="home-card-num">${num.padStart(2, "0")}</span>` : "")}</div>` : "") +
        `<div class="home-card-body">` +
        `<div class="home-card-eyebrow">${escapeHtml([eyebrow, type].filter(Boolean).join(" · "))}</div>` +
        `<div class="home-card-title">${escapeHtml(t.main)}</div>` +
        (t.sub ? `<div class="home-card-sub">${escapeHtml(t.sub)}</div>` : "") +
        (text ? `<p class="home-card-text">${inline(text, page).replace(/<a [^>]*>|<\/a>/g, "")}</p>` : "") +
        (tags ? `<div class="home-card-tags">${tags.c.split(/,\s*/).slice(0, 4).map((x) => `<span>${escapeHtml(x)}</span>`).join("")}</div>` : "") +
        `</div></a>`,
    };
  }).filter(Boolean);
  // Show a media band only when some card in the grid has a real visual.
  const anyMedia = cards.some((c) => c.media);
  return `<div class="home-cards${anyMedia ? " has-media" : ""}">${cards.map((c) => c.html(anyMedia ? c.media : null)).join("")}</div>`;
}

function renderHome(page) {
  const lines = page.body.replace(/\r\n/g, "\n").split("\n");
  const base = page.lineBase;
  const secs = splitSections(lines);
  const at = (k) => ` data-line="${base + k + 1}"`;

  // Intro: H1, lede (first plain paragraph), the "Start here" path, anything else.
  let lede = "", path = [], introMd = "";
  for (const b of lessonBlocks({ ...secs[0], lines: secs[0].lines.map((l) => (/^#\s/.test(l) ? "" : l)) })) {
    const plain = b.text.replace(/^\s*>\s?/gm, "");
    if (/\*\*Start here:?\*\*/i.test(plain) && !path.length) {
      for (const m of plain.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g)) {
        const tgt = m[1].trim().replace(/^wiki\//, "");
        if (byTarget.has(tgt) && !path.includes(tgt)) path.push(tgt);
      }
    } else if (!lede && b.kind === "md" && !/^\s*[|>]/.test(b.lines[0])) {
      lede = `<p class="home-lede"${at(b.start)}>${inline(b.text.replace(/\n/g, " "), page)}</p>`;
    } else introMd += mdToHtml(b.text, page, base + b.start);
  }
  const first = path.length ? byTarget.get(path[0]) : null;
  const hero = `<header class="home-hero">
  <div class="hero-kicker">Knowledge base · ${pages.length} pages</div>
  <h1 class="home-title">${escapeHtml(CONFIG.title)}</h1>
  ${lede}
  ${first ? `<a class="ddc-btn home-start" href="${relHref(page.outRel, first.outRel)}"><span class="ddc-btn__fill" aria-hidden="true"></span>Start here ›</a>` : ""}
</header>`;
  const pathHtml = path.length > 1
    ? `<section class="home-section"><div class="home-section-head"><h2 class="home-h2" id="start-here">Start here</h2><span class="home-meta">${path.length} steps</span></div>` +
      `<ol class="home-path">${path.map((tgt, k) => {
        const d = byTarget.get(tgt);
        const t = splitTitle(d.title);
        const type = TYPE_LABELS[d.data.type] || (d.data.type ? String(d.data.type).toUpperCase() : "PAGE");
        return `<li><a href="${relHref(page.outRel, d.outRel)}"><span class="home-path-n">${String(k + 1).padStart(2, "0")}</span>` +
          `<span class="home-path-k">${escapeHtml(type)}</span><span class="home-path-t">${escapeHtml(t.main)}</span></a></li>`;
      }).join("")}</ol></section>`
    : "";

  const sections = secs.slice(1).map((sec) => {
    const id = headingId(sec.head);
    // Find the section's table, if any, and decide whether it becomes cards.
    const ti = sec.lines.findIndex((l, k) => /^\s*\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(sec.lines[k + 1] || ""));
    let tEnd = ti;
    if (ti !== -1) while (tEnd < sec.lines.length && /^\s*\|/.test(sec.lines[tEnd])) tEnd++;
    const rows = ti === -1 ? [] : sec.lines.slice(ti + 2, tEnd).map(splitRow);
    const cardable = rows.length > 0 && rows.length <= 12 && rows.every((r) => r.some((c) => /\[\[/.test(c)));
    const count = rows.length ? `${rows.length} ${rows.length === 1 ? "page" : "pages"}` : "";
    const head = `<div class="home-section-head"${at(sec.headLine)}><h2 class="home-h2" id="${id}">${inline(sec.head, page)}</h2>${count ? `<span class="home-meta">${count}</span>` : ""}</div>`;
    if (!cardable) {
      return `<section class="home-section home-catalog">${head}<div class="content-body">${mdToHtml(sec.lines.join("\n"), page, base + sec.start)}</div></section>`;
    }
    const before = sec.lines.slice(0, ti).join("\n");
    const after = sec.lines.slice(tEnd).join("\n");
    return `<section class="home-section">${head}` +
      (before.trim() ? `<div class="content-body home-intro">${mdToHtml(before, page, base + sec.start)}</div>` : "") +
      renderCards(rows, splitRow(sec.lines[ti]), page) +
      (after.trim() ? `<div class="content-body">${mdToHtml(after, page, base + sec.start + tEnd)}</div>` : "") +
      `</section>`;
  }).join("\n");

  return `<div class="home">
${hero}
${introMd ? `<div class="content-body home-intro">${introMd}</div>` : ""}
${pathHtml}
${sections}
</div>`;
}

// Index collapse: open by default on wide screens. Persist the reader's choice in
// localStorage under "sb" ("0" = collapsed). The head snippet runs before paint
// to set the class up front (no flash). Below 1024px the index is a drawer instead.
const SB_HEAD =
  `try{if(localStorage.getItem('sb')==='0')document.documentElement.classList.add('sidebar-collapsed')}catch(e){}`;

// Page script: the index toggle and drawer, remembered index groups, the index
// filter, the page actions menu, the markdown viewer, and "On this page"
// tracking the heading being read. Without JS the index groups and the inline
// "On this page" still open (they are <details>) and the links all work.
const PAGE_SCRIPT = `(function(){
  var d=document, r=d.documentElement, mq=window.matchMedia('(max-width:1023px)');
  function busy(){return r.classList.contains('llm-review-annotating');}

  // Index toggle: a drawer on narrow screens, a collapse on wide ones.
  var tb=d.querySelector('.sidebar-toggle');
  function sync(){ if(tb) tb.setAttribute('aria-expanded',String(mq.matches?r.classList.contains('index-open'):!r.classList.contains('sidebar-collapsed'))); }
  function drawer(o){ r.classList.toggle('index-open',o); sync(); }
  if(tb) tb.addEventListener('click',function(){
    if(mq.matches) drawer(!r.classList.contains('index-open'));
    else { var c=r.classList.toggle('sidebar-collapsed'); try{localStorage.setItem('sb',c?'0':'1')}catch(e){} sync(); }
  });
  if(mq.addEventListener) mq.addEventListener('change',function(){ drawer(false); });
  sync();

  // Index groups: remember which ones the reader opened, per wiki.
  var idx=d.getElementById('master-index'), q=d.getElementById('idx-q');
  if(idx){
    var key='idx-open:'+idx.dataset.site, open={};
    try{open=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){}
    var groups=[].slice.call(idx.querySelectorAll('.idx-group'));
    groups.forEach(function(g){
      if(open[g.dataset.group]) g.open=true;
      // Record the reader's clicks only, not the current page's group opening itself.
      g.querySelector('summary').addEventListener('click',function(){ setTimeout(function(){
        if(q&&q.value.trim()) return;
        if(g.open) open[g.dataset.group]=1; else delete open[g.dataset.group];
        try{localStorage.setItem(key,JSON.stringify(open))}catch(e){}
      },0); });
    });
    var cur=idx.querySelector('[aria-current="page"]');
    if(cur&&!mq.matches&&cur.offsetTop+cur.offsetHeight>idx.clientHeight) idx.scrollTop=cur.offsetTop-idx.clientHeight/2;
    // Filter: show matching titles only, with their groups open.
    var empty=idx.querySelector('.idx-empty'), saved=null;
    if(q) q.addEventListener('input',function(){
      var s=q.value.trim().toLowerCase(), any=false;
      if(s&&!saved) saved=groups.map(function(g){return g.open;});
      groups.forEach(function(g,i){
        var n=0;
        [].forEach.call(g.querySelectorAll('.index-item'),function(li){
          var hit=!s||li.querySelector('.title').textContent.toLowerCase().indexOf(s)!==-1;
          li.hidden=!hit; if(hit) n++;
        });
        g.hidden=!!s&&!n;
        if(s) g.open=n>0; else if(saved) g.open=saved[i];
        if(n) any=true;
      });
      if(!s) saved=null;
      if(empty) empty.hidden=any;
      if(s&&mq.matches) drawer(true);
    });
  }

  // Page actions.
  var more=d.querySelector('.split-more'), menu=d.getElementById('page-menu');
  function closeMenu(){ if(menu&&!menu.hidden){ menu.hidden=true; more.setAttribute('aria-expanded','false'); } }
  if(more) more.addEventListener('click',function(e){
    e.stopPropagation(); var o=menu.hidden; menu.hidden=!o; more.setAttribute('aria-expanded',String(o));
    if(o){ var f=menu.querySelector('button,a'); if(f) f.focus(); }
  });
  d.addEventListener('click',function(e){ if(menu&&!menu.contains(e.target)) closeMenu(); });

  var mdEl=d.getElementById('page-md'), md=null, dlg=d.getElementById('md-dialog'), toastEl, toastT;
  function source(){ if(md===null){ try{md=JSON.parse(mdEl.textContent)}catch(e){md='';} } return md; }
  function toast(m){
    if(!toastEl){ toastEl=d.createElement('div'); toastEl.className='toast'; toastEl.setAttribute('role','status'); d.body.appendChild(toastEl); }
    toastEl.textContent=m; toastEl.classList.add('show'); clearTimeout(toastT);
    toastT=setTimeout(function(){toastEl.classList.remove('show');},2400);
  }
  function copy(text,ok){
    function legacy(){
      var t=d.createElement('textarea'), done=false; t.value=text; t.setAttribute('readonly','');
      t.style.position='fixed'; t.style.opacity='0'; (dlg&&dlg.open?dlg:d.body).appendChild(t); t.select();
      try{done=d.execCommand('copy')}catch(e){} t.remove();
      toast(done?ok:'Copy was blocked. Use View as Markdown and select the text.');
    }
    if(navigator.clipboard&&window.isSecureContext) navigator.clipboard.writeText(text).then(function(){toast(ok);},legacy);
    else legacy();
  }
  d.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('[data-act]'); if(!a||busy()) return;
    var act=a.dataset.act; closeMenu();
    if(act==='copy'){
      copy(source(),'Copied the markdown for this page.');
      var l=d.querySelector('.split-label'); if(l){ l.textContent='Copied'; setTimeout(function(){l.textContent='Copy page';},1600); }
    } else if(act==='view'&&dlg){
      dlg.querySelector('.md-pre').textContent=source();
      if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open','');
    } else if(act==='close'&&dlg){
      if(dlg.close) dlg.close(); else dlg.removeAttribute('open');
    } else if(act==='link'){
      copy(location.href.split('#')[0],'Copied the link to this page.');
    } else if(act==='top'){
      window.scrollTo(0,0);
    } else if(act==='close-index'){
      drawer(false);
    }
  });
  if(dlg) dlg.addEventListener('click',function(e){ if(e.target===dlg&&dlg.close) dlg.close(); });

  // On this page: mark the heading being read.
  var links=[].slice.call(d.querySelectorAll('[data-toc]'));
  if(links.length){
    var seen={}, heads=[];
    links.forEach(function(a){ var id=a.dataset.toc; if(seen[id]) return; seen[id]=1; var h=d.getElementById(id); if(h) heads.push(h); });
    var hh=parseInt(getComputedStyle(r).getPropertyValue('--header-h'),10)||64, ticking=false;
    function spy(){
      ticking=false; if(!heads.length) return;
      var act=heads[0].id;
      for(var i=0;i<heads.length;i++){ if(heads[i].getBoundingClientRect().top<hh+96) act=heads[i].id; else break; }
      if(window.innerHeight+window.scrollY>=r.scrollHeight-4) act=heads[heads.length-1].id;
      links.forEach(function(a){ var on=a.dataset.toc===act; a.classList.toggle('is-active',on);
        if(on) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
    }
    window.addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(spy); } },{passive:true});
    spy();
    var inl=d.querySelector('.toc-inline');
    if(inl) inl.addEventListener('click',function(e){ if(e.target.closest('a')) inl.open=false; });
  }

  d.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      closeMenu();
      if(r.classList.contains('index-open')) drawer(false);
      if(q&&d.activeElement===q&&q.value){ q.value=''; q.dispatchEvent(new Event('input')); }
    }
    if(e.key==='/'&&q&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      var t=e.target; if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault(); q.focus();
    }
  });
})();`;

function renderPage(page) {
  // Timecode popovers: if this page names a transcript, resolve it and build the
  // timecode index so inline() can turn @[MM:SS] tokens into popover pills.
  page._tcSrc = new Map();
  page._tcUsed = new Map();
  page._vizUsed = new Set();
  const tcTarget = page.data.transcript;
  page._tcDefault = tcTarget && tcSource(page, tcTarget) ? tcTarget : null;
  page._tc = page._tcDefault ? tcSource(page, page._tcDefault) : null;

  const isHome = page.target === "index";
  const isLesson = page.data.type === "lesson";
  const lesson = isLesson ? renderLesson(page) : null;
  let bodyHtml = isHome ? renderHome(page) : isLesson ? lesson.html : mdToHtml(page.body, page, page.lineBase);
  // A body that opens with the page title as its H1 repeats the page head; drop
  // it. Anything the H1 adds after the title ("Limb — `DDC_Moted_MR_Limb`")
  // moves into the head as its subtitle.
  let heroSub = "";
  if (!isHome && !isLesson) {
    const t = escapeHtml(page.title);
    bodyHtml = bodyHtml.replace(/^\s*<h1 [^>]*>([\s\S]*?)<\/h1>/, (h1, inner) => {
      inner = inner.trim();
      if (inner.replace(/<[^>]+>/g, "").trim() === t) return "";
      const rest = inner.slice(t.length);
      if (inner.startsWith(t) && /^(\s*[—–:-]\s*|\s)/.test(rest) && !page.title.includes(":")) {
        heroSub = rest.replace(/^\s*[—–:-]?\s*/, "");
        return "";
      }
      return h1;
    });
  }
  // "On this page" for ordinary pages with two or more sections. Lessons have
  // their phase rail; the landing page is its own map.
  const toc = !isHome && !isLesson ? tocItems(bodyHtml) : [];
  const hasToc = toc.length >= 2;

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
  <div class="entry-shell${hasToc ? " has-toc" : ""}">
    ${renderSidebar(page)}
    <div class="idx-scrim" data-act="close-index"></div>
    <main class="entry-main${isHome ? " is-home" : ""}${isLesson ? " is-lesson" : ""}">
      <div class="page-col${isHome || isLesson ? " is-wide" : ""}">
      ${isHome ? bodyHtml : isLesson ? `${renderHero(page, lesson)}
      ${bodyHtml}
      ${tcData}` : `${renderHero(page, null, heroSub)}
      <article class="article-container">
        ${renderMeta(page)}
        ${hasToc ? `<details class="toc-inline"><summary>On this page<span class="chev" aria-hidden="true"></span></summary>${tocList(toc)}</details>` : ""}
        ${vizBlock}
        <section class="content-body">
${bodyHtml}
        </section>
        ${tcData}
      </article>`}
      ${isHome ? "" : renderPager(page)}
      <footer class="entry-footer">
        <div>${escapeHtml(CONFIG.footer)}</div>
        <div class="entry-source">source: ${escapeHtml(PROVENANCE.source)} · built ${PROVENANCE.builtAt.slice(0, 10)}</div>
      </footer>
      </div>
    </main>
    ${hasToc ? `<aside class="page-toc" aria-label="On this page">
      <div class="toc-label">On this page</div>
      ${tocList(toc)}
      <div class="toc-tools"><button type="button" data-act="top"><span>Back to top</span><span aria-hidden="true">↑</span></button><button type="button" data-act="view"><span>View as Markdown</span><span aria-hidden="true">›</span></button></div>
    </aside>` : ""}
  </div>
</div>
${isHome ? "" : `<dialog class="md-dialog" id="md-dialog" aria-label="Markdown source">
  <div class="md-head"><span class="md-path">${escapeHtml(page.srcRel)}</span><button type="button" data-act="copy">Copy</button><button type="button" data-act="close">Close</button></div>
  <pre class="md-pre"></pre>
</dialog>
<script type="application/json" id="page-md">${JSON.stringify(page.raw).replace(/</g, "\\u003c")}</script>`}
${vizScripts}
${tcScript}
${isLesson ? `<script>${LESSON_SCRIPT}</script>` : ""}
<script>${PAGE_SCRIPT}</script>
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
  --page-margin:16px;--header-h:64px;--touch-target:48px;
  --index-w:272px;--toc-w:224px;--read-w:760px;
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

/* Layout: three columns. The master index on the left, one reading column, and
   "On this page" on the right. Below 1280px the right column folds into a
   dropdown above the content; below 1024px the index becomes a drawer. */
.chev{display:inline-block;flex:none;width:8px;height:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;
  transform:rotate(45deg) translate(-2px,-2px);transition:transform .2s ease}
.ico{width:14px;height:14px;flex:none}

/* Header */
.site-header{display:flex;align-items:center;gap:16px;
  height:var(--header-h);padding:0 var(--page-margin);position:sticky;top:0;z-index:40;
  background:rgba(7,7,9,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--color-border)}
.header-left{display:flex;align-items:center;gap:16px;min-width:0}
.brand-mark{text-decoration:none;color:var(--color-text);min-width:0;display:inline-flex;align-items:center;min-height:var(--touch-target)}
.brand-name,.brand-short{font-family:var(--font-display);font-weight:700;text-transform:uppercase;white-space:nowrap;font-size:14px;line-height:24px}
.brand-name{overflow:hidden;text-overflow:ellipsis}
.brand-short{display:none}
@media(min-width:768px){.brand-name{font-size:18px;line-height:24px}}
@media(max-width:479px){.brand-name{display:none}.brand-short{display:inline}}
.idx-search{margin-left:auto;display:flex;align-items:center;gap:10px;height:40px;width:min(280px,40vw);padding:0 12px;
  border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface);color:var(--color-nav);cursor:text}
.idx-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--color-text);font-family:var(--font-body);font-size:14px}
.idx-search input::placeholder{color:var(--color-nav)}
.idx-search input::-webkit-search-cancel-button{filter:invert(1) brightness(.6)}
.idx-search:focus-within{border-color:var(--color-border-strong)}
.idx-search kbd{font-family:var(--font-mono);font-size:11px;line-height:18px;color:var(--color-nav);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0 6px}
@media(max-width:599px){.idx-search{width:auto;flex:0 1 160px}.idx-search kbd{display:none}}
.sidebar-toggle{flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;
  padding:0;background:transparent;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);cursor:pointer;transition:border-color .2s}
.sb-icon,.sb-icon::before,.sb-icon::after{display:block;width:16px;height:2px;background:var(--color-secondary);transition:background .2s}
.sb-icon{position:relative}
.sb-icon::before,.sb-icon::after{content:"";position:absolute;left:0}
.sb-icon::before{top:-5px}.sb-icon::after{top:5px}
@media(hover:hover){
  .sidebar-toggle:hover{border-color:var(--color-text)}
  .sidebar-toggle:hover .sb-icon,.sidebar-toggle:hover .sb-icon::before,.sidebar-toggle:hover .sb-icon::after{background:var(--color-text)}
}

/* Shell */
.entry-shell{display:grid;grid-template-columns:var(--index-w) minmax(0,1fr);min-height:calc(100vh - var(--header-h));align-items:start}
.entry-shell.has-toc{grid-template-columns:var(--index-w) minmax(0,1fr) var(--toc-w)}
.entry-main{min-width:0;padding:40px var(--page-margin) 0}
.page-col{max-width:var(--read-w);margin:0 auto}
.page-col.is-wide{max-width:1280px;margin:0}
/* Index collapsed (reader toggled it shut; open by default) */
html.sidebar-collapsed .field-logs{display:none}
html.sidebar-collapsed .entry-shell{grid-template-columns:minmax(0,1fr)}
html.sidebar-collapsed .entry-shell.has-toc{grid-template-columns:minmax(0,1fr) var(--toc-w)}

/* Master index: collapsible groups */
.field-logs{position:sticky;top:var(--header-h);height:calc(100vh - var(--header-h));overflow-y:auto;scrollbar-width:thin;
  border-right:1px solid var(--color-border);padding:24px 16px 32px;display:flex;flex-direction:column;gap:16px}
.idx-head{display:flex;justify-content:space-between;align-items:center;padding:0 8px 16px}
.field-logs .brand,.idx-total{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none}
.field-logs .brand{color:var(--color-secondary)}
.idx-total{color:var(--color-muted)}
.idx-groups{flex:1}
.idx-group{border-top:1px solid var(--color-border)}
.idx-group:last-child{border-bottom:1px solid var(--color-border)}
.idx-group-label{list-style:none;display:flex;align-items:center;gap:10px;min-height:44px;padding:0 8px;cursor:pointer;
  font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-secondary)}
.idx-group-label::-webkit-details-marker{display:none}
.idx-group-label .chev{transform:rotate(-45deg);color:var(--color-nav);margin-right:2px}
.idx-group[open]>.idx-group-label{color:var(--color-text)}
.idx-group[open]>.idx-group-label .chev{transform:rotate(45deg) translate(-2px,-2px)}
.idx-group-name{flex:1}
.idx-count{font-weight:400;color:var(--color-muted)}
.index-list{list-style:none;margin:0;padding:0 0 12px}
.index-link{display:flex;gap:10px;align-items:baseline;padding:7px 8px;border-radius:var(--radius-sm);text-decoration:none;
  color:var(--color-secondary);font-family:var(--font-body);font-size:14px;line-height:20px}
.index-link .num{flex:none;width:36px;font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;color:var(--color-muted);font-variant-numeric:tabular-nums}
.index-link .num::before{content:"["}.index-link .num::after{content:"]"}
.index-link[aria-current="page"]{background:var(--color-surface-raised);color:var(--color-text);font-weight:600}
.index-link[aria-current="page"] .num{color:var(--color-text)}
.idx-empty{margin:0;padding:12px 8px;color:var(--color-nav);font-family:var(--font-body);font-size:14px}
.status-footer{padding:0 8px;font-family:var(--font-mono);font-weight:700;font-size:10px;line-height:16px;letter-spacing:.2em;color:var(--color-muted);text-transform:uppercase}
.idx-scrim{display:none}
@media(hover:hover){
  .field-logs .brand:hover,.idx-group-label:hover{color:var(--color-text)}
  .index-link:not([aria-current]):hover{color:var(--color-text);background:var(--color-surface)}
}

/* Page head: breadcrumb, the page's one accent on the kicker, title, actions */
.hero{padding:0 0 8px}
.crumbs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px;font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;
  letter-spacing:.14em;text-transform:uppercase;color:var(--color-nav)}
.crumbs a{text-decoration:none}
.crumbs .sep{color:var(--color-muted)}
.crumbs .here{color:var(--color-secondary)}
@media(hover:hover){.crumbs a:hover{color:var(--color-text)}}
.hero-kicker{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.3em;text-transform:uppercase;
  color:var(--color-accent);margin-bottom:24px}
.hero .hero-kicker{margin-bottom:12px}
.headline{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.02em;line-height:1;
  font-size:clamp(34px,4.6vw,60px);margin:0;color:var(--color-text);text-wrap:balance;overflow-wrap:anywhere}
.headline-sub{display:block;margin-top:16px;font-family:var(--font-body);font-weight:400;text-transform:none;letter-spacing:0;
  font-size:22px;line-height:1.4;color:var(--color-secondary)}
.headline-sub code{font-family:var(--font-mono);font-size:.8em;background:var(--color-surface-raised);padding:2px 6px;border-radius:var(--radius-sm);color:var(--color-text)}

/* Page actions: "Copy page ▾" */
.page-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:24px}
.split{position:relative;display:inline-flex;border:1px solid var(--color-border-strong);border-radius:var(--radius-md)}
.split>button{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;background:none;border:0;cursor:pointer;color:var(--color-text);
  font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase}
.split>button+button{border-left:1px solid var(--color-border-strong);padding:0 12px}
.split-more .chev{color:var(--color-secondary)}
.split-more[aria-expanded="true"] .chev{transform:rotate(-135deg) translate(-2px,-2px)}
.page-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:50;width:max-content;min-width:260px;max-width:min(360px,calc(100vw - 32px));padding:6px;
  background:var(--color-surface);border:1px solid var(--color-border-strong);border-radius:var(--radius-md)}
.page-menu[hidden]{display:none}
.page-menu button,.page-menu a{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;background:none;border-radius:var(--radius-sm);
  cursor:pointer;text-align:left;text-decoration:none;color:var(--color-text);font-family:var(--font-body);font-size:14px;line-height:20px}
.menu-sub{display:block;color:var(--color-nav);font-size:12px;line-height:16px;overflow-wrap:anywhere}
.menu-ext{margin-left:auto;color:var(--color-nav)}
.page-menu hr{border:0;border-top:1px solid var(--color-border);margin:6px 0}
@media(hover:hover){.split>button:hover,.page-menu button:hover,.page-menu a:hover{background:var(--color-surface-raised)}}

/* Article: the reading column */
.article-container{padding:24px 0 0}
.article-meta{font-family:var(--font-mono);font-size:12px;line-height:16px;color:var(--color-muted);text-transform:uppercase;font-weight:700;
  letter-spacing:.2em;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px;margin-bottom:24px;
  padding:16px 0;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border)}
@media(min-width:768px){.article-meta{grid-template-columns:repeat(4,minmax(0,1fr))}}
.article-meta span{display:flex;flex-direction:column;gap:4px;min-width:0}
.article-meta b{color:var(--color-text);font-weight:400;letter-spacing:0;text-transform:none;font-size:14px;line-height:24px;overflow-wrap:anywhere}

.content-body{font-family:var(--font-body);font-size:18px;line-height:1.7;color:var(--color-text)}
@media(max-width:767px){.content-body{font-size:16px;line-height:1.6}}
.content-body p{margin:0 0 1em}
.article-container .content-body>.h2:first-child{margin-top:40px}
.content-body .h1,.content-body .h2,.content-body .h3,.lesson-phase-title{scroll-margin-top:calc(var(--header-h) + 24px)}

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

/* On this page: the right column, or a dropdown above the content when narrower */
.page-toc{position:sticky;top:var(--header-h);height:calc(100vh - var(--header-h));overflow-y:auto;scrollbar-width:thin;padding:40px 24px 32px 8px}
.toc-label,.toc-tools button,.toc-inline>summary{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase}
.toc-label{color:var(--color-secondary);margin-bottom:16px}
.toc-list{list-style:none;margin:0;padding:0;border-left:1px solid var(--color-border)}
.toc-list a{display:block;margin-left:-1px;padding:6px 0 6px 14px;border-left:1px solid transparent;text-decoration:none;
  color:var(--color-nav);font-family:var(--font-body);font-size:14px;line-height:20px;transition:color .15s,border-color .15s}
.toc-list a.toc-h3{padding-left:28px;font-size:13px}
.toc-list a.is-active{color:var(--color-text);border-left-color:var(--color-text)}
.toc-tools{display:flex;flex-direction:column;gap:4px;margin-top:24px;padding-top:16px;border-top:1px solid var(--color-border)}
.toc-tools button{display:flex;justify-content:space-between;background:none;border:0;padding:6px 0;cursor:pointer;color:var(--color-nav)}
.toc-inline{display:none;margin:0 0 8px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-surface)}
.toc-inline>summary{list-style:none;display:flex;align-items:center;gap:10px;min-height:48px;padding:0 16px;cursor:pointer;color:var(--color-secondary)}
.toc-inline>summary::-webkit-details-marker{display:none}
.toc-inline>summary .chev{margin-left:auto}
.toc-inline[open]>summary .chev{transform:rotate(-135deg) translate(-2px,-2px)}
.toc-inline .toc-list{margin:0 16px 16px}
@media(hover:hover){.toc-list a:not(.is-active):hover{color:var(--color-secondary)}.toc-tools button:hover{color:var(--color-text)}}

/* Previous / next */
.pager{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:80px}
.pager-link{display:flex;flex-direction:column;gap:8px;padding:20px;border:1px solid var(--color-border);border-radius:var(--radius-lg);
  text-decoration:none;min-width:0;transition:border-color .2s,background .2s}
.pager-link.next{grid-column:2;text-align:right}
.pager-k,.pager-s{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-nav)}
.pager-s{color:var(--color-muted)}
.pager-t{font-family:var(--font-display);font-weight:600;font-size:18px;line-height:24px;color:var(--color-text);overflow-wrap:anywhere}
@media(max-width:599px){.pager{grid-template-columns:minmax(0,1fr)}.pager-link.next{grid-column:1}}
@media(hover:hover){.pager-link:hover{border-color:var(--color-border-strong);background:var(--color-surface)}}

/* Footer */
.entry-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 24px;margin-top:48px;padding:24px 0 64px;border-top:1px solid var(--color-border);
  font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;color:var(--color-muted);text-transform:uppercase}
.entry-source{font-weight:400;font-size:10px;letter-spacing:.1em;color:var(--color-muted);word-break:break-all}

/* Markdown viewer */
.md-dialog{width:min(820px,calc(100vw - 32px));max-height:min(80vh,900px);padding:0;border:1px solid var(--color-border-strong);border-radius:var(--radius-lg);
  background:var(--color-surface);color:var(--color-text)}
.md-dialog::backdrop{background:rgba(7,7,9,.7)}
.md-head{position:sticky;top:0;display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--color-border);background:var(--color-surface)}
.md-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-secondary);font-family:var(--font-mono);font-size:12px}
.md-head button{height:32px;padding:0 12px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);background:none;cursor:pointer;color:var(--color-text);
  font-family:var(--font-mono);font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.md-pre{margin:0;padding:20px;font-family:var(--font-mono);font-size:12.5px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--color-secondary)}
@media(hover:hover){.md-head button:hover{background:var(--color-surface-raised)}}

/* Toast (copy confirmations) */
.toast{position:fixed;left:50%;bottom:24px;z-index:80;transform:translate(-50%,16px);opacity:0;pointer-events:none;max-width:calc(100vw - 32px);
  padding:12px 16px;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);background:var(--color-surface-raised);
  font-family:var(--font-body);font-size:14px;line-height:20px;color:var(--color-text);transition:opacity .2s,transform .2s ease}
.toast.show{opacity:1;transform:translate(-50%,0)}

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

/* 1024-1279: index + page; "On this page" folds into a dropdown */
@media(max-width:1279px){
  .entry-shell.has-toc{grid-template-columns:var(--index-w) minmax(0,1fr)}
  html.sidebar-collapsed .entry-shell.has-toc{grid-template-columns:minmax(0,1fr)}
  .page-toc{display:none}
  .toc-inline{display:block}
}
/* Below 1024: the index is a drawer, opened from the header button */
@media(max-width:1023px){
  .entry-shell,.entry-shell.has-toc,html.sidebar-collapsed .entry-shell.has-toc{grid-template-columns:minmax(0,1fr)}
  .entry-main{padding-top:24px}
  .field-logs,html.sidebar-collapsed .field-logs{display:flex;position:fixed;left:0;top:var(--header-h);bottom:0;height:auto;width:min(320px,86vw);z-index:35;
    background:var(--color-bg);transform:translateX(-100%);visibility:hidden;transition:transform .25s ease,visibility .25s}
  html.index-open .field-logs{transform:none;visibility:visible}
  html.index-open .idx-scrim{display:block;position:fixed;inset:var(--header-h) 0 0 0;z-index:30;background:rgba(7,7,9,.6)}
}
@media(prefers-reduced-motion:reduce){.chev,.field-logs,.toc-list a,.pager-link,.toast{transition:none}}

/* ---- Interactive visualizations ---- */
.viz-block{margin:0 0 48px}
.video-block{margin:0 0 48px}
.video-block .video{display:block;width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-md)}
.diagram-block{margin:0 0 48px}
.diagram-block svg{display:block;max-width:100%;height:auto;margin:0 auto}
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

/* ---- Stills (@image) ---- */
.image-block{margin:0 0 48px}
.image-block .still{display:block;width:100%;height:auto;border-radius:var(--radius-md)}

/* ---- Lesson layout (type: lesson) ---- */
.lesson{max-width:1280px;padding:32px 0 0}
.lesson-label{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-secondary);margin:0 0 8px}
.lesson-brief{display:flex;flex-direction:column;gap:16px;max-width:1040px;margin-bottom:48px}
.lesson-brief-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
@media(min-width:768px){.lesson-brief-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.lesson-brief-card,.lesson-open{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:24px}
.lesson-brief-card p{margin:0;font-family:var(--font-body);font-size:18px;line-height:1.6}
.lesson-open-list{list-style:none;margin:0;padding:0;font-family:var(--font-body);font-size:15px;line-height:1.5;color:var(--color-secondary)}
.lesson-open-list li{padding:8px 0;border-top:1px solid var(--color-border)}
.lesson-open-list li:first-child{border-top:none;padding-top:0}
.lesson-open-list code,.lesson-brief code{font-family:var(--font-mono);font-size:.85em;background:var(--color-surface-raised);padding:2px 4px;border-radius:var(--radius-sm);color:var(--color-text)}

/* Phase rail: one bar per phase, its width the phase's time budget */
.lesson-rail{position:sticky;top:var(--header-h);z-index:15;background:var(--color-bg);border-bottom:1px solid var(--color-border);
  display:flex;align-items:flex-start;gap:32px;padding:16px 0;margin-bottom:8px}
.lesson-rail-track{display:flex;gap:8px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
.lesson-rail-item{display:flex;flex-direction:column;gap:8px;min-width:132px;padding:0 0 4px;text-decoration:none;color:var(--color-secondary);transition:color .2s}
.lesson-rail-bar{height:4px;border-radius:2px;background:var(--color-border-strong);transition:background .2s}
.lesson-rail-k{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;color:var(--color-nav)}
.lesson-rail-t{font-family:var(--font-body);font-size:14px;line-height:20px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lesson-rail-item.is-done .lesson-rail-bar{background:var(--color-secondary)}
.lesson-rail-item.is-current{color:var(--color-text)}
.lesson-rail-item.is-current .lesson-rail-k{color:var(--color-text)}
.lesson-rail-item.is-current .lesson-rail-bar{background:var(--color-text)}
.lesson-rail-tools{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex:none}
.lesson-rail-total{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;color:var(--color-secondary);white-space:nowrap}
.lesson-view{display:inline-flex;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);overflow:hidden}
.lesson-view-btn{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.15em;text-transform:uppercase;
  color:var(--color-secondary);background:transparent;border:none;min-height:40px;padding:8px 14px;cursor:pointer;white-space:nowrap;transition:background .2s,color .2s}
.lesson-view-btn+.lesson-view-btn{border-left:1px solid var(--color-border-strong)}
.lesson-view-btn[aria-pressed="true"]{background:var(--color-text);color:var(--color-bg);cursor:default}
.lesson-done{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--color-text);background:transparent;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);
  min-height:40px;padding:8px 16px;cursor:pointer;white-space:nowrap;transition:border-color .2s,background .2s,color .2s}
.lesson-done[aria-pressed="true"]{background:var(--color-text);color:var(--color-bg);border-color:var(--color-text)}
@media(max-width:767px){.lesson-rail{flex-direction:column;align-items:stretch;gap:12px}.lesson-rail-tools{flex-direction:row;justify-content:space-between;align-items:center}}
@media(hover:hover){
  .lesson-rail-item:not(.is-current):hover{color:var(--color-text)}
  .lesson-view-btn[aria-pressed="false"]:hover{color:var(--color-text)}
  .lesson-done:hover{border-color:var(--color-text)}
}
/* All phases on one page: the pager has nothing to do */
html:not(.lesson-paged) .lesson-pager{display:none}

/* Why this phase: the lead of every phase */
.lesson-why{margin:0 0 32px;padding:24px 0;border-top:1px solid var(--color-border-strong);border-bottom:1px solid var(--color-border)}
.lesson-why p{font-size:19px;line-height:1.6}
.lesson-why p:last-child{margin-bottom:0}
.lesson-open-md p{margin:0 0 8px;font-size:16px;line-height:1.5}
.lesson-open-md ul{margin:0;padding-left:1.2em;font-family:var(--font-body);font-size:15px;line-height:1.6;color:var(--color-secondary)}
.lesson-open-md li{margin:0 0 4px}

/* A screenshot not taken yet: shown in review mode only */
.image-wanted{display:none;margin:0 0 24px}
html.llm-review .image-wanted{display:block}
.image-wanted-box{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:200px;padding:24px;text-align:center;
  border:1px dashed var(--color-border-strong);border-radius:var(--radius-lg)}
.image-wanted-label{font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-text)}
.image-wanted-cap{font-family:var(--font-mono);font-size:13px;line-height:20px;color:var(--color-secondary);max-width:40ch}

/* Phases. Paged mode (set by the script) shows the current one only. */
html.lesson-paged .lesson-phase:not(.is-current){display:none}
.lesson-phases.content-body{font-size:17px}
.lesson-phase{padding-top:40px;scroll-margin-top:calc(var(--header-h) + 80px)}
.lesson-phase-head{margin-bottom:32px}
.lesson-phase-kicker{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-secondary);margin-bottom:12px}
.content-body .lesson-phase-title{font-family:var(--font-display);font-weight:600;font-size:clamp(26px,3.2vw,40px);line-height:1.15;margin:0;padding:0;border:none;text-wrap:balance}
.content-body .lesson-phase-title code{font-size:.85em;background:none;padding:0}
.lesson-figure{cursor:zoom-in}
.lesson-figure.is-zoomed{position:fixed;inset:0;z-index:70;margin:0;padding:32px var(--page-margin);background:var(--color-bg);
  display:flex;flex-direction:column;justify-content:center;overflow:auto;cursor:zoom-out}
.lesson-figure.is-zoomed .diagram-block svg{width:100%;height:auto;max-width:none!important;max-height:calc(100vh - 160px)}
.lesson-figure.is-zoomed .viz{max-width:1600px;width:100%;margin:0 auto}
.lesson-figure.is-zoomed .lesson-figure-title,.lesson-figure.is-zoomed .lesson-figure-caption{max-width:1600px;width:100%;margin-left:auto;margin-right:auto}
.lesson-phase-grid{display:flex;flex-direction:column;gap:32px}
.lesson-visual{order:-1;min-width:0}
.lesson-phase-grid.no-visual .lesson-visual{display:none}
.lesson-visual-empty{display:none}
html.llm-review .lesson-phase-grid.no-visual .lesson-visual{display:block}
html.llm-review .lesson-visual-empty{display:flex;align-items:center;justify-content:center;min-height:200px;border:1px dashed var(--color-border-strong);
  border-radius:var(--radius-lg);font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-nav)}
@media(min-width:1280px){
  .lesson-phase-grid.has-visual,html.llm-review .lesson-phase-grid.no-visual{display:grid;grid-template-columns:minmax(0,680px) minmax(0,1fr);gap:48px;align-items:start}
  .lesson-visual{order:0;position:sticky;top:calc(var(--header-h) + 96px)}
}
.lesson-flow{min-width:0;max-width:720px}
.lesson-figure{margin:0 0 24px}
.lesson-figure .diagram-block,.lesson-figure .video-block,.lesson-figure .image-block,.lesson-figure .viz-block{margin:0}
.lesson-figure-title{font-family:var(--font-mono);font-weight:700;font-size:12px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-text);margin-bottom:12px}
.lesson-figure-caption{font-family:var(--font-mono);font-size:13px;line-height:20px;color:var(--color-secondary);padding:12px 8px 0}

/* Steps: the source numbers, kept across splits */
.content-body ol.lesson-steps{list-style:none;padding:0;margin:0 0 24px;counter-reset:step var(--start,0)}
.content-body ol.lesson-steps>li{counter-increment:step;position:relative;padding:16px 0 16px 56px;margin:0;border-top:1px solid var(--color-border)}
.content-body ol.lesson-steps>li::before{content:counter(step,decimal-leading-zero);position:absolute;left:0;top:16px;
  font-family:var(--font-mono);font-weight:700;font-size:13px;line-height:1.7;letter-spacing:.05em;color:var(--color-secondary)}
.content-body ol.lesson-steps>li>ul{margin:8px 0 0}

/* Cards in the flow */
.lesson-ask,.lesson-predict,.lesson-read,.lesson-trap{border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:24px;margin:0 0 24px;background:var(--color-surface)}
.lesson-q{font-family:var(--font-display);font-weight:600;font-size:20px;line-height:1.4;margin:0}
.lesson-q code{font-family:var(--font-mono)}
.lesson-ask p:last-child,.lesson-read p:last-child,.lesson-trap p:last-child,.lesson-reveal-body p:last-child{margin-bottom:0}
.lesson-reveal{margin-top:16px}
.lesson-reveal>summary,.lesson-read>summary{list-style:none;display:inline-flex;align-items:center;min-height:var(--touch-target);padding:0 16px;
  border:1px solid var(--color-border-strong);border-radius:var(--radius-md);cursor:pointer;
  font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-text);transition:background .2s,color .2s,border-color .2s}
.lesson-reveal>summary::-webkit-details-marker,.lesson-read>summary::-webkit-details-marker{display:none}
.lesson-reveal>summary::after,.lesson-read>summary::after{content:" \\203A";margin-left:8px}
.lesson-reveal[open]>summary,.lesson-read[open]>summary{border-color:var(--color-border);color:var(--color-nav)}
.lesson-reveal[open]>summary::after,.lesson-read[open]>summary::after{content:""}
.lesson-reveal-body{margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border)}
.lesson-read:not(.is-open){background:transparent;border-style:dashed;border-color:var(--color-border-strong)}
.lesson-read{border-color:var(--color-border-strong)}
.lesson-predict-input{display:block;width:100%;margin-top:16px;padding:12px 16px;background:var(--color-bg);color:var(--color-text);
  border:1px solid var(--color-border-strong);border-radius:var(--radius-md);font-family:var(--font-body);font-size:16px;line-height:1.5;resize:vertical}
.lesson-predict-input::placeholder{color:var(--color-nav)}
.lesson-trap{background:var(--color-surface-raised);border-color:var(--color-border-strong)}
.lesson-trap .lesson-label{color:var(--color-text)}
.lesson-remember{margin:32px 0;padding:24px 0;border-top:1px solid var(--color-border-strong);border-bottom:1px solid var(--color-border-strong)}
.lesson-remember p{font-family:var(--font-display);font-weight:600;font-size:24px;line-height:1.4;margin:0}
@media(hover:hover){
  .lesson-reveal>summary:hover,.lesson-read>summary:hover{background:var(--color-text);color:var(--color-bg);border-color:var(--color-text)}
}
@media(prefers-reduced-motion:reduce){.lesson-rail-item,.lesson-rail-bar,.lesson-view-btn,.lesson-done,.lesson-reveal>summary,.lesson-read>summary{transition:none}}

.lesson-phase-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-top:32px;padding:24px 0;border-top:1px solid var(--color-border)}
.lesson-pager{display:flex;flex-wrap:wrap;align-items:center;gap:24px}
.lesson-prev{font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-nav);text-decoration:none;min-height:var(--touch-target);display:inline-flex;align-items:center}
@media(hover:hover){.lesson-prev:hover{color:var(--color-text)}}
.lesson-pager .ddc-btn{max-width:100%;white-space:normal;text-align:left}
.lesson-tail{max-width:720px;padding-top:48px}

/* ---- Landing page (index.md) ---- */
.home{max-width:1280px;padding:0 0 32px}
.home-hero{padding:24px 0 48px;border-bottom:1px solid var(--color-border)}
@media(min-width:768px){.home-hero{padding:56px 0 64px}}
.home-title{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.02em;line-height:1;
  font-size:clamp(40px,6.4vw,96px);margin:0;text-wrap:balance;overflow-wrap:anywhere}
.home-lede{font-family:var(--font-body);font-size:20px;line-height:1.6;color:var(--color-secondary);max-width:720px;margin:24px 0 32px}
.home-lede strong{color:var(--color-text);font-weight:600}
.home-intro{max-width:720px;margin-top:24px}
.home-section{margin-top:64px}
@media(min-width:768px){.home-section{margin-top:96px}}
.home-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding-bottom:16px;margin-bottom:24px;border-bottom:1px solid var(--color-border)}
.home-h2{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.02em;line-height:1;font-size:clamp(24px,3vw,40px);margin:0;scroll-margin-top:calc(var(--header-h) + 16px)}
.home-meta{font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-secondary);white-space:nowrap}
.home-path{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.home-path a{display:flex;flex-direction:column;gap:8px;height:100%;padding:24px;text-decoration:none;color:var(--color-text);
  background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);transition:border-color .2s}
.home-path-n{font-family:var(--font-mono);font-weight:700;font-size:12px;letter-spacing:.1em;color:var(--color-secondary)}
.home-path-k{font-family:var(--font-mono);font-weight:700;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-nav)}
.home-path-t{font-family:var(--font-display);font-weight:600;font-size:20px;line-height:1.3}
.home-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
@media(min-width:1024px){.home-cards{gap:24px}}
.home-card{display:flex;flex-direction:column;text-decoration:none;color:var(--color-text);background:var(--color-surface);
  border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;transition:border-color .2s}
.home-card-media{aspect-ratio:16/9;margin:8px 8px 0;border-radius:var(--radius-md);background:var(--color-bg);overflow:hidden;
  display:flex;align-items:center;justify-content:center}
.home-card-img{display:block;width:100%;height:100%;object-fit:cover;filter:grayscale(1);transition:filter .3s}
.home-card-svg{width:100%;height:100%;padding:12px;display:flex}
.home-card-svg svg{width:100%!important;height:100%!important;max-width:none!important}
.home-card-num{font-family:var(--font-display);font-weight:800;font-size:72px;line-height:1;letter-spacing:-.02em;color:var(--color-muted);transition:color .2s}
.home-card-body{display:flex;flex-direction:column;gap:8px;padding:16px 20px 24px}
.home-card-eyebrow{font-family:var(--font-mono);font-weight:700;font-size:11px;line-height:16px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-secondary)}
.home-card-title{font-family:var(--font-display);font-weight:600;font-size:20px;line-height:1.3}
.home-card-sub{font-family:var(--font-body);font-size:15px;line-height:1.4;color:var(--color-secondary)}
.home-card-text{font-family:var(--font-body);font-size:15px;line-height:1.5;color:var(--color-secondary);margin:0}
.home-card-text code{font-family:var(--font-mono);font-size:.85em}
.home-card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.home-card-tags span{font-family:var(--font-mono);font-size:10px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--color-secondary);background:var(--color-surface-raised);border-radius:var(--radius-sm);padding:2px 6px}
.home-catalog .content-body{max-width:880px}
@media(hover:hover){
  .home-card:hover,.home-path a:hover{border-color:var(--color-text)}
  .home-card:hover .home-card-img{filter:none}
  .home-card:hover .home-card-num{color:var(--color-text)}
}
@media(prefers-reduced-motion:reduce){.home-card,.home-card-img,.home-card-num,.home-path a{transition:none}}
`;

// ---------------------------------------------------------------------------
// 5. Write output
// ---------------------------------------------------------------------------

// Mermaid diagrams: rendered up front (in one batch) because page rendering is
// synchronous. Anything that fails stays a plain code block.
const DIAGRAMS = new Map();
{
  const sources = pages.flatMap((p) => findMermaidFences(p.body));
  const r = renderMermaid(sources);
  for (const [k, v] of r.svgs) DIAGRAMS.set(k, v);
  if (r.failed) console.warn(`mermaid: ${r.failed} diagram(s) left as code blocks (${r.reason})`);
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
// Diagrams draw in the font they were measured in (see findDiagramFont).
const DIAGRAM_FONT = DIAGRAMS.size ? findDiagramFont() : null;
if (DIAGRAM_FONT) {
  mkdirSync(join(OUT, "assets", "fonts"), { recursive: true });
  writeFileSync(join(OUT, "assets", "fonts", "DejaVuSansMono.ttf"), readFileSync(DIAGRAM_FONT));
}
writeFileSync(
  join(OUT, "assets", "wiki.css"),
  CSS + (DIAGRAM_FONT
    ? '\n@font-face{font-family:"DejaVu Sans Mono";src:url("fonts/DejaVuSansMono.ttf") format("truetype");font-display:block}\n'
    : "")
);

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

// Copy explainer videos, posters and stills into assets/media/.
if (mediaSlugs.size || mediaImages.size) {
  mkdirSync(join(OUT, "assets", "media"), { recursive: true });
  for (const f of readdirSync(MEDIA)) {
    if (!/\.(mp4|png|webp|jpg|gif)$/.test(f)) continue;
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
