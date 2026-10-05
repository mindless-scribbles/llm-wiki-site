// mermaid.mjs — optional Mermaid rendering for build-site.mjs.
//
// ```mermaid fences are rendered to inline SVG by mmdc (@mermaid-js/mermaid-cli)
// when it is installed. Rendering is batched (one mmdc run, so Chromium starts
// once per build) and cached by content hash. Nothing here may fail a build:
// every problem degrades to "this fence stays a plain code block".

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// DDC Reel, dark and monochrome. No orange: authors opt in per diagram with
// `classDef accent stroke:#ff3300`. Labels are measured in DejaVu Sans Mono,
// which the mermaid-cli snap ships (its generic "monospace" alias falls back to
// serif), and the SVG keeps that font, so boxes always fit their text. Space Mono
// is not used here: a wider display font than the measured one overflows labels.
export const MERMAID_CONFIG = {
  theme: "base",
  fontFamily: "DejaVu Sans Mono, monospace",
  htmlLabels: false,
  flowchart: { htmlLabels: false },
  state: { htmlLabels: false },
  themeVariables: {
    background: "transparent",
    fontFamily: "DejaVu Sans Mono, monospace",
    fontSize: "14px",
    primaryColor: "#222226",
    mainBkg: "#222226",
    secondaryColor: "#1a1a1d",
    tertiaryColor: "#1a1a1d",
    primaryTextColor: "#f2f2f3",
    textColor: "#f2f2f3",
    primaryBorderColor: "#5a5a60",
    nodeBorder: "#5a5a60",
    lineColor: "#a1a1aa",
    clusterBkg: "#1a1a1d",
    clusterBorder: "#3a3a3f",
    noteBkgColor: "#222226",
    noteTextColor: "#f2f2f3",
    noteBorderColor: "#5a5a60",
    actorBkg: "#222226",
    actorBorder: "#5a5a60",
    actorTextColor: "#f2f2f3",
    signalColor: "#f2f2f3",
    signalTextColor: "#f2f2f3",
    labelBoxBkgColor: "#222226",
    edgeLabelBackground: "#1a1a1d",
  },
};

export const MERMAID_CACHE = join(homedir(), ".cache", "llm-wiki-site", "mermaid");

const CONFIG_JSON = JSON.stringify(MERMAID_CONFIG);

export function diagramHash(source) {
  return createHash("sha256").update(source).update("\0").update(CONFIG_JSON).digest("hex");
}

// Fence sources in a markdown body, in document order. Mirrors the fence rule
// in mdToHtml(): a line starting with ``` opens, the next such line closes.
export function findMermaidFences(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^```/.test(lines[i])) continue;
    const isMermaid = /^```\s*mermaid\s*$/.test(lines[i]);
    const buf = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
    if (isMermaid) found.push(buf.join("\n"));
  }
  return found;
}

// The font labels were measured in. The site ships it next to wiki.css so every
// viewer draws the exact glyph widths the boxes were sized for; a substitute
// monospace overruns them. DejaVu's licence allows redistribution.
export function findDiagramFont() {
  const candidates = [
    process.env.LLM_WIKI_DIAGRAM_FONT,
    "/snap/mermaid-cli/current/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
  ];
  return candidates.find((p) => p && existsSync(p)) || null;
}

function resolveMmdc() {
  const explicit = process.env.LLM_WIKI_MMDC;
  if (explicit) return existsSync(explicit) ? explicit : null;
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["mmdc"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n")[0].trim() || null : null;
}

// Mermaid ids every SVG "my-svg" and scopes its CSS, markers and gradients with
// it; inline on one page they would collide. Everything is prefixed, so a plain
// replace covers the root id, `#my-svg` selectors and url(#my-svg-...) refs.
function uniquify(svg, hash) {
  return svg.replace(/my-svg/g, `d-${hash.slice(0, 12)}`);
}

/**
 * Render every distinct mermaid fence in `sources` (array of fence texts).
 * Returns { svgs: Map<fenceSource, svg>, failed: count, reason }. Never throws.
 */
export function renderMermaid(sources) {
  const svgs = new Map();
  const unique = [...new Set(sources)];
  if (!unique.length) return { svgs, failed: 0, reason: "" };
  const cachePath = (h) => join(MERMAID_CACHE, `${h}.svg`);

  const todo = [];
  for (const src of unique) {
    const h = diagramHash(src);
    try {
      if (existsSync(cachePath(h))) { svgs.set(src, readFileSync(cachePath(h), "utf8")); continue; }
    } catch { /* fall through to re-render */ }
    todo.push({ src, h });
  }
  if (!todo.length) return { svgs, failed: 0, reason: "" };

  const fail = (reason) => ({ svgs, failed: unique.length - svgs.size, reason });
  const mmdc = resolveMmdc();
  if (!mmdc) return fail("mmdc not found on PATH (or LLM_WIKI_MMDC)");

  // Staging lives under ~/.cache, never /tmp: a snap-packaged mmdc cannot see /tmp.
  const stage = join(homedir(), ".cache", "llm-wiki-site", "stage", `${process.pid}-${Date.now()}`);
  try {
    mkdirSync(stage, { recursive: true });
    mkdirSync(MERMAID_CACHE, { recursive: true });
    writeFileSync(join(stage, "config.json"), CONFIG_JSON);
    writeFileSync(
      join(stage, "batch.md"),
      todo.map((t) => "```mermaid\n" + t.src + "\n```\n").join("\n"),
    );
    const r = spawnSync(
      mmdc,
      ["-i", "batch.md", "-o", "out.md", "-c", "config.json", "-b", "transparent"],
      { cwd: stage, encoding: "utf8", timeout: 180000 },
    );
    if (r.error || r.status !== 0) {
      return fail(`mmdc failed: ${r.error?.message ?? (r.stderr || r.stdout || "").trim().split("\n")[0]}`);
    }
    // Charts come out as out-1.svg … out-N.svg in fence order. A bad chart can
    // make mmdc exit non-zero (handled above) or leave a gap; either way only
    // the files that exist are used.
    todo.forEach((t, idx) => {
      const f = join(stage, `out-${idx + 1}.svg`);
      if (!existsSync(f)) return;
      const svg = uniquify(readFileSync(f, "utf8"), t.h);
      if (!svg.startsWith("<svg")) return;
      writeFileSync(cachePath(t.h), svg);
      svgs.set(t.src, svg);
    });
    return { svgs, failed: unique.length - svgs.size, reason: "mmdc produced no SVG for some diagrams" };
  } catch (e) {
    return fail(`mermaid render error: ${e.message}`);
  } finally {
    try { rmSync(stage, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
