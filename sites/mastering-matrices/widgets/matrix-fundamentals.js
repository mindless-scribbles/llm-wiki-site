/* matrix-fundamentals — a transform IS "where the axes land + where the origin goes". */
VIZ.build("matrix-fundamentals", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-4, 8, -4, 6], aspect: 1.5 });

  let tx = 2, ty = 1, rot = 30 * Math.PI / 180, sx = 1.6, sy = 1;

  panel.slider({ label: "translate tx", min: -3, max: 6, value: tx, dp: 1, onInput: (v) => { tx = v; s.render(); } });
  panel.slider({ label: "translate ty", min: -3, max: 5, value: ty, dp: 1, onInput: (v) => { ty = v; s.render(); } });
  panel.slider({ label: "rotate", min: -180, max: 180, value: 30, unit: "°", dp: 0, onInput: (v) => { rot = v * Math.PI / 180; s.render(); } });
  panel.slider({ label: "scale sx", min: -1.5, max: 2.5, value: sx, dp: 2, onInput: (v) => { sx = v; s.render(); } });
  panel.slider({ label: "scale sy", min: -1.5, max: 2.5, value: sy, dp: 2, onInput: (v) => { sy = v; s.render(); } });

  // an asymmetric "F" so rotation/flips read clearly
  const F = [[0, 0], [0, 2.4], [1.6, 2.4], [1.6, 1.85], [0.55, 1.85], [0.55, 1.35], [1.3, 1.35], [1.3, 0.8], [0.55, 0.8], [0.55, 0]];
  const SQ = [[0, 0], [1, 0], [1, 1], [0, 1]];

  // transform columns: where the basis axes land, plus where the origin goes
  const Xax = () => [Math.cos(rot) * sx, Math.sin(rot) * sx];       // image of local (1,0)
  const Yax = () => [-Math.sin(rot) * sy, Math.cos(rot) * sy];      // image of local (0,1)
  function map(p) { const X = Xax(), Y = Yax(); return [tx + X[0] * p[0] + Y[0] * p[1], ty + X[1] * p[0] + Y[1] * p[1]]; }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    const X = Xax(), Y = Yax();

    // ghost: untransformed shape + unit square at the origin
    s.poly(SQ, { close: true, color: "rgba(244,244,245,0.16)", width: 1, dash: [3, 3] });
    s.poly(F, { close: true, color: C.ghost, width: 1.5 });
    s.text(F[1][0], F[1][1], "local (rest)", { color: C.dim, dy: -6, size: 9 });

    // transformed shape
    s.poly(F.map(map), { close: true, color: C.accent, width: 2.5, fill: "rgba(255,51,0,0.10)" });
    s.poly(SQ.map(map), { close: true, color: "rgba(255,51,0,0.35)", width: 1, dash: [3, 3] });

    // where the origin goes + where the axes land
    s.arrow(tx, ty, tx + X[0], ty + X[1], { color: C.x, width: 3 });
    s.arrow(tx, ty, tx + Y[0], ty + Y[1], { color: C.y, width: 3 });
    s.text(tx + X[0], ty + X[1], "X lands", { color: C.x, dy: -8, size: 10 });
    s.text(tx + Y[0], ty + Y[1], "Y lands", { color: C.y, dy: -8, size: 10 });
    s.dot(tx, ty, { color: C.a1, r: 6, ring: "#fff", label: "origin →" });
    s.dot(0, 0, { color: C.dim, r: 3 });

    panel.readout(
      `<span class="k">matrix</span> &nbsp; ` +
      `X col = (<b>${X[0].toFixed(2)}</b>, <b>${X[1].toFixed(2)}</b>) &nbsp; ` +
      `Y col = (<b>${Y[0].toFixed(2)}</b>, <b>${Y[1].toFixed(2)}</b>) &nbsp; ` +
      `origin = (<b>${tx.toFixed(2)}</b>, <b>${ty.toFixed(2)}</b>) ` +
      `&nbsp;·&nbsp; det = <b>${(X[0] * Y[1] - X[1] * Y[0]).toFixed(2)}</b>`
    );
  });

  panel.note("Adjust translate / rotate / scale. The red and green arrows show exactly where the local X and Y axes land, and the amber dot shows where the origin goes — those three vectors ARE the transform matrix's columns. In Maya every transform node stores nothing more than this: the landing spots of the basis vectors plus the origin.");
  s.render();
});
