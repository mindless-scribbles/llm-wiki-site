/* ik-elbow-locker — pin the elbow to its own control while the hand keeps animating. */
VIZ.build("ik-elbow-locker", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-2, 8, -4, 5], aspect: 1.5 });
  const root = [0, 0];
  const L1 = 3, L2 = 3;

  let lock = 0; // 0 = pure IK, 1 = elbow fully pinned to the lock control
  panel.slider({ label: "elbow lock", min: 0, max: 1, value: 0, dp: 2, onInput: (v) => { lock = v; s.render(); } });
  let up = 1;
  panel.buttons([
    { label: "elbow up", active: true, onClick: () => { up = 1; s.render(); } },
    { label: "elbow down", onClick: () => { up = -1; s.render(); } },
  ]);

  const T = s.draggable({ x: 4.4, y: 1.8, color: C.accent, label: "hand", r: 9 });
  const Lk = s.draggable({ x: 2.6, y: 3.2, color: C.a2, label: "elbow lock", r: 8 });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    s.ring(root[0], root[1], L1 + L2, { color: "rgba(244,244,245,0.10)", dash: [3, 5] });

    // --- normal two-bone IK elbow (law of cosines) ---
    const dx = T.x - root[0], dy = T.y - root[1];
    const dist = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.001);
    const base = Math.atan2(dy, dx);
    const cosB = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
    const B = Math.acos(VIZ.clamp(cosB, -1, 1));
    const ikElbow = [root[0] + L1 * Math.cos(base + up * B), root[1] + L1 * Math.sin(base + up * B)];

    // --- blend the elbow toward the lock control ---
    const elbow = VIZ.v.lerp(ikElbow, [Lk.x, Lk.y], lock);

    // ghost of the unlocked IK solution
    s.line(root[0], root[1], ikElbow[0], ikElbow[1], { color: "rgba(244,244,245,0.20)", width: 2, dash: [4, 4] });
    s.line(ikElbow[0], ikElbow[1], T.x, T.y, { color: "rgba(244,244,245,0.20)", width: 2, dash: [4, 4] });

    // helper line from the lock control to the actual elbow
    s.line(Lk.x, Lk.y, elbow[0], elbow[1], { color: "rgba(167,139,250,0.5)", width: 1, dash: [2, 4] });

    // actual bones (they stretch when the elbow is pulled off the IK circle)
    const upLen = VIZ.v.len(VIZ.v.sub(elbow, root));
    const loLen = VIZ.v.len(VIZ.v.sub([T.x, T.y], elbow));
    const upStretch = upLen / L1, loStretch = loLen / L2;
    const col = (st) => (Math.abs(st - 1) > 0.02 ? C.a1 : C.z);
    s.line(root[0], root[1], elbow[0], elbow[1], { color: col(upStretch), width: 5 });
    s.line(elbow[0], elbow[1], T.x, T.y, { color: Math.abs(loStretch - 1) > 0.02 ? C.a1 : C.y, width: 5 });

    s.dot(root[0], root[1], { color: "#fff", r: 5, label: "root" });
    s.dot(elbow[0], elbow[1], { color: C.a2, r: 6, ring: "#fff", label: "elbow" });

    panel.readout(
      `<span class="k">lock</span> <b>${(lock * 100).toFixed(0)}%</b> &nbsp;·&nbsp; ` +
      `elbow → ${lock < 0.02 ? "pure IK solve" : lock > 0.98 ? "pinned to control" : "blended"} &nbsp;·&nbsp; ` +
      `upper stretch <b>${upStretch.toFixed(2)}×</b> &nbsp; lower stretch <b>${loStretch.toFixed(2)}×</b>`
    );
  });

  panel.note("Drag the hand (red) and the elbow-lock control (violet). At 0% the elbow follows the normal two-bone IK solve (dashed ghost). As you raise the lock, the elbow is pinned to its own control — the bones stretch to keep root and hand connected. This is why the elbow locker gets a separate control with its own space switch: it holds the elbow in place (on a table, a hip) while the hand animates freely.");
  s.render();
});
