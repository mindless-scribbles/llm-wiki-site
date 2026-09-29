/* transformation-hierarchy — a 3-link chain: each local rotation composes down to world. */
VIZ.build("transformation-hierarchy", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-2, 9, -4, 7], aspect: 1.4 });
  const root = [0, 0];
  const L = [2.4, 2.0, 1.6]; // fixed segment offsets

  let a = [30, 40, 35].map((d) => d * Math.PI / 180); // LOCAL angles
  const names = ["root", "mid", "tip"];
  const bone = [C.z, C.y, C.a1];
  names.forEach((nm, i) => {
    panel.slider({ label: nm + " local rot", min: -120, max: 120, value: a[i] * 180 / Math.PI, unit: "°", dp: 0, onInput: (v) => { a[i] = v * Math.PI / 180; s.render(); } });
  });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // walk the chain: world angle accumulates (world = local · parent · grandparent)
    const joints = [root.slice()];
    const wAng = [];
    let acc = 0, p = root.slice();
    for (let i = 0; i < 3; i++) {
      acc += a[i];
      wAng.push(acc);
      const q = [p[0] + L[i] * Math.cos(acc), p[1] + L[i] * Math.sin(acc)];
      joints.push(q);
      p = q;
    }

    // bones
    for (let i = 0; i < 3; i++) s.line(joints[i][0], joints[i][1], joints[i + 1][0], joints[i + 1][1], { color: bone[i], width: 6 });

    // each joint's own little frame (axes rotated by that link's WORLD angle)
    for (let i = 0; i < 3; i++) {
      const j = joints[i], th = wAng[i], al = 0.9;
      const cx = Math.cos(th), sn = Math.sin(th);
      s.arrow(j[0], j[1], j[0] + al * cx, j[1] + al * sn, { color: C.x, width: 2, head: 7 });
      s.arrow(j[0], j[1], j[0] - al * sn, j[1] + al * cx, { color: C.y, width: 2, head: 7 });
      s.arc(j[0], j[1], 0.7, th - a[i], th, { color: C.dim, width: 1.5 });
    }

    // joints on top
    for (let i = 0; i < 3; i++) s.dot(joints[i][0], joints[i][1], { color: bone[i], r: 6, ring: "#fff", label: names[i] });
    s.dot(joints[3][0], joints[3][1], { color: "#fff", r: 5, label: "end" });

    const deg = (r) => (r * 180 / Math.PI).toFixed(0);
    panel.readout(
      `<span class="k">world = local · parent · grandparent</span> &nbsp; ` +
      names.map((nm, i) =>
        `<b style="color:${bone[i]}">${nm}</b> local ${deg(a[i])}° → world ${deg(wAng[i])}°`
      ).join(" &nbsp;·&nbsp; ")
    );
  });

  panel.note("Three nested frames. Each slider sets a link's <b>local</b> rotation; a parent's rotation carries every descendant because the world angle is the running product down the chain — <code>world = local · parent · grandparent</code>. Spin <b>root</b> and the whole arm swings; spin <b>tip</b> and only the last bone moves. This is exactly how a Maya joint chain (or stacked <code>multMatrix</code> nodes) composes.");
  s.render();
});
