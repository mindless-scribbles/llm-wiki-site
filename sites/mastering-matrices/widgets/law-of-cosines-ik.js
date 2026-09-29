/* law-of-cosines-ik — drag the target; solve the two-bone triangle in closed form. */
VIZ.build("law-of-cosines-ik", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3.5, 5.5], aspect: 1.5 });
  const root = [0, 0];

  let L1 = 3, L2 = 3;
  panel.slider({ label: "upper L1", min: 1, max: 4.5, value: L1, dp: 1, onInput: (v) => { L1 = v; s.render(); } });
  panel.slider({ label: "lower L2", min: 1, max: 4.5, value: L2, dp: 1, onInput: (v) => { L2 = v; s.render(); } });
  let up = 1; // pole side
  panel.buttons([
    { label: "elbow up", active: true, onClick: () => { up = 1; s.render(); } },
    { label: "elbow down", onClick: () => { up = -1; s.render(); } },
  ]);

  const T = s.draggable({ x: 4.2, y: 2.2, color: C.accent, label: "target", r: 9 });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const dx = T.x - root[0], dy = T.y - root[1];
    let dist = Math.hypot(dx, dy);
    const reach = L1 + L2;
    const clamped = Math.min(dist, reach - 0.001);
    const overreach = dist > reach;

    // interior angle at the root (between L1 and the root->target line), law of cosines
    const cosB = (L1 * L1 + clamped * clamped - L2 * L2) / (2 * L1 * clamped);
    const B = Math.acos(VIZ.clamp(cosB, -1, 1));
    const baseAng = Math.atan2(dy, dx);
    const shoulderAng = baseAng + up * B;

    const elbow = [root[0] + L1 * Math.cos(shoulderAng), root[1] + L1 * Math.sin(shoulderAng)];
    const endEff = overreach
      ? [root[0] + reach * Math.cos(baseAng), root[1] + reach * Math.sin(baseAng)]
      : [T.x, T.y];

    // reach envelope
    s.ring(root[0], root[1], reach, { color: "rgba(244,244,245,0.12)", dash: [3, 5] });

    // root->target base line + the solved triangle
    s.line(root[0], root[1], T.x, T.y, { color: C.dim, width: 1, dash: [5, 5] });
    s.fillTri(root, elbow, endEff, { fill: "rgba(255,51,0,0.10)" });

    // bones
    s.line(root[0], root[1], elbow[0], elbow[1], { color: C.z, width: 5 });
    s.line(elbow[0], elbow[1], endEff[0], endEff[1], { color: C.y, width: 5 });

    // angle arc at root
    s.arc(root[0], root[1], 1.1, baseAng, shoulderAng, { color: C.a1, width: 2 });
    s.text(root[0] + 1.3 * Math.cos(baseAng + up * B / 2), root[1] + 1.3 * Math.sin(baseAng + up * B / 2), "B", { color: C.a1, size: 12, weight: 700 });

    // joints
    s.dot(root[0], root[1], { color: "#fff", r: 5, label: "root" });
    s.dot(elbow[0], elbow[1], { color: C.z, r: 6, ring: "#fff", label: "elbow" });
    if (overreach) s.dot(endEff[0], endEff[1], { color: C.accent, r: 5 });

    panel.readout(
      `<span class="k">law of cosines</span> &nbsp; cos(B) = (L1² + d² − L2²) / (2·L1·d) = <b>${VIZ.clamp(cosB, -1, 1).toFixed(3)}</b> &nbsp;→&nbsp; ` +
      `B = <b>${(B * 180 / Math.PI).toFixed(1)}°</b> &nbsp;·&nbsp; d = <b>${dist.toFixed(2)}</b> / reach ${reach.toFixed(1)} ` +
      (overreach ? `&nbsp;·&nbsp; <b>overreach — arm locks straight</b>` : "")
    );
  });

  panel.note("Drag the target. No iteration: the upper-bone angle B comes straight from the law of cosines on the root–elbow–target triangle. Two solutions exist (elbow up/down) — the pole choice picks one. Past full reach, d clamps and the arm locks out.");
  s.render();
});
