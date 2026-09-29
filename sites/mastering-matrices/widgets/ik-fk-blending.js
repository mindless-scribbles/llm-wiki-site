/* ik-fk-blending — blend an FK pose and an IK pose by interpolating joint angles in LOCAL space. */
VIZ.build("ik-fk-blending", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-4, 8, -4, 5.5], aspect: 1.5 });
  const root = [0, 0];
  const L1 = 3, L2 = 2.6;

  let fkSh = 70 * Math.PI / 180;   // FK shoulder (local, from parent x-axis)
  let fkEl = -60 * Math.PI / 180;  // FK elbow bend (local, relative to upper bone)
  let blend = 0.5;                 // 0 = FK, 1 = IK

  panel.slider({ label: "FK shoulder", min: -30, max: 150, value: 70, unit: "°", dp: 0, onInput: (v) => { fkSh = v * Math.PI / 180; s.render(); } });
  panel.slider({ label: "FK elbow", min: -150, max: 0, value: -60, unit: "°", dp: 0, onInput: (v) => { fkEl = v * Math.PI / 180; s.render(); } });
  panel.slider({ label: "useIK blend", min: 0, max: 1, value: blend, dp: 2, onInput: (v) => { blend = v; s.render(); } });

  const T = s.draggable({ x: 4.5, y: 1.5, color: C.z, label: "IK target", r: 9 });

  // reconstruct chain from LOCAL joint angles
  function chain(shLocal, elLocal) {
    const elbow = [L1 * Math.cos(shLocal), L1 * Math.sin(shLocal)];
    const a2 = shLocal + elLocal;
    const hand = [elbow[0] + L2 * Math.cos(a2), elbow[1] + L2 * Math.sin(a2)];
    return { elbow, hand };
  }
  function drawArm(ang, opt) {
    const c = chain(ang[0], ang[1]);
    s.line(0, 0, c.elbow[0], c.elbow[1], opt);
    s.line(c.elbow[0], c.elbow[1], c.hand[0], c.hand[1], opt);
    return c;
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // ---- IK pose: solve two-bone to target, express as local angles ----
    const dx = T.x, dy = T.y;
    const dist = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.0001);
    const baseAng = Math.atan2(dy, dx);
    const cosB = VIZ.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const ikShLocal = baseAng + Math.acos(cosB);
    // interior angle at elbow via law of cosines -> local bend (negative = elbow-up)
    const cosE = VIZ.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1);
    const ikElLocal = -(Math.PI - Math.acos(cosE));

    const fkAng = [fkSh, fkEl];
    const ikAng = [ikShLocal, ikElLocal];
    const mixAng = [fkAng[0] + (ikAng[0] - fkAng[0]) * blend, fkAng[1] + (ikAng[1] - fkAng[1]) * blend];

    // ghosts
    drawArm(fkAng, { color: "rgba(251,191,36,0.35)", width: 3 });
    drawArm(ikAng, { color: "rgba(58,160,255,0.35)", width: 3 });
    s.text(-3.8, 5.1, "FK ghost", { color: C.a1, size: 10 });
    s.text(-3.8, 4.5, "IK ghost", { color: C.z, size: 10 });

    // blended solid
    const c = drawArm(mixAng, { color: C.accent, width: 5 });
    s.dot(0, 0, { color: "#fff", r: 5, label: "root" });
    s.dot(c.elbow[0], c.elbow[1], { color: C.accent, r: 6, ring: "#fff", label: "elbow" });
    s.dot(c.hand[0], c.hand[1], { color: C.accent, r: 5, label: "hand" });

    const D = 180 / Math.PI;
    panel.readout(
      `<span class="k">blend ${(blend * 100).toFixed(0)}%</span> &nbsp; ` +
      `shoulder: FK <b>${(fkSh * D).toFixed(0)}°</b> → IK <b>${(ikShLocal * D).toFixed(0)}°</b> ` +
      `&nbsp;·&nbsp; elbow: FK <b>${(fkEl * D).toFixed(0)}°</b> → IK <b>${(ikElLocal * D).toFixed(0)}°</b> ` +
      `&nbsp;·&nbsp; result shoulder <b>${(mixAng[0] * D).toFixed(0)}°</b>, elbow <b>${(mixAng[1] * D).toFixed(0)}°</b>`
    );
  });

  panel.note("Set an FK pose with the two rotation sliders (amber ghost) and an IK pose by dragging the target (blue ghost). The <b>useIK</b> slider interpolates the <b>local joint angles</b> — not world positions — from FK to IK, so the red arm always stays connected and rigid through the blend. Blending world-space matrices for the lower bone would let the hand drift off the arm; local-space blending is why Maya rigs switch modes without a pop.");
  s.render();
});
