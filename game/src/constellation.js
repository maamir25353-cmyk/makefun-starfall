"use strict";
/* Starfall — constellation.js
   The signature mechanic: collect 3 star orbs to drop anchors, then
   return to the first anchor to detonate everything inside the triangle.
   Pure geometry functions are exported for Node testing via module.exports
   and attached to the global `Constellation` object for the browser. */
const _clamp = (typeof clamp !== "undefined") ? clamp : (v, a, b) => Math.max(a, Math.min(b, v));
const _W = (typeof W !== "undefined") ? W : 960;
const _H = (typeof H !== "undefined") ? H : 640;

const CLOSURE_RADIUS = 46;   /* forgiving return radius around anchor 1 */
const CLOSURE_TIME = 8;      /* seconds to return once the triangle is ready */
const MIN_EDGE = 70;         /* anchors closer than this are degenerate */
const MIN_AREA = 1200;       /* triangles smaller / straighter than this are degenerate */

function triangleArea(a, b, c) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}
function edgeLen(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function isDegenerate(a, b, c) {
  if (!a || !b || !c) return true;
  if (edgeLen(a, b) < MIN_EDGE || edgeLen(b, c) < MIN_EDGE || edgeLen(c, a) < MIN_EDGE) return true;
  /* area is half the cross product: a tiny area means near-collinear */
  return triangleArea(a, b, c) < MIN_AREA;
}
/* "close" = an edge is too short; "straight" = edges are long but near-collinear */
function degenerateReason(a, b, c) {
  if (edgeLen(a, b) < MIN_EDGE || edgeLen(b, c) < MIN_EDGE || edgeLen(c, a) < MIN_EDGE) return "close";
  return "straight";
}
function pointInTriangle(p, a, b, c) {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (a.x - c.x) * (p.y - a.y);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function createConstellation() { return { anchors: [], timer: 0 }; }
function clampAnchor(x, y) { return { x: _clamp(x, 30, _W - 30), y: _clamp(y, 30, _H - 30) }; }

/* Try to drop an anchor at (x, y). Returns { ok, count } or { ok:false, reason }.
   A rejected anchor never consumes constellation progress.
   closureTime overrides the default CLOSURE_TIME for THIS triangle only
   (Extended Closure upgrade); already-running triangles are untouched. */
function tryAddAnchor(c, x, y, closureTime) {
  /* The triangle is already complete: extra stars give score, never a 4th anchor. */
  if (c.anchors.length >= 3) return { ok: false, reason: "full" };
  const p = clampAnchor(x, y);
  if (c.anchors.length === 2) {
    const a = c.anchors[0], b = c.anchors[1];
    if (isDegenerate(a, b, p)) return { ok: false, reason: degenerateReason(a, b, p) };
  }
  c.anchors.push(p);
  if (c.anchors.length === 3) c.timer = closureTime || CLOSURE_TIME;
  return { ok: true, count: c.anchors.length };
}
function resetConstellation(c) { c.anchors.length = 0; c.timer = 0; }
/* Decrement the closure timer. Returns true only when it just expired
   (exactly once per triangle: the timer > 0 guard means a second call
   after expiry returns false even if the caller has not reset yet). */
function updateClosure(c, dt) {
  if (c.anchors.length === 3 && c.timer > 0) {
    c.timer -= dt;
    if (c.timer <= 0) { c.timer = 0; return true; }
  }
  return false;
}

const Constellation = {
  CLOSURE_RADIUS, CLOSURE_TIME, MIN_EDGE, MIN_AREA,
  triangleArea, isDegenerate, pointInTriangle, degenerateReason,
  createConstellation, tryAddAnchor, resetConstellation, updateClosure, clampAnchor
};
if (typeof module !== "undefined" && module.exports) module.exports = Constellation;
