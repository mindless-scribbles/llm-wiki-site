/* fk-control-rig — three FK controls, each with its own rotation; parents carry children. */
VIZ.build("fk-control-rig", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3.5, 5.5], aspect: 1.5 });

  const root = [1, 1];
  const L1 = 2.8, L2 = 2.4, L3 = 1.4;

  let a0 = 30, a1 = -40, a2 = 25; // local rotations (degrees) of each control
  panel.slider({ label: "shoulder local", min: -90, max: 120, value: a0, unit: "°", dp: 0, onInput: (v) => { a0 = v; s.render(); } });
  panel.slider({ label: "elbow local", min: -120, max: 20, value: a1, unit: "°", dp: 0, onInput: (v) => { a1 = v; s.render(); } });
  panel.slider({ label: "wrist local", min: -80, max: 80, value: a2, unit: "°", dp: 0, onInput: (v) => { a2 = v; s.render(); } });

  function drawCtrl(o, worldAng, rad, tag, col) {
    // NURBS-circle-like control ring with a small shape inside
    s.ring(o[0], o[1], rad, { color: col, width: 2 });
    s.dot(o[0], o[1], { color: col, r: 3 });
    // local frame: red X along the control's world orientation, green Y perpendicular
    const AX = rad + 0.5;
    const dx = [Math.cos(worldAng), Math.sin(worldAng)];
    const dy = [-Math.sin(worldAng), Math.cos(worldAng)];
    s.arrow(o[0], o[1], o[0] + dx[0] * AX, o[1] + dx[1] * AX, { color: C.x, width: 2.5 });
    s.arrow(o[0], o[1], o[0] + dy[0] * AX, o[1] + dy[1] * AX, { color: C.y, width: 2.5 });
    s.text(o[0], o[1], tag, { color: col, dy: -rad * 30 - 6, size: 9, align: "center" });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // world angles accumulate down the chain: each = local + parent world
    const w0 = a0 * Math.PI / 180;                 // shoulder world = its local (root parent = identity)
    const w1 = w0 + a1 * Math.PI / 180;            // elbow world = elbow local · shoulder world
    const w2 = w1 + a2 * Math.PI / 180;            // wrist world = wrist local · elbow world

    const pElbow = [root[0] + L1 * Math.cos(w0), root[1] + L1 * Math.sin(w0)];
    const pWrist = [pElbow[0] + L2 * Math.cos(w1), pElbow[1] + L2 * Math.sin(w1)];
    const pEnd = [pWrist[0] + L3 * Math.cos(w2), pWrist[1] + L3 * Math.sin(w2)];

    // bones
    s.line(root[0], root[1], pElbow[0], pElbow[1], { color: C.z, width: 6 });
    s.line(pElbow[0], pElbow[1], pWrist[0], pWrist[1], { color: C.a3, width: 6 });
    s.line(pWrist[0], pWrist[1], pEnd[0], pEnd[1], { color: C.a2, width: 6 });

    // controls (rings + local frames)
    drawCtrl(root, w0, 0.55, "shoulder", C.z);
    drawCtrl(pElbow, w1, 0.5, "elbow", C.a3);
    drawCtrl(pWrist, w2, 0.42, "wrist", C.a2);
    s.dot(pEnd[0], pEnd[1], { color: C.dim, r: 4 });

    panel.readout(
      `<span class="k">world = local · parent · grandparent</span> &nbsp; ` +
      `shoulder <b>${a0.toFixed(0)}°</b> · elbow <b>${a1.toFixed(0)}°</b> · wrist <b>${a2.toFixed(0)}°</b> ` +
      `&nbsp;→&nbsp; wrist world = <b>${(w2 * 180 / Math.PI).toFixed(1)}°</b>`
    );
  });

  panel.note("An FK chain built from matrix nodes instead of Outliner parenting. Each control's <code>offsetParentMatrix</code> carries a buffer to its parent, so a control's world matrix is <code>local · parent</code> down the chain. Rotate the shoulder and the whole arm swings; rotate the elbow and only the forearm and wrist follow — children inherit every ancestor's rotation. Red X / green Y show each control's live world frame.");
  s.render();
});
