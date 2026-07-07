# Interactive concept visualizations

Optional. Any concept page (`wiki/concepts/<slug>.md`) can get a bespoke,
interactive canvas widget by dropping a `widgets/<slug>.js` file here. The build
(`node build-site.mjs`) matches it by filename and injects an **INTERACTIVE**
panel just under the page's metadata row. No widget file → no panel; the page
still builds.

## Files

- `_viz.js` — the shared visualization library (loaded once per concept page that
  has a widget). Exposes the global `VIZ`: a dark, DPR-aware canvas scene with a
  world-coordinate system (y-up), draggable handles (mouse + touch), sliders,
  toggles, segmented buttons, a live readout line, a caption note, an animation
  loop, and drawing primitives (grid, axes, line, arrow, dot, poly, text, ring,
  arc, filled triangle) plus 2D vector helpers (`VIZ.v.add/sub/mul/len/norm/dot/
  rot/lerp`) and `VIZ.clamp`. **Do not edit per-widget** — it is shared. The file
  header documents the full Panel/Scene API.
- `_test.html` — standalone preview harness. Open `widgets/_test.html?slug=<slug>`
  in a browser to iterate on one widget without rebuilding the whole site.
- `<slug>.js` — one self-contained widget per concept (you add these).

## Widget skeleton

```js
/* <slug> — one line on what this visual teaches. */
VIZ.build("<slug>", function (panel) {
  const C = VIZ.C;
  const s = panel.scene({ world: [xMin, xMax, yMin, yMax], aspect: 1.5 });

  // controls
  panel.slider({ label: "param", min: 0, max: 1, value: 0.5, dp: 2,
                 onInput: (v) => { /* store v */ s.render(); } });
  const T = s.draggable({ x: 2, y: 1, color: C.accent, label: "target" });

  s.onDraw(function () {
    s.grid(1, C.grid);
    s.axes({});
    // ...draw using T.x, T.y and the control values...
    panel.readout(`<span class="k">label</span> value <b>${/* ... */}</b>`);
  });

  panel.note("One or two sentences tying the interaction back to the concept.");
  s.render();
});
```

Always call `panel.readout(...)` **inside** `s.onDraw(...)` so it updates live as
handles/sliders move. Keep each widget dependency-free — it may use only the
global `VIZ`.
