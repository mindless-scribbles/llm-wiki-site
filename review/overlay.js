/* Review overlay for `llm-wiki-site serve --review`. Vanilla JS, no dependencies. */
(function () {
  "use strict";
  var SCRIPT = document.currentScript;
  var SITE = SCRIPT && SCRIPT.getAttribute("data-site");
  if (!SITE || window.__llmReview) return;
  window.__llmReview = true;
  document.documentElement.classList.add("llm-review");

  var API = "/__review/" + encodeURIComponent(SITE);
  var CANDIDATES = '[data-line], p, li, h1, h2, h3, h4, h5, h6, figure, table, pre, blockquote, img, video, section, details, .viz, [class*="lesson-"]';
  var MAX_IMG = 15 * 1024 * 1024;

  var state = { annotate: false, notes: [], panel: false, composer: null, hoverEl: null, focusId: null };

  function pageKey() {
    var p = location.pathname;
    try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
    p = p.replace(/^\/+/, "");
    // Pages are served under /<site>/; notes record the path inside the wiki.
    if (p.indexOf(SITE + "/") === 0) p = p.slice(SITE.length + 1);
    else if (p === SITE) p = "";
    if (p === "" || p.slice(-1) === "/") p += "index.html";
    return p;
  }
  var PAGE = pageKey();

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function btn(label, cls, onclick, extra) {
    var attrs = { type: "button", class: "rv-btn " + (cls || ""), text: label, onclick: onclick };
    if (extra) Object.keys(extra).forEach(function (k) { attrs[k] = extra[k]; });
    return h("button", attrs);
  }

  /* ---------- DOM skeleton ---------- */
  var root = h("div", { id: "llm-review-root" });
  var hl = h("div", { class: "rv-hl", "aria-hidden": "true" });
  var markers = h("div", { class: "rv-markers" });
  var toggleBtn = btn("REVIEW", "rv-primary", function () { setAnnotate(!state.annotate); }, { "aria-pressed": "false", title: "Annotate mode (n)" });
  var countEl = h("span", { class: "rv-label rv-count", text: "0 OPEN" });
  var notesBtn = btn("NOTES", "", function () { setPanel(!state.panel); });
  var pageBtn = btn("PAGE NOTE", "", function () { openComposer(null); });
  var rebuildBtn = btn("REBUILD", "", rebuild);
  var errEl = h("div", { class: "rv-err", role: "status", hidden: "" });
  var dock = h("div", { class: "rv-dock" }, [toggleBtn, countEl, notesBtn, pageBtn, rebuildBtn, errEl]);
  var listEl = h("ul", { class: "rv-list" });
  var panel = h("aside", { class: "rv-panel", "aria-label": "Review notes" }, [
    h("div", { class: "rv-panel-head" }, [
      h("span", { class: "rv-label", text: "NOTES ON THIS PAGE" }),
      btn("CLOSE", "", function () { setPanel(false); })
    ]),
    listEl
  ]);
  root.appendChild(hl);
  root.appendChild(markers);
  root.appendChild(panel);
  root.appendChild(dock);

  function mount() {
    document.body.appendChild(root);
    loadNotes();
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  function showError(msg) {
    errEl.textContent = msg || "";
    if (msg) errEl.removeAttribute("hidden"); else errEl.setAttribute("hidden", "");
  }

  function api(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.ok === false) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      });
    });
  }

  /* ---------- notes ---------- */
  function loadNotes() {
    api("GET", "/notes?page=" + encodeURIComponent(PAGE)).then(function (list) {
      state.notes = list;
      showError("");
      render();
    }).catch(function (e) { showError("Notes unavailable: " + e.message); });
  }

  function render() {
    var open = state.notes.filter(function (n) { return n.status === "open"; }).length;
    countEl.textContent = open + " OPEN";
    renderList();
    placeMarkers();
  }

  function resolveEl(n) {
    var a = n.anchor;
    if (!a) return null;
    var el = null;
    if (a.selector) { try { el = document.querySelector(a.selector); } catch (e) { el = null; } }
    if (!el && a.line != null) el = document.querySelector('[data-line="' + a.line + '"]');
    return el;
  }

  function placeMarkers() {
    markers.textContent = "";
    var sx = window.pageXOffset, sy = window.pageYOffset;
    var vw = document.documentElement.clientWidth;
    state.notes.forEach(function (n, i) {
      var el = resolveEl(n);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      var m = h("button", {
        type: "button",
        class: "rv-marker" + (n.status === "resolved" ? " rv-resolved" : ""),
        text: "[" + (i + 1) + "]" + (n.kind === "design" ? " DESIGN" : ""),
        "aria-label": "Note " + (i + 1) + ", " + n.status + (n.kind === "design" ? ", design" : ""),
        onclick: function (ev) { ev.stopPropagation(); focusNote(n.id); }
      });
      var left = Math.min(r.right + sx - 4, sx + vw - 40);
      m.style.left = Math.max(sx + 4, left) + "px";
      m.style.top = (r.top + sy) + "px";
      markers.appendChild(m);
    });
  }
  var rafId = 0;
  function schedulePlace() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = 0; placeMarkers(); });
  }
  window.addEventListener("resize", schedulePlace);
  // Layout can change without a resize: a lesson phase switch, a reveal, a zoom.
  window.addEventListener("hashchange", schedulePlace);
  document.addEventListener("toggle", schedulePlace, true);
  document.addEventListener("click", function () { setTimeout(schedulePlace, 0); });
  window.addEventListener("load", schedulePlace);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(schedulePlace);
    var watch = function () { if (document.body) ro.observe(document.body); };
    if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
  }

  function renderList() {
    listEl.textContent = "";
    if (!state.notes.length) {
      listEl.appendChild(h("li", { class: "rv-empty", text: "No notes on this page yet." }));
      return;
    }
    state.notes.forEach(function (n, i) {
      var a = n.anchor || {};
      var li = h("li", { class: "rv-note" + (n.status === "resolved" ? " rv-resolved" : "") + (n.id === state.focusId ? " rv-focus" : ""), "data-id": n.id });
      var head = h("div", { class: "rv-note-head" }, [
        h("span", { class: "rv-label", text: "[" + (i + 1) + "] " + (a.excerpt || a.tag ? (a.tag || "").toUpperCase() : "PAGE") + " / " + n.status.toUpperCase() }),
        n.kind === "design" ? h("span", { class: "rv-tag rv-label", text: "DESIGN" }) : null,
        btn(n.status === "open" ? "RESOLVE" : "REOPEN", "", function () { toggle(n); })
      ]);
      li.appendChild(head);
      if (a.excerpt) {
        var ex = h("div", { class: "rv-excerpt", text: a.excerpt });
        li.appendChild(ex);
        var target = resolveEl(n);
        if (target) {
          ex.style.cursor = "pointer";
          ex.addEventListener("click", function () { reveal(target); });
        }
      }
      if (n.text) li.appendChild(h("div", { class: "rv-text", text: n.text }));
      (n.images || []).forEach(function (src) {
        li.appendChild(h("img", { class: "rv-img", src: API + "/" + src, alt: "Attached image", loading: "lazy" }));
      });
      if (n.resolution) li.appendChild(h("div", { class: "rv-resolution", text: "Resolved: " + n.resolution }));
      listEl.appendChild(li);
    });
  }

  function toggle(n) {
    api("POST", "/notes/" + n.id, { status: n.status === "open" ? "resolved" : "open" }).then(function (u) {
      state.notes = state.notes.map(function (x) { return x.id === u.id ? u : x; });
      showError("");
      render();
    }).catch(function (e) { showError("Could not update: " + e.message); });
  }

  // A note can sit in a lesson phase that is hidden (one phase at a time) or in a
  // closed <details>. Open its phase and its reveal, then scroll to it.
  function reveal(el) {
    var phase = el.closest && el.closest(".lesson-phase");
    if (phase && !phase.getClientRects().length) location.hash = "phase-" + phase.getAttribute("data-phase");
    var d = el.closest && el.closest("details");
    if (d) d.open = true;
    setTimeout(function () { el.scrollIntoView({ block: "center" }); schedulePlace(); }, 0);
  }

  function focusNote(id) {
    state.focusId = id;
    setPanel(true);
    renderList();
    var li = listEl.querySelector('[data-id="' + id + '"]');
    if (li) li.scrollIntoView({ block: "nearest" });
  }

  function setPanel(on) {
    state.panel = on;
    panel.classList.toggle("rv-open", on);
    if (on) renderList();
  }

  function rebuild() {
    rebuildBtn.disabled = true;
    rebuildBtn.textContent = "BUILDING";
    showError("");
    api("POST", "/rebuild").then(function () { location.reload(); }).catch(function (e) {
      rebuildBtn.disabled = false;
      rebuildBtn.textContent = "REBUILD";
      showError("Rebuild failed: " + e.message);
    });
  }

  /* ---------- annotate mode ---------- */
  function setAnnotate(on) {
    state.annotate = on;
    toggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    document.documentElement.classList.toggle("llm-review-annotating", on);
    if (!on) { hl.style.display = "none"; state.hoverEl = null; }
  }

  function inOverlay(t) { return t && t.nodeType === 1 && root.contains(t); }
  function scope() { return document.querySelector("main") || document.body; }

  function pickTarget(t) {
    var sc = scope();
    if (!t || t.nodeType !== 1 || !sc.contains(t)) return null;
    var first = null;
    for (var el = t; el && el !== sc.parentNode; el = el.parentElement) {
      if (el.hasAttribute && el.hasAttribute("data-line")) return el;
      if (!first && el.matches && el.matches(CANDIDATES) && el !== sc) first = el;
      if (el === sc) break;
    }
    return first;
  }

  function drawHl(el) {
    if (!el) { hl.style.display = "none"; return; }
    var r = el.getBoundingClientRect();
    hl.style.display = "block";
    hl.style.left = r.left + "px";
    hl.style.top = r.top + "px";
    hl.style.width = r.width + "px";
    hl.style.height = r.height + "px";
  }

  document.addEventListener("mousemove", function (e) {
    if (!state.annotate || state.composer) return;
    if (inOverlay(e.target)) { drawHl(null); state.hoverEl = null; return; }
    state.hoverEl = pickTarget(e.target);
    drawHl(state.hoverEl);
  }, true);
  window.addEventListener("scroll", function () { if (state.annotate && state.hoverEl) drawHl(state.hoverEl); }, true);

  function swallow(e) {
    if (!state.annotate || inOverlay(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  ["mousedown", "mouseup", "auxclick", "dblclick", "submit", "pointerup"].forEach(function (t) { document.addEventListener(t, swallow, true); });
  document.addEventListener("click", function (e) {
    if (!state.annotate || inOverlay(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (state.composer) return;
    var el = pickTarget(e.target);
    if (el) openComposer(el);
  }, true);

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === "Escape") {
      if (state.composer) closeComposer();
      else if (state.annotate) setAnnotate(false);
      else if (state.panel) setPanel(false);
      return;
    }
    if ((e.key === "n" || e.key === "N") && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setAnnotate(!state.annotate);
    }
  });

  /* ---------- anchor capture ---------- */
  function cssPath(el) {
    var parts = [];
    var sc = scope();
    for (var cur = el; cur && cur.nodeType === 1; cur = cur.parentElement) {
      if (cur.id) { parts.unshift("#" + CSS.escape(cur.id)); return parts.join(" > "); }
      if (cur === sc || cur === document.body) { parts.unshift(cur.tagName.toLowerCase()); return parts.join(" > "); }
      var tag = cur.tagName.toLowerCase();
      var idx = 1;
      for (var s = cur.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === cur.tagName) idx++;
      parts.unshift(tag + ":nth-of-type(" + idx + ")");
    }
    return parts.join(" > ");
  }

  function nearestHeading(el) {
    var found = null;
    var hs = document.querySelectorAll("h1, h2, h3, h4");
    for (var i = 0; i < hs.length; i++) {
      var pos = hs[i].compareDocumentPosition(el);
      // heading precedes el, or contains el, or is el
      if (hs[i] === el || (pos & Node.DOCUMENT_POSITION_FOLLOWING) || (pos & Node.DOCUMENT_POSITION_CONTAINED_BY)) found = hs[i];
      else break;
    }
    return found;
  }

  function captureAnchor(el) {
    var lineEl = el.closest("[data-line]");
    var ph = el.closest("[data-phase]");
    var hd = nearestHeading(el);
    var ex = (el.innerText || el.getAttribute("alt") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    return {
      selector: cssPath(el),
      line: lineEl && isFinite(Number(lineEl.getAttribute("data-line"))) ? Number(lineEl.getAttribute("data-line")) : null,
      heading: hd ? (hd.innerText || hd.textContent).replace(/\s+/g, " ").trim() : null,
      headingId: hd && hd.id ? hd.id : null,
      excerpt: ex.slice(0, 240),
      tag: el.tagName.toLowerCase(),
      phase: ph ? ph.getAttribute("data-phase") : null
    };
  }

  /* ---------- composer ---------- */
  function readImage(file) {
    return new Promise(function (ok, bad) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return bad(new Error("Only png, jpeg, webp or gif images"));
      if (file.size > MAX_IMG) return bad(new Error("Image is over 15 MB"));
      var fr = new FileReader();
      fr.onload = function () { ok(fr.result); };
      fr.onerror = function () { bad(new Error("Could not read image")); };
      fr.readAsDataURL(file);
    });
  }

  function openComposer(el) {
    if (state.composer) closeComposer();
    var anchor = el ? captureAnchor(el) : null;
    var images = [];
    var kind = "content";
    var kindBtns = {};
    function setKind(k) {
      kind = k;
      Object.keys(kindBtns).forEach(function (key) { kindBtns[key].setAttribute("aria-pressed", key === k ? "true" : "false"); });
      kindHint.textContent = k === "design" ? "HOW EVERY PAGE LIKE THIS IS LAID OUT" : "WHAT THIS PAGE SAYS";
    }
    kindBtns.content = btn("CONTENT", "", function () { setKind("content"); }, { "aria-pressed": "true" });
    kindBtns.design = btn("DESIGN", "", function () { setKind("design"); }, { "aria-pressed": "false" });
    var kindHint = h("div", { class: "rv-label rv-hint", text: "WHAT THIS PAGE SAYS" });
    var kindSwitch = h("div", { class: "rv-kind", role: "group", "aria-label": "Note kind" }, [kindBtns.content, kindBtns.design]);
    var ta = h("textarea", { "aria-label": "Note text", placeholder: "Your note", rows: "4" });
    var thumbs = h("div", { class: "rv-thumbs" });
    var err = h("div", { class: "rv-hint rv-label", role: "alert", hidden: "" });
    var saveBtn = btn("SAVE", "rv-primary rv-solid", save);
    var box = h("div", { class: "rv-composer", role: "dialog", "aria-label": "New note" }, [
      h("div", { class: "rv-label rv-where", text: anchor ? ("<" + anchor.tag + "> " + (anchor.excerpt || "")) : "PAGE NOTE" }),
      kindSwitch,
      kindHint,
      ta,
      h("div", { class: "rv-label rv-hint", text: "PASTE OR DROP AN IMAGE" }),
      thumbs,
      err,
      h("div", { class: "rv-actions" }, [btn("CANCEL", "rv-primary", closeComposer), saveBtn])
    ]);

    function setErr(m) { err.textContent = m || ""; if (m) err.removeAttribute("hidden"); else err.setAttribute("hidden", ""); }
    function drawThumbs() {
      thumbs.textContent = "";
      images.forEach(function (src, i) {
        thumbs.appendChild(h("div", { class: "rv-thumb" }, [
          h("img", { src: src, alt: "Attached image " + (i + 1) }),
          h("button", { type: "button", "aria-label": "Remove image " + (i + 1), text: "x", onclick: function () { images.splice(i, 1); drawThumbs(); } })
        ]));
      });
    }
    function attach(files) {
      Array.prototype.forEach.call(files, function (f) {
        readImage(f).then(function (d) { images.push(d); drawThumbs(); setErr(""); }).catch(function (e) { setErr(e.message); });
      });
    }
    function save() {
      var text = ta.value.trim();
      if (!text && !images.length) { setErr("Add text or an image."); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = "SAVING";
      api("POST", "/notes", {
        page: PAGE,
        kind: kind,
        anchor: anchor,
        text: text,
        images: images,
        viewport: { w: window.innerWidth, h: window.innerHeight }
      }).then(function (n) {
        state.notes.push(n);
        closeComposer();
        showError("");
        render();
      }).catch(function (e) {
        saveBtn.disabled = false;
        saveBtn.textContent = "SAVE";
        setErr("Could not save: " + e.message);
      });
    }

    ta.addEventListener("paste", function (e) {
      var files = [];
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === "file" && /^image\//.test(items[i].type)) files.push(items[i].getAsFile());
      if (files.length) { e.preventDefault(); attach(files); }
    });
    box.addEventListener("dragover", function (e) { e.preventDefault(); box.classList.add("rv-drop"); });
    box.addEventListener("dragleave", function () { box.classList.remove("rv-drop"); });
    box.addEventListener("drop", function (e) {
      e.preventDefault();
      box.classList.remove("rv-drop");
      if (e.dataTransfer && e.dataTransfer.files.length) attach(e.dataTransfer.files);
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    });

    root.appendChild(box);
    positionComposer(box, el);
    drawHl(el);
    state.composer = box;
    ta.focus();
  }

  function positionComposer(box, el) {
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var bw = box.offsetWidth, bh = box.offsetHeight;
    var left, top;
    if (el) {
      var r = el.getBoundingClientRect();
      left = r.left;
      top = r.bottom + 10;
      if (top + bh > vh - 12) top = Math.max(12, r.top - bh - 10);
      if (top + bh > vh - 12) top = Math.max(12, vh - bh - 12);
    } else {
      left = vw - bw - 16;
      top = vh - bh - 90;
    }
    left = Math.min(Math.max(12, left), Math.max(12, vw - bw - 12));
    box.style.left = left + "px";
    box.style.top = Math.max(12, top) + "px";
  }

  function closeComposer() {
    if (state.composer) { state.composer.remove(); state.composer = null; }
    hl.style.display = "none";
  }
})();
