/* buffer-matrix-pattern — child = buffer × parentWorld. The buffer (child in the
 * parent's local frame) is captured once and held constant, so the child rides
 * rigidly with the parent until you re-capture. */
VIZ.build("buffer-matrix-pattern", function (panel) {
  const C = VIZ.C, V = VIZ.v;
  const s = panel.scene({ world: [-4.6, 4.6, -3.2, 3.6], aspect: 1.4 });

  let pa = 20 * Math.PI / 180;              // parent world angle
  let caw = 20 * Math.PI / 180;             // child world angle
  const buffer = { pos: [0, 0], ang: 0 };   // child expressed in parent-local space (held constant)

  const Ph = s.draggable({ x: -1.6, y: -0.6, color: C.a2, label: "parent", r: 9 });
  const Ch = s.draggable({ x: 1.6, y: 1.2, color: C.accent, label: "child", r: 9 });

  // parent local <-> world helpers (world = R(pa)·local + P)
  const toLocal = (w) => V.rot([w[0] - Ph.x, w[1] - Ph.y], -pa);
  const fromLocal = (l) => V.add([Ph.x, Ph.y], V.rot(l, pa));

  function captureBuffer() { buffer.pos = toLocal([Ch.x, Ch.y]); buffer.ang = caw - pa; }
  function applyBuffer() { const w = fromLocal(buffer.pos); Ch.x = w[0]; Ch.y = w[1]; caw = pa + buffer.ang; }

  panel.slider({ label: "parent rotate", min: -180, max: 180, value: 20, unit: "°", dp: 0, onInput: (v) => { pa = v * Math.PI / 180; applyBuffer(); s.render(); } });
  Ph.onDrag = () => { applyBuffer(); };      // parent drives child through the constant buffer
  panel.button({ label: "◉ re-capture buffer", onClick: () => { captureBuffer(); s.render(); } });

  captureBuffer();   // seed the buffer from the initial rest pose

  function frame(o, ang, len, cx, cy, tag) {
    const x = V.rot([len, 0], ang), y = V.rot([0, len], ang);
    s.arrow(o[0], o[1], o[0] + x[0], o[1] + x[1], { color: cx, width: 3.2, head: 11 });
    s.arrow(o[0], o[1], o[0] + y[0], o[1] + y[1], { color: cy, width: 3.2, head: 11 });
    if (tag) s.text(o[0], o[1], tag, { color: "#fff", size: 10, dy: -8, dx: 8 });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // where the buffer says the child should be, given the current parent
    const synced = fromLocal(buffer.pos);
    const inSync = Math.hypot(synced[0] - Ch.x, synced[1] - Ch.y) < 0.02;

    // offset line (the buffer, drawn in world) from parent to child
    s.line(Ph.x, Ph.y, Ch.x, Ch.y, { color: inSync ? "rgba(255,51,0,0.5)" : C.a1, width: 1.5, dash: [5, 5] });
    if (!inSync) {
      s.ring(synced[0], synced[1], 0.28, { color: C.a3, dash: [3, 3] });
      s.text(synced[0], synced[1], "buffer→here; re-capture", { color: C.a3, size: 9, dy: -18, align: "center" });
    }

    frame([Ph.x, Ph.y], pa, 1.4, C.x, C.y, null);   // handle already labels these
    frame([Ch.x, Ch.y], caw, 1.2, C.x, C.y, null);

    panel.readout(
      `<span class="k">childWorld = buffer × parentWorld</span> &nbsp;·&nbsp; ` +
      `buffer = childWorld × parent⁻¹ &nbsp;|&nbsp; ` +
      `buffer local T = <b>(${buffer.pos[0].toFixed(2)}, ${buffer.pos[1].toFixed(2)})</b> &nbsp; ` +
      `R = <b>${(buffer.ang * 180 / Math.PI).toFixed(0)}°</b> &nbsp; ` +
      (inSync ? "· locked to parent ✓" : "· <b>drifted — re-capture</b>")
    );
  });

  panel.note("The recurring pattern behind guided rigs: express the child in the parent's local space once — <b>buffer = childWorld × parentInverse</b> — then rebuild the child every frame as <b>buffer × parentWorld</b>. Rotate or drag the <b>parent</b> and the child rides along rigidly because the buffer is constant. Drag the <b>child</b> to a new rest pose, then <b>re-capture buffer</b> to re-anchor it. Switching which node is 'parent' is exactly space-switching.");
  s.render();
});
