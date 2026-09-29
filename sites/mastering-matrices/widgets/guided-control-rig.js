/* guided-control-rig — drag the guides; the control frames rebuild by aiming at the next guide. */
VIZ.build("guided-control-rig", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1, 9, -3, 5], aspect: 1.5 });

  // Guides are the rest-pose source of truth. Drag them to re-fit the rig.
  const G0 = s.draggable({ x: 1, y: 2.6, color: C.a1, label: "shoulder guide", r: 9 });
  const G1 = s.draggable({ x: 4.2, y: 1.4, color: C.a1, label: "elbow guide", r: 9 });
  const G2 = s.draggable({ x: 7.4, y: 2.2, color: C.a1, label: "wrist guide", r: 9 });

  let showFrames = true;
  panel.toggle({ label: "show derived control frames", value: true, onChange: (v) => { showFrames = v; s.render(); } });

  const AX = 1.1; // drawn axis length in world units

  // build an aimed frame at 'from' pointing toward 'to': X = aim, Y = perpendicular (y-up, ccw)
  function frame(from, to) {
    const d = VIZ.v.norm([to.x - from.x, to.y - from.y]);
    const perp = [-d[1], d[0]];
    return { o: [from.x, from.y], x: d, y: perp, ang: Math.atan2(d[1], d[0]) };
  }
  function drawFrame(f, tag) {
    if (!showFrames) return;
    s.arrow(f.o[0], f.o[1], f.o[0] + f.x[0] * AX, f.o[1] + f.x[1] * AX, { color: C.x, width: 3 });
    s.arrow(f.o[0], f.o[1], f.o[0] + f.y[0] * AX, f.o[1] + f.y[1] * AX, { color: C.y, width: 3 });
    s.text(f.o[0] + f.x[0] * AX, f.o[1] + f.x[1] * AX, tag, { color: C.dim, dy: -8, size: 9 });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // bones between guides
    s.line(G0.x, G0.y, G1.x, G1.y, { color: C.z, width: 6 });
    s.line(G1.x, G1.y, G2.x, G2.y, { color: C.a3, width: 6 });

    // derived control frames (upper aims shoulder->elbow, lower aims elbow->wrist)
    const fU = frame(G0, G1);
    const fL = frame(G1, G2);
    drawFrame(fU, "upperArm ctrl");
    drawFrame(fL, "lowerArm ctrl");

    // guide markers (drawn under handles by the library)
    s.dot(G2.x, G2.y, { color: C.a1, r: 4 });

    const l1 = VIZ.v.len([G1.x - G0.x, G1.y - G0.y]);
    const l2 = VIZ.v.len([G2.x - G1.x, G2.y - G1.y]);
    panel.readout(
      `<span class="k">derived from guides</span> &nbsp; ` +
      `upper: len <b>${l1.toFixed(2)}</b>, aim <b>${(fU.ang * 180 / Math.PI).toFixed(1)}°</b> &nbsp;·&nbsp; ` +
      `lower: len <b>${l2.toFixed(2)}</b>, aim <b>${(fL.ang * 180 / Math.PI).toFixed(1)}°</b>`
    );
  });

  panel.note("The amber guides are the rig's rest-pose source of truth. Each control frame is <em>derived</em>: it sits on its guide and aims (red X) at the next guide, with green Y perpendicular in the rotation plane — exactly what an <code>aimMatrix</code> feeds into the control's <code>offsetParentMatrix</code>. Drag any guide and both control orientations rebuild, so one rig re-fits any character's proportions without re-rigging.");
  s.render();
});
