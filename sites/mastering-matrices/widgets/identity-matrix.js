/* identity-matrix — blend from identity (no-op) to a target transform; I changes nothing. */
VIZ.build("identity-matrix", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-3.5, 6, -3.5, 5], aspect: 1.5 });

  let t = 0;
  panel.slider({ label: "blend t (identity → target)", min: 0, max: 1, value: 0, dp: 2, onInput: (v) => { t = v; s.render(); } });

  // target transform: rotate 40°, non-uniform scale, small translate
  const ang = 40 * Math.PI / 180, TSX = 1.5, TSY = 0.6, TTX = 1.2, TTY = 0.7;
  const targ = { a: Math.cos(ang) * TSX, b: -Math.sin(ang) * TSY, c: Math.sin(ang) * TSX, d: Math.cos(ang) * TSY, tx: TTX, ty: TTY };
  // lerp each matrix element from identity toward the target
  const M = () => ({
    a: 1 + (targ.a - 1) * t, b: targ.b * t,
    c: targ.c * t, d: 1 + (targ.d - 1) * t,
    tx: targ.tx * t, ty: targ.ty * t,
  });
  const map = (m, p) => [m.tx + m.a * p[0] + m.b * p[1], m.ty + m.c * p[0] + m.d * p[1]];

  const F = [[0, 0], [0, 2.2], [1.5, 2.2], [1.5, 1.7], [0.5, 1.7], [0.5, 1.25], [1.2, 1.25], [1.2, 0.75], [0.5, 0.75], [0.5, 0]];

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    const m = M();
    const isId = t < 0.001;

    // ghost rest lattice + shape (the untouched inner space)
    for (let i = 0; i <= 3; i++) {
      s.line(i, 0, i, 3, { color: "rgba(244,244,245,0.08)", width: 1 });
      s.line(0, i, 3, i, { color: "rgba(244,244,245,0.08)", width: 1 });
    }
    s.poly(F, { close: true, color: C.ghost, width: 1.5 });

    // live deformed lattice + shape
    const col = isId ? C.y : C.accent;
    for (let i = 0; i <= 3; i++) {
      s.line(...map(m, [i, 0]), ...map(m, [i, 3]), { color: "rgba(255,51,0,0.14)", width: 1 });
      s.line(...map(m, [0, i]), ...map(m, [3, i]), { color: "rgba(255,51,0,0.14)", width: 1 });
    }
    s.poly(F.map((p) => map(m, p)), { close: true, color: col, width: 2.5, fill: isId ? "rgba(61,220,132,0.10)" : "rgba(255,51,0,0.10)" });

    s.text(-3.4, 4.6, isId ? "M = IDENTITY  →  no-op (M·v = v)" : "M ≠ I  →  shape is transformed",
      { color: isId ? C.y : C.a1, size: 11, weight: 700 });

    // highlight the diagonal 1s when at identity
    const hl = isId ? C.y : C.dim;
    panel.readout(
      `<span class="k">2×2 + translation</span> &nbsp; ` +
      `[ <b style="color:${hl}">${m.a.toFixed(2)}</b> ${m.b.toFixed(2)} ; ${m.c.toFixed(2)} <b style="color:${hl}">${m.d.toFixed(2)}</b> ] ` +
      `&nbsp; t = (<b>${m.tx.toFixed(2)}</b>, <b>${m.ty.toFixed(2)}</b>) ` +
      (isId ? `&nbsp;·&nbsp; <b style="color:${C.y}">= IDENTITY (no-op)</b>` : "")
    );
  });

  panel.note("Slide t. At t = 0 the matrix is the identity — diagonal 1s, zero translation (highlighted green) — and the shape and its lattice are untouched: multiplying by I changes nothing. As t rises the same shape deforms toward the target. In Maya every transform's translate/rotate/scale matrix starts as identity and is mutated from your TRS values before composing.");
  s.render();
});
