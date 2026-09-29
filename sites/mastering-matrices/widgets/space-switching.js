/* space-switching — reparent a hand control between WORLD / CHEST / ROOT with no pop on switch. */
VIZ.build("space-switching", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [-4.5, 8.5, -4, 6.5], aspect: 1.3 });

  // three parent frames: {pos:[x,y], rot:radians}. WORLD is fixed at the origin.
  const frames = [
    { name: "WORLD", pos: [0, 0], rot: 0, col: C.a3 },
    { name: "CHEST", pos: [3.2, 2.6], rot: 0, col: C.a2 },
    { name: "ROOT", pos: [-2.2, -1.8], rot: 0, col: C.a1 },
  ];
  let active = 1; // start parented to CHEST

  // hand stored as a constant OFFSET inside the active frame: local pos + local angle
  const local = { ox: 1.6, oy: 1.2, rot: 0.3 };

  function toWorld(f, lx, ly) {
    const c = Math.cos(f.rot), sn = Math.sin(f.rot);
    return [f.pos[0] + c * lx - sn * ly, f.pos[1] + sn * lx + c * ly];
  }
  function toLocal(f, wx, wy) {
    const dx = wx - f.pos[0], dy = wy - f.pos[1];
    const c = Math.cos(f.rot), sn = Math.sin(f.rot);
    return [c * dx + sn * dy, -sn * dx + c * dy];
  }
  const handWorld = () => toWorld(frames[active], local.ox, local.oy);
  const handWorldRot = () => frames[active].rot + local.rot;

  // rotate sliders for the two movable frames — rotating the ACTIVE parent carries the hand
  panel.slider({ label: "CHEST rotate", min: -90, max: 90, value: 0, unit: "°", dp: 0, onInput: (v) => { frames[1].rot = v * Math.PI / 180; sync(); s.render(); } });
  panel.slider({ label: "ROOT rotate", min: -90, max: 90, value: 0, unit: "°", dp: 0, onInput: (v) => { frames[2].rot = v * Math.PI / 180; sync(); s.render(); } });

  // switching space must NOT move the hand: recompute its offset in the new frame
  panel.buttons([
    { label: "WORLD", onClick: () => switchTo(0) },
    { label: "CHEST", active: true, onClick: () => switchTo(1) },
    { label: "ROOT", onClick: () => switchTo(2) },
  ]);
  function switchTo(i) {
    const hw = handWorld(), hr = handWorldRot();   // freeze current world pose
    active = i;
    const nl = toLocal(frames[i], hw[0], hw[1]);    // re-express in the new parent
    local.ox = nl[0]; local.oy = nl[1];
    local.rot = hr - frames[i].rot;                 // no pop
    sync(); s.render();
  }

  // draggable frame origins (CHEST, ROOT) and the hand control
  const chestH = s.draggable({ x: frames[1].pos[0], y: frames[1].pos[1], color: frames[1].col, r: 7, onDrag: (h) => { frames[1].pos = [h.x, h.y]; sync(); } });
  const rootH = s.draggable({ x: frames[2].pos[0], y: frames[2].pos[1], color: frames[2].col, r: 7, onDrag: (h) => { frames[2].pos = [h.x, h.y]; sync(); } });
  const hand = s.draggable({ x: 0, y: 0, color: C.accent, r: 9, label: "hand", onDrag: (h) => { const l = toLocal(frames[active], h.x, h.y); local.ox = l[0]; local.oy = l[1]; } });
  function sync() { const hw = handWorld(); hand.x = hw[0]; hand.y = hw[1]; }
  sync();

  function drawFrame(f, on) {
    const fl = 1.15, a = on ? 1 : 0.32;
    const X = toWorld(f, fl, 0), Y = toWorld(f, 0, fl);
    const xc = on ? C.x : "rgba(255,77,61,0.34)", yc = on ? C.y : "rgba(61,220,132,0.34)";
    s.arrow(f.pos[0], f.pos[1], X[0], X[1], { color: xc, width: on ? 3 : 2 });
    s.arrow(f.pos[0], f.pos[1], Y[0], Y[1], { color: yc, width: on ? 3 : 2 });
    s.dot(f.pos[0], f.pos[1], { color: on ? f.col : "rgba(160,160,170," + a + ")", r: on ? 5 : 3 });
    s.text(f.pos[0], f.pos[1], f.name, { color: on ? f.col : C.dim, size: on ? 11 : 9, weight: on ? 700 : 400, dy: 20, dx: 6 });
  }

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    sync();

    // inactive frames first (dimmed), then active on top
    frames.forEach((f, i) => { if (i !== active) drawFrame(f, false); });
    const af = frames[active];
    drawFrame(af, true);

    // parent -> hand link showing the constant offset it rides on
    const hw = handWorld();
    s.line(af.pos[0], af.pos[1], hw[0], hw[1], { color: af.col, width: 1.5, dash: [5, 5] });

    // the hand's own little frame (so its inherited rotation is visible)
    const hr = handWorldRot(), hl = 0.8;
    s.arrow(hw[0], hw[1], hw[0] + hl * Math.cos(hr), hw[1] + hl * Math.sin(hr), { color: C.x, width: 2 });
    s.arrow(hw[0], hw[1], hw[0] - hl * Math.sin(hr), hw[1] + hl * Math.cos(hr), { color: C.y, width: 2 });

    panel.readout(
      `<span class="k">parented to ${af.name}</span> &nbsp; ` +
      `local offset = (<b>${local.ox.toFixed(2)}</b>, <b>${local.oy.toFixed(2)}</b>) &nbsp;·&nbsp; ` +
      `local angle = <b>${(local.rot * 180 / Math.PI).toFixed(0)}°</b> &nbsp;·&nbsp; ` +
      `world = (${hw[0].toFixed(2)}, ${hw[1].toFixed(2)})`
    );
  });

  panel.note("Pick WORLD / CHEST / ROOT to reparent the <b>hand</b> at runtime — Maya does this with a <b>parentMatrix</b> node whose <b>target</b> array holds each candidate space. Drag or rotate the <b>active</b> parent and the hand rides along on a constant offset (dashed line). Crucially, <b>switching space never pops the hand</b>: its offset is recomputed in the new parent from its current world pose, exactly as the node's offsetMatrix must be authored.");
  s.render();
});
