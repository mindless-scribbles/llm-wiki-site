/* joint-hierarchy-flat-vs-nested — same arm pose, serial chain vs parallel matrix feed. */
VIZ.build("joint-hierarchy-flat-vs-nested", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1.5, 11.5, -6.5, 7], aspect: 1.05 });
  const root = [1, 4];
  const L = [2.3, 2.0, 1.7];
  const bone = [C.z, C.y, C.a1];
  const jn = ["joint0", "joint1", "joint2"];

  let mode = 0; // 0 nested, 1 flat
  let rot = 30; // pose slider
  panel.buttons([
    { label: "NESTED", active: true, onClick: () => { mode = 0; s.render(); } },
    { label: "FLAT", onClick: () => { mode = 1; s.render(); } },
  ]);
  panel.slider({ label: "pose rotation", min: -60, max: 90, value: rot, unit: "°", dp: 0, onInput: (v) => { rot = v; s.render(); } });

  // a rounded-less box with centered label
  function box(cx, cy, w, h, label, c, sub) {
    const hw = w / 2, hh = h / 2;
    s.poly([[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh]],
      { close: true, fill: "rgba(13,13,16,0.9)", color: c, width: 2 });
    s.text(cx, cy + (sub ? 0.28 : 0), label, { color: c, size: 11, weight: 700, align: "center", baseline: "middle" });
    if (sub) s.text(cx, cy - 0.5, sub, { color: C.dim, size: 8, align: "center", baseline: "middle" });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);

    // ---- arm pose (identical in both modes) ----
    const a = [20 + rot, -35 + rot * 0.5, 30 + rot * 0.35].map((d) => d * Math.PI / 180);
    const joints = [root.slice()];
    let acc = 0, p = root.slice();
    const wAng = [];
    for (let i = 0; i < 3; i++) { acc += a[i]; wAng.push(acc); const q = [p[0] + L[i] * Math.cos(acc), p[1] + L[i] * Math.sin(acc)]; joints.push(q); p = q; }
    for (let i = 0; i < 3; i++) s.line(joints[i][0], joints[i][1], joints[i + 1][0], joints[i + 1][1], { color: bone[i], width: 6 });
    for (let i = 0; i < 3; i++) {
      const j = joints[i], th = wAng[i], al = 0.8;
      s.arrow(j[0], j[1], j[0] + al * Math.cos(th), j[1] + al * Math.sin(th), { color: C.x, width: 2, head: 6 });
      s.arrow(j[0], j[1], j[0] - al * Math.sin(th), j[1] + al * Math.cos(th), { color: C.y, width: 2, head: 6 });
      s.dot(j[0], j[1], { color: bone[i], r: 6, ring: "#fff", label: jn[i] });
    }
    s.dot(joints[3][0], joints[3][1], { color: "#fff", r: 4, label: "end" });

    // ---- dependency graph (differs by mode) ----
    const bx = [2.5, 5.5, 8.5], by = -1.5, bw = 2.2, bh = 1.2;

    if (mode === 0) {
      // NESTED: world -> j0 -> j1 -> j2 serial chain
      box(-0.1, by, 1.4, bh, "world", C.dim);
      for (let i = 0; i < 3; i++) box(bx[i], by, bw, bh, jn[i], bone[i], "local mtx");
      s.arrow(0.6, by, bx[0] - bw / 2, by, { color: C.dim, width: 2, head: 8 });
      for (let i = 0; i < 2; i++) s.arrow(bx[i] + bw / 2, by, bx[i + 1] - bw / 2, by, { color: C.a2, width: 2.5, head: 9 });
      s.text(5.5, -3.4, "serial dependency chain — each joint waits for its parent's world matrix", { color: C.a2, size: 10, align: "center", weight: 700 });
      s.text(5.5, -4.3, "evaluation is one-at-a-time down the chain", { color: C.dim, size: 9, align: "center" });
    } else {
      // FLAT: one matrix graph feeds every joint in parallel
      for (let i = 0; i < 3; i++) box(bx[i], by, bw, bh, jn[i], bone[i], "world mtx");
      const gx = 5.5, gy = -5;
      box(gx, gy, 4.6, 1.2, "matrix graph", C.a3, "computes all world matrices");
      for (let i = 0; i < 3; i++) s.arrow(gx + (i - 1) * 1.2, gy + 0.6, bx[i], by - bh / 2, { color: C.a3, width: 2.5, head: 9 });
      s.text(5.5, -3.35, "all joints are siblings under world — fed their OWN world matrix", { color: C.a3, size: 10, align: "center", weight: 700 });
      s.text(5.5, -6.1, "independent inputs → Maya evaluates them in parallel", { color: C.dim, size: 9, align: "center" });
    }

    panel.readout(
      `<span class="k">${mode === 0 ? "NESTED (parent chain)" : "FLAT (offsetParentMatrix)"}</span> &nbsp; ` +
      (mode === 0
        ? `world = local · parent · grandparent &nbsp;→&nbsp; <b style="color:${C.a2}">serial: j2 waits on j1 waits on j0</b>`
        : `each joint's offsetParentMatrix = precomputed world matrix &nbsp;→&nbsp; <b style="color:${C.a3}">independent → parallel eval</b>, joints deletable at publish`)
    );
  });

  panel.note("The <b>same 3-joint pose</b> drawn two ways. <b>NESTED</b>: joints are Outliner-parented, so each joint's world matrix depends on its parent's — the DG must evaluate them serially down the chain. <b>FLAT</b>: joints are un-parented siblings, each fed its own precomputed world matrix from a single side <em>matrix graph</em>; the inputs are independent so Maya can evaluate them in parallel (and the world matrices can be plugged straight into <code>skinCluster.matrix[i]</code>, letting you delete the joints at publish). Drag <b>pose rotation</b> — the arm bends identically in both; only the evaluation graph changes.");
  s.render();
});
