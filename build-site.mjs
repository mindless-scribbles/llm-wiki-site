#!/usr/bin/env node
// build-site.mjs — Convert an llm-wiki (markdown under ./wiki/) into a
// self-contained static HTML site styled after the "Field Logs" journal pages
// (dark, mono, accent-driven, serif headlines). Domain-agnostic: branding comes
// from ./site.config.json (title, brandLetters, footer, accent).
//
// Usage:  node build-site.mjs
// Output: ./site/  (open site/index.html in a browser, or serve the folder)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const WIKI = join(ROOT, "wiki");
const OUT = join(ROOT, "site");
const WIDGETS = join(ROOT, "widgets");

// Site branding. Every field can be overridden in ./site.config.json so this
// generator stays domain-agnostic — copy it into any llm-wiki project and only
// the config changes. `brandLetters` are the two glyphs in the header mark.

// Tinted accents are authored as rgba(var(--color-accent-rgb),alpha), so the
// accent hex has to reach CSS as a bare "r,g,b" triplet too.
function hexToRgbTriplet(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const CONFIG = (() => {
  const defaults = {
    title: "Knowledge Base",
    brandLetters: "KB",
    footer: "SYS.WIKI / 2026",
    accent: "#ff3300",
  };
  const cfgPath = join(ROOT, "site.config.json");
  if (existsSync(cfgPath)) {
    try {
      Object.assign(defaults, JSON.parse(readFileSync(cfgPath, "utf8")));
    } catch (e) {
      console.warn(`site.config.json ignored (${e.message})`);
    }
  }
  const [a = "K", b = "B"] = String(defaults.brandLetters).slice(0, 2).split("");
  defaults.brandA = a;
  defaults.brandB = b;

  const rgb = hexToRgbTriplet(defaults.accent);
  if (!rgb) {
    console.warn(
      `accent "${defaults.accent}" is not a hex color; falling back to #ff3300`,
    );
    defaults.accent = "#ff3300";
  }
  defaults.accentRgb = rgb ?? "255,51,0";
  return defaults;
})();

// Interactive widgets: widgets/<slug>.js (excluding the shared _viz.js library).
const widgetSlugs = new Set(
  existsSync(WIDGETS)
    ? readdirSync(WIDGETS)
        .filter((f) => f.endsWith(".js") && f !== "_viz.js")
        .map((f) => f.replace(/\.js$/, ""))
    : []
);

// ---------------------------------------------------------------------------
// 1. Discover source pages
// ---------------------------------------------------------------------------

// Sections in sidebar order. `dir` is relative to wiki/. index.md + log.md are
// handled separately (they live at the wiki root).
const SECTIONS = [
  { dir: "concepts", label: "Concepts" },
  { dir: "entities", label: "Entities" },
  { dir: "syntheses", label: "Syntheses" },
  { dir: "summaries", label: "Summaries" },
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
const SIDEBAR_SECTIONS = [
  ...SECTIONS,
  ...[...extraDirs].sort().map((d) => ({ dir: d, label: humanize(d) })),
  { dir: null, label: "Pages" },
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
      if (has) page._tcUsed.add(tc);
      const anchor = "#" + timecodeAnchor(tc);
      const href = page._tc.href + anchor;
      const cls = has ? "tc" : "tc tc-missing";
      const data = has ? ` data-tc="${tc}"` : "";
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
    if (tcm && page._tc) {
      const tc = tcm[1];
      const has = page._tc.index.has(tc);
      if (has) page._tcUsed.add(tc);
      const href = page._tc.href + "#" + timecodeAnchor(tc);
      const cls = has ? "tc" : "tc tc-missing";
      const data = has ? ` data-tc="${tc}"` : "";
      const label = (alias || tc).trim();
      return `<a class="${cls}" href="${escapeHtml(href)}"${data}>${escapeHtml(label)}</a>`;
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
      const cells = (r) =>
        r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
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
    var a=e.target.closest&&e.target.closest('a.tc[data-tc]'); if(!a) return;
    e.preventDefault();
    var tc=a.getAttribute('data-tc');
    var esc=(window.CSS&&CSS.escape)?CSS.escape(tc):tc.replace(/[^a-zA-Z0-9_-]/g,'\\\\$&');
    var src=data.querySelector('[data-tc="'+esc+'"]'); if(!src) return;
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
// 3. Page template (Field Logs style)
// ---------------------------------------------------------------------------

const TYPE_LABELS = {
  concept: "CONCEPT",
  entity: "ENTITY",
  summary: "SUMMARY",
  synthesis: "SYNTHESIS",
  presentation: "WALKTHROUGH",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap";

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
  return `<aside class="field-logs">
  <div class="top">
    <a class="brand" href="${homeHref}">MASTER INDEX</a>
    ${items}
  </div>
  <div class="status-footer">${CONFIG.footer}</div>
</aside>`;
}

function renderHeader(page) {
  const homeHref = relHref(page.outRel, home.outRel);
  const navItems = [
    ["Home", homeHref],
    ["Concepts", homeHref + "#concepts"],
    ["Entities", homeHref + "#entities"],
    ["Walkthroughs", homeHref + "#presentations-step-by-step-walkthroughs"],
  ];
  return `<header class="site-header">
  <a href="${homeHref}" class="brand-mark" aria-label="${escapeHtml(CONFIG.title)} — home">
    <span class="brand-letters"><span class="brand-a">${escapeHtml(CONFIG.brandA)}</span><span class="brand-b">${escapeHtml(CONFIG.brandB)}</span></span>
    <span class="brand-sub">${escapeHtml(CONFIG.title)}</span>
  </a>
  <nav class="nav">
    ${navItems.map(([l, h]) => `<a href="${h}" class="nav-link">${l}</a>`).join("")}
  </nav>
</header>`;
}

function renderHero(page) {
  const t = page.data.type;
  const kicker = TYPE_LABELS[t] || (page.target === "index" ? "MASTER INDEX" : "PAGE");
  const conf = page.data.confidence ? ` · CONFIDENCE ${String(page.data.confidence).toUpperCase()}` : "";
  // Split "Title: Subtitle" so the part after the colon reads as an italic subtitle.
  const raw = page.title;
  const colon = raw.indexOf(":");
  let headline;
  if (colon !== -1 && colon < raw.length - 1) {
    headline = `${escapeHtml(raw.slice(0, colon))}<em>${escapeHtml(raw.slice(colon + 1).trim())}</em>`;
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

// Add a dropcap to the first <p> of the body.
function applyDropcap(bodyHtml) {
  return bodyHtml.replace(/<p>(\s*)([A-Za-z])/, (m, sp, ch) => {
    if (applyDropcap._done) return m;
    applyDropcap._done = true;
    return `<p>${sp}<span class="dropcap">${ch}</span>`;
  });
}

function renderPage(page) {
  applyDropcap._done = false;

  // Timecode popovers: if this page names a transcript, resolve it and build the
  // timecode index so inline() can turn @[MM:SS] tokens into popover pills.
  const tcTarget = page.data.transcript;
  if (tcTarget && byTarget.has(tcTarget)) {
    const tp = byTarget.get(tcTarget);
    page._tc = { href: relHref(page.outRel, tp.outRel), index: buildTimecodeIndex(tp) };
  } else {
    page._tc = null;
  }
  page._tcUsed = new Set();

  let bodyHtml = mdToHtml(page.body, page);
  bodyHtml = applyDropcap(bodyHtml);

  // Hidden data island holding each referenced transcript chunk + its wiring script.
  let tcData = "";
  let tcScript = "";
  if (page._tc && page._tcUsed.size) {
    const parts = [...page._tcUsed].map(
      (tc) => `<div data-tc="${tc}">${page._tc.index.get(tc) || ""}</div>`
    );
    tcData = `<div id="tc-data" hidden>${parts.join("")}</div>`;
    tcScript = `<script>${TC_SCRIPT}</script>`;
  }

  const cssHref = relHref(page.outRel, "assets/wiki.css");
  const isHome = page.target === "index";

  // Interactive visualization (concept pages that have a widget file).
  const slug = basename(page.target);
  const hasViz = page.data.type === "concept" && widgetSlugs.has(slug);
  const vizBlock = hasViz ? `<div class="viz-block" data-viz="${slug}"></div>` : "";
  const vizScripts = hasViz
    ? `<script src="${relHref(page.outRel, "assets/_viz.js")}"></script>\n<script src="${relHref(page.outRel, "assets/widgets/" + slug + ".js")}"></script>`
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
</head>
<body>
<div class="noise" aria-hidden="true"></div>
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
        <div>© 2026 MASTERING MATRICES — MATRIX WIKI</div>
        <a class="proceed" href="${relHref(page.outRel, home.outRel)}">RETURN TO MASTER INDEX →</a>
      </footer>
    </main>
  </div>
</div>
${vizScripts}
${tcScript}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 4. Stylesheet
// ---------------------------------------------------------------------------

const CSS = `:root{
  --color-bg:#070709;
  --color-text:#f4f4f5;
  --color-accent:${CONFIG.accent};
  --color-accent-rgb:${CONFIG.accentRgb};
  --color-muted:#52525b;
  --font-display:"Syne",ui-sans-serif,system-ui,sans-serif;
  --font-mono:"Space Mono",ui-monospace,monospace;
  --font-serif:"Playfair Display",ui-serif,serif;
}
*{box-sizing:border-box}
html{background:var(--color-bg);color:var(--color-text);font-family:var(--font-mono);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body{margin:0;min-height:100vh;background:var(--color-bg);color:var(--color-text);overflow-x:hidden;max-width:100vw}
::selection{background:var(--color-accent);color:var(--color-text)}
a{color:inherit}

.noise{position:fixed;inset:0;z-index:3;opacity:.10;pointer-events:none;mix-blend-mode:screen;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

.wiki-root{position:relative;z-index:10;min-height:100vh}

/* Header */
.site-header{display:grid;grid-template-columns:1fr auto;align-items:center;gap:1rem;
  padding:.6rem 1rem;position:sticky;top:0;z-index:20;background:var(--color-bg);
  border-bottom:1px solid rgba(244,244,245,.1)}
.brand-mark{text-decoration:none;display:flex;flex-direction:column;align-items:flex-start;line-height:1}
.brand-letters{display:flex;align-items:baseline;line-height:1}
.brand-a{font-family:var(--font-serif);font-size:1.9rem;font-weight:600;letter-spacing:-.04em;color:rgba(82,82,91,.85)}
.brand-b{font-family:var(--font-serif);font-size:2.05rem;font-weight:400;font-style:italic;letter-spacing:-.02em;color:transparent;-webkit-text-stroke:1px rgba(82,82,91,.85)}
.brand-sub{font-family:var(--font-mono);font-size:.58rem;color:rgba(var(--color-accent-rgb),.6);margin-top:-2px;letter-spacing:.02em}
.nav{display:flex;gap:16px;flex-wrap:wrap;justify-content:flex-end}
.nav-link{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(82,82,91,.85);text-decoration:none;transition:color .2s}
.nav-link:hover{color:rgba(var(--color-accent-rgb),.75)}

/* Shell */
.entry-shell{display:grid;grid-template-columns:320px 1fr;min-height:calc(100vh - 3.2rem);align-items:start}
.entry-main{min-width:0}

/* Sidebar */
.field-logs{border-right:1px solid rgba(244,244,245,.08);padding:2.2rem 1.6rem;
  display:flex;flex-direction:column;justify-content:space-between;gap:2rem;min-height:100%}
@media(min-width:1024px){.field-logs{position:sticky;top:3.2rem;height:calc(100vh - 3.2rem);overflow-y:auto}}
.field-logs .brand{display:block;font-family:var(--font-display);font-size:.95rem;font-weight:800;
  letter-spacing:.05em;color:var(--color-text);text-decoration:none;margin-bottom:1.6rem}
.field-logs .brand:hover{color:var(--color-accent)}
.idx-group{margin-bottom:1.4rem}
.idx-group-label{font-family:var(--font-mono);font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;
  color:rgba(var(--color-accent-rgb),.55);margin-bottom:.6rem}
.index-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem}
.index-item{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.03em;display:grid;
  grid-template-columns:30px 1fr;align-items:baseline;gap:.6rem;color:var(--color-muted);transition:color .2s}
.index-item .num{color:rgba(82,82,91,.75)}
.index-link{display:contents;color:inherit;text-decoration:none}
.index-item:not(.current):hover{color:var(--color-text)}
.index-item:not(.current):hover .num{color:var(--color-accent)}
.index-item.current{color:var(--color-accent);cursor:default}
.index-item.current .num{color:var(--color-accent)}
.status-footer{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.18em;color:var(--color-muted);text-transform:uppercase}

/* Hero */
.hero{padding:4.5rem 2rem 2.5rem;border-bottom:1px solid rgba(244,244,245,.08);
  background:radial-gradient(120% 140% at 50% -20%,rgba(var(--color-accent-rgb),.08),transparent 60%);text-align:center}
.hero-kicker{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.28em;text-transform:uppercase;
  color:var(--color-accent);margin-bottom:1.4rem}
.headline{font-family:var(--font-serif);font-size:clamp(2.1rem,5vw,4rem);line-height:1;font-weight:800;
  max-width:900px;margin:0 auto;color:var(--color-text)}
.headline em{font-style:italic;font-weight:400;display:block;font-size:.72em;margin-top:.35em;color:#dcdcdd}

/* Article */
.article-container{max-width:760px;margin:0 auto;padding:2.5rem 2rem 0}
.is-home .article-container{max-width:900px}
.article-meta{font-family:var(--font-mono);font-size:.66rem;color:var(--color-muted);text-transform:uppercase;
  letter-spacing:.1em;display:flex;flex-wrap:wrap;gap:1.4rem;margin-bottom:3rem;
  border-top:1px solid rgba(244,244,245,.08);border-bottom:1px solid rgba(244,244,245,.08);
  padding:.9rem 0;justify-content:center}
.article-meta b{color:var(--color-text);font-weight:700}

.content-body{font-size:1rem;line-height:1.7;color:#cccccc}
.content-body p{margin:0 0 1.6rem;font-weight:400}
.dropcap{font-family:var(--font-serif);float:left;font-size:4.4rem;line-height:.8;margin:.15rem .8rem 0 0;color:var(--color-accent)}

.content-body .h1,.content-body .h2,.content-body .h3,.content-body .h4{font-family:var(--font-display);
  color:var(--color-text);line-height:1.15;letter-spacing:.01em}
.content-body .h1{font-size:1.9rem;margin:3rem 0 1.2rem}
.content-body .h2{font-size:1.35rem;margin:2.6rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid rgba(244,244,245,.08)}
.content-body .h2::before{content:"";display:inline-block;width:10px;height:10px;background:var(--color-accent);margin-right:.6rem;transform:translateY(0)}
.content-body .h3{font-size:1.05rem;margin:2rem 0 .8rem;color:#e8e8e9}
.content-body .h4{font-size:.9rem;margin:1.6rem 0 .6rem;text-transform:uppercase;letter-spacing:.12em;color:var(--color-muted)}

.content-body a.wl{color:var(--color-accent);text-decoration:none;border-bottom:1px solid rgba(var(--color-accent-rgb),.35);transition:border-color .2s}
.content-body a.wl:hover{border-bottom-color:var(--color-accent)}
.content-body a.lnk{color:#e8e8e9;text-decoration:none;border-bottom:1px solid rgba(244,244,245,.25)}
.content-body a.lnk:hover{border-bottom-color:var(--color-text)}
.wl-missing{color:var(--color-muted);border-bottom:1px dotted var(--color-muted)}

.content-body ul,.content-body ol{margin:0 0 1.6rem;padding-left:1.4rem}
.content-body li{margin:0 0 .55rem;line-height:1.6}
.content-body li::marker{color:var(--color-accent)}

.content-body code{font-family:var(--font-mono);font-size:.86em;background:rgba(244,244,245,.07);
  border:1px solid rgba(244,244,245,.08);padding:.05em .35em;border-radius:2px;color:#f0d8cf}
.content-body pre.code{background:#0d0d10;border:1px solid rgba(244,244,245,.1);border-left:2px solid var(--color-accent);
  padding:1rem 1.2rem;overflow-x:auto;margin:0 0 1.6rem;border-radius:2px}
.content-body pre.code code{background:none;border:none;padding:0;color:#d7d7d9;font-size:.82rem;line-height:1.5}

.content-body blockquote.quote{border-left:2px solid var(--color-accent);padding-left:1.5rem;margin:1.6rem 0;
  color:#d7d7d9;font-family:var(--font-serif);font-style:italic;font-size:1.08rem;line-height:1.5}
.content-body blockquote.quote p{margin:0 0 1rem}
.content-body blockquote.quote p:last-child{margin-bottom:0}

.content-body hr.rule{border:none;border-top:1px solid rgba(244,244,245,.1);margin:2.5rem 0}

.table-wrap{overflow-x:auto;margin:0 0 1.8rem}
.content-body table.tbl{border-collapse:collapse;width:100%;font-size:.82rem}
.content-body table.tbl th,.content-body table.tbl td{border:1px solid rgba(244,244,245,.1);padding:.55rem .7rem;text-align:left;vertical-align:top}
.content-body table.tbl th{font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em;font-size:.68rem;
  color:var(--color-accent);background:rgba(var(--color-accent-rgb),.05)}
.content-body table.tbl tr:nth-child(even) td{background:rgba(244,244,245,.02)}

/* Footer */
.entry-footer{padding:5rem 2rem 4rem;max-width:760px;margin:0 auto;text-align:center;
  border-top:1px solid rgba(244,244,245,.08);font-family:var(--font-mono);font-size:.64rem;
  letter-spacing:.2em;color:var(--color-muted);text-transform:uppercase}
.proceed{display:inline-block;margin-top:1.4rem;color:var(--color-accent);text-decoration:none;letter-spacing:.2em;
  border-bottom:1px solid transparent;transition:border-color .2s}
.proceed:hover{border-bottom-color:var(--color-accent)}

/* Home page tweaks: index.md is a big set of nested link lists */
.is-home .content-body .h2{font-family:var(--font-display);font-size:1.5rem}
.is-home .content-body ul{list-style:none;padding-left:0}
.is-home .content-body li{border-bottom:1px solid rgba(244,244,245,.05);padding-bottom:.55rem}

@media(max-width:1023px){
  .entry-shell{grid-template-columns:1fr}
  .field-logs{border-right:none;border-bottom:1px solid rgba(244,244,245,.08);padding:1.4rem 1.4rem 1.8rem}
  .hero{padding:3rem 1.4rem 2rem}
  .article-container{padding:2rem 1.4rem 0}
  .article-meta{gap:.5rem;flex-direction:column;align-items:center}
}

/* ---- Interactive visualizations ---- */
.viz-block{margin:0 0 3rem}
.viz{border:1px solid rgba(244,244,245,.1);border-top:2px solid var(--color-accent);background:#0a0a0d;border-radius:2px;overflow:hidden}
.viz-label{font-family:var(--font-mono);font-size:.58rem;letter-spacing:.28em;text-transform:uppercase;color:var(--color-accent);padding:.7rem 1rem .2rem}
.viz-label::before{content:"● ";font-size:.6em;vertical-align:middle}
.viz-stage{position:relative;width:100%;padding:.4rem 1rem}
.viz-canvas{display:block;width:100%;border-radius:2px;touch-action:none}
.viz-controls{display:flex;flex-wrap:wrap;gap:.8rem 1.4rem;align-items:flex-end;padding:1rem 1.2rem;border-top:1px solid rgba(244,244,245,.07)}
.viz-ctl{display:flex;flex-direction:column;gap:.35rem;font-family:var(--font-mono)}
.viz-slider{min-width:150px;flex:1 1 150px;max-width:260px}
.viz-ctl-head{display:flex;justify-content:space-between;gap:1rem;align-items:baseline}
.viz-ctl-label{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--color-muted)}
.viz-ctl-val{font-size:.66rem;color:var(--color-accent);font-weight:700}
.viz-range{-webkit-appearance:none;appearance:none;width:100%;height:3px;background:rgba(244,244,245,.15);border-radius:3px;outline:none}
.viz-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--color-accent);cursor:pointer;border:2px solid #0a0a0d}
.viz-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--color-accent);cursor:pointer;border:2px solid #0a0a0d}
.viz-toggle{flex-direction:row;align-items:center;gap:.5rem;cursor:pointer}
.viz-toggle input{position:absolute;opacity:0;width:0;height:0}
.viz-switch{width:32px;height:17px;border-radius:9px;background:rgba(244,244,245,.15);position:relative;transition:background .2s;flex:none}
.viz-switch::after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#fff;transition:transform .2s}
.viz-toggle input:checked + .viz-switch{background:var(--color-accent)}
.viz-toggle input:checked + .viz-switch::after{transform:translateX(15px)}
.viz-seg{display:inline-flex;border:1px solid rgba(244,244,245,.15);border-radius:2px;overflow:hidden}
.viz-seg-btn{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--color-muted);background:transparent;border:none;padding:.45rem .8rem;cursor:pointer;transition:all .15s;border-right:1px solid rgba(244,244,245,.12)}
.viz-seg-btn:last-child{border-right:none}
.viz-seg-btn:hover{color:var(--color-text)}
.viz-seg-btn.active{background:var(--color-accent);color:#fff}
.viz-btn{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--color-text);background:rgba(244,244,245,.06);border:1px solid rgba(244,244,245,.15);padding:.5rem .9rem;cursor:pointer;border-radius:2px;transition:all .15s}
.viz-btn:hover{border-color:var(--color-accent);color:var(--color-accent)}
.viz-readout{font-family:var(--font-mono);font-size:.72rem;line-height:1.6;color:#bdbdc2;padding:0 1.2rem 1rem}
.viz-readout:empty{display:none}
.viz-readout b{color:var(--color-accent);font-weight:700}
.viz-readout .k{color:var(--color-muted);text-transform:uppercase;letter-spacing:.08em;font-size:.62rem}
.viz-note{font-family:var(--font-mono);font-size:.62rem;line-height:1.5;color:var(--color-muted);padding:0 1.2rem 1.1rem;letter-spacing:.02em}
.viz-note:empty{display:none}
.viz-error{padding:1.5rem;color:var(--color-muted);font-size:.7rem}

/* ---- Timecode pills + transcript popover ---- */
.content-body a.tc{display:inline-block;font-family:var(--font-mono);font-size:.74em;line-height:1;
  color:var(--color-accent);background:rgba(var(--color-accent-rgb),.09);
  border:1px solid rgba(var(--color-accent-rgb),.32);border-radius:3px;
  padding:.12em .42em;text-decoration:none;cursor:pointer;white-space:nowrap;vertical-align:baseline;
  transition:background .15s,border-color .15s}
.content-body a.tc:hover{background:rgba(var(--color-accent-rgb),.2);border-color:var(--color-accent)}
.content-body a.tc::before{content:"\\25B8";margin-right:.28em;opacity:.7}
.content-body a.tc.tc-missing{color:var(--color-muted);border-color:rgba(82,82,91,.5);background:transparent}
.tc-pop{position:absolute;z-index:60;max-width:min(520px,92vw);background:#0d0d12;
  border:1px solid rgba(var(--color-accent-rgb),.4);border-top:2px solid var(--color-accent);
  border-radius:3px;box-shadow:0 14px 44px rgba(0,0,0,.6)}
.tc-pop-head{display:flex;align-items:center;gap:.8rem;padding:.5rem .7rem;
  border-bottom:1px solid rgba(244,244,245,.1);font-family:var(--font-mono)}
.tc-pop-time{color:var(--color-accent);font-size:.72rem;letter-spacing:.1em;font-weight:700}
.tc-pop-full{margin-left:auto;color:var(--color-accent);font-size:.62rem;text-decoration:none;opacity:.85;letter-spacing:.04em}
.tc-pop-full:hover{opacity:1;text-decoration:underline}
.tc-pop-x{background:none;border:none;color:var(--color-muted);font-size:1.15rem;line-height:1;cursor:pointer;padding:0 .15rem}
.tc-pop-x:hover{color:var(--color-text)}
.tc-pop-body{padding:.75rem .9rem;max-height:min(50vh,420px);overflow-y:auto;
  font-family:var(--font-mono);font-size:.8rem;line-height:1.55;color:#cfcfd4}
.tc-pop-body p{margin:0 0 .7rem}
.tc-pop-body p:last-child{margin-bottom:0}
`;

// ---------------------------------------------------------------------------
// 5. Write output
// ---------------------------------------------------------------------------

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
writeFileSync(join(OUT, "assets", "wiki.css"), CSS);

// Copy the viz library + any concept widgets into assets/.
if (existsSync(WIDGETS)) {
  mkdirSync(join(OUT, "assets", "widgets"), { recursive: true });
  for (const f of readdirSync(WIDGETS)) {
    if (!f.endsWith(".js")) continue;
    const dest = f === "_viz.js" ? join(OUT, "assets", f) : join(OUT, "assets", "widgets", f);
    writeFileSync(dest, readFileSync(join(WIDGETS, f)));
  }
}

for (const page of pages) {
  const dest = join(OUT, page.outRel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, renderPage(page));
}

console.log(`Built ${pages.length} pages -> ${relative(ROOT, OUT)}/`);
console.log(`Open: ${relative(ROOT, join(OUT, "index.html"))}`);
