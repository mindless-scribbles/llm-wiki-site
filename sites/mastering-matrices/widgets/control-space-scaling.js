/* control-space-scaling — master scale must not double-scale intermediate controls. */
VIZ.build("control-space-scaling", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-1.5, 11, -1, 8], aspect: 1.35 });

  // rest LOCAL offsets down the chain: MASTER -> MAIN -> CONTROL -> tip
  const mainL = [2.0, 1.3], ctrlL = [1.7, 1.4], tipL = [1.3, 0.9];

  let S = 1;      // master (global) scale
  let naive = false;
  panel.slider({ label: "master scale", min: 0.5, max: 1.7, value: 1, dp: 2, onInput: (v) => { S = v; s.render(); } });
  panel.toggle({ label: "naive: control double-scales", value: false, onChange: (v) => { naive = v; s.render(); } });

  const col = [C.a1, C.a3, C.accent, C.dim]; // master, main, control, tip

  function drawFrame(o, ws, label, c) {
    const a = 0.55 * ws;
    s.arrow(o[0], o[1], o[0] + a, o[1], { color: C.x, width: 2, head: 7 });
    s.arrow(o[0], o[1], o[0], o[1] + a, { color: C.y, width: 2, head: 7 });
    s.dot(o[0], o[1], { color: c, r: 6, ring: "#fff", label });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});

    // control's world scale doubles in the naive bug; correct keeps it uniform S
    const ctrlWS = naive ? S * S : S;
    const master = [0, 0];
    const main = [S * mainL[0], S * mainL[1]];
    const control = [main[0] + S * ctrlL[0], main[1] + S * ctrlL[1]];
    const tip = [control[0] + ctrlWS * tipL[0], control[1] + ctrlWS * tipL[1]];
    const nodes = [master, main, control, tip];
    const worldScale = [S, S, ctrlWS, ctrlWS];
    const localScale = [S, 1, naive ? S : 1, 1];
    const names = ["MASTER", "MAIN", "CONTROL", "tip"];

    // ghost of the rest (unscaled) chain for reference
    const g = [[0, 0], mainL, [mainL[0] + ctrlL[0], mainL[1] + ctrlL[1]]];
    g.push([g[2][0] + tipL[0], g[2][1] + tipL[1]]);
    s.poly(g, { color: "rgba(244,244,245,0.16)", width: 1.5, dash: [4, 4] });

    // bones
    for (let i = 0; i < 3; i++) {
      const segBug = naive && i === 2; // control->tip segment is the one that double-scales
      s.line(nodes[i][0], nodes[i][1], nodes[i + 1][0], nodes[i + 1][1],
        { color: segBug ? C.accent : "rgba(244,244,245,0.5)", width: segBug ? 5 : 4 });
    }

    // frames + per-node scale labels
    for (let i = 0; i < 4; i++) {
      drawFrame(nodes[i], worldScale[i], names[i], col[i]);
      s.text(nodes[i][0], nodes[i][1],
        "L=" + localScale[i].toFixed(2) + "  W=" + worldScale[i].toFixed(2),
        { color: localScale[i] > 1.001 && i > 0 ? C.accent : C.dim, dy: 20, size: 9, align: "center" });
    }

    if (naive)
      s.text(tip[0], tip[1], "double-scaled!", { color: C.accent, dy: -14, size: 10, weight: 700, align: "center" });

    panel.readout(
      `<span class="k">master scale S = ${S.toFixed(2)}</span> &nbsp; ` +
      `MASTER local=<b>${S.toFixed(2)}</b> &nbsp;·&nbsp; ` +
      `<b style="color:${C.accent}">CONTROL</b> local=<b>${localScale[2].toFixed(2)}</b> ` +
      `world=<b>${worldScale[2].toFixed(2)}</b> ` +
      (naive
        ? `&nbsp;→&nbsp; <b style="color:${C.accent}">local≠1: control scales on top of master (S² past it)</b>`
        : `&nbsp;→&nbsp; local stays <b>1.00</b>, world carries S cleanly`)
    );
  });

  panel.note("MASTER holds global scale; MAIN, CONTROL and the tip should read a clean <b>local scale of 1.0</b> while their <b>world</b> positions scale uniformly about the master origin. Drag the <b>master scale</b> slider — the whole rig grows about MASTER, but the intermediate CONTROL's local value never changes, so animators get predictable numbers. Flip <b>naive</b> to see the bug: CONTROL also carries the scale, so everything past it is multiplied by S twice (S²) and the control-to-tip segment blows out.");
  s.render();
});
