// config.mjs — Resolve a wiki's site branding.
//
// Branding can live in three places, highest precedence first:
//
//   1. CLI flags / sites/<id>/site.json  (passed in as `overrides`)
//   2. <wikiRoot>/site.config.json       (plain-git wikis)
//   3. a `site:` block in <wikiRoot>/wiki/index.md frontmatter
//
// (3) exists because Obsidian Sync only carries *.md — a wiki that lives in a
// synced vault cannot rely on a JSON file travelling with it, so its branding
// has to be markdown.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DEFAULTS = {
  title: "Knowledge Base",
  brandLetters: "KB",
  footer: "SYS.WIKI / 2026",
  accent: "#ff3300",
};

// Tinted accents are authored as rgba(var(--color-accent-rgb),alpha), so the
// accent hex has to reach CSS as a bare "r,g,b" triplet too.
export function hexToRgbTriplet(hex) {
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

// Pull the nested `site:` block out of index.md frontmatter. The generator's own
// parseFrontmatter() only understands flat keys, so this reads the one nested
// block we care about rather than growing a second YAML dialect there.
//
//   ---
//   title: "Index"
//   site:
//     title: "Trading Field Logs"
//     accent: "#ff3300"
//   ---
export function readSiteFrontmatter(indexPath) {
  if (!existsSync(indexPath)) return {};
  const fm = readFileSync(indexPath, "utf8").match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return {};
  const out = {};
  let inBlock = false;
  for (const line of fm[1].split("\n")) {
    if (/^site:\s*$/.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (!/^\s/.test(line)) break; // dedented back to a sibling key
    const kv = line.match(/^\s+([A-Za-z_]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function resolveConfig(wikiRoot, wikiDir, overrides = {}) {
  const cfg = { ...DEFAULTS };

  Object.assign(cfg, readSiteFrontmatter(join(wikiDir, "index.md")));

  const cfgPath = join(wikiRoot, "site.config.json");
  if (existsSync(cfgPath)) {
    try {
      Object.assign(cfg, JSON.parse(readFileSync(cfgPath, "utf8")));
    } catch (e) {
      console.warn(`site.config.json ignored (${e.message})`);
    }
  }

  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && v !== null) cfg[k] = v;
  }

  const [a = "K", b = "B"] = String(cfg.brandLetters).slice(0, 2).split("");
  cfg.brandA = a;
  cfg.brandB = b;

  const rgb = hexToRgbTriplet(cfg.accent);
  if (!rgb) {
    console.warn(`accent "${cfg.accent}" is not a hex color; falling back to #ff3300`);
    cfg.accent = "#ff3300";
  }
  cfg.accentRgb = rgb ?? "255,51,0";
  return cfg;
}
