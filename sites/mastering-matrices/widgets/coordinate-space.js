/* coordinate-space — one point, two frames: watch WORLD coords change while LOCAL stay fixed. */
VIZ.build("coordinate-space", function (panel) {
  const C = VIZ.C, v = VIZ.v;
  const s = panel.scene({ world: [-6, 6, -4, 6], aspect: 1.35 });

  let ang = 35 * Math.PI / 180;
  panel.slider({ label: "parent rotation", min: -180, max: 180, value: 35, unit: "°", dp: 0, onInput: (x) => { ang = x * Math.PI / 180; s.render(); } });

  // draggable parent origin
  const O = s.draggable({ x: 2, y: 1.2, color: C.accent, label: "parent origin", r: 8 });
  // the point — stored in LOCAL (parent-space) coords; this is the source of truth
  let local = [2, 1.2];

  const toWorld = (l) => { const r = v.rot(l, ang); return [O.x + r[0], O.y + r[1]]; };
  const toLocal = (w) => v.rot([w[0] - O.x, w[1] - O.y], -ang);

  const P = s.draggable({ x: 0, y: 0, color: C.a1, label: "p", r: 7, onDrag: (h) => { local = toLocal([h.x, h.y]); } });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // WORLD frame (fixed) at the scene origin
    s.arrow(0, 0, 1.7, 0, { color: C.x, width: 2.5 });
    s.arrow(0, 0, 0, 1.7, { color: C.y, width: 2.5 });
    s.text(1.8, 0, "world X", { color: C.x, size: 9 });
    s.text(0, 1.9, "world Y", { color: C.y, size: 9, align: "center" });

    // PARENT frame (movable + rotatable)
    const ex = v.rot([1, 0], ang), ey = v.rot([0, 1], ang);
    s.arrow(O.x, O.y, O.x + 1.7 * ex[0], O.y + 1.7 * ex[1], { color: C.a3, width: 2.5 });
    s.arrow(O.x, O.y, O.x + 1.7 * ey[0], O.y + 1.7 * ey[1], { color: C.a2, width: 2.5 });
    s.text(O.x + 1.9 * ex[0], O.y + 1.9 * ex[1], "local x", { color: C.a3, size: 9 });
    s.text(O.x + 1.9 * ey[0], O.y + 1.9 * ey[1], "local y", { color: C.a2, size: 9 });

    // place the point at its world position derived from the constant local coords
    const w = toWorld(local);
    P.x = w[0]; P.y = w[1];

    // local coords traced ALONG the parent axes (stay constant while parent moves)
    const along = [O.x + local[0] * ex[0], O.y + local[0] * ex[1]];
    s.line(O.x, O.y, along[0], along[1], { color: C.a3, width: 1.5, dash: [4, 4] });
    s.line(along[0], along[1], w[0], w[1], { color: C.a2, width: 1.5, dash: [4, 4] });

    // world coords dropped onto the world axes (change as parent moves)
    s.line(w[0], w[1], w[0], 0, { color: "rgba(244,244,245,0.20)", width: 1, dash: [2, 4] });
    s.line(w[0], w[1], 0, w[1], { color: "rgba(244,244,245,0.20)", width: 1, dash: [2, 4] });
    s.dot(w[0], 0, { color: C.dim, r: 3 });
    s.dot(0, w[1], { color: C.dim, r: 3 });
    s.dot(O.x, O.y, { color: C.accent, r: 3 });

    panel.readout(
      `<span class="k">point p</span> &nbsp; ` +
      `local (parent space) = (<b style="color:${C.a3}">${local[0].toFixed(2)}</b>, <b style="color:${C.a2}">${local[1].toFixed(2)}</b>) <i>— constant</i> &nbsp;·&nbsp; ` +
      `world = (<b style="color:${C.x}">${w[0].toFixed(2)}</b>, <b style="color:${C.y}">${w[1].toFixed(2)}</b>) <i>— follows the parent</i>`
    );
  });

  panel.note("Drag the parent origin or spin its rotation slider: the point p is <b>fixed in parent-local space</b>, so its local coords never change — but its world coords do. This is exactly a child transform's <code>offsetParentMatrix</code>: the child keeps its local values while the world matrix carries it. Drag <b>p</b> to set new local coords.");
  s.render();
});
