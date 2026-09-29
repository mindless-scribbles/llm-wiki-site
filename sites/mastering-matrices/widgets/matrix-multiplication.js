/* matrix-multiplication — composing a rotate and a translate; order is not commutative. */
VIZ.build("matrix-multiplication", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-5, 7, -4, 6], aspect: 1.5 });

  let rot = 55 * Math.PI / 180;   // R
  let tx = 3, ty = 0;             // T
  let order = 0;                  // 0: R then T  (T·R) | 1: T then R (R·T)
  let t = 1;                      // animation progress 0..1

  panel.slider({ label: "rotate R", min: -180, max: 180, value: 55, unit: "°", dp: 0, onInput: (v) => { rot = v * Math.PI / 180; s.render(); } });
  panel.slider({ label: "translate Tx", min: -2, max: 5, value: tx, dp: 1, onInput: (v) => { tx = v; s.render(); } });
  panel.buttons([
    { label: "R then T", active: true, onClick: () => { order = 0; s.render(); } },
    { label: "T then R", onClick: () => { order = 1; s.render(); } },
  ]);
  panel.button({ label: "▶ play", onClick: () => { t = 0; anim && anim.stop(); anim = s.animate((dt) => { t = Math.min(1, t + dt * 0.7); if (t >= 1) anim.stop(); }); } });
  let anim = null;

  // an "F" shape (asymmetric so rotation + flips are obvious)
  const F = [[0, 0], [0, 3], [2, 3], [2, 2.3], [0.7, 2.3], [0.7, 1.7], [1.6, 1.7], [1.6, 1], [0.7, 1], [0.7, 0]];
  const R = (a) => [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
  const applyR = (m, p) => [m[0][0] * p[0] + m[0][1] * p[1], m[1][0] * p[0] + m[1][1] * p[1]];

  function seq(p, prog) {
    const half = prog < 0.5 ? prog / 0.5 : 1;
    const half2 = prog < 0.5 ? 0 : (prog - 0.5) / 0.5;
    if (order === 0) { // R then T : final = T(R(p))
      const r = applyR(R(rot * half), p);
      return [r[0] + tx * half2, r[1] + ty * half2];
    } else { // T then R : final = R(T(p))
      const tt = [p[0] + tx * half, p[1] + ty * half];
      return applyR(R(rot * half2), tt);
    }
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // original (ghost)
    s.poly(F, { close: true, color: "rgba(244,244,245,0.22)", width: 1.5 });
    s.text(F[1][0], F[1][1], "start", { color: C.dim, dy: -6, size: 9 });

    // transformed
    const out = F.map((p) => seq(p, t));
    s.poly(out, { close: true, color: C.accent, width: 2.5, fill: "rgba(255,51,0,0.10)" });

    s.text(-4.8, 5.6, order === 0 ? "T · R   (rotate, then translate)" : "R · T   (translate, then rotate)", { color: C.a1, size: 11, weight: 700 });
  });

  panel.note("The same rotate R and translate T give different results depending on order — matrix multiplication does not commute. In Maya's row-vector convention a child matrix is multiplied by its parent's, so read the chain child → parent. Press play to watch each step apply.");
  panel.readout(`<span class="k">why order matters</span> rotating first spins the shape about the origin, then slides it; translating first moves it out, then rotation swings it around a wide arc.`);
  s.render();
});
