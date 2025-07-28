/*
import {
  gsap
} from "/scripts/greensock/esm/all.js";
*/
export function getTokensAlongSegment(start, end, sourceToken, options = {}) {
  const { tolerance = 1, onlyVisible = false } = options;

  const tokens = game.scenes.active.tokens;
  const results = [];

  for (const token of tokens) {
    if (token.id === sourceToken.id) continue;
    if (onlyVisible && !token.object.visible) continue;

    const bounds = token.object.bounds; // PIXI.Rectangle

    // Slightly expand bounds to avoid precision misses
    const expanded = bounds.clone();
    expanded.pad(tolerance);

    if (lineIntersectsRect(start, end, expanded)) {
      results.push(token);
    }
  }

  return results;
}

// Helper: Check if a line intersects a rectangle
function lineIntersectsRect(p1, p2, rect) {
  const { x, y, width, height } = rect;

  const corners = [
    { x: x, y: y },
    { x: x + width, y: y },
    { x: x + width, y: y + height },
    { x: x, y: y + height }
  ];

  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]]
  ];

  for (const [a, b] of edges) {
    if (segmentsIntersect(p1, p2, a, b)) return true;
  }

  return rect.contains(p1.x, p1.y) || rect.contains(p2.x, p2.y);
}

// Helper: Check if two segments intersect
function segmentsIntersect(p1, p2, q1, q2) {
  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);

  if (o1 !== o2 && o3 !== o4) return true;

  return false;
}

// Helper: Orientation of three points
function orientation(a, b, c) {
  const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}





/** Ensure a global registry for active bolts */
if (!globalThis.__lightningBolts) globalThis.__lightningBolts = new Map();

/**
 * Convert assorted point inputs to {x, y}.
 */
function toPoint(p) {
  if (!p) throw new Error('Invalid point');
  if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  if (p.center) return { x: p.center.x, y: p.center.y };
  if (Array.isArray(p) && p.length >= 2) return { x: p[0], y: p[1] };
  throw new Error('Unsupported point type supplied to createLightning');
}

/**
 * @typedef {object} LightningOptions
 * @prop {*}        start              – Token, {x,y}, PIXI.Point, or [x,y]
 * @prop {*}        end                – Same types as start
 * @prop {number} [color=0xffffff]     – Hex color
 * @prop {number} [thickness=2]
 * @prop {number} [segments=20]
 * @prop {number} [amplitude=20]
 * @prop {number} [flicker=3]
 * @prop {number} [flashDuration=0.08]
 * @prop {boolean}[persist=false]      – Skip auto‑cleanup
 * @prop {boolean}[animate=true]       – Whether to animate flashes at all
 * @prop {boolean}[loop=false]         – Repeat flashes forever (needs animate=true)
 * @prop {string} [id]                 – Supply custom identifier
 * @prop {PIXI.Container}[layer=canvas.effects]
 */

/**
 * Create a lightning bolt on Foundry's canvas.
 * Returns a handle:
 *   {
 *     id: string,
 *     graphics: PIXI.Graphics,
 *     destroy(): void
 *   }
 */
export function createLightning(opts) {
  if (!gsap) throw new Error('GSAP library not found – include gsap.min.js before calling createLightning');

  const {
    start,
    end,
    color = 0xffffff,
    thickness = 2,
    segments = 20,
    amplitude = 20,
    flicker = 3,
    flashDuration = 0.08,
    persist = false,
    animate = true,
    loop = false,
    id = foundry.utils.randomID(),
    layer = canvas.effects,
  } = opts;

  if (__lightningBolts.has(id)) {
    console.warn(`Lightning with id "${id}" already exists – overwriting`);
    const old = __lightningBolts.get(id);
    old.destroy?.();
  }

  const p0 = toPoint(start);
  const p1 = toPoint(end);

  const g = new PIXI.Graphics();
  g.blendMode = PIXI.BLEND_MODES.ADD;
  layer.addChild(g);

  function drawBolt() {
    g.clear();
    g.lineStyle(thickness, color, 1, 0.5, true);

    let prevX = p0.x;
    let prevY = p0.y;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      let x = p0.x + dx * t;
      let y = p0.y + dy * t;
      const taper = 1 - Math.abs(0.5 - t) * 2;
      const offset = (Math.random() * 2 - 1) * amplitude * taper;
      x += perpX * offset;
      y += perpY * offset;
      g.moveTo(prevX, prevY);
      g.lineTo(x, y);
      prevX = x;
      prevY = y;
    }
  }

  function buildTimeline() {
    const tl = gsap.timeline({
      repeat: loop ? -1 : 0,
      onComplete: () => {
        if (persist || loop) return; // keep alive if desired
        destroy();
      },
    });

    const cycles = loop ? 1 : flicker;
    for (let i = 0; i < cycles; i++) {
      tl.call(drawBolt)
        .set(g, { alpha: 1 })
        .to(g, { alpha: 0, duration: flashDuration })
        .set(g, { alpha: 0 });
    }
    return tl;
  }

  function destroy() {
    gsap.killTweensOf(g);
    if (g.parent) g.parent.removeChild(g);
    g.destroy();
    __lightningBolts.delete(id);
  }

  if (animate) {
    g.alpha = 0;
    buildTimeline();
  } else {
    drawBolt();
    g.alpha = 1;
  }

  const handle = { id, graphics: g, destroy };
  __lightningBolts.set(id, handle);
  return handle;
}

/**
 * Delete a bolt previously created with createLightning.
 * @param {string} id – The identifier returned by createLightning.
 * @returns {boolean} True if a bolt was found and destroyed.
 */
export function deleteLightning(id) {
  const bolt = __lightningBolts.get(id);
  if (!bolt) return false;
  bolt.destroy();
  return true;
}
