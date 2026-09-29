/* ik-setup-with-maya-solver — Maya rotate-plane ikHandle: the pole vector sets the solve plane / elbow side. */
VIZ.build("ik-setup-with-maya-solver", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -4, 5.5], aspect: 1.5 });
  const root = [0, 0];

  let L1 = 3, L2 = 3;
  panel.slider({ label: "upper L1", min: 1, max: 4.5, value: L1, dp: 1, onInput: (v) => { L1 = v; s.render(); } });
  panel.slider({ label: "lower L2", min: 1, max: 4.5, value: L2, dp: 1, onInput: (v) => { L2 = v; s.render(); } });

  const T = s.draggable({ x: 5, y: 1.5, color: C.accent, label: "IK handle", r: 9 });
  const P = s.draggable({ x: 3, y: -2.5, color: C.a2, label: "pole vector", r: 8 });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const dx = T.x - root[0], dy = T.y - root[1];
    const dist = Math.hypot(dx, dy);
    const reach = L1 + L2;
    const clamped = Math.min(dist, reach - 0.0001);
    const baseAng = Math.atan2(dy, dx);

    // which side of the root->target axis is the pole on? (2D cross product)
    const side = (dx * (P.y - root[1]) - dy * (P.x - root[0])) >= 0 ? 1 : -1;

    const cosB = VIZ.clamp((L1 * L1 + clamped * clamped - L2 * L2) / (2 * L1 * clamped), -1, 1);
    const B = Math.acos(cosB);
    const sh = baseAng + side * B;
    const elbow = [L1 * Math.cos(sh), L1 * Math.sin(sh)];
    const end = dist > reach ? [reach * Math.cos(baseAng), reach * Math.sin(baseAng)] : [T.x, T.y];

    // root->target solve axis (dashed) — the rotation plane's spine
    s.line(root[0], root[1], T.x, T.y, { color: C.dim, width: 1, dash: [5, 5] });
    s.ring(0, 0, reach, { color: "rgba(244,244,245,0.10)", dash: [3, 5] });

    // pole -> elbow line: the pole pulls the elbow toward it
    s.line(P.x, P.y, elbow[0], elbow[1], { color: C.a2, width: 1.5, dash: [3, 4] });
    s.arrow(root[0], root[1], root[0] + (P.x - root[0]) * 0.45, root[1] + (P.y - root[1]) * 0.45,
      { color: "rgba(167,139,250,0.6)", width: 2, head: 8 });

    // triangle + bones
    s.fillTri(root, elbow, end, { fill: "rgba(255,51,0,0.10)" });
    s.line(root[0], root[1], elbow[0], elbow[1], { color: C.z, width: 5 });
    s.line(elbow[0], elbow[1], end[0], end[1], { color: C.y, width: 5 });

    s.dot(0, 0, { color: "#fff", r: 5, label: "root" });
    s.dot(elbow[0], elbow[1], { color: C.z, r: 6, ring: "#fff", label: "elbow" });
    s.dot(end[0], end[1], { color: C.accent, r: 5 });

    panel.readout(
      `<span class="k">rotate-plane ikHandle</span> &nbsp; d = <b>${dist.toFixed(2)}</b> / reach ${reach.toFixed(1)} ` +
      `&nbsp;·&nbsp; pole on <b>${side > 0 ? "+" : "−"} side</b> → elbow ${side > 0 ? "up" : "down"} ` +
      `&nbsp;·&nbsp; B = <b>${(B * 180 / Math.PI).toFixed(1)}°</b>` +
      (dist > reach ? ` &nbsp;·&nbsp; <b>overreach — locks straight</b>` : "")
    );
  });

  panel.note("Drag the <b>IK handle</b> to place the hand and the <b>pole vector</b> to aim the elbow. Maya's rotate-plane solver builds a plane through the root→handle axis (dashed) and the pole; the elbow lives in that plane. Cross the pole to the other side of the axis and the whole solution flips (elbow up ↔ down). Unlike a joint-free custom solver, this drives a real ikHandle via offsetParentMatrix and still carries three joints plus the solver's iterative cost.");
  s.render();
});
