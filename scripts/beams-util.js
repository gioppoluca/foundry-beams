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
