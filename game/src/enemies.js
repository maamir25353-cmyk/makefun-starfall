"use strict";
/* Starfall — enemies.js
   Asteroids (splitting rocks, sizes/colours/scores from the baseline)
   and star orbs. Owns the rocks/orbs arrays and their movement;
   collisions, scoring and splitting consequences live in main.js. */
const rocks = [], orbs = [], chargers = [], shooters = [], eBullets = [];

/* Enemy bullets: magenta/red diamonds, ~180 speed, dodgeable. Not
   shootable by the player. Cap ~40. */
function spawnEBullet(x, y, angle, speed) {
  if (eBullets.length >= 40) return null;
  const s = speed || 180;
  const b = { x, y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, r: 5, life: 4 };
  eBullets.push(b);
  return b;
}
/* Chargers: enter drifting down (~1s), telegraph (~0.9s, dashed aim line,
   aim locks in the last 0.2s), charge (~520 straight, ~0.7s), recover
   (~1s slow drift), then telegraph again. hp 2, score 150. */
function spawnCharger(x, y) {
  const c = {
    x, y, r: 16, vx: 0, vy: 55, hp: 2,
    phase: "enter", phaseT: 0, lockX: x, lockY: y, rot: Math.PI / 2
  };
  chargers.push(c);
  return c;
}
/* Orbiting shooters: enter from the top, settle into a slow circular
   orbit around a fixed centre in the upper half, fire an aimed shot
   every ~3.0s after a 0.4s charge-up flash. Their bullets travel at
   150 px/s (slower than the boss's 180) so they are dodgeable. hp 2, score 150. */
function spawnShooter(x, y) {
  const s = {
    x, y, r: 15, hp: 2,
    cx: rand(180, W - 180), cy: rand(90, 230),
    orbitR: rand(70, 110), orbitA: rand(0, TAU),
    orbitSpeed: rand(0.4, 0.7) * (Math.random() < 0.5 ? -1 : 1),
    fireT: rand(2, 3), charging: false, entering: true
  };
  shooters.push(s);
  return s;
}
function chargerScore() { return 150; }
function shooterScore() { return 150; }

function spawnRock(x, y, size, vyBonus) {
  const r = size === "big" ? rand(34, 48) : size === "med" ? rand(22, 30) : rand(11, 16);
  const verts = [];
  const n = 9 + Math.floor(rand(0, 3));
  for (let i = 0; i < n; i++) verts.push(rand(0.75, 1.15));
  rocks.push({
    x, y, r, size, verts, rot: rand(0, TAU), vr: rand(-1.2, 1.2),
    vx: rand(-30, 30), vy: rand(40, 90) + (vyBonus || 0),
    hp: size === "big" ? 3 : size === "med" ? 2 : 1
  });
}
/* life defaults to 12s; tutorial orbs pass a long life so the player
   always has time to fly to them. */
function spawnOrb(x, y, life) {
  const o = { x, y, r: 11, vx: rand(-25, 25), vy: rand(25, 55), t: 0, life: life || 12, tutorial: false };
  orbs.push(o);
  return o;
}
function rockScore(size) { return size === "big" ? 100 : size === "med" ? 60 : 30; }
function childSizes(size) { return size === "big" ? ["med", "med"] : size === "med" ? ["small", "small"] : []; }

function updateEnemies(dt) {
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
    if (r.y > H + 70) rocks.splice(i, 1);
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.t += dt; o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt;
    o.x += Math.sin(o.t * 4) * 18 * dt;
    if (o.life <= 0 || o.y > H + 20) orbs.splice(i, 1);
  }
}

function updateChargers(dt, ship) {
  for (let i = chargers.length - 1; i >= 0; i--) {
    const c = chargers[i];
    c.phaseT += dt;
    if (c.phase === "enter") {
      c.y += c.vy * dt;
      if (c.phaseT >= 1) { c.phase = "telegraph"; c.phaseT = 0; }
    } else if (c.phase === "telegraph") {
      /* track the ship, but freeze the aim point for the last 0.2s */
      if (c.phaseT < 0.7) { c.lockX = ship.x; c.lockY = ship.y; }
      c.rot = Math.atan2(c.lockY - c.y, c.lockX - c.x);
      if (c.phaseT >= 0.9) {
        const a = Math.atan2(c.lockY - c.y, c.lockX - c.x);
        c.vx = Math.cos(a) * 520; c.vy = Math.sin(a) * 520;
        c.rot = a;
        c.phase = "charge"; c.phaseT = 0;
      }
    } else if (c.phase === "charge") {
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.phaseT >= 0.7) { c.phase = "recover"; c.phaseT = 0; c.vx = 0; c.vy = 30; }
    } else { /* recover: slow drift, then telegraph again */
      c.y += c.vy * dt;
      if (c.phaseT >= 1) { c.phase = "telegraph"; c.phaseT = 0; }
    }
    if (c.y > H + 80 || c.x < -80 || c.x > W + 80) chargers.splice(i, 1);
  }
}

function updateShooters(dt, ship) {
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i];
    if (s.entering) {
      const tx = s.cx + Math.cos(s.orbitA) * s.orbitR;
      const ty = s.cy + Math.sin(s.orbitA) * s.orbitR * 0.6;
      s.x += (tx - s.x) * Math.min(1, dt * 1.6);
      s.y += (ty - s.y) * Math.min(1, dt * 1.6);
      if (dist2(s.x, s.y, tx, ty) < 12 * 12) s.entering = false;
    } else {
      s.orbitA += s.orbitSpeed * dt;
      s.x = s.cx + Math.cos(s.orbitA) * s.orbitR;
      s.y = s.cy + Math.sin(s.orbitA) * s.orbitR * 0.6;
    }
    s.fireT -= dt;
    s.charging = s.fireT <= 0.4 && s.fireT > 0;
    if (s.fireT <= 0) {
      const a = Math.atan2(ship.y - s.y, ship.x - s.x);
      spawnEBullet(s.x, s.y, a, 150);
      s.fireT = 3.0;
      s.charging = false;
    }
  }
}

function updateEBullets(dt) {
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) eBullets.splice(i, 1);
  }
}
