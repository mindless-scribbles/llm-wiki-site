/* row-vs-column-matrix — same R and T, same result; the written order flips per convention. */
VIZ.build("row-vs-column-matrix", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-5, 7, -4, 6], aspect: 1.4 });

  let rot = 50 * Math.PI / 180;   // R : rotate about origin
  let tx = 3.5, ty = 1;           // T : translate
  let conv = 0;                   // 0 = Maya row vectors, 1 = Bifrost column vectors
  let t = 1;                      // animation progress

  panel.slider({ label: "rotate R", min: -180, max: 180, value: 50, unit: "°", dp: 0, onInput: (v) => { rot = v * Math.PI / 180; s.render(); } });
  panel.slider({ label: "translate Tx", min: -2, max: 5, value: tx, dp: 1, onInput: (v) => { tx = v; s.render(); } });
  panel.buttons([
    { label: "Maya — row vectors", active: true, onClick: () => { conv = 0; s.render(); } },
    { label: "Bifrost — column vectors", onClick: () => { conv = 1; s.render(); } },
  ]);
  let anim = null;
  panel.button({ label: "▶ play steps", onClick: () => { t = 0; anim && anim.stop(); anim = s.animate((dt) => { t = Math.min(1, t + dt * 0.6); if (t >= 1) anim.stop(); }); } });

  // asymmetric "F" so rotation is unambiguous
  const F = [[0, 0], [0, 3], [2, 3], [2, 2.3], [0.7, 2.3], [0.7, 1.7], [1.6, 1.7], [1.6, 1], [0.7, 1], [0.7, 0]];
  const applyR = (a, p) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

  // The pipeline is ALWAYS "rotate first, then translate" — geometrically identical
  // in both conventions. Only how you WRITE the product flips.
  function pipe(p, prog) {
    const h1 = Math.min(1, prog / 0.5);        // R phase
    const h2 = Math.max(0, (prog - 0.5) / 0.5); // T phase
    const r = applyR(rot * h1, p);
    return [r[0] + tx * h2, r[1] + ty * h2];
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // start (ghost) and rotate-only stage
    s.poly(F, { close: true, color: "rgba(244,244,245,0.20)", width: 1.5 });
    s.text(F[1][0], F[1][1], "start", { color: C.dim, dy: -6, size: 9 });
    s.poly(F.map((p) => applyR(rot, p)), { close: true, color: "rgba(58,160,255,0.35)", width: 1, dash: [4, 4] });

    // final result — SAME shape for both conventions
    const out = F.map((p) => pipe(p, t));
    s.poly(out, { close: true, color: C.accent, width: 2.5, fill: "rgba(255,51,0,0.12)" });
    s.text(out[1][0], out[1][1], "result", { color: C.accent, dy: -6, size: 9 });

    const label = conv === 0 ? "MAYA · row vectors" : "BIFROST · column vectors";
    // row: point is a row on the left, read child→parent left→right : p' = p · R · T
    // column: point is a column on the right, read right→left : p' = T · R · p
    const expr = conv === 0
      ? `p&#39; = p · <b style="color:${C.a3}">R</b> · <b style="color:${C.a1}">T</b>`
      : `p&#39; = <b style="color:${C.a1}">T</b> · <b style="color:${C.a3}">R</b> · p`;
    s.text(-4.8, 5.5, label, { color: conv === 0 ? C.a3 : C.a2, size: 11, weight: 700 });
    s.text(-4.8, 4.7, conv === 0 ? "multiply left→right  (child × parent)" : "multiply right→left  (parent × child)", { color: C.dim, size: 9 });

    panel.readout(
      `<span class="k">${conv === 0 ? "row (Maya)" : "column (Bifrost)"}</span> &nbsp; ${expr} ` +
      `&nbsp;·&nbsp; R = ${(rot * 180 / Math.PI).toFixed(0)}°, T = (${tx.toFixed(1)}, ${ty.toFixed(1)}) ` +
      `&nbsp;·&nbsp; <b>same red result either way</b> — only the written order flips.`
    );
  });

  panel.note("Rotate <b>R</b> then translate <b>T</b> — the red result is identical in both conventions. Toggle the convention: <b>Maya</b> uses row vectors so you write <code>p · R · T</code> and read the chain child→parent; <b>Bifrost</b> uses column vectors so the same operations are written <code>T · R · p</code>, reading right→left. Plug a row matrix into a column expression without flipping order and you get the transpose. Press play to watch R then T apply.");
  s.render();
});
