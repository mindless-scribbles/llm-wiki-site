// One local hub server for every registered wiki, plus the review notes queues.
//
// `serve` lists the wikis at /, hosts each wiki's out dir under /<id>/ and
// injects the review overlay into html responses at response time. Nothing here
// touches the built files, so a plain `build` is unaffected. Notes live in the
// builder repo, never in an out dir (wiped each build) or the vault:
//   content notes  sites/<id>/review/    one queue per wiki
//   design notes   design-notes/         one shared queue (fixes go in the builder)

import { createServer } from "node:http";
import {
  readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync, readdirSync,
} from "node:fs";
import { join, resolve, extname, relative, sep, dirname, isAbsolute, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "./config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEW_ASSETS = join(HERE, "review");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const IMG_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_BODY = 60 * 1024 * 1024;
const MAX_IMG = 15 * 1024 * 1024;
const MAX_IMAGES = 8;
const injectFor = (id) => `<link rel="stylesheet" href="/__review/overlay.css"><script src="/__review/overlay.js" data-site="${id}" defer></script>`;

// --- notes storage ----------------------------------------------------------

const contentDir = (repo, id) => join(repo, "sites", id, "review");
const designDir = (repo) => join(repo, "design-notes");
const dirFor = (repo, site, kind) => (kind === "design" ? designDir(repo) : contentDir(repo, site));

function pad(n, w = 2) { return String(n).padStart(w, "0"); }

function newId(repo, site) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  for (;;) {
    const id = `${stamp}-${randomBytes(2).toString("hex")}`;
    if (!existsSync(join(contentDir(repo, site), "notes", `${id}.json`)) &&
        !existsSync(join(designDir(repo), "notes", `${id}.json`))) return id;
  }
}

function validId(id) { return /^\d{8}-\d{6}-[0-9a-f]{4}$/.test(id); }

function validPage(p) {
  return typeof p === "string" && p.length < 500 && p.endsWith(".html") && !p.startsWith("/") &&
    !p.split("/").some((seg) => seg === ".." || seg === "." || seg === "") && !p.includes("\\") && !p.includes("\0");
}

// Page html path -> markdown path relative to the wiki root.
function sourceFor(buildOpts, page) {
  const { wikiRoot, wikiDir } = buildOpts;
  const prefix = relative(wikiRoot, wikiDir).split(sep).join("/");
  return (prefix ? prefix + "/" : "") + page.replace(/\.html$/, ".md");
}

function readDir(dir) {
  const nd = join(dir, "notes");
  if (!existsSync(nd)) return [];
  const out = [];
  for (const f of readdirSync(nd)) {
    if (!f.endsWith(".json")) continue;
    try { out.push(JSON.parse(readFileSync(join(nd, f), "utf8"))); } catch { /* skip bad file */ }
  }
  return out;
}

const byCreated = (a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.id < b.id ? -1 : 1);

// Old notes have no kind or site: they are content notes of the wiki they sit in.
export function readContentNotes(repo, id) {
  return readDir(contentDir(repo, id)).map((n) => ({ ...n, kind: "content", site: id })).sort(byCreated);
}

export function readDesignNotes(repo) {
  return readDir(designDir(repo)).map((n) => ({ ...n, kind: "design" })).sort(byCreated);
}

function noteFile(dir, id) {
  if (!validId(id)) throw httpError(400, "bad note id");
  return join(dir, "notes", `${id}.json`);
}

function writeNote(dir, note) {
  const f = noteFile(dir, note.id);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(note, null, 2) + "\n");
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);

function cleanAnchor(a) {
  if (!a || typeof a !== "object") a = null;
  const line = a && Number.isFinite(Number(a.line)) && a.line !== null && a.line !== "" ? Math.trunc(Number(a.line)) : null;
  return {
    selector: a ? str(a.selector, 1000) : null,
    line,
    heading: a ? str(a.heading, 300) : null,
    headingId: a ? str(a.headingId, 200) : null,
    excerpt: a ? str(a.excerpt, 400) : null,
    tag: a ? str(a.tag, 40) : null,
    phase: a ? str(a.phase == null ? null : String(a.phase), 40) : null,
  };
}

function createNote(repo, site, buildOpts, body) {
  if (!body || typeof body !== "object") throw httpError(400, "body must be an object");
  if (!validPage(body.page)) throw httpError(400, "bad page");
  const kind = body.kind === "design" ? "design" : "content";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const images = Array.isArray(body.images) ? body.images : [];
  if (!text && !images.length) throw httpError(400, "note needs text or an image");
  if (text.length > 20000) throw httpError(400, "note text too long");
  if (images.length > MAX_IMAGES) throw httpError(400, `at most ${MAX_IMAGES} images`);

  const decoded = images.map((u) => {
    const m = typeof u === "string" && /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(u);
    if (!m) throw httpError(400, "images must be png, jpeg, webp or gif data URLs");
    const buf = Buffer.from(m[2], "base64");
    if (!buf.length) throw httpError(400, "empty image");
    if (buf.length > MAX_IMG) throw httpError(413, "image over 15 MB");
    return { ext: IMG_EXT[m[1]], buf };
  });

  const id = newId(repo, site);
  const dir = dirFor(repo, site, kind);
  const imgDir = join(dir, "img");
  const rels = decoded.map((d, i) => {
    mkdirSync(imgDir, { recursive: true });
    const name = `${id}-${i + 1}.${d.ext}`;
    writeFileSync(join(imgDir, name), d.buf);
    return `img/${name}`;
  });

  const v = body.viewport && typeof body.viewport === "object" ? body.viewport : {};
  const note = {
    id,
    kind,
    site,
    status: "open",
    created: new Date().toISOString(),
    page: body.page,
    source: sourceFor(buildOpts, body.page),
    anchor: cleanAnchor(body.anchor),
    text,
    images: rels,
    viewport: { w: Number(v.w) || null, h: Number(v.h) || null },
    resolution: null,
    resolvedAt: null,
  };
  writeNote(dir, note);
  return note;
}

// Find a note by id: the given wikis' content queues first, then the design queue.
function findNote(repo, siteIds, id) {
  if (!validId(id)) throw httpError(400, "bad note id");
  for (const s of siteIds) {
    const dir = contentDir(repo, s);
    if (existsSync(noteFile(dir, id))) return { dir, file: noteFile(dir, id), site: s, kind: "content" };
  }
  const dir = designDir(repo);
  if (existsSync(noteFile(dir, id))) return { dir, file: noteFile(dir, id), site: null, kind: "design" };
  return null;
}

// Shared by the CLI and the HTTP endpoint.
export function setNoteStatus(repo, siteIds, id, status, message) {
  const hit = findNote(repo, siteIds, id);
  if (!hit) throw new Error(`no note ${id} in any wiki's queue or the design queue`);
  const note = JSON.parse(readFileSync(hit.file, "utf8"));
  note.status = status;
  if (status === "resolved") {
    note.resolvedAt = new Date().toISOString();
    if (message !== undefined && message !== null) note.resolution = String(message);
  } else {
    note.resolvedAt = null;
    note.resolution = null;
  }
  writeNote(hit.dir, note);
  return { ...note, kind: hit.kind, site: note.site ?? hit.site };
}

function formatList(repo, notes, all, { showSite }) {
  const shown = all ? notes : notes.filter((n) => n.status === "open");
  const lines = [];
  for (const n of shown) {
    const a = n.anchor ?? {};
    lines.push(`## ${n.id}  [${n.status}]  ${n.kind}`);
    if (showSite) lines.push(`site: ${n.site ?? "(unknown)"}`);
    lines.push(`page: ${n.page}`);
    lines.push(`source: ${n.source}${a.line ? `:${a.line}` : ""}`);
    if (a.heading) lines.push(`heading: ${a.heading}`);
    if (a.excerpt) lines.push(`element: <${a.tag ?? "?"}> ${a.excerpt}`);
    else lines.push("element: (page-level note)");
    lines.push("note:");
    for (const l of (n.text || "(image only)").split("\n")) lines.push(`  ${l}`);
    for (const img of n.images ?? []) lines.push(`image: ${join(dirFor(repo, n.site, n.kind), img)}`);
    if (n.status === "resolved" && n.resolution) lines.push(`resolution: ${n.resolution}`);
    lines.push("");
  }
  const open = notes.filter((n) => n.status === "open").length;
  lines.push(all ? `${notes.length} notes (${open} open)` : `${open} open notes`);
  return lines.join("\n");
}

export function formatContentNotes(repo, id, all) {
  return formatList(repo, readContentNotes(repo, id), all, { showSite: false });
}

export function formatDesignNotes(repo, all) {
  return formatList(repo, readDesignNotes(repo), all, { showSite: true });
}

// Open counts for the summary and the hub.
export function openCounts(repo, siteIds) {
  const content = {};
  for (const id of siteIds) content[id] = readContentNotes(repo, id).filter((n) => n.status === "open").length;
  const design = readDesignNotes(repo).filter((n) => n.status === "open").length;
  return { content, design };
}

// --- http -------------------------------------------------------------------

function readBody(req) {
  return new Promise((res, rej) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { rej(httpError(413, "body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rej);
  });
}

function sendJson(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { "content-type": TYPES[".json"], "content-length": b.length, "cache-control": "no-store" });
  res.end(b);
}

function sendFile(req, res, file, { inject } = {}) {  // inject: html snippet or falsy
  const st = statSync(file);
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  if (inject && type.startsWith("text/html")) {
    let html = readFileSync(file, "utf8");
    const i = html.lastIndexOf("</body>");
    html = i === -1 ? html + inject : html.slice(0, i) + inject + html.slice(i);
    const b = Buffer.from(html);
    res.writeHead(200, { "content-type": type, "content-length": b.length, "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : b);
    return;
  }
  const headers = { "content-type": type, "accept-ranges": "bytes", "cache-control": "no-cache" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    let start, end;
    if (range[1] === "") { start = Math.max(0, st.size - Number(range[2])); end = st.size - 1; }
    else { start = Number(range[1]); end = range[2] === "" ? st.size - 1 : Math.min(Number(range[2]), st.size - 1); }
    if (start > end || start >= st.size) {
      res.writeHead(416, { "content-range": `bytes */${st.size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1 });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": st.size });
  if (req.method === "HEAD") { res.end(); return; }
  createReadStream(file).pipe(res);
}

// Map a URL path to a file under root, or null. Traversal-safe.
function resolveStatic(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes("\0")) return null;
  let file = resolve(root, "." + (p.startsWith("/") ? p : "/" + p));
  const rel = relative(root, file);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function hubHtml(rows, designOpen) {
  const cards = rows.map((r) => `
    <li><a class="card" href="/${esc(r.id)}/">
      <span class="title">${esc(r.title)}</span>
      <span class="meta"><span>${esc(r.id)}</span><span>${r.open} OPEN ${r.open === 1 ? "NOTE" : "NOTES"}</span><span>${esc(r.built)}</span></span>
    </a></li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wiki hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600&family=Space+Mono:wght@400;700&family=Syne:wght@800&display=swap" rel="stylesheet">
<style>
:root{--bg:#070709;--text:#f4f4f5;--secondary:#a1a1aa;--surface:#111114;--border:rgba(244,244,245,.1);--border-strong:rgba(244,244,245,.3);--accent:#ff3300}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 "Hanken Grotesk",system-ui,sans-serif}
main{max-width:960px;margin:0 auto;padding:48px 16px 64px}
.label{font-family:"Space Mono",ui-monospace,monospace;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--secondary)}
h1{font-family:Syne,sans-serif;font-weight:800;text-transform:uppercase;font-size:clamp(36px,8vw,72px);line-height:1;margin:12px 0 20px;letter-spacing:-.01em}
.design{display:inline-block;border:1px solid var(--border-strong);border-radius:4px;padding:6px 12px;color:var(--text)}
.design b{color:var(--accent)}
ul{list-style:none;margin:32px 0 0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}
.card{display:flex;flex-direction:column;gap:14px;height:100%;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:inherit;text-decoration:none}
.card:hover,.card:focus-visible{border-color:var(--text);outline:none}
.title{font-weight:600;font-size:18px;line-height:1.25}
.meta{display:flex;flex-wrap:wrap;gap:4px 14px;font-family:"Space Mono",ui-monospace,monospace;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--secondary)}
.empty{color:var(--secondary)}
</style></head><body><main>
<div class="label">LLM-WIKI-SITE / LOCAL HUB</div>
<h1>Wikis</h1>
<div class="label design">${designOpen} OPEN DESIGN ${designOpen === 1 ? "NOTE" : "NOTES"}</div>
${rows.length ? `<ul>${cards}</ul>` : '<p class="empty">No registered wikis. Run: llm-wiki-site register &lt;id&gt; &lt;wiki-path&gt;</p>'}
</main></body></html>`;
}

// Hub server. `siteApi`:
//   ids()          registered wiki ids
//   resolve(id)    that wiki's buildOpts (throws if its source is missing here)
//   runBuild(id)   build that wiki (re-imports the generator each call)
export async function serve({ repo, siteApi, review, host, port, prebuild, onListening }) {
  const siteIds = () => siteApi.ids();
  const isSite = (id) => siteIds().includes(id);

  // One global queue: builds never overlap, whichever wiki they are for.
  let queue = Promise.resolve();
  const enqueue = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };
  const rebuild = (id) => enqueue(async () => {
    const t = Date.now();
    const r = await siteApi.runBuild(id);
    return { ok: true, pages: r.pages, ms: Date.now() - t };
  });
  const ensureBuilt = (id, outDir) => enqueue(async () => {
    if (existsSync(join(outDir, "index.html"))) return;
    console.log(`Building ${id} on first request`);
    await siteApi.runBuild(id);
  });

  const outDirOf = (id) => siteApi.resolve(id).outDir;

  if (prebuild) {
    const t = Date.now();
    const r = await rebuild(prebuild);
    console.log(`Built ${prebuild}: ${r.pages} pages in ${Date.now() - t} ms`);
  }

  function hub() {
    const ids = siteIds();
    const counts = openCounts(repo, ids);
    const rows = ids.map((id) => {
      let title = id, built = "NOT BUILT";
      try {
        const b = siteApi.resolve(id);
        title = resolveConfig(b.wikiRoot, b.wikiDir, b.overrides).title || id;
        try {
          const m = JSON.parse(readFileSync(join(b.outDir, ".llm-wiki-site.json"), "utf8"));
          if (m.builtAt) built = "BUILT " + new Date(m.builtAt).toISOString().replace("T", " ").slice(0, 16) + " UTC";
        } catch { /* not built */ }
      } catch { /* unresolved source: show the id */ }
      return { id, title, built, open: counts.content[id] };
    });
    return hubHtml(rows, counts.design);
  }

  async function reviewRoute(req, res, url) {
    const path = url.pathname;
    if (req.method === "GET" && (path === "/__review/overlay.js" || path === "/__review/overlay.css")) {
      const f = join(REVIEW_ASSETS, path.split("/").pop());
      if (!existsSync(f)) throw httpError(404, "overlay asset missing");
      res.writeHead(200, { "content-type": TYPES[extname(f)], "cache-control": "no-store" });
      res.end(readFileSync(f));
      return;
    }
    const m = /^\/__review\/([^/]+)\/(.*)$/.exec(path);
    if (!m) throw httpError(404, "not found");
    let id;
    try { id = decodeURIComponent(m[1]); } catch { throw httpError(400, "bad site"); }
    if (!isSite(id)) throw httpError(404, "no such wiki");
    const rest = m[2];
    const readJson = async () => {
      try { return JSON.parse(await readBody(req)); } catch (e) { throw e.status ? e : httpError(400, "bad JSON"); }
    };

    if (rest === "notes" && req.method === "GET") {
      const page = url.searchParams.get("page");
      if (!validPage(page)) throw httpError(400, "bad page");
      const design = readDesignNotes(repo).filter((n) => n.site === id && n.page === page);
      sendJson(res, 200, [...readContentNotes(repo, id).filter((n) => n.page === page), ...design].sort(byCreated));
      return;
    }
    if (rest === "notes" && req.method === "POST") {
      const body = await readJson();
      let b;
      try { b = siteApi.resolve(id); } catch (e) { throw httpError(500, e.message); }
      sendJson(res, 200, createNote(repo, id, b, body));
      return;
    }
    const n = /^notes\/([^/]+)$/.exec(rest);
    if (n && req.method === "POST") {
      const body = await readJson();
      if (!body || (body.status !== "open" && body.status !== "resolved")) throw httpError(400, "status must be open or resolved");
      if (!validId(n[1]) || !findNote(repo, [id], n[1])) throw httpError(404, "no such note");
      sendJson(res, 200, setNoteStatus(repo, [id], n[1], body.status, body.resolution));
      return;
    }
    if (rest === "rebuild" && req.method === "POST") {
      try { sendJson(res, 200, await rebuild(id)); }
      catch (e) { sendJson(res, 500, { ok: false, error: String(e.message ?? e) }); }
      return;
    }
    if (rest.startsWith("img/") && req.method === "GET") {
      // Content images sit with the wiki's queue, design images with the shared one.
      const f = resolveStatic(join(contentDir(repo, id), "img"), rest.slice(3)) ??
        resolveStatic(join(designDir(repo), "img"), rest.slice(3));
      if (!f) throw httpError(404, "not found");
      sendFile(req, res, f);
      return;
    }
    throw httpError(404, "not found");
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/__review/")) {
        if (!review) throw httpError(404, "review mode is off (started with --no-review)");
        await reviewRoute(req, res, url);
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw httpError(405, "method not allowed");
      if (url.pathname === "/") {
        const b = Buffer.from(hub());
        res.writeHead(200, { "content-type": TYPES[".html"], "content-length": b.length, "cache-control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : b);
        return;
      }
      const segs = url.pathname.split("/");
      let id;
      try { id = decodeURIComponent(segs[1] ?? ""); } catch { throw httpError(404, "not found"); }
      if (!isSite(id)) throw httpError(404, "not found");
      if (segs.length === 2) {
        res.writeHead(301, { location: `/${segs[1]}/${url.search}` });
        res.end();
        return;
      }
      let outDir;
      try { outDir = outDirOf(id); } catch (e) { throw httpError(500, e.message); }
      if (!existsSync(outDir)) {
        try { await ensureBuilt(id, outDir); } catch (e) { throw httpError(500, `build of ${id} failed: ${e.message}`); }
      }
      const rest = "/" + segs.slice(2).join("/");
      const file = resolveStatic(outDir, rest);
      if (!file) throw httpError(404, "not found");
      // A directory asked for without its trailing slash: redirect so relative links resolve.
      if (!rest.endsWith("/") && basename(file) === "index.html" && basename(rest) !== "index.html") {
        res.writeHead(301, { location: `${url.pathname}/${url.search}` });
        res.end();
        return;
      }
      sendFile(req, res, file, { inject: review ? injectFor(id) : null });
    } catch (e) {
      if (res.headersSent) { res.destroy(); return; }
      const status = e.status ?? 500;
      if ((req.url ?? "").startsWith("/__review/")) sendJson(res, status, { ok: false, error: e.message });
      else {
        res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
        res.end(`${status} ${e.message}\n`);
      }
    }
  });

  await new Promise((ok, bad) => {
    server.once("error", (e) => {
      if (e.code === "EADDRINUSE") {
        bad(new Error(`port ${port} is busy on ${host}; a server is already running at http://${host.includes(":") ? `[${host}]` : host}:${port}/ ?`));
      } else bad(e);
    });
    server.listen(port, host, ok);
  });
  const addr = server.address();
  const base = `http://${host.includes(":") ? `[${host}]` : host}:${addr.port}/`;
  console.log(`Hub: ${base}`);
  console.log(review ? `Review on. Content notes in sites/<id>/review/, design notes in ${designDir(repo)}` : "Review off (--no-review).");
  if (onListening) onListening(base);
}
