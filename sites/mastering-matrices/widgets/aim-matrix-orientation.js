/* aim-matrix-orientation — build an orthonormal frame that aims one axis at a
 * target and derives the other axis from an up vector via Gram-Schmidt. */
VIZ.build("aim-matrix-orientation", function (panel) {
  const C = VIZ.C, V = VIZ.v;
  const s = panel.scene({ world: [-3.6, 4.6, -3, 4], aspect: 1.4 });
  const O = [0, 0];            // frame origin
  const DISP = 1.8;            // drawn axis length (both axes are unit vectors)
  let primaryIsX = true;       // which axis aims at the target

  panel.buttons([
    { label: "primary = X", active: true, onClick: () => { primaryIsX = true; s.render(); } },
    { label: "primary = Y", onClick: () => { primaryIsX = false; s.render(); } },
  ]);

  const T = s.draggable({ x: 3, y: 1.4, color: C.accent, label: "target", r: 9 });
  const U = s.draggable({ x: 0.4, y: 3, color: C.a2, label: "up (raw)", r: 8 });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    const upVec = [U.x - O[0], U.y - O[1]];
    const primary = V.norm([T.x - O[0], T.y - O[1]]);          // aim direction
    const projS = V.dot(upVec, primary);                        // up along primary
    const residual = V.sub(upVec, V.mul(primary, projS));       // perpendicular part
    const secondary = V.norm(residual);                         // orthonormalized axis

    // reference lines: to the raw target and raw up vector
    s.line(O[0], O[1], T.x, T.y, { color: C.dim, width: 1, dash: [4, 5] });
    s.line(O[0], O[1], U.x, U.y, { color: "rgba(167,139,250,0.55)", width: 1.5, dash: [4, 5] });

    // projection of up onto primary, and the residual that becomes the secondary axis
    const projPt = V.add(O, V.mul(primary, projS));
    s.line(O[0], O[1], projPt[0], projPt[1], { color: "rgba(167,139,250,0.35)", width: 1 });
    s.line(U.x, U.y, projPt[0], projPt[1], { color: C.a3, width: 2, dash: [3, 4] });
    s.text((U.x + projPt[0]) / 2, (U.y + projPt[1]) / 2, "residual ⟂", { color: C.a3, size: 9, dx: 4 });

    // resulting orthonormal frame — X always red, Y always green (Maya convention)
    const xAxis = primaryIsX ? primary : secondary;
    const yAxis = primaryIsX ? secondary : primary;
    s.arrow(O[0], O[1], xAxis[0] * DISP, xAxis[1] * DISP, { color: C.x, width: 3.5, head: 12 });
    s.arrow(O[0], O[1], yAxis[0] * DISP, yAxis[1] * DISP, { color: C.y, width: 3.5, head: 12 });
    s.text(xAxis[0] * DISP, xAxis[1] * DISP, primaryIsX ? "X ▸ aim" : "X ⟂", { color: C.x, size: 11, weight: 700, dx: 6 });
    s.text(yAxis[0] * DISP, yAxis[1] * DISP, primaryIsX ? "Y ⟂" : "Y ▸ aim", { color: C.y, size: 11, weight: 700, dx: 6 });
    s.dot(O[0], O[1], { color: "#fff", r: 4 });

    const dot = V.dot(xAxis, yAxis);
    panel.readout(
      `<span class="k">aimMatrix</span> primary = normalize(target−origin) &nbsp;·&nbsp; ` +
      `secondary = normalize(up − primary·(up·primary)) &nbsp;|&nbsp; ` +
      `|X| = <b>${V.len(xAxis).toFixed(2)}</b> &nbsp; |Y| = <b>${V.len(yAxis).toFixed(2)}</b> &nbsp; ` +
      `X·Y = <b>${dot.toFixed(3)}</b> ${Math.abs(dot) < 1e-3 ? "≈ 0 ✓ perpendicular" : ""}`
    );
  });

  panel.note("The aimMatrix node orients a frame by aiming one axis at a target while keeping a secondary axis aligned to an up reference. Drag the <b>target</b> to swing the aim axis; drag <b>up</b> to see it projected perpendicular (Gram-Schmidt) so the frame stays orthonormal. Switch which axis aims. Both axes stay unit-length and their dot product stays 0 — a clean, twist-free orientation with no constraints.");
  s.render();
});
