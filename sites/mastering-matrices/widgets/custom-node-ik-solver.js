/* custom-node-ik-solver — two-bone IK solved straight into matrices, with NO Maya joints. */
VIZ.build("custom-node-ik-solver", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3.5, 5.5], aspect: 1.5 });
  const root = [0, 0];
  const DEG = 180 / Math.PI;

  let L1 = 3, L2 = 3, up = 1;
  panel.slider({ label: "upper L1", min: 1, max: 4.5, value: L1, dp: 1, onInput: (v) => { L1 = v; s.render(); } });
  panel.slider({ label: "lower L2", min: 1, max: 4.5, value: L2, dp: 1, onInput: (v) => { L2 = v; s.render(); } });
  panel.buttons([
    { label: "elbow up", active: true, onClick: () => { up = 1; s.render(); } },
    { label: "elbow down", onClick: () => { up = -1; s.render(); } },
  ]);

  const T = s.draggable({ x: 4.2, y: 2.2, color: C.accent, label: "IK hand", r: 9 });

  // draw a little oriented frame (bone X = along bone, bone Y = perpendicular) — a matrix, not a joint
  function frame(o, ang, col) {
    const ln = 0.85, tick = 0.55;
    const ax = [Math.cos(ang), Math.sin(ang)];        // bone X axis
    const ay = [-Math.sin(ang), Math.cos(ang)];       // bone Y axis
    s.arrow(o[0], o[1], o[0] + ln * ax[0], o[1] + ln * ax[1], { color: C.x, width: 2 });
    s.arrow(o[0], o[1], o[0] + tick * ay[0], o[1] + tick * ay[1], { color: C.y, width: 2 });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const dx = T.x - root[0], dy = T.y - root[1];
    const dist = Math.hypot(dx, dy);
    const reach = L1 + L2;
    const d = Math.min(dist, reach - 0.001);
    const overreach = dist > reach;

    const cosB = VIZ.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const B = Math.acos(cosB);
    const baseAng = Math.atan2(dy, dx);
    const shoulderAng = baseAng + up * B;
    const elbow = [root[0] + L1 * Math.cos(shoulderAng), root[1] + L1 * Math.sin(shoulderAng)];
    const endEff = overreach
      ? [root[0] + reach * Math.cos(baseAng), root[1] + reach * Math.sin(baseAng)]
      : [T.x, T.y];
    const lowerAng = Math.atan2(endEff[1] - elbow[1], endEff[0] - elbow[0]);
    const elbowRot = lowerAng - shoulderAng; // relative bone rotation at the elbow

    s.ring(root[0], root[1], reach, { color: "rgba(244,244,245,0.12)", dash: [3, 5] });
    s.line(root[0], root[1], T.x, T.y, { color: C.dim, width: 1, dash: [5, 5] });

    // bones drawn as oriented frames (matrices) — no joint spheres
    s.line(root[0], root[1], elbow[0], elbow[1], { color: "rgba(58,160,255,0.55)", width: 5 });
    s.line(elbow[0], elbow[1], endEff[0], endEff[1], { color: "rgba(61,220,132,0.55)", width: 5 });
    frame(root, shoulderAng, C.z);
    frame(elbow, lowerAng, C.y);

    // hollow frame markers instead of joint dots
    s.dot(root[0], root[1], { color: C.bg, r: 5, ring: "#fff" });
    s.dot(elbow[0], elbow[1], { color: C.bg, r: 5, ring: C.a3 });
    s.text(elbow[0], elbow[1], "elbow matrix", { color: C.a3, dy: -12, align: "center", size: 9 });
    s.text(root[0], root[1], "shoulder matrix", { color: "#fff", dy: 20, align: "center", size: 9 });
    if (overreach) s.dot(endEff[0], endEff[1], { color: C.accent, r: 5 });

    panel.readout(
      `<span class="k">closed-form, no joints</span> &nbsp; shoulder = <b>${(shoulderAng * DEG).toFixed(1)}°</b> ` +
      `&nbsp;·&nbsp; elbow bend = <b>${(elbowRot * DEG).toFixed(1)}°</b> &nbsp;·&nbsp; ` +
      `d = <b>${dist.toFixed(2)}</b> / reach ${reach.toFixed(1)}` +
      (overreach ? ` &nbsp;·&nbsp; <b>overreach</b>` : "")
    );
  });

  panel.note("A two-bone IK built purely from Maya math nodes — no ikHandle, no joints. The angles come straight from the law of cosines and feed a fourByFourMatrix, so each bone is placed as an oriented <b style='color:#ff4d3d'>X</b>/<b style='color:#3ddc84'>Y</b> frame (a matrix), not a joint. Drag the IK hand and resize the bones; the shoulder and elbow rotations are computed directly, with no iteration and no jointOrient overhead.");
  s.render();
});
