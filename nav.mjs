// nav.mjs — Nav census for llm-wiki-site: the facts a nav diagnosis starts from.
//
// Report only, like lint.mjs: it reads the markdown (never the built HTML, which
// can be stale) and returns the folder nav a build would show, the reader's path
// as far as the files reveal it, and four mechanical flags. Deciding what the
// path really is, and what to change, is left to the caller (the nav-flow skill).
//
// The path: index.md's **Start here:** links, then entry pages (overview,
// syllabus, ...), then sequence pages (day-1, lesson-2, part-3, 01-...) in
// natural order. Flags:
//   order      a group whose path order (the order the sequence first links its
//              pages) differs from its nav order. Only with a sequence, and only
//              for groups of LOOKUP_MAX pages or fewer: a big group is for lookup,
//              and A to Z suits lookup
//   plugin     a page with a dataview / dataviewjs / chartsview fence; the site
//              prints those as raw text
//   backroom   a group no path page links to
//   entry      an entry page that sorts after the sequence pages it introduces

import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { SECTIONS, parseFrontmatter, humanize, natural, walkMd, startHereBlock } from "./wiki-model.mjs";

export const NAV_KEYS = ["sections", "startHere", "labels", "order", "hide"];
export const FLAG_KINDS = ["order", "plugin", "backroom", "entry"];
const LOOKUP_MAX = 12;

// A numbered page; a dated one (2026-10-03-notes) is a journal entry, not a step.
const SEQUENCE = /^(?:(?:day|lesson|part|week|chapter|session|episode|ep|step|unit)[-_ ]?\d+|(?!\d{4}-\d\d-\d\d)\d{1,3}[-_ ])/i;
const ENTRY = /^(?:overview|syllabus|start[-_]here|introduction|intro|welcome|course[-_]overview|workshop[-_]overview)$/i;
const PLUGIN_FENCE = /^```(dataview|dataviewjs|chartsview)\b/m;
const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;

// Wikilink targets in a page body, in order, once each; fenced code is skipped.
function linkTargets(body) {
  const out = [];
  const prose = body.replace(/^```[\s\S]*?^```/gm, "");
  for (const m of prose.matchAll(WIKILINK)) {
    const t = m[1].trim().replace(/^wiki\//, "");
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function navCensus({ wikiDir, navKeys = {} }) {
  const canon = new Map(SECTIONS.map((s) => [s.dir, s.label]));
  const pages = new Map(); // target -> page
  const extraDirs = new Set();
  for (const rel of walkMd(wikiDir).sort(natural)) {
    const target = rel.replace(/\.md$/, "");
    const slash = rel.indexOf("/");
    const dir = slash === -1 ? null : rel.slice(0, slash);
    if (dir && !canon.has(dir)) extraDirs.add(dir);
    const raw = readFileSync(join(wikiDir, rel), "utf8");
    const { data, body } = parseFrontmatter(raw);
    pages.set(target, {
      target,
      dir,
      title: data.title || humanize(basename(target)),
      type: typeof data.type === "string" ? data.type : "",
      body,
      links: linkTargets(body).filter((t) => t !== target),
      plugin: (raw.match(PLUGIN_FENCE) || [])[1] || null,
    });
  }
  const home = pages.get("index");
  const known = (t) => pages.has(t) && t !== "index" && t !== "log";

  // Groups as the default folder nav shows them (build-site.mjs, DEFAULT_SIDEBAR_SECTIONS).
  const groupDefs = [
    ...SECTIONS.map((s) => ({ dir: s.dir, label: s.label })),
    ...[...extraDirs].sort().map((d) => ({ dir: d, label: humanize(d) })),
    { dir: null, label: "Pages" },
  ];
  const inGroup = (p, g) => p.dir === g.dir && known(p.target);

  // The path, as far as the files reveal it.
  const startHere = home ? linkTargets(startHereBlock(home.body)).filter(known) : [];
  const entries = [...pages.values()].filter((p) => known(p.target) && ENTRY.test(basename(p.target))).map((p) => p.target);
  const sequence = [...pages.values()].filter((p) => known(p.target) && SEQUENCE.test(basename(p.target))).map((p) => p.target);
  const path = [...new Set([...startHere, ...entries, ...sequence])];
  const onPath = new Set(path);

  // Who on the path links each page. The path order of a page is when the
  // sequence (the days or lessons) first links it; Start here and entry pages
  // preview everything, so they only count when there is no sequence.
  const reachedBy = new Map();
  for (const t of path) {
    for (const l of pages.get(t).links) {
      if (!known(l)) continue;
      if (!reachedBy.has(l)) reachedBy.set(l, []);
      reachedBy.get(l).push(t);
    }
  }
  const firstReach = new Map();
  let n = 0;
  for (const t of sequence.length ? sequence : path) {
    for (const l of pages.get(t).links) if (known(l) && !firstReach.has(l)) firstReach.set(l, n++);
  }

  const flags = [];
  const groups = [];
  for (const g of groupDefs) {
    const list = [...pages.values()].filter((p) => inGroup(p, g));
    if (!list.length) continue;
    const out = list.map((p) => ({
      target: p.target,
      title: p.title,
      type: p.type,
      onPath: onPath.has(p.target),
      reachedBy: reachedBy.get(p.target) || [],
      plugin: p.plugin,
    }));
    const reached = out.filter((p) => p.reachedBy.length && !p.onPath);
    const ordered = reached.filter((p) => firstReach.has(p.target));
    const pathOrder = [...ordered].sort((a, b) => firstReach.get(a.target) - firstReach.get(b.target)).map((p) => p.target);
    const navOrder = ordered.map((p) => p.target);
    const group = { dir: g.dir, label: g.label, count: out.length, pages: out, linkedFromPath: reached.length, pathOrder };
    groups.push(group);

    if (sequence.length && out.length <= LOOKUP_MAX && pathOrder.length > 1 && pathOrder.join() !== navOrder.join()) {
      flags.push({ kind: "order", group: g.label, text: `the path reaches ${g.label} as ${pathOrder.map((t) => basename(t)).join(", ")}; the nav lists A to Z` });
    }
    if (path.length && !out.some((p) => p.onPath) && !reached.length) {
      flags.push({ kind: "backroom", group: g.label, text: `no path page links to ${g.label} (${out.length})` });
    }
    for (const p of out) if (p.plugin) flags.push({ kind: "plugin", group: g.label, page: p.target, text: `${p.target} holds a ${p.plugin} fence` });
    const seqIdx = out.map((p, i) => (sequence.includes(p.target) ? i : -1)).filter((i) => i >= 0);
    for (const [i, p] of out.entries()) {
      if (!(entries.includes(p.target) || startHere[0] === p.target) || sequence.includes(p.target)) continue;
      if (seqIdx.length && i > Math.min(...seqIdx)) {
        flags.push({ kind: "entry", group: g.label, page: p.target, text: `${p.target} is [${String(i + 1).padStart(3, "0")}] in ${g.label}, after the sequence it introduces` });
      }
    }
  }

  return {
    navKeys: Object.fromEntries(NAV_KEYS.filter((k) => navKeys[k] !== undefined).map((k) => [k, navKeys[k]])),
    pageCount: [...pages.keys()].filter(known).length,
    startHere,
    entries,
    sequence,
    path,
    groups,
    flags,
  };
}
