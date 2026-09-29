/* inverse-matrix — M maps a shape out; M⁻¹ brings it exactly back. Basis of the buffer-matrix pattern. */
VIZ.build("inverse-matrix", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-5, 7, -4, 5], aspect: 1.5 });

  let rot = 35 * Math.PI / 180, sc = 1.4, tx = 2.5;

  panel.slider({ label: "rotate", min: -180, max: 180, value: 35, unit: "°", dp: 0, onInput: (v) => { rot = v * Math.PI / 180; s.render(); } });
  panel.slider({ label: "uniform scale", min: 0, max: 2.2, value: sc, dp: 2, onInput: (v) => { sc = v; s.render(); } });
  panel.slider({ label: "translate tx", min: -2, max: 5, value: tx, dp: 1, onInput: (v) => { tx = v; s.render(); } });

  const F = [[0, 0], [0, 2], [1.4, 2], [1.4, 1.55], [0.5, 1.55], [0.5, 1.2], [1.1, 1.2], [1.1, 0.75], [0.5, 0.75], [0.5, 0]];

  // M = translate(tx) · rotate · scale
  const Mfwd = () => ({ a: Math.cos(rot) * sc, b: -Math.sin(rot) * sc, c: Math.sin(rot) * sc, d: Math.cos(rot) * sc, tx: tx, ty: 0 });
  function apply(m, p) { return [m.tx + m.a * p[0] + m.b * p[1], m.ty + m.c * p[0] + m.d * p[1]]; }
  function inv(m) {
    const det = m.a * m.d - m.b * m.c;
    if (Math.abs(det) < 1e-6) return null;
    const ia = m.d / det, ib = -m.b / det, ic = -m.c / det, id = m.a / det;
    return { a: ia, b: ib, c: ic, d: id, tx: -(ia * m.tx + ib * m.ty), ty: -(ic * m.tx + id * m.ty) };
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    const m = Mfwd();
    const det = m.a * m.d - m.b * m.c;
    const singular = Math.abs(det) < 1e-4;

    // ghost original
    s.poly(F, { close: true, color: C.ghost, width: 1.5 });
    s.text(F[1][0], F[1][1], "original", { color: C.dim, dy: -6, size: 9 });

    // after M (accent)
    const outM = F.map((p) => apply(m, p));
    s.poly(outM, { close: true, color: C.accent, width: 2.5, fill: "rgba(255,51,0,0.10)" });
    s.text(outM[1][0], outM[1][1], "after M", { color: C.accent, dy: -6, size: 10 });

    // forward + inverse mapping of one anchor point
    const p0 = F[2], pM = apply(m, p0);
    s.arrow(p0[0], p0[1], pM[0], pM[1], { color: C.a3, width: 1.5, dash: [4, 4], head: 8 });
    s.text((p0[0] + pM[0]) / 2, (p0[1] + pM[1]) / 2, "M", { color: C.a3, dy: -4, size: 11, weight: 700 });

    const mi = inv(m);
    if (mi) {
      // M then M⁻¹ → back to original (draw slightly to confirm coincidence)
      const back = outM.map((p) => apply(mi, p));
      s.poly(back, { close: true, color: C.y, width: 1.5, dash: [5, 4] });
      const pBack = apply(mi, pM);
      s.arrow(pM[0], pM[1], pBack[0], pBack[1], { color: C.a2, width: 1.5, dash: [4, 4], head: 8 });
      s.text((pM[0] + pBack[0]) / 2, (pM[1] + pBack[1]) / 2 - 0.4, "M⁻¹", { color: C.a2, dy: 12, size: 11, weight: 700 });
    }

    panel.readout(
      `<span class="k">det(M)</span> = <b>${det.toFixed(3)}</b> &nbsp;·&nbsp; ` +
      (singular
        ? `<b style="color:${C.accent}">singular — no inverse (scale → 0 collapses the space)</b>`
        : `M⁻¹ exists &nbsp;→&nbsp; <b style="color:${C.y}">M then M⁻¹ returns to original</b> (green dashed ≡ ghost)`)
    );
  });

  panel.note("Build M with rotate / scale / translate. The amber shape is the space after M; the green dashed shape is that result pushed back through M⁻¹ — it lands exactly on the ghost original. This exact undo is the basis of the buffer-matrix pattern: childWorld · parentInverse gives a child's offset relative to its parent. Drive scale to 0 and det hits 0 — the space collapses to a line and no inverse exists.");
  s.render();
});
