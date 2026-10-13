// wiki-model.mjs — How a wiki's markdown becomes pages and nav groups.
//
// Shared by build-site.mjs (which renders them) and nav.mjs (which reports on
// them), so the nav census sees exactly the groups and order a build would.

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Sections in sidebar order. `dir` is relative to wiki/. index.md + log.md are
// handled separately (they live at the wiki root).
export const SECTIONS = [
  { dir: "summaries", label: "Summaries" },
  { dir: "concepts", label: "Concepts" },
  { dir: "entities", label: "Entities" },
  { dir: "syntheses", label: "Syntheses" },
  { dir: "presentations", label: "Presentations" },
];

// Parse YAML-ish frontmatter (only the flat keys we use).
export function parseFrontmatter(raw) {
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

export function humanize(slug) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Natural order, so day-10 follows day-9 rather than day-1.
export const natural = (a, b) => a.localeCompare(b, "en", { numeric: true });

// Every *.md under root (recursively), as forward-slash paths relative to root.
export function walkMd(root, absDir = root) {
  const out = [];
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, e.name);
    if (e.isDirectory()) out.push(...walkMd(root, abs));
    else if (e.name.endsWith(".md")) out.push(relative(root, abs).split("\\").join("/"));
  }
  return out;
}

// The "**Start here:**" paragraph of a page body, or "" when it has none.
export const startHereBlock = (body) =>
  body.split(/\n\s*\n/).find((b) => /\*\*Start here:?\*\*/i.test(b)) || "";
