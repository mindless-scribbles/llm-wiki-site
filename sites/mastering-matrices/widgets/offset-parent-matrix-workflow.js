/* offset-parent-matrix-workflow — the offsetParentMatrix positions a control in
 * the world while its transform channels (T/R) stay at zero. */
VIZ.build("offset-parent-matrix-workflow", function (panel) {
  const C = VIZ.C, V = VIZ.v;
  const s = panel.scene({ world: [-3.6, 4.8, -3, 4], aspect: 1.4 });
  const P = [0, 0];            // parent origin (world identity)

  let ox = 2.4, oy = 1.2, orot = 35 * Math.PI / 180;   // offsetParentMatrix TRS
  panel.slider({ label: "OPM offset tx", min: -3, max: 4, value: ox, dp: 1, onInput: (v) => { ox = v; s.render(); } });
  panel.slider({ label: "OPM offset ty", min: -3, max: 4, value: oy, dp: 1, onInput: (v) => { oy = v; s.render(); } });
  panel.slider({ label: "OPM rotate", min: -180, max: 180, value: 35, unit: "°", dp: 0, onInput: (v) => { orot = v * Math.PI / 180; s.render(); } });

  function frame(o, ang, len, cx, cy, tag, ghost) {
    const x = V.rot([len, 0], ang), y = V.rot([0, len], ang);
    const xc = ghost ? "rgba(255,77,61,0.4)" : cx, yc = ghost ? "rgba(61,220,132,0.4)" : cy;
    s.arrow(o[0], o[1], o[0] + x[0], o[1] + x[1], { color: xc, width: ghost ? 2 : 3.5, head: ghost ? 8 : 12 });
    s.arrow(o[0], o[1], o[0] + y[0], o[1] + y[1], { color: yc, width: ghost ? 2 : 3.5, head: ghost ? 8 : 12 });
    if (tag) s.text(o[0], o[1], tag, { color: ghost ? C.dim : "#fff", size: 10, dy: ghost ? 22 : -8, dx: 8 });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // control's LOCAL frame = identity → sits at the parent origin (T=0, R=0)
    frame(P, 0, 1.15, C.x, C.y, "LOCAL  T=0 R=0", true);

    // offsetParentMatrix translation, drawn as an arrow from the parent origin
    const W = [P[0] + ox, P[1] + oy];
    s.arrow(P[0], P[1], W[0], W[1], { color: C.a1, width: 2, dash: [5, 5], head: 9 });
    s.text((P[0] + W[0]) / 2, (P[1] + W[1]) / 2, "offsetParentMatrix", { color: C.a1, size: 10, dx: 4, dy: -4 });

    // control glyph + FINAL WORLD frame, moved & rotated purely by the OPM
    const oct = [];
    for (let i = 0; i < 8; i++) { const a = orot + i * Math.PI / 4; oct.push([W[0] + 0.55 * Math.cos(a), W[1] + 0.55 * Math.sin(a)]); }
    s.poly(oct, { close: true, color: C.accent, width: 2, fill: "rgba(255,51,0,0.10)" });
    frame(W, orot, 1.35, C.x, C.y, "WORLD");
    s.dot(W[0], W[1], { color: "#fff", r: 3 });
    s.dot(P[0], P[1], { color: C.dim, r: 4, label: "parent" });

    panel.readout(
      `<span class="k">worldMatrix = localTRS × offsetParentMatrix × parent</span> &nbsp;|&nbsp; ` +
      `local <b>T=(0.00, 0.00)  R=0°</b> (channels untouched) &nbsp;→&nbsp; ` +
      `world pos <b>(${ox.toFixed(2)}, ${oy.toFixed(2)})</b>  R <b>${(orot * 180 / Math.PI).toFixed(0)}°</b>`
    );
  });

  panel.note("Since Maya 2020 every transform has an <b>offsetParentMatrix</b> plug applied before the parent. Feed a guide's world matrix into it and the control jumps to that pose while its animator-facing translate/rotate stay at 0 — the ghost LOCAL frame never leaves the origin. The OPM holds the rest-pose buffer, so no buffer/group node is needed. Drag the sliders: the WORLD frame moves, the channels don't.");
  s.render();
});
