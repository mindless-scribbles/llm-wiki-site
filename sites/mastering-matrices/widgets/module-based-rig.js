/* module-based-rig — wire UPPER_ARM.endOut into LOWER_ARM.parentIn; rotate the upper, the lower follows. */
VIZ.build("module-based-rig", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 11, -6, 6], aspect: 1.1 });

  let deg = 35;
  panel.slider({ label: "rotate UPPER_ARM", min: -70, max: 90, value: deg, unit: "°", dp: 0, onInput: (v) => { deg = v; s.render(); } });

  const base = [2, -1.2];   // rig root, lower area
  const Lu = 2.6, Ll = 2.4; // module bone lengths

  // draw a labeled module card with a parentIn (left) and endOut (right) port
  function card(x0, y0, w, h, name, col) {
    s.poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], { close: true, color: col, width: 2, fill: "rgba(255,255,255,0.03)" });
    s.text(x0 + w / 2, y0 + h - 0.5, name, { color: col, align: "center", size: 11, weight: 700 });
    const pin = [x0, y0 + h / 2], pout = [x0 + w, y0 + h / 2];
    s.dot(pin[0], pin[1], { color: C.a3, r: 5 });
    s.text(pin[0], pin[1], "parentIn", { color: C.a3, dx: 6, dy: 4, size: 8 });
    s.dot(pout[0], pout[1], { color: C.a2, r: 5 });
    s.text(pout[0], pout[1], "endOut", { color: C.a2, dx: -6, dy: 4, size: 8, align: "right" });
    return { pin, pout };
  }

  s.onDraw(function () {
    s.grid(1, C.grid);

    // --- top: the two module cards, wired output -> input ---
    const up = card(0.5, 3.2, 3.4, 2, "UPPER_ARM", C.z);
    const lo = card(6.1, 3.2, 3.4, 2, "LOWER_ARM", C.a3);
    s.arrow(up.pout[0], up.pout[1], lo.pin[0], lo.pin[1], { color: C.a2, width: 2.5 });
    s.text((up.pout[0] + lo.pin[0]) / 2, up.pout[1] + 0.55, "endOut → parentIn", { color: C.a2, align: "center", size: 9 });
    s.text(5, 5.7, "modules compose by wiring matrix output → input", { color: C.dim, align: "center", size: 9 });

    // --- bottom: the actual rig those modules represent ---
    const a = deg * Math.PI / 180;
    const dU = [Math.cos(a), Math.sin(a)];
    const endOut = [base[0] + dU[0] * Lu, base[1] + dU[1] * Lu];   // UPPER_ARM.endOut (tip frame)
    // LOWER_ARM.parentIn = UPPER_ARM.endOut; lower local is identity -> continues in same dir
    const endLo = [endOut[0] + dU[0] * Ll, endOut[1] + dU[1] * Ll];
    const perp = [-dU[1], dU[0]];

    s.line(base[0], base[1], endOut[0], endOut[1], { color: C.z, width: 6 });
    s.line(endOut[0], endOut[1], endLo[0], endLo[1], { color: C.a3, width: 6 });

    // tip frames (red X = aim, green Y = perpendicular)
    const AX = 0.9;
    s.arrow(endOut[0], endOut[1], endOut[0] + dU[0] * AX, endOut[1] + dU[1] * AX, { color: C.x, width: 3 });
    s.arrow(endOut[0], endOut[1], endOut[0] + perp[0] * AX, endOut[1] + perp[1] * AX, { color: C.y, width: 3 });
    s.dot(base[0], base[1], { color: "#fff", r: 4, label: "root" });
    s.dot(endOut[0], endOut[1], { color: C.a2, r: 6, ring: "#fff" });
    s.text(endOut[0], endOut[1], "endOut = parentIn", { color: C.a2, dx: 8, dy: -6, size: 9 });

    panel.readout(
      `<span class="k">matrix at port</span> &nbsp; UPPER_ARM.endOut → LOWER_ARM.parentIn &nbsp;·&nbsp; ` +
      `translate = (<b>${endOut[0].toFixed(2)}</b>, <b>${endOut[1].toFixed(2)}</b>) &nbsp;·&nbsp; ` +
      `rotate = <b>${deg.toFixed(0)}°</b>`
    );
  });

  panel.note("Each rig module is self-contained and talks to the world only through named matrix pass-throughs: a <code>parentIn</code> and an <code>endOut</code>. Wiring UPPER_ARM's <code>endOut</code> into LOWER_ARM's <code>parentIn</code> feeds the upper tip's world matrix as the lower module's <code>offsetParentMatrix</code>. Rotate the upper module — the lower one follows because its input <em>is</em> the upper's output. Swap either module and the wiring still holds.");
  s.render();
});
