/* emissive-pulse.js — the Time → Remap → Cosine → Remap timing math behind the
 * Phase-12 emissive pulse (Tutorial 04). A PLOT, not a node diagram: one cycle on
 * a time axis, showing how the calm gate (If), the phase remap, the cosine, and
 * the normalize remap produce the behavior verified in-engine — the lines stay
 * LIT for the Calm Duration, then briefly DIP to dark and ramp back.
 *
 * Chain modelled:
 *   Time (loops 0..InputHigh)
 *     └ If: HOLD lit until t >= CalmDuration, then run the dip below
 *          Remap #1 : t in [calm .. InputHigh]  ->  x in [0.5 .. 1.5]   (time -> phase)
 *          Cosine   : cos(2*pi*x)               ->  -1 .. +1            (the animation)
 *          Remap #2 : [-1 .. 1]                 ->  [0 .. 1]            (Lerp alpha)
 *          Lerp     : lit color <-> black, so alpha 0 = lit, alpha 1 = dark
 *   Visible glow = (1 - cos)/2 : lit(1) at the window edges, dark(0) in the middle.
 */
VIZ.build("emissive-pulse", function (panel) {
  const st = { calm: 4.0, high: 6.0, gate: true, t: 0 };

  // World: X = seconds (0..~15 covers the max cycle), Y = value (-1..1 wave band,
  // with headroom above for labels).
  const s = panel.scene({ world: [-0.8, 15.0, -1.45, 1.78], aspect: 2.2 });

  const TWO_PI = Math.PI * 2;
  const winLen = () => Math.max(0.5, st.high - st.calm);

  // phase x in [0.5 , 1.5] across the dip window (or the whole cycle if the calm
  // gate is off). Returns null during the calm hold.
  function phaseX(t) {
    const L = st.high;
    const tt = ((t % L) + L) % L;
    let u;
    if (st.gate) {
      if (tt < st.calm) return null; // held lit by the If
      u = (tt - st.calm) / winLen(); // 0..1 across the dip window
    } else {
      u = tt / L; // no hold: sweep the whole cycle
    }
    return 0.5 + u; // 0.5 .. 1.5
  }

  function cosAt(t) {
    const x = phaseX(t);
    if (x == null) return null;
    return Math.cos(TWO_PI * x);
  }

  // Visible glow (what the wall shows): 1 = lit, 0 = dark. During the calm hold it
  // stays lit; the Lerp makes alpha 0 -> lit, alpha 1 -> black, so glow = (1-cos)/2.
  function glow(t) {
    const c = cosAt(t);
    if (c == null) return 1; // calm = lit
    return (1 - c) / 2;
  }

  function plot(fn, x0, x1, opt) {
    const pts = [];
    const N = 190;
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const v = fn(x);
      if (v == null) { if (pts.length) { s.poly(pts, opt); pts.length = 0; } continue; }
      pts.push([x, v]);
    }
    if (pts.length) s.poly(pts, opt);
  }

  const C = VIZ.C;
  const DIM = "rgba(244,244,245,0.30)";
  const PINK = [236, 72, 153];

  s.onDraw(function () {
    const L = st.high;
    const yTop = 1.55, yBot = -1.45;
    const aStart = st.gate ? st.calm : 0;

    // --- value gridlines / axis ---
    for (const yv of [-1, 0, 1]) {
      s.line(-0.5, yv, L + 0.4, yv, { color: yv === 0 ? C.gridBold : C.grid, width: yv === 0 ? 1.5 : 1 });
      s.text(-0.6, yv, yv > 0 ? "+1" : "" + yv, { color: C.dim, size: 10, align: "right", baseline: "middle" });
    }

    // --- calm (lit) vs dip windows ---
    if (st.gate && st.calm > 0.001) {
      s.poly([[0, yBot], [st.calm, yBot], [st.calm, yTop], [0, yTop]],
        { close: true, fill: `rgba(${PINK[0]},${PINK[1]},${PINK[2]},0.10)`, color: null });
      s.text(st.calm / 2, yTop, "CALM · lines held LIT", { color: `rgb(${PINK.join(",")})`, size: 10, align: "center", baseline: "bottom", dy: -2 });
    }
    s.poly([[aStart, yBot], [L, yBot], [L, yTop], [aStart, yTop]],
      { close: true, fill: "rgba(122,122,130,0.12)", color: null });
    s.text((aStart + L) / 2, yTop, "DIP WINDOW", { color: C.dim, size: 10, align: "center", baseline: "bottom", dy: -2 });

    // --- raw cosine (-1..1), dim + dashed: the animation before normalizing ---
    plot((t) => cosAt(t), aStart - 0.02, L + 0.02, { color: DIM, width: 2, dash: [4, 4] });

    // --- visible glow curve (what the wall shows), bold pink ---
    plot((t) => glow(t), -0.5, L + 0.4, { color: `rgb(${PINK.join(",")})`, width: 3 });

    // --- phase-point ticks: x = 0.5 / 1.0 / 1.5 -> cos = -1 / +1 / -1 ---
    if (st.gate) {
      const pts = [
        { u: 0.0, x: "0.5", c: "−1", g: "lit" },
        { u: 0.5, x: "1.0", c: "+1", g: "dark" },
        { u: 1.0, x: "1.5", c: "−1", g: "lit" },
      ];
      for (const p of pts) {
        const t = st.calm + p.u * winLen();
        const cv = Math.cos(TWO_PI * (0.5 + p.u));
        s.line(t, cv, t, -1.32, { color: C.gridBold, width: 1, dash: [2, 3] });
        s.dot(t, cv, { r: 3, color: DIM });
        s.text(t, -1.32, "x=" + p.x, { color: C.dim, size: 9, align: "center", baseline: "top", dy: 2 });
        s.text(t, -1.32, "cos " + p.c, { color: C.dim, size: 9, align: "center", baseline: "top", dy: 13 });
      }
    }

    // --- playhead + riding dot ---
    const tNow = ((st.t % L) + L) % L;
    const g = glow(tNow);
    s.line(tNow, yBot, tNow, yTop, { color: "rgba(255,255,255,0.35)", width: 1 });
    s.dot(tNow, g, { r: 5, color: `rgb(${PINK.join(",")})`, ring: "#fff" });

    // --- right-edge axis hints ---
    s.text(L + 0.5, 1, "glow 1 · lit", { color: `rgb(${PINK.join(",")})`, size: 9, align: "left", baseline: "middle" });
    s.text(L + 0.5, 0, "glow 0 · dark", { color: `rgb(${PINK.join(",")})`, size: 9, align: "left", baseline: "middle" });
    s.text(L + 0.5, -1, "cos", { color: DIM, size: 9, align: "left", baseline: "middle" });

    // --- live readout with a glowing swatch ---
    const c = cosAt(tNow);
    const held = c == null;
    const gg = Math.min(1, Math.max(0, g));
    const r = Math.round(PINK[0] * gg), gr = Math.round(PINK[1] * gg), bl = Math.round(PINK[2] * gg);
    const bloom = g > 0.7 ? `0 0 ${Math.round((g - 0.55) * 20)}px rgba(${PINK.join(",")},${(g - 0.5).toFixed(2)})` : "none";
    const swatch = `<span style="display:inline-block;width:2.4em;height:1em;vertical-align:middle;border-radius:3px;background:rgb(${r},${gr},${bl});box-shadow:${bloom}"></span>`;
    const xNow = held ? "—" : (0.5 + (st.gate ? (tNow - st.calm) / winLen() : tNow / L)).toFixed(2);
    panel.readout(
      `<b>t</b> ${tNow.toFixed(1)}s / ${L.toFixed(1)}s` +
      ` &nbsp;·&nbsp; ${held ? "<b>held LIT</b>" : "<b>phase x</b> " + xNow} ` +
      ` &nbsp;·&nbsp; <b>cos</b> ${held ? "—" : c.toFixed(2)}` +
      ` &nbsp;·&nbsp; <b>glow</b> ${g.toFixed(2)} ${swatch}`
    );
  });

  let calmS, highS;
  calmS = panel.slider({
    label: "Calm duration (lit hold)", min: 0, max: 10, value: st.calm, step: 0.5, unit: "s", dp: 1,
    onInput: (v) => { if (v > st.high - 1) { v = st.high - 1; calmS.set(v); } st.calm = v; s.render(); },
  });
  highS = panel.slider({
    label: "Input High (cycle end)", min: 2, max: 14, value: st.high, step: 0.5, unit: "s", dp: 1,
    onInput: (v) => { if (v < st.calm + 1) { v = st.calm + 1; highS.set(v); } st.high = v; s.render(); },
  });
  panel.toggle({ label: "Calm gate (the If node)", value: st.gate, onChange: (v) => { st.gate = v; s.render(); } });

  panel.note(
    "Bold line = <b>visible glow</b> (1 = lit, 0 = dark); dashed line = the raw <b>cosine</b> the dip is built from. " +
    "The lines hold <b>lit</b> for the Calm Duration, then the dip window sweeps cosine phase <b>0.5→1.5</b> " +
    "(angle π→3π, one full wave), which carries them <b>lit → dark → lit</b> and back to the hold — no snap. " +
    "The gap <b>Input High − Calm</b> is how long the dip takes. Turn the <b>Calm gate</b> off to lose the hold and dip non-stop."
  );

  s.animate((dt) => { st.t += dt; });
});
