/* ik-stretching — past full reach, either stretch both bones or lock the arm straight. */
VIZ.build("ik-stretching", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3.5, 5.5], aspect: 1.5 });
  const root = [0, 0];

  let L1 = 3, L2 = 3, up = 1, stretch = true, maxStretch = 1.6;
  panel.slider({ label: "upper L1", min: 1, max: 4.5, value: L1, dp: 1, onInput: (v) => { L1 = v; s.render(); } });
  panel.slider({ label: "lower L2", min: 1, max: 4.5, value: L2, dp: 1, onInput: (v) => { L2 = v; s.render(); } });
  panel.slider({ label: "max stretch", min: 1, max: 2.5, value: maxStretch, dp: 2, unit: "×", onInput: (v) => { maxStretch = v; s.render(); } });
  panel.toggle({ label: "enable stretch", value: true, onChange: (v) => { stretch = v; s.render(); } });
  panel.buttons([
    { label: "elbow up", active: true, onClick: () => { up = 1; s.render(); } },
    { label: "elbow down", onClick: () => { up = -1; s.render(); } },
  ]);

  const T = s.draggable({ x: 6.2, y: 2.4, color: C.accent, label: "IK control", r: 9 });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const vx = T.x - root[0], vy = T.y - root[1];
    const dist = Math.hypot(vx, vy);
    const reach = L1 + L2;
    const baseAng = Math.atan2(vy, vx);
    const overreach = dist > reach;

    // stretch factor: never below 1, capped at maxStretch
    let factor = 1;
    if (overreach && stretch) factor = Math.min(maxStretch, dist / reach);
    const l1 = L1 * factor, l2 = L2 * factor, sReach = l1 + l2;

    // reach envelopes
    s.ring(root[0], root[1], reach, { color: "rgba(244,244,245,0.14)", dash: [3, 5] });
    if (factor > 1.001) s.ring(root[0], root[1], sReach, { color: "rgba(251,191,36,0.30)", dash: [2, 4] });

    let elbow, endEff;
    if (dist <= reach) {
      // in reach: normal bent solve (law of cosines)
      const cosB = VIZ.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * Math.max(dist, 0.001)), -1, 1);
      const B = Math.acos(cosB);
      const sh = baseAng + up * B;
      elbow = [root[0] + L1 * Math.cos(sh), root[1] + L1 * Math.sin(sh)];
      endEff = [T.x, T.y];
    } else {
      // past reach: straight arm, scaled by factor
      const dir = [vx / (dist || 1), vy / (dist || 1)];
      elbow = [root[0] + l1 * dir[0], root[1] + l1 * dir[1]];
      endEff = [root[0] + sReach * dir[0], root[1] + sReach * dir[1]];
    }

    // bones (amber when stretched)
    const upperCol = factor > 1.001 ? C.a1 : C.z;
    const lowerCol = factor > 1.001 ? C.a1 : C.y;
    s.line(root[0], root[1], elbow[0], elbow[1], { color: upperCol, width: 5 });
    s.line(elbow[0], elbow[1], endEff[0], endEff[1], { color: lowerCol, width: 5 });

    // gap line when locked short of the target
    if (overreach && !stretch) s.line(endEff[0], endEff[1], T.x, T.y, { color: C.accent, width: 1.5, dash: [3, 4] });

    s.dot(root[0], root[1], { color: "#fff", r: 5, label: "root" });
    s.dot(elbow[0], elbow[1], { color: upperCol, r: 6, ring: "#fff", label: "elbow" });
    s.dot(endEff[0], endEff[1], { color: C.accent, r: 5, ring: "#fff" });

    let status;
    if (!overreach) status = "in reach";
    else if (!stretch) status = "<b>locked straight — can't touch target</b>";
    else if (factor >= maxStretch - 0.001) status = "<b>at max stretch — capped</b>";
    else status = "<b>stretching to reach</b>";

    panel.readout(
      `<span class="k">${stretch ? "stretch on" : "stretch off"}</span> &nbsp; d = <b>${dist.toFixed(2)}</b> / reach ${reach.toFixed(1)} ` +
      `&nbsp;·&nbsp; factor = <b>${factor.toFixed(2)}×</b> &nbsp;·&nbsp; ${status}`
    );
  });

  panel.note("The dashed ring is the chain's max reach (L1+L2). Drag the IK control past it: with <b>stretch on</b>, both bones scale by the same factor = d/reach (never below 1×, capped by max stretch) so the hand keeps up — the amber ring shows the stretched reach. With <b>stretch off</b>, the arm locks straight at full length and the red gap shows how far the control has run away. This is the overstretch handling that pairs with soft IK.");
  s.render();
});
