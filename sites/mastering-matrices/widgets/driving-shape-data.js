/* driving-shape-data — drive curve CVs directly by a weighted control, no cluster. */
VIZ.build("driving-shape-data", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-5, 5, -3.5, 5], aspect: 1.4 });

  // 7 rest CVs along a gentle curve
  const N = 7;
  const rest = [];
  for (let i = 0; i < N; i++) {
    const x = -4 + (8 * i) / (N - 1);
    rest.push([x, 1.1 * Math.sin(x * 0.42)]);
  }
  const ctrlRest = rest[3].slice(); // control anchored to middle CV rest

  let radius = 3.2;
  panel.slider({ label: "falloff radius", min: 0.6, max: 6, value: radius, dp: 2, onInput: (v) => { radius = v; s.render(); } });

  const ctrl = s.draggable({ x: ctrlRest[0], y: ctrlRest[1] + 2, color: C.accent, label: "control", r: 9 });

  const smooth = (e0, e1, x) => { const t = VIZ.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const weightOf = (d) => 1 - smooth(0, radius, d);

  // Catmull-Rom sampling for a smooth NURBS-like curve through the CVs
  function smoothCurve(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 12; k++) {
        const t = k / 12, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const disp = [ctrl.x - ctrlRest[0], ctrl.y - ctrlRest[1]];
    const driven = [], w = [];
    let affected = 0;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(rest[i][0] - ctrlRest[0], rest[i][1] - ctrlRest[1]);
      const wi = weightOf(d);
      w.push(wi);
      if (wi > 0.01) affected++;
      driven.push([rest[i][0] + disp[0] * wi, rest[i][1] + disp[1] * wi]);
    }

    // falloff radius ring around the control's rest anchor
    s.ring(ctrlRest[0], ctrlRest[1], radius, { color: "rgba(255,51,0,0.35)", dash: [4, 5] });
    s.dot(ctrlRest[0], ctrlRest[1], { color: C.dim, r: 3 });

    // rest curve + rest CVs (faint reference)
    s.poly(smoothCurve(rest), { color: "rgba(244,244,245,0.16)", width: 1.5 });
    for (let i = 0; i < N; i++) s.dot(rest[i][0], rest[i][1], { color: "rgba(244,244,245,0.28)", r: 3 });

    // driven curve + driven CVs, tinted by weight
    s.poly(smoothCurve(driven), { color: C.a3, width: 2.5 });
    for (let i = 0; i < N; i++) {
      if (w[i] > 0.01) s.line(rest[i][0], rest[i][1], driven[i][0], driven[i][1], { color: "rgba(255,51,0,0.3)", width: 1, dash: [3, 3] });
      const c = w[i] > 0.01 ? C.accent : C.dim;
      s.dot(driven[i][0], driven[i][1], { color: c, r: 4 + 3 * w[i], ring: w[i] > 0.01 ? "#fff" : null });
      s.text(driven[i][0], driven[i][1], "w" + w[i].toFixed(2), { color: c, dy: -10, size: 8, align: "center" });
    }

    // control tie line
    s.line(ctrlRest[0], ctrlRest[1], ctrl.x, ctrl.y, { color: C.accent, width: 1, dash: [5, 4] });

    panel.readout(
      `<span class="k">CV = rest + control·weight</span> &nbsp; ` +
      `falloff radius = <b>${radius.toFixed(2)}</b> &nbsp;·&nbsp; ` +
      `<b>${affected}</b>/${N} CVs affected &nbsp;·&nbsp; ` +
      `control displacement = (<b>${disp[0].toFixed(2)}</b>, <b>${disp[1].toFixed(2)}</b>)`
    );
  });

  panel.note("Each control vertex is driven <b>directly</b> — no cluster. Weight is a smoothstep falloff of the distance from the control's rest anchor to each CV's rest position, so CVs inside the <b>falloff radius</b> follow, tapering to zero at the ring. Drag the <b>control</b> to reshape the curve; every CV moves by <code>displacement × weight</code>. Widen the radius to pull more CVs. In Maya this is <code>controlPoints[i]</code> fed by matrix/weight math instead of one cluster per CV.");
  s.render();
});
