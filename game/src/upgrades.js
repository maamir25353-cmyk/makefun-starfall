"use strict";
/* Starfall — upgrades.js
   The upgrade pool (6 upgrades), the random draw of 3 untaken options,
   applying an upgrade to a plain state object, and the shared card layout
   (upgradeCardRect) used by render.js for drawing and by main.js/input.js
   for hit-testing. Pure logic: no DOM, no canvas, no audio — requireable
   in Node for unit tests. */
const _UW = (typeof W !== "undefined") ? W : 960;
const _UH = (typeof H !== "undefined") ? H : 640;

/* The mutable upgrade state. main.js keeps one of these and resets it
   with freshUpgradeState() on every restart. */
function freshUpgradeState() {
  return {
    twin: false,          /* Twin Shot: two parallel bullets */
    fireCdBase: 0.16,     /* Rapid Fire: 0.16 -> 0.096 */
    magnetRadius: 90,     /* Star Magnet: 90 -> 180 */
    magnetSpeed: 90,      /* Star Magnet: 90 -> 160 */
    closureTime: 8,       /* Extended Closure: 8 -> 12 (per-triangle) */
    detBonus: 250,        /* Constellation Amplifier: 250 -> 400 */
    shieldTimer: 0        /* Emergency Shield: set to 12 on pick */
  };
}

const UPGRADE_POOL = [
  {
    id: "twin", name: "Twin Shot",
    desc: "Fire two parallel bullets.",
    effect: "Two bullets, offset ±8px.",
    apply(st) { st.twin = true; }
  },
  {
    id: "rapid", name: "Rapid Fire",
    desc: "Shoot 40% faster.",
    effect: "Fire cooldown 0.16s → 0.096s.",
    apply(st) { st.fireCdBase = 0.096; }
  },
  {
    id: "magnet", name: "Star Magnet",
    desc: "Stars drift toward you from farther away.",
    effect: "Magnet radius 90 → 180, pull 90 → 160.",
    apply(st) { st.magnetRadius = 180; st.magnetSpeed = 160; }
  },
  {
    id: "closure", name: "Extended Closure",
    desc: "12s to close a constellation instead of 8s.",
    effect: "New triangles get a 12s closure timer.",
    apply(st) { st.closureTime = 12; }
  },
  {
    id: "amp", name: "Constellation Amplifier",
    desc: "Detonations deal +150 bonus score.",
    effect: "Detonation base bonus 250 → 400.",
    apply(st) { st.detBonus = 400; }
  },
  {
    id: "shield", name: "Emergency Shield",
    desc: "Gain a shield that blocks hits for 12s.",
    effect: "Shield timer set to 12s on pick.",
    apply(st) { st.shieldTimer = 12; }
  }
];

/* Draw 3 distinct upgrades at random from those not yet taken.
   `taken` is a Set of ids (or any object with .has). With 6 in the pool
   and at most 2 picks per run, 3 distinct valid choices always exist. */
function drawUpgradeOptions(taken) {
  const avail = UPGRADE_POOL.filter(u => !taken || !taken.has(u.id));
  const arr = avail.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr.slice(0, 3);
}

function applyUpgrade(id, st) {
  const u = UPGRADE_POOL.find(x => x.id === id);
  if (!u) return false;
  u.apply(st);
  return true;
}

/* Shared card layout in game coordinates. Three 280x230 cards centred
   horizontally with 20px gaps, starting at y=190. */
function upgradeCardRect(i) {
  const w = 280, h = 230, gap = 20;
  const total = 3 * w + 2 * gap;
  const x = (_UW - total) / 2 + i * (w + gap);
  return { x, y: 190, w, h };
}

const Upgrades = {
  UPGRADE_POOL, freshUpgradeState, drawUpgradeOptions, applyUpgrade, upgradeCardRect
};
if (typeof module !== "undefined" && module.exports) module.exports = Upgrades;
