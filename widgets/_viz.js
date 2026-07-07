/* _viz.js — shared interactive-visualization library for the Mastering Matrices wiki.
 * Vanilla JS, no dependencies. Loaded once per concept page before the widget file.
 *
 * Widget contract:
 *   VIZ.build('<slug>', function(panel){ ... });
 * The build injects <div class="viz-block" data-viz="<slug>"></div>; VIZ.build finds it,
 * creates a Panel, and calls your setup fn. If the mount is missing it no-ops.
 *
 * Panel API
 *   panel.scene({world:[xmin,xmax,ymin,ymax], aspect}) -> Scene  (a fitted 2D canvas)
 *   panel.slider({label,min,max,value,step,unit,onInput}) -> {el,set,get}
 *   panel.toggle({label,value,onChange}) -> {el,get,set}
 *   panel.buttons([{label,onClick,active}]) -> segmented control
 *   panel.button({label,onClick}) -> button
 *   panel.readout(html)  set the readout line (accepts HTML)
 *   panel.note(html)     one-line caption under the stage
 *
 * Scene API (all coordinates are WORLD coords, y-up)
 *   s.onDraw(fn)                 register the draw callback; called on every render
 *   s.render()                   redraw now
 *   s.draggable({x,y,color,r,label,constrain,onDrag}) -> handle {x,y}
 *   s.animate(tickFn) -> {stop}  requestAnimationFrame loop; tickFn(dtSeconds)
 *   drawing (inside onDraw):
 *     s.grid(step,color) s.axes({x,y,origin}) s.line(x1,y1,x2,y2,opt)
 *     s.arrow(x1,y1,x2,y2,opt) s.dot(x,y,opt) s.poly(pts,opt) s.text(x,y,str,opt)
 *     s.ring(x,y,rad,opt) s.arc(cx,cy,rad,a0,a1,opt) s.fillTri(a,b,c,opt)
 */
(function () {
  const C = {
    bg: "#0d0d10",
    grid: "rgba(244,244,245,0.06)",
    gridBold: "rgba(244,244,245,0.13)",
    ink: "#cccccc",
    dim: "#7a7a82",
    accent: "#ff3300",
    x: "#ff4d3d",
    y: "#3ddc84",
    z: "#3aa0ff",
    a1: "#fbbf24",
    a2: "#a78bfa",
    a3: "#22d3ee",
    ghost: "rgba(244,244,245,0.28)",
  };
  const FONT = '"Space Mono", ui-monospace, monospace';

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---- Scene (fitted 2D canvas with world coords + draggable handles) --------
  function Scene(host, opts) {
    const world = opts.world || [-5, 5, -5, 5];
    const aspect = opts.aspect || 1.35; // width / height
    const canvas = el("canvas", "viz-canvas");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let W = 0, H = 0, dpr = 1;
    let drawFn = () => {};
    const handles = [];
    let dragging = null;

    function fit() {
      const cw = host.clientWidth || 600;
      W = cw;
      H = Math.round(cw / aspect);
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      render();
    }

    // world -> screen
    const pad = 0.06;
    function sx(x) {
      const [x0, x1] = world;
      const t = (x - x0) / (x1 - x0);
      return (pad + t * (1 - 2 * pad)) * W;
    }
    function sy(y) {
      const y0 = world[2], y1 = world[3];
      const t = (y - y0) / (y1 - y0);
      return (1 - (pad + t * (1 - 2 * pad))) * H;
    }
    // screen -> world (for dragging)
    function wx(px) {
      const [x0, x1] = world;
      const t = (px / W - pad) / (1 - 2 * pad);
      return x0 + t * (x1 - x0);
    }
    function wy(py) {
      const y0 = world[2], y1 = world[3];
      const t = (1 - py / H - pad) / (1 - 2 * pad);
      return y0 + t * (y1 - y0);
    }
    const unit = () => Math.abs(sx(1) - sx(0)); // px per world unit (x)

    const S = { canvas, ctx, world, C, sx, sy, wx, wy, unit };

    S.onDraw = (fn) => { drawFn = fn; return S; };
    S.render = render;

    function render() {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      drawFn(S);
      // draw handles on top
      for (const h of handles) {
        if (h.hidden) continue;
        const px = sx(h.x), py = sy(h.y), r = h.r || 8;
        ctx.beginPath();
        ctx.arc(px, py, r + 4, 0, 7);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 7);
        ctx.fillStyle = h.color || C.accent;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
        if (h.label) S.text(h.x, h.y, h.label, { color: "#fff", dy: -r - 8, align: "center", size: 10 });
      }
      ctx.restore();
    }

    // ---- drawing primitives (world coords) ----
    S.grid = function (step, color) {
      step = step || 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = color || C.grid;
      const [x0, x1, y0, y1] = world;
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
        ctx.beginPath(); ctx.moveTo(sx(x), sy(y0)); ctx.lineTo(sx(x), sy(y1)); ctx.stroke();
      }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        ctx.beginPath(); ctx.moveTo(sx(x0), sy(y)); ctx.lineTo(sx(x1), sy(y)); ctx.stroke();
      }
    };
    S.axes = function (o) {
      o = o || {};
      const ox = o.origin ? o.origin[0] : 0, oy = o.origin ? o.origin[1] : 0;
      const [x0, x1, y0, y1] = world;
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.gridBold;
      ctx.beginPath(); ctx.moveTo(sx(x0), sy(oy)); ctx.lineTo(sx(x1), sy(oy)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(ox), sy(y0)); ctx.lineTo(sx(ox), sy(y1)); ctx.stroke();
    };
    S.line = function (x1, y1, x2, y2, opt) {
      opt = opt || {};
      ctx.save();
      ctx.lineWidth = opt.width || 2;
      ctx.strokeStyle = opt.color || C.ink;
      ctx.setLineDash(opt.dash || []);
      ctx.beginPath(); ctx.moveTo(sx(x1), sy(y1)); ctx.lineTo(sx(x2), sy(y2)); ctx.stroke();
      ctx.restore();
    };
    S.arrow = function (x1, y1, x2, y2, opt) {
      opt = opt || {};
      const col = opt.color || C.accent, w = opt.width || 2.5;
      S.line(x1, y1, x2, y2, { color: col, width: w, dash: opt.dash });
      const ang = Math.atan2(sy(y2) - sy(y1), sx(x2) - sx(x1));
      const hl = opt.head || 10;
      ctx.save();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(sx(x2), sy(y2));
      ctx.lineTo(sx(x2) - hl * Math.cos(ang - 0.4), sy(y2) - hl * Math.sin(ang - 0.4));
      ctx.lineTo(sx(x2) - hl * Math.cos(ang + 0.4), sy(y2) - hl * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    S.dot = function (x, y, opt) {
      opt = opt || {};
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), opt.r || 4, 0, 7);
      ctx.fillStyle = opt.color || C.ink;
      ctx.fill();
      if (opt.ring) { ctx.lineWidth = 2; ctx.strokeStyle = opt.ring; ctx.stroke(); }
      if (opt.label) S.text(x, y, opt.label, { color: opt.color || C.ink, dy: -(opt.r || 4) - 7, align: "center", size: 10 });
    };
    S.poly = function (pts, opt) {
      opt = opt || {};
      if (!pts.length) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sx(pts[0][0]), sy(pts[0][1]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1]));
      if (opt.close) ctx.closePath();
      if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }
      if (opt.color !== null) {
        ctx.lineWidth = opt.width || 2;
        ctx.strokeStyle = opt.color || C.ink;
        ctx.setLineDash(opt.dash || []);
        ctx.lineJoin = "round";
        ctx.stroke();
      }
      ctx.restore();
    };
    S.fillTri = function (a, b, c, opt) {
      S.poly([a, b, c], { close: true, fill: (opt && opt.fill) || "rgba(255,51,0,0.12)", color: (opt && opt.color) || null });
    };
    S.ring = function (x, y, rad, opt) {
      opt = opt || {};
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx(x), sy(y), rad * unit(), 0, 7);
      ctx.lineWidth = opt.width || 1.5;
      ctx.strokeStyle = opt.color || C.dim;
      ctx.setLineDash(opt.dash || []);
      ctx.stroke();
      ctx.restore();
    };
    S.arc = function (cx, cy, rad, a0, a1, opt) {
      opt = opt || {};
      ctx.save();
      ctx.beginPath();
      // canvas y is flipped: negate angles and swap dir
      ctx.arc(sx(cx), sy(cy), rad * unit(), -a0, -a1, true);
      ctx.lineWidth = opt.width || 2;
      ctx.strokeStyle = opt.color || C.a1;
      ctx.setLineDash(opt.dash || []);
      ctx.stroke();
      ctx.restore();
    };
    S.text = function (x, y, str, opt) {
      opt = opt || {};
      ctx.save();
      ctx.font = `${opt.weight || 400} ${opt.size || 11}px ${FONT}`;
      ctx.fillStyle = opt.color || C.ink;
      ctx.textAlign = opt.align || "left";
      ctx.textBaseline = opt.baseline || "alphabetic";
      ctx.fillText(str, sx(x) + (opt.dx || 0), sy(y) + (opt.dy || 0));
      ctx.restore();
    };

    // ---- draggable handles ----
    S.draggable = function (h) {
      h.r = h.r || 8;
      handles.push(h);
      return h;
    };
    function pointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { px: t.clientX - rect.left, py: t.clientY - rect.top };
    }
    function pick(px, py) {
      for (let i = handles.length - 1; i >= 0; i--) {
        const h = handles[i];
        if (h.hidden) continue;
        const dx = sx(h.x) - px, dy = sy(h.y) - py;
        if (dx * dx + dy * dy <= Math.pow((h.r || 8) + 8, 2)) return h;
      }
      return null;
    }
    function down(e) {
      const { px, py } = pointerPos(e);
      dragging = pick(px, py);
      if (dragging) { e.preventDefault(); canvas.style.cursor = "grabbing"; }
    }
    function move(e) {
      const { px, py } = pointerPos(e);
      if (!dragging) { canvas.style.cursor = pick(px, py) ? "grab" : "default"; return; }
      e.preventDefault();
      let nx = wx(px), ny = wy(py);
      if (dragging.constrain) { const c = dragging.constrain(nx, ny); nx = c[0]; ny = c[1]; }
      dragging.x = nx; dragging.y = ny;
      if (dragging.onDrag) dragging.onDrag(dragging);
      render();
    }
    function up() { dragging = null; canvas.style.cursor = "default"; }
    canvas.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);

    // ---- animation loop ----
    S.animate = function (tick) {
      let raf, last = null, stopped = false;
      function frame(ts) {
        if (stopped) return;
        if (last == null) last = ts;
        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;
        tick(dt);
        render();
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      return { stop() { stopped = true; cancelAnimationFrame(raf); } };
    };

    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
    else window.addEventListener("resize", fit);
    setTimeout(fit, 0);
    return S;
  }

  // ---- Panel (stage + controls + readout) -----------------------------------
  function Panel(mount, slug) {
    const root = el("div", "viz");
    root.appendChild(el("div", "viz-label", 'INTERACTIVE'));
    const stage = el("div", "viz-stage");
    const controls = el("div", "viz-controls");
    const readoutEl = el("div", "viz-readout");
    const noteEl = el("div", "viz-note");
    root.appendChild(stage);
    root.appendChild(controls);
    root.appendChild(readoutEl);
    root.appendChild(noteEl);
    mount.appendChild(root);

    const P = { root, stageEl: stage, controlsEl: controls };
    P.scene = (opts) => Scene(stage, opts || {});
    P.readout = (html) => { readoutEl.innerHTML = html; };
    P.note = (html) => { noteEl.innerHTML = html; };

    P.slider = function (o) {
      const wrap = el("label", "viz-ctl viz-slider");
      const head = el("div", "viz-ctl-head");
      const name = el("span", "viz-ctl-label", o.label || "");
      const val = el("span", "viz-ctl-val", "");
      head.appendChild(name); head.appendChild(val);
      const input = el("input", "viz-range");
      input.type = "range";
      input.min = o.min; input.max = o.max; input.step = o.step || "any";
      input.value = o.value;
      wrap.appendChild(head); wrap.appendChild(input);
      controls.appendChild(wrap);
      const fmt = (v) => (o.fmt ? o.fmt(v) : (+v).toFixed(o.dp != null ? o.dp : 2)) + (o.unit || "");
      const show = () => (val.textContent = fmt(input.value));
      input.addEventListener("input", () => { show(); o.onInput && o.onInput(+input.value); });
      show();
      return { el: wrap, input, get: () => +input.value, set: (v) => { input.value = v; show(); } };
    };

    P.toggle = function (o) {
      const wrap = el("label", "viz-ctl viz-toggle");
      const box = el("span", "viz-switch");
      const name = el("span", "viz-ctl-label", o.label || "");
      const input = el("input");
      input.type = "checkbox"; input.checked = !!o.value;
      wrap.appendChild(input); wrap.appendChild(box); wrap.appendChild(name);
      controls.appendChild(wrap);
      input.addEventListener("change", () => o.onChange && o.onChange(input.checked));
      return { el: wrap, get: () => input.checked, set: (v) => { input.checked = v; } };
    };

    P.buttons = function (list) {
      const wrap = el("div", "viz-seg");
      const btns = [];
      list.forEach((b, i) => {
        const btn = el("button", "viz-seg-btn" + (b.active ? " active" : ""), b.label);
        btn.addEventListener("click", () => {
          btns.forEach((x) => x.classList.remove("active"));
          btn.classList.add("active");
          b.onClick && b.onClick(i);
        });
        wrap.appendChild(btn); btns.push(btn);
      });
      controls.appendChild(wrap);
      return { el: wrap, select: (i) => btns[i] && btns[i].click() };
    };

    P.button = function (o) {
      const btn = el("button", "viz-btn", o.label || "");
      btn.addEventListener("click", () => o.onClick && o.onClick(btn));
      controls.appendChild(btn);
      return btn;
    };

    return P;
  }

  // ---- public API -----------------------------------------------------------
  const VIZ = {
    C, FONT,
    build(slug, setup) {
      function go() {
        const mount = document.querySelector('[data-viz="' + slug + '"]');
        if (!mount || mount.dataset.ready) return;
        mount.dataset.ready = "1";
        try { setup(Panel(mount, slug)); }
        catch (err) {
          mount.appendChild(el("div", "viz-error", "Visualization failed to load."));
          console.error("[viz:" + slug + "]", err);
        }
      }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
      else go();
    },
    // small vector helpers
    v: {
      add: (a, b) => [a[0] + b[0], a[1] + b[1]],
      sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
      mul: (a, s) => [a[0] * s, a[1] * s],
      len: (a) => Math.hypot(a[0], a[1]),
      norm: (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; },
      dot: (a, b) => a[0] * b[0] + a[1] * b[1],
      rot: (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)],
      lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    },
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  };
  window.VIZ = VIZ;
})();
