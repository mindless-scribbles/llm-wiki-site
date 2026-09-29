/* emissive-material — the M_EmissiveProcedural node chain, live.
 * Shows how LineMask, 1-x, LineEmissiveColor, Multiply and the Time pulse combine
 * into the Emissive Color output, and re-renders a floor preview as you change values.
 * Distilled from Lesson 04, Phase 12 (38:11 -> 49:33). */
VIZ.build("emissive-material", function (panel) {
  const C = VIZ.C;
  const clamp = VIZ.clamp;

  // ---- state (mirrors the material's exposed parameters) -------------------
  const st = {
    hue: 20,        // LineEmissiveColor: which color (0..360)
    bright: 2.2,    // LineEmissiveColor: brightness (>1 = HDR / blooms)
    invert: true,   // 1-x (OneMinus): true -> lines glow, false -> cells glow
    pulse: true,    // Time pulse network wired in?
    period: 4.0,    // EmissiveCalmDuration: seconds per breath
    depth: 0.85,    // how far it dims between flashes (0 = steady, 1 = to black)
    t: 0,           // animation clock (advances only while pulsing)
  };

  const s = panel.scene({ world: [0, 18, 0, 11.5], aspect: 1.62 });
  const ctx = s.ctx;

  // ---- color helpers -------------------------------------------------------
  // HSL(hue,100%,50%) -> linear-ish rgb in 0..1, then scaled by an intensity.
  function hueRgb(h) {
    h = ((h % 360) + 360) % 360 / 60;
    const x = 1 - Math.abs((h % 2) - 1);
    const t = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x]
            : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    return t;
  }
  // css color for an intensity (channels clamped for display; >1 handled via glow)
  function css(intensity) {
    const c = hueRgb(st.hue);
    const r = clamp(c[0] * intensity, 0, 1) * 255;
    const g = clamp(c[1] * intensity, 0, 1) * 255;
    const b = clamp(c[2] * intensity, 0, 1) * 255;
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  // ---- the math the graph performs -----------------------------------------
  // pulse(t): cosine breathing in [1-depth, 1]; disabled -> constant 1.
  function pulseVal() {
    if (!st.pulse) return 1;
    const raw = (Math.cos((2 * Math.PI * st.t) / st.period) + 1) / 2; // 0..1
    return 1 - st.depth * (1 - raw);
  }
  // LineMask sampled on a grid line vs inside a cell (the precomputed grid mask).
  const maskLine = () => (st.invert ? 1 : 0); // 1-x flips which region survives
  const maskCell = () => (st.invert ? 0 : 1);

  // ---- node-box drawing (screen-space rectangles, world-space anchors) -----
  function box(cx, cy, w, h, opt) {
    opt = opt || {};
    const x = s.sx(cx - w / 2), y = s.sy(cy + h / 2);
    const x2 = s.sx(cx + w / 2), y2 = s.sy(cy - h / 2);
    ctx.save();
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x2, y, x2, y2, r);
    ctx.arcTo(x2, y2, x, y2, r);
    ctx.arcTo(x, y2, x, y, r);
    ctx.arcTo(x, y, x2, y, r);
    ctx.closePath();
    ctx.fillStyle = opt.fill || "#111116";
    ctx.fill();
    ctx.lineWidth = opt.active ? 2 : 1;
    ctx.strokeStyle = opt.active ? C.accent : "rgba(244,244,245,0.2)";
    ctx.stroke();
    ctx.restore();
  }
  function label(cx, cy, title, sub, opt) {
    opt = opt || {};
    s.text(cx, cy, title, { align: "center", size: 11, weight: 700, color: opt.tcol || "#e8e8e9", dy: -1 });
    if (sub != null) s.text(cx, cy, sub, { align: "center", size: 9.5, color: opt.scol || C.dim, dy: 13 });
  }
  // a wire; when active, a signal dot rides along it (phase from the clock)
  function wire(x1, y1, x2, y2, active, col) {
    s.line(x1, y1, x2, y2, { color: active ? (col || "rgba(244,244,245,0.5)") : "rgba(244,244,245,0.12)", width: active ? 2 : 1.2 });
    if (active && st.pulse) {
      const p = ((st.t / 1.4) % 1 + 1) % 1;
      s.dot(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p, { r: 3, color: col || C.accent });
    }
  }

  // ---- node coordinates ----------------------------------------------------
  const N = {
    mask:  [2.3, 9.7],   // LineMask
    minus: [6.6, 9.7],   // 1-x (OneMinus)
    color: [2.3, 7.2],   // LineEmissiveColor
    mul1:  [9.9, 8.4],   // Multiply  (mask' x color)
    time:  [2.3, 4.6],   // Time (period = EmissiveCalmDuration)
    cos:   [6.6, 4.6],   // Cosine pulse
    mul2:  [13.2, 6.5],  // Multiply  (x pulse) / Lerp
    out:   [16.4, 6.5],  // Emissive Color -> Set Material Attributes
  };
  const BW = 3.4, BH = 1.5, SW = 2.3;

  s.onDraw(function () {
    const pv = pulseVal();

    // ---- wires (draw under the boxes) ----
    wire(N.mask[0] + BW / 2, N.mask[1], N.minus[0] - SW / 2, N.minus[1], true);
    wire(N.minus[0] + SW / 2, N.minus[1], N.mul1[0] - BW / 2, N.mul1[1] + 0.4, true);
    wire(N.color[0] + BW / 2, N.color[1], N.mul1[0] - BW / 2, N.mul1[1] - 0.4, true, css(st.bright));
    wire(N.mul1[0] + BW / 2, N.mul1[1], N.mul2[0] - BW / 2, N.mul2[1] + 0.4, true);
    wire(N.time[0] + BW / 2, N.time[1], N.cos[0] - SW / 2, N.cos[1], st.pulse);
    wire(N.cos[0] + SW / 2, N.cos[1], N.mul2[0] - BW / 2, N.mul2[1] - 0.4, st.pulse);
    wire(N.mul2[0] + BW / 2, N.mul2[1], N.out[0] - BW / 2, N.out[1], true, C.accent);
    // output down to the preview
    wire(N.out[0], N.out[1] - BH / 2, N.out[0], 4.0, true, C.accent);
    s.line(N.out[0], 4.0, 9, 4.0, { color: "rgba(255,51,0,0.35)", width: 1.2, dash: [4, 4] });
    s.line(9, 4.0, 9, 3.7, { color: "rgba(255,51,0,0.35)", width: 1.2, dash: [4, 4] });

    // ---- boxes ----
    box(N.mask[0], N.mask[1], BW, BH, { active: true });
    label(N.mask[0], N.mask[1], "LineMask", "grid: cells=1 lines=0");

    box(N.minus[0], N.minus[1], SW, BH, { active: st.invert });
    label(N.minus[0], N.minus[1], "1 - x", st.invert ? "ON -> lines" : "OFF -> cells",
      { tcol: st.invert ? C.accent : "#e8e8e9" });

    // color node with a live swatch chip
    box(N.color[0], N.color[1], BW, BH, { active: true });
    ctx.fillStyle = css(st.bright);
    const sw = 12;
    ctx.fillRect(s.sx(N.color[0]) - sw / 2, s.sy(N.color[1] + 0.15) - sw - 2, sw, sw);
    s.text(N.color[0], N.color[1], "LineEmissiveColor", { align: "center", size: 10, weight: 700, color: "#e8e8e9", dy: 12 });
    s.text(N.color[0], N.color[1], `hue ${st.hue | 0} · x${st.bright.toFixed(1)}`, { align: "center", size: 9, color: C.dim, dy: 23 });

    box(N.mul1[0], N.mul1[1], BW, BH, { active: true });
    label(N.mul1[0], N.mul1[1], "Multiply", "mask' x color");

    box(N.time[0], N.time[1], BW, BH, { active: st.pulse });
    label(N.time[0], N.time[1], "Time", `period ${st.period.toFixed(1)}s`,
      { tcol: st.pulse ? "#e8e8e9" : C.dim });

    box(N.cos[0], N.cos[1], SW, BH, { active: st.pulse });
    label(N.cos[0], N.cos[1], "Cos pulse", st.pulse ? `x${pv.toFixed(2)}` : "bypassed",
      { tcol: st.pulse ? C.accent : C.dim, scol: st.pulse ? C.accent : C.dim });

    box(N.mul2[0], N.mul2[1], BW, BH, { active: true });
    label(N.mul2[0], N.mul2[1], "Multiply", "x pulse");

    box(N.out[0], N.out[1], BW, BH, { active: true, fill: "#16100e" });
    label(N.out[0], N.out[1], "Emissive", "-> material", { tcol: C.accent });

    // ---- preview floor (bottom band): result = mask' x color x pulse ----
    const gx0 = 4.0, gx1 = 14.0, gy0 = 0.4, gy1 = 3.5, cols = 6, rows = 2;
    const cw = (gx1 - gx0) / cols, ch = (gy1 - gy0) / rows;
    // dark base
    ctx.fillStyle = "#08080b";
    ctx.fillRect(s.sx(gx0), s.sy(gy1), s.sx(gx1) - s.sx(gx0), s.sy(gy0) - s.sy(gy1));
    // cell interiors
    const cellI = maskCell() * st.bright * pv;
    if (cellI > 0.01) {
      ctx.fillStyle = css(cellI);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = gx0 + c * cw + 0.06, y = gy0 + r * ch + 0.06;
          ctx.fillRect(s.sx(x), s.sy(y + ch - 0.12), s.sx(x + cw - 0.12) - s.sx(x), s.sy(y) - s.sy(y + ch - 0.12));
        }
    }
    // grid lines
    const lineI = maskLine() * st.bright * pv;
    const lcss = css(lineI);
    ctx.save();
    ctx.strokeStyle = lineI > 0.01 ? lcss : "rgba(244,244,245,0.08)";
    ctx.lineWidth = lineI > 1 ? 3 : 2;
    if (lineI > 1) { ctx.shadowColor = lcss; ctx.shadowBlur = 10 * clamp(lineI - 1, 0, 2); }
    for (let c = 0; c <= cols; c++) { const x = gx0 + c * cw; s.line(x, gy0, x, gy1, { color: ctx.strokeStyle, width: ctx.lineWidth }); }
    for (let r = 0; r <= rows; r++) { const y = gy0 + r * ch; s.line(gx0, y, gx1, y, { color: ctx.strokeStyle, width: ctx.lineWidth }); }
    ctx.restore();
    s.text(gx0, gy1, "PREVIEW  (BattleMap floor)", { size: 9, color: C.dim, dy: 15 });

    // ---- readout: the equation with live numbers ----
    const glow = lineI > 1 ? ` <b>bloom x${lineI.toFixed(1)}</b>` : "";
    panel.readout(
      `<span class="k">emissive</span> = ` +
      `<b>${st.invert ? "(1 − mask)" : "mask"}</b> × ` +
      `<b>color(${st.hue | 0}°, ×${st.bright.toFixed(1)})</b> × ` +
      `<b>pulse ${pv.toFixed(2)}</b> &nbsp;→&nbsp; ` +
      `lines <b>${lineI.toFixed(2)}</b> · cells <b>${cellI.toFixed(2)}</b>${glow}`
    );
  });

  // ---- controls ------------------------------------------------------------
  panel.slider({ label: "Hue (color)", min: 0, max: 360, value: st.hue, dp: 0, unit: "°",
                 onInput: (v) => { st.hue = v; s.render(); } });
  panel.slider({ label: "Brightness", min: 0, max: 5, value: st.bright, dp: 1, unit: "×",
                 onInput: (v) => { st.bright = v; s.render(); } });
  panel.toggle({ label: "1 − x  (invert mask)", value: st.invert,
                 onChange: (v) => { st.invert = v; s.render(); } });
  panel.toggle({ label: "Pulse (Time)", value: st.pulse,
                 onChange: (v) => { st.pulse = v; s.render(); } });
  panel.slider({ label: "Calm duration", min: 1, max: 8, value: st.period, dp: 1, unit: "s",
                 onInput: (v) => { st.period = v; s.render(); } });
  panel.slider({ label: "Pulse depth", min: 0, max: 1, value: st.depth, dp: 2,
                 onInput: (v) => { st.depth = v; s.render(); } });

  panel.note(
    "Signal flows left → right into Emissive Color. <b>1 − x</b> chooses whether the grid " +
    "lines glow (the lesson's look) or the cells do. <b>Brightness &gt; 1</b> pushes the color " +
    "past white so it blooms. The <b>Time → Cos</b> branch makes it breathe every " +
    "<i>Calm duration</i> seconds; <i>Pulse depth</i> is how dark it gets between flashes."
  );

  // advance the clock only while pulsing
  s.animate((dt) => { if (st.pulse) st.t += dt; });
  s.render();
});
