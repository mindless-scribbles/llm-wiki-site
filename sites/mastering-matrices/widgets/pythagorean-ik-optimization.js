/* pythagorean-ik-optimization — place the elbow with Pythagoras (a, h), skipping acos+sin. */
VIZ.build("pythagorean-ik-optimization", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3.5, 5.5], aspect: 1.5 });
  const root = [0, 0];

  let L1 = 3, L2 = 3, up = 1;
  panel.slider({ label: "upper L1", min: 1, max: 4.5, value: L1, dp: 1, onInput: (v) => { L1 = v; s.render(); } });
  panel.slider({ label: "lower L2", min: 1, max: 4.5, value: L2, dp: 1, onInput: (v) => { L2 = v; s.render(); } });
  panel.buttons([
    { label: "elbow up", active: true, onClick: () => { up = 1; s.render(); } },
    { label: "elbow down", onClick: () => { up = -1; s.render(); } },
  ]);

  const T = s.draggable({ x: 4.2, y: 2.2, color: C.accent, label: "target", r: 9 });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const vx = T.x - root[0], vy = T.y - root[1];
    const dist = Math.hypot(vx, vy);
    const reach = L1 + L2;
    const d = Math.max(0.001, Math.min(dist, reach - 0.001));
    const dir = [vx / (dist || 1), vy / (dist || 1)];
    const perp = [-dir[1] * up, dir[0] * up];

    // Pythagorean construction — no trig
    const a = (d * d + L1 * L1 - L2 * L2) / (2 * d);          // projection foot along the base
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));        // perpendicular height to the elbow
    const foot = [root[0] + a * dir[0], root[1] + a * dir[1]];
    const elbow = [foot[0] + h * perp[0], foot[1] + h * perp[1]];
    const endEff = [root[0] + d * dir[0], root[1] + d * dir[1]];

    s.ring(root[0], root[1], reach, { color: "rgba(244,244,245,0.12)", dash: [3, 5] });

    // base line of length d (root -> endEff)
    s.line(root[0], root[1], endEff[0], endEff[1], { color: C.a3, width: 2 });
    s.text((root[0] + foot[0]) / 2, (root[1] + foot[1]) / 2, "a", { color: C.a3, dy: 16, align: "center", size: 12, weight: 700 });

    // perpendicular height h (foot -> elbow)
    s.line(foot[0], foot[1], elbow[0], elbow[1], { color: C.a1, width: 2, dash: [4, 4] });
    s.text((foot[0] + elbow[0]) / 2, (foot[1] + elbow[1]) / 2, "h", { color: C.a1, dx: 8, align: "left", size: 12, weight: 700 });

    // right-angle marker at the foot
    const m = 0.35;
    const c1 = [foot[0] + m * dir[0], foot[1] + m * dir[1]];
    const c2 = [c1[0] + m * perp[0], c1[1] + m * perp[1]];
    const c3 = [foot[0] + m * perp[0], foot[1] + m * perp[1]];
    s.poly([foot, c1, c2, c3], { close: false, color: C.dim, width: 1 });

    // bones
    s.line(root[0], root[1], elbow[0], elbow[1], { color: C.z, width: 5 });
    s.line(elbow[0], elbow[1], endEff[0], endEff[1], { color: C.y, width: 5 });

    s.dot(root[0], root[1], { color: "#fff", r: 5, label: "root" });
    s.dot(foot[0], foot[1], { color: C.a3, r: 4, ring: "#fff" });
    s.dot(elbow[0], elbow[1], { color: C.z, r: 6, ring: "#fff", label: "elbow" });
    if (dist > reach) s.dot(endEff[0], endEff[1], { color: C.accent, r: 5 });

    panel.readout(
      `<span class="k">Pythagoras, no trig</span> &nbsp; a = (d²+L1²−L2²)/(2d) = <b>${a.toFixed(2)}</b> ` +
      `&nbsp;·&nbsp; h = √(L1²−a²) = <b>${h.toFixed(2)}</b> &nbsp;·&nbsp; d = <b>${dist.toFixed(2)}</b> / reach ${reach.toFixed(1)}`
    );
  });

  panel.note("The optimized elbow placement: project the elbow onto the root→target line. Its foot sits at distance <b style='color:#22d3ee'>a</b> along the base, and it stands <b style='color:#fbbf24'>h</b> above at a right angle — elbow = root + a·dir + h·perp. Computing a and h with squares and one sqrt replaces the costly acos + sin, so it's cheaper every frame. Drag the target; flip elbow up/down to swap the sign of h.");
  s.render();
});
