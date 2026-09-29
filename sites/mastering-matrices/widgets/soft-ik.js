/* soft-ik — two-bone IK with a soft-distance falloff that removes the pop at full extension. */
VIZ.build("soft-ik", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3.5, 5.5], aspect: 1.5 });
  const root = [0, 0];

  let L1 = 3, L2 = 3, dsoft = 1.2;
  panel.slider({ label: "upper L1", min: 1, max: 4.5, value: L1, dp: 1, onInput: (v) => { L1 = v; s.render(); } });
  panel.slider({ label: "lower L2", min: 1, max: 4.5, value: L2, dp: 1, onInput: (v) => { L2 = v; s.render(); } });
  panel.slider({ label: "soft dist dsoft", min: 0.01, max: 2.5, value: dsoft, dp: 2, onInput: (v) => { dsoft = v; s.render(); } });

  const T = s.draggable({ x: 5.5, y: 1.2, color: C.accent, label: "target", r: 9 });

  // soft transfer: input distance d -> effective distance d_eff (never quite reaches full lock)
  function softDist(d, reach) {
    const knee = reach - dsoft;
    if (d < knee) return d;
    return reach - dsoft * Math.exp(-(d - knee) / dsoft);
  }
  // closed-form two-bone solve to a distance along the base direction
  function solve(dEff, baseAng) {
    const clamped = Math.min(dEff, L1 + L2 - 0.0001);
    const cosB = VIZ.clamp((L1 * L1 + clamped * clamped - L2 * L2) / (2 * L1 * clamped), -1, 1);
    const B = Math.acos(cosB);
    const sh = baseAng + B; // elbow-up
    const elbow = [L1 * Math.cos(sh), L1 * Math.sin(sh)];
    const end = [dEff * Math.cos(baseAng), dEff * Math.sin(baseAng)];
    return { elbow, end };
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    const reach = L1 + L2;
    const dx = T.x - root[0], dy = T.y - root[1];
    const d = Math.hypot(dx, dy);
    const baseAng = Math.atan2(dy, dx);
    const dEff = softDist(d, reach);

    s.ring(0, 0, reach, { color: "rgba(244,244,245,0.12)", dash: [3, 5] });
    s.ring(0, 0, reach - dsoft, { color: "rgba(251,191,36,0.35)", dash: [2, 4] });

    // raw target vs softened effector
    s.line(0, 0, T.x, T.y, { color: C.dim, width: 1, dash: [5, 5] });
    const sol = solve(dEff, baseAng);
    s.fillTri(root, sol.elbow, sol.end, { fill: "rgba(255,51,0,0.10)" });
    s.line(0, 0, sol.elbow[0], sol.elbow[1], { color: C.z, width: 5 });
    s.line(sol.elbow[0], sol.elbow[1], sol.end[0], sol.end[1], { color: C.y, width: 5 });
    s.dot(0, 0, { color: "#fff", r: 5, label: "root" });
    s.dot(sol.elbow[0], sol.elbow[1], { color: C.z, r: 6, ring: "#fff", label: "elbow" });
    s.dot(sol.end[0], sol.end[1], { color: C.accent, r: 5, label: "effector" });

    // ---- inset plot: input distance x vs effective distance y ----
    // plot region in world coords (top-left), maps [0,reach] -> box
    const bx = -0.4, by = 2.4, bw = 3.4, bh = 2.6;
    const mx = reach || 1;
    const PX = (v) => bx + (VIZ.clamp(v, 0, mx) / mx) * bw;
    const PY = (v) => by + (VIZ.clamp(v, 0, mx) / mx) * bh;
    s.poly([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], { close: true, color: "rgba(244,244,245,0.18)", width: 1, fill: "rgba(13,13,16,0.65)" });
    s.text(bx, by + bh, "d → d_eff", { color: C.dim, size: 9, dy: -4, dx: 4 });
    // diagonal reference (identity)
    s.line(PX(0), PY(0), PX(mx), PY(mx), { color: "rgba(244,244,245,0.25)", width: 1, dash: [3, 3] });
    // soft curve
    const pts = [];
    for (let i = 0; i <= 40; i++) { const xv = (i / 40) * mx; pts.push([PX(xv), PY(softDist(xv, reach))]); }
    s.poly(pts, { color: C.a1, width: 2 });
    // knee marker (where falloff starts)
    s.dot(PX(reach - dsoft), PY(reach - dsoft), { color: C.a1, r: 3 });
    // current-d marker
    s.dot(PX(d), PY(dEff), { color: C.accent, r: 4, ring: "#fff" });

    panel.readout(
      `<span class="k">soft IK</span> &nbsp; d = <b>${d.toFixed(2)}</b> &nbsp;→&nbsp; d_eff = <b>${dEff.toFixed(2)}</b> ` +
      `&nbsp;·&nbsp; reach = ${reach.toFixed(1)} &nbsp;·&nbsp; knee at ${(reach - dsoft).toFixed(2)} ` +
      (d >= reach ? `&nbsp;·&nbsp; <b>past reach — effector eases toward lock, never snaps</b>` : "")
    );
  });

  panel.note("Drag the target past the amber knee ring. A raw solver snaps the arm dead straight the instant d = L1+L2, giving a visible pop. Soft IK feeds the solver an <b>effective</b> distance that curves away from the diagonal (inset), so the effector asymptotically approaches — but never reaches — full lock. Raising <b>dsoft</b> starts the easing earlier and softer. In Maya this scales the segment lengths before the IK solve.");
  s.render();
});
