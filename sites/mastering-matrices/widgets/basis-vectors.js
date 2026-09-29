/* basis-vectors — drag the X and Y basis vectors; watch the inner space deform. */
VIZ.build("basis-vectors", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-3.2, 5.2, -2.5, 5], aspect: 1.5 });

  const X = s.draggable({ x: 2, y: 0, color: C.x, label: "X" });
  const Y = s.draggable({ x: 0, y: 2, color: C.y, label: "Y" });

  let px = 0.7, py = 0.6; // local coords of the sample point
  const sX = panel.slider({ label: "point local x", min: -1.5, max: 2.5, value: px, dp: 2, onInput: (v) => { px = v; s.render(); } });
  const sY = panel.slider({ label: "point local y", min: -1.5, max: 2.5, value: py, dp: 2, onInput: (v) => { py = v; s.render(); } });

  function map(lx, ly) { return [X.x * lx + Y.x * ly, X.y * lx + Y.y * ly]; }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    s.text(5, 0, "parent space", { color: C.dim, dx: -6, dy: 14, align: "right", size: 9 });

    // deformed lattice of the inner space
    for (let i = -1; i <= 2; i++) {
      s.line(...map(i, -1), ...map(i, 2), { color: "rgba(255,51,0,0.12)", width: 1 });
      s.line(...map(-1, i), ...map(2, i), { color: "rgba(255,51,0,0.12)", width: 1 });
    }
    // unit parallelogram spanned by the basis
    s.poly([[0, 0], [X.x, X.y], map(1, 1), [Y.x, Y.y]], { close: true, fill: "rgba(255,51,0,0.10)", color: "rgba(255,51,0,0.45)", width: 1.5 });

    // basis vectors
    s.arrow(0, 0, X.x, X.y, { color: C.x, width: 3 });
    s.arrow(0, 0, Y.x, Y.y, { color: C.y, width: 3 });

    // the mapped sample point
    const p = map(px, py);
    s.line(0, 0, p[0], p[1], { color: C.a1, width: 1, dash: [4, 4] });
    s.dot(p[0], p[1], { color: C.a1, r: 6, ring: "#fff", label: "p" });

    // shear indicator
    const dot = VIZ.v.dot(VIZ.v.norm([X.x, X.y]), VIZ.v.norm([Y.x, Y.y]));
    const sheared = Math.abs(dot) > 0.02;
    s.text(-3.1, 4.7, sheared ? "basis not orthogonal → SHEAR" : "orthogonal basis", { color: sheared ? C.accent : C.dim, size: 10 });

    // readout (updated every render, including drags)
    panel.readout(
      `<span class="k">matrix</span> &nbsp; ` +
      `X = (<b>${X.x.toFixed(2)}</b>, <b>${X.y.toFixed(2)}</b>) &nbsp; ` +
      `Y = (<b>${Y.x.toFixed(2)}</b>, <b>${Y.y.toFixed(2)}</b>) &nbsp;·&nbsp; ` +
      `|X|=${VIZ.v.len([X.x, X.y]).toFixed(2)} scales x, |Y|=${VIZ.v.len([Y.x, Y.y]).toFixed(2)} scales y &nbsp;·&nbsp; ` +
      `p maps to (<b>${p[0].toFixed(2)}</b>, <b>${p[1].toFixed(2)}</b>)`
    );
  });

  panel.note("Drag the red X and green Y arrows. Lengthening one scales the inner space along that axis; breaking their right angle introduces shear. The point p keeps the same local coordinates — only its position in the parent space changes.");
  s.render();
});
