/*
import {
  gsap
} from "/scripts/greensock/esm/all.js";
*/
import {MOD_NAME} from "./beams-const.js";

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







// Simple version helpers
function isV13Plus() {
  // Foundry v12+ exposes game.release.generation
  return (game.release?.generation ?? 0) >= 13;
}

// Ensure Sequencer is loaded
function assertSequencer() {
  const active = game.modules.get("sequencer")?.active;
  if (!active) {
    ui.notifications?.error("[My Sequencer Toggle] Sequencer module is not active.");
    throw new Error("Sequencer not active");
  }
}

// A stable effect name per-token so we can query/stop it later
function effectNameForToken(token) {
  return `${MOD_NAME}-toggle-${token.document?.id ?? token.id}`;
}

// Is our effect already running on this token?
export function isEffectActive(token) {
  try {
    assertSequencer();
    const name = effectNameForToken(token);
    const effects = Sequencer.EffectManager.getEffects({ name, object: token?.object ?? token });
    return (effects?.length ?? 0) > 0;
  } catch {
    return false;
  }
}


/**
 * Start effect(s).
 * - If no segments provided => single attached effect (old behavior).
 * - If segments provided => one effect per segment in a single Sequence.
 *
 * @param {Token|TokenDocument|PlaceableObject} token
 * @param {Array<{start:{x:number,y:number}, end:{x:number,y:number}}>} [segments]
 */
export async function startEffect(token, segments = [], color = 0xffffff) {
  console.log(`[${MOD_NAME}] Starting effect for token`, token, segments);
  assertSequencer();

  const FILE = "modules/foundry-beams/beam.webm"; // <- your asset
  const base = effectNameForToken(token);
console.log(`[${MOD_NAME}] Effect base name: ${base}`);
  // No segments? default to a single attached effect.
  if (!Array.isArray(segments) || segments.length === 0) {
    await new Sequence()
      .effect()
        .name(base)
        .file(FILE)
        .attachTo(token?.object ?? token)
        .persist()
        .belowTokens(false)
        .fadeIn(200)
        .fadeOut(200)
      .play();
    return;
  }

  // Build one Sequence with 1 effect per segment
  const seq = new Sequence();
  segments.forEach((seg, i) => {
    const name = `${base}-${i}`;
    const start = seg?.start ?? {};
    const end   = seg?.end ?? {};
    const startPt = { x: start.x, y: start.y };
    const endPt   = { x: end.x,   y: end.y   };

    // If your asset supports stretching (e.g., beams), .stretchTo will scale/rotate it.
    seq.effect()
      .name(name)
      .file(FILE)
      .atLocation(startPt)     // start
      .stretchTo(endPt, { onlyX: true})        // end (Sequencer will rotate/scale to fit)
      .tint(color)
      .scale({x:1.0,y:0.2})
      .filter("Glow", {
    distance: 15,      // Number, distance of the glow in pixels
    outerStrength: 3,  // Number, strength of the glow outward from the edge of the sprite
    innerStrength: 0,  // Number, strength of the glow inward from the edge of the sprite
    color: color,   // Hexadecimal, color of the glow
    quality: 0.07,      // Number, describes the quality of the glow (0 to 1) - the higher the number the less performant
    knockout: false    // Boolean, toggle to hide the contents and only show glow (effectively hides the sprite)
})
      .persist()
      .belowTokens(false)
  });
console.log(`[${MOD_NAME}] Playing sequence with ${segments.length} segments`);

  await seq.play();
}

/**
 * Stop effect(s). If segments are provided, it tries to stop the indexed names.
 * If not, it stops any effect whose name starts with the base.
 *
 * @param {Token|TokenDocument|PlaceableObject} token
 * @param {Array} [segments]
 */
export async function stopEffect(token) {
  assertSequencer();
  console.log(`[${MOD_NAME}] Stopping effect for token`, token);
  const base = effectNameForToken(token);

  // If we know how many we spawned, end by exact names
  //if (Array.isArray(segments) && segments.length > 0) {
   // const tasks = segments.map((_, i) => {
      const name = `${base}-*`;
      console.log(`[${MOD_NAME}] Ending effects with name: ${name}`);
      return await Sequencer.EffectManager.endEffects({ name });
   // });
   // await Promise.all(tasks);
 //   return;
 // }

  // Otherwise, end everything with our base prefix
//  const effects = Sequencer.EffectManager.getEffects({ object: token?.object ?? token }) || [];
 // const mine = effects.filter(e => e?.data?.name?.startsWith(base));
 // await Promise.all(mine.map(e => e.end()));
}