// lint.mjs — STE-80 writing lint for llm-wiki-site.
//
// The measurable half of ASD-STE100 Part 1 (writing rules), none of Part 2 (the
// dictionary). Report only: this module never writes, and the caller decides what
// to do with the results (the CLI prints them; an LLM does the fixing).
//
// Limits: procedural sentence (a numbered item, or an indented sub-bullet, under a
// heading that looks like steps) <= 20 words, descriptive sentence <= 25,
// paragraph <= 6 sentences. Words: a `code span` counts as one word and so does a
// [[link]]; a [[link|label]] counts its label. (§x.y) citations, tables, block
// quotes, headings, fences and @markers are skipped.
//
// Terminology: the wiki's own CLAUDE.md may carry a Use / Not table under
// "## Writing Rule"; each Not term is flagged (kind "term") with the Use cell as
// the suggestion. Built-in banned words are kind "word".

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export const LIMIT = { procedural: 20, descriptive: 25, paragraph: 6 };
export const KINDS = ["procedural", "descriptive", "paragraph", "term", "word", "passive"];

// STE-unapproved words that show up in technical prose, with the approved form.
const BANNED = {
  "in order to": "to", "prior to": "before", "ensure": "make sure", "utilize": "use",
  "approximately": "about", "commence": "start", "subsequently": "then", "facilitate": "help",
  "in the event that": "if", "due to the fact that": "because", "leverage": "use",
  "a number of": "some / N", "in addition": "also", "therefore": "thus / so",
};

const SKIP_PAGE = /(^|\/)(index|log|dashboard|analytics|flashcards)\.md$/;
const STEP_HEADING = /phase|step|procedure|how to|build it|try it/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const unTick = (s) => s.trim().replace(/`/g, "").trim();
const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());

// Read the Use / Not table from the "## Writing Rule" section of a CLAUDE.md.
// Returns [{ term, use }]; [] when the file, section or table is missing.
export function parseTerminology(claudeMdPath) {
  if (!existsSync(claudeMdPath)) return [];
  const lines = readFileSync(claudeMdPath, "utf8").split("\n");
  const terms = [];
  // Every "## Writing Rule" section is scanned (up to the next "## " heading);
  // the first Use / Not table found in each one is read.
  for (let start = 0; start < lines.length; start++) {
    if (!/^##\s+Writing Rule\b/i.test(lines[start])) continue;
    let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
    if (end < 0) end = lines.length;
    const sec = lines.slice(start + 1, end);
    for (let i = 0; i < sec.length - 1; i++) {
      if (!/^\s*\|/.test(sec[i]) || !/^\s*\|[\s:|-]+\|?\s*$/.test(sec[i + 1])) continue;
      const head = cells(sec[i]).map((c) => unTick(c).toLowerCase());
      const useCol = head.indexOf("use"), notCol = head.indexOf("not");
      if (useCol < 0 || notCol < 0) continue;
      for (let j = i + 2; j < sec.length && /^\s*\|/.test(sec[j]); j++) {
        const row = cells(sec[j]);
        const use = unTick(row[useCol] ?? ""), not = row[notCol] ?? "";
        if (!use || !not || use.startsWith("[") || not.trim().startsWith("[")) continue;
        for (const t of not.split(/\s*,\s*|\s+\/\s+/).map(unTick).filter(Boolean)) terms.push({ term: t, use });
      }
      break;
    }
  }
  return terms;
}

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
});

function words(s) {
  s = s.replace(/`[^`]*`/g, "CODE")
       .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
       .replace(/\[\[([^\]]*)\]\]/g, "LINK")
       .replace(/\(§[^)]*\)/g, "")
       .replace(/[*_]/g, "");
  return (s.match(/[A-Za-z0-9§][\w'’.\-/×→↔]*/g) || []).length;
}

const splitSentences = (l) =>
  l.split(/(?<=[.!?])\s+(?=[A-Z`*\[⚠(])/).map((s) => s.trim()).filter((s) => words(s) > 0);

function lintFile(path, banned) {
  const raw = readFileSync(path, "utf8");
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
  const offset = raw.slice(0, raw.length - body.length).split("\n").length - 1;
  const issues = [];
  let nSent = 0, nWords = 0, inFence = false, para = [], paraStart = 0, stepCtx = false;
  const flushPara = () => {
    if (para.length > LIMIT.paragraph)
      issues.push({ line: paraStart, kind: "paragraph", n: para.length, text: para[0].slice(0, 60) });
    para = [];
  };
  body.split("\n").forEach((line, i) => {
    const ln = i + 1 + offset;
    if (/^```/.test(line)) { inFence = !inFence; flushPara(); return; }
    if (inFence) return;
    const t = line.trim();
    if (/^#/.test(t)) stepCtx = STEP_HEADING.test(t);
    if (!t || /^(#|\||>|@|---)/.test(t)) { flushPara(); return; }
    if (/^\*\*(Ask|Decision|Read|Predict)\b/.test(t) || /^⚠/.test(t)) flushPara();
    const item = /^(\d+\.|[-*])\s+/.test(t);
    const procedural = stepCtx && (/^\d+\.\s+/.test(t) || (/^[-*]\s+/.test(line) && /^\s{2,}/.test(line)));
    const text = t.replace(/^(\d+\.|[-*])\s+/, "").replace(/^\*\*(Ask|Decision|Read|Predict|Goal|Result)[^*]*\*\*\s*/, "");
    if (item) flushPara();
    const sents = splitSentences(text);
    for (const s of sents) {
      const w = words(s);
      nSent++; nWords += w;
      const kind = procedural ? "procedural" : "descriptive";
      if (w > LIMIT[kind]) issues.push({ line: ln, kind, n: w, text: s.slice(0, 90) });
      const prose = s.replace(/`[^`]*`/g, " ");
      for (const b of banned)
        if (b.re.test(prose)) issues.push({ line: ln, kind: b.kind, n: 0, text: `"${b.term}" -> ${b.use}` });
      if (procedural && /\b(is|are|be|been|being)\s+\w+ed\b/i.test(s))
        issues.push({ line: ln, kind: "passive", n: 0, text: s.slice(0, 90) });
    }
    if (item) return;
    if (!para.length) paraStart = ln;
    para.push(...sents);
  });
  flushPara();
  return { nSent, avg: nSent ? nWords / nSent : 0, issues };
}

// Lint one wiki. wikiDir holds the markdown; wikiRoot (default: its parent when
// wikiDir is named "wiki", else wikiDir) is where CLAUDE.md lives.
// Returns { pages: [{ path, nSent, avg, counts, issues }], totals, sentences, terms }.
export function lintWiki({ wikiRoot, wikiDir, pages: filter, extraBanned = {} }) {
  const terms = parseTerminology(join(wikiRoot, "CLAUDE.md"));
  const banned = [
    ...Object.entries({ ...BANNED, ...extraBanned }).map(([term, use]) => ({ term, use, kind: "word" })),
    ...terms.map((t) => ({ ...t, kind: "term" })),
  ].map((b) => ({ ...b, re: new RegExp(`(?<!\\w)${escapeRe(b.term)}(?!\\w)`, "i") }));

  const files = walk(wikiDir)
    .filter((p) => !filter || p.includes(filter))
    .filter((p) => !SKIP_PAGE.test(p.split("\\").join("/")))
    .sort();
  const totals = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const pages = [];
  let sentences = 0;
  for (const f of files) {
    const r = lintFile(f, banned);
    if (!r.nSent) continue;
    const counts = Object.fromEntries(KINDS.map((k) => [k, r.issues.filter((x) => x.kind === k).length]));
    for (const k of KINDS) totals[k] += counts[k];
    sentences += r.nSent;
    pages.push({ path: relative(wikiDir, f), nSent: r.nSent, avg: r.avg, counts, issues: r.issues });
  }
  return { pages, totals, sentences, terms };
}
