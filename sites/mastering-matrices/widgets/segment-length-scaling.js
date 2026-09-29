/* segment-length-scaling — per-segment length scalars vs. a single global scale on a two-bone arm. */
VIZ.build("segment-length-scaling", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1.5, 7.5, -1, 7], aspect: 1.35 });

  // fixed base lengths (measured from the guides) and a fixed bent pose
  const UPPER_BASE = 2.4, LOWER_BASE = 2.0;
  const upperAng = 62 * Math.PI / 180;   // shoulder -> elbow direction (world)
  const lowerAng = 14 * Math.PI / 180;   // elbow -> wrist direction (world)

  let upScale = 1, loScale = 1, glob = 1;
  panel.slider({ label: "upper scale", min: 0.5, max: 1.6, value: 1, dp: 2, onInput: (v) => { upScale = v; s.render(); } });
  panel.slider({ label: "lower scale", min: 0.5, max: 1.6, value: 1, dp: 2, onInput: (v) => { loScale = v; s.render(); } });
  panel.slider({ label: "global scale", min: 0.6, max: 1.3, value: 1, dp: 2, onInput: (v) => { glob = v; s.render(); } });

  const shoulder = [0, 0];

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // effective length = base × per-segment scalar × global
    const upLen = UPPER_BASE * upScale * glob;
    const loLen = LOWER_BASE * loScale * glob;

    const elbow = [shoulder[0] + upLen * Math.cos(upperAng), shoulder[1] + upLen * Math.sin(upperAng)];
    const wrist = [elbow[0] + loLen * Math.cos(lowerAng), elbow[1] + loLen * Math.sin(lowerAng)];

    // ghost of the un-scaled rest arm for reference
    const gElbow = [shoulder[0] + UPPER_BASE * Math.cos(upperAng), shoulder[1] + UPPER_BASE * Math.sin(upperAng)];
    const gWrist = [gElbow[0] + LOWER_BASE * Math.cos(lowerAng), gElbow[1] + LOWER_BASE * Math.sin(lowerAng)];
    s.line(shoulder[0], shoulder[1], gElbow[0], gElbow[1], { color: "rgba(244,244,245,0.16)", width: 2, dash: [4, 4] });
    s.line(gElbow[0], gElbow[1], gWrist[0], gWrist[1], { color: "rgba(244,244,245,0.16)", width: 2, dash: [4, 4] });
    s.dot(gWrist[0], gWrist[1], { color: "rgba(244,244,245,0.22)", r: 3 });

    // bones
    s.line(shoulder[0], shoulder[1], elbow[0], elbow[1], { color: C.z, width: 6 });
    s.line(elbow[0], elbow[1], wrist[0], wrist[1], { color: C.y, width: 6 });

    // length labels at the bone midpoints
    const um = VIZ.v.lerp(shoulder, elbow, 0.5), lm = VIZ.v.lerp(elbow, wrist, 0.5);
    s.text(um[0], um[1], "upper " + upLen.toFixed(2), { color: C.z, size: 11, weight: 700, dx: -34, dy: -2 });
    s.text(lm[0], lm[1], "lower " + loLen.toFixed(2), { color: C.y, size: 11, weight: 700, dx: 10, dy: 2 });

    // joints
    s.dot(shoulder[0], shoulder[1], { color: "#fff", r: 5, label: "shoulder" });
    s.dot(elbow[0], elbow[1], { color: C.z, r: 6, ring: "#fff", label: "elbow" });
    s.dot(wrist[0], wrist[1], { color: C.accent, r: 6, ring: "#fff", label: "wrist" });

    // local frame at the shoulder (red X, green Y)
    const fl = 0.9;
    s.arrow(shoulder[0], shoulder[1], shoulder[0] + fl, shoulder[1], { color: C.x, width: 2.5 });
    s.arrow(shoulder[0], shoulder[1], shoulder[0], shoulder[1] + fl, { color: C.y, width: 2.5 });

    panel.readout(
      `<span class="k">length = base × segScale × global</span> &nbsp; ` +
      `upper = ${UPPER_BASE.toFixed(1)} × <b>${upScale.toFixed(2)}</b> × <b>${glob.toFixed(2)}</b> = <b>${upLen.toFixed(2)}</b> &nbsp;·&nbsp; ` +
      `lower = ${LOWER_BASE.toFixed(1)} × <b>${loScale.toFixed(2)}</b> × <b>${glob.toFixed(2)}</b> = <b>${loLen.toFixed(2)}</b> &nbsp;·&nbsp; ` +
      `total reach = <b>${(upLen + loLen).toFixed(2)}</b>`
    );
  });

  panel.note("Two animator-facing scalars stretch each bone independently (upper=blue, lower=green), while <b>global scale</b> multiplies both at once — the first global-scale fix in the series. In the rig the same scalar feeds both the IK solver's measured length and the FK <b>parentOffsetMatrix.translateX</b>, so an IK/FK switch never surfaces mismatched proportions. Dashed grey is the un-scaled rest arm.");
  s.render();
});
