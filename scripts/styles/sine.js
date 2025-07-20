// styles/sine.js – triple scrolling sine waves

const SEGMENTS   = 60;       // horizontal resolution
const AMP_FACTOR = 0.2;      // amplitude as fraction of beam width
const SPEEDS     = [0.25, 0.30, 0.35];   // per‑wave scroll speeds

function buildX(len) {
  const xs = [];
  for (let i = 0; i <= SEGMENTS; i++) xs.push((i / SEGMENTS) * len);
  return xs;
}

function draw(gfx, xs, phases, cfg) {
  const amp   = (cfg.width ?? 30) * AMP_FACTOR;
  const color = PIXI.utils.string2hex(cfg.colorHex ?? "#4ae3ff");
  const lw    = (cfg.width ?? 30) / 5;

  gfx.clear();
  gfx.lineStyle(lw, color);

  for (let w = 0; w < 3; w++) {
    const vOffset = (w - 1) * lw * 2;          // -2·lw, 0, +2·lw
    gfx.moveTo(0, vOffset);
    for (let i = 1; i < xs.length; i++) {
      const x = xs[i];
      const y = vOffset + Math.sin(phases[w] + x * 0.04) * amp;
      gfx.lineTo(x, y);
    }
  }
}

export const sineStyle = {
  id: "sine",

  create(seg, cfg) {
    const cont = new PIXI.Container();
    cont.blendMode = PIXI.BLEND_MODES.ADD;
    cont.zIndex    = 9_002;

    const gfx = new PIXI.Graphics();
    cont.addChild(gfx);

    // per‑segment state
    seg.xs     = buildX(seg.length);
    seg.phases = [0, 1, 2].map(() => Math.random() * Math.PI * 2); // 3 random phases

    draw(gfx, seg.xs, seg.phases, cfg);

    /* scrolling animation */
    seg.tick = (dt) => {
      seg.phases = seg.phases.map((p, idx) => p + dt * SPEEDS[idx]);
      draw(gfx, seg.xs, seg.phases, cfg);
    };

    seg.container = cont;
    this.update(seg, cfg, seg.length);
    return cont;
  },

  update(seg, cfg, len) {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    seg.container.position.set(seg.start.x, seg.start.y);
    seg.container.rotation = Math.atan2(dy, dx);

    if (seg.prevLen !== len) {
      seg.prevLen = len;
      seg.xs      = buildX(len);
    }
  },

  destroy(seg) { seg.tick = undefined; },
};
