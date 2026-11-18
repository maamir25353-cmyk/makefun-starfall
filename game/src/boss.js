"use strict";
/* Starfall — boss.js
   The Sector 3 boss: a fractured celestial machine. State and logic live
   here; drawing lives here too (drawBoss) and render.js calls it.
   The boss never touches the DOM or audio directly: attacks spawn enemy
   bullets / rocks through the `env` callbacks main.js passes in, and
   phase/death announcements go through `hooks`. Pure enough to unit-test
   in Node (W/H fall back to 960/640 when the audio module is absent). */
const _BW = (typeof W !== "undefined") ? W : 960;
const _BH = (typeof H !== "undefined") ? H : 640;
const _BTAU = (typeof TAU !== "undefined") ? TAU : Math.PI * 2;

const BOSS_MAX_HP = 45;
const BOSS_PHASE2_HP = 22;
const BOSS_SEG_GAP = 1.8;   /* radians of open gap in the protective ring */
const BOSS_RING_R = 48;      /* radius of the protective segment ring */
const BOSS_CORE_R = 26;

function createBoss() {
  return {
    x: _BW / 2, y: -90, r: BOSS_CORE_R,
    hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, phase: 1,
    segAngle: 0,
    state: "enter",          /* enter | fight | stagger | dying */
    stateT: 0,               /* enter progress / stagger / dying countdown */
    driftT: 0,
    fireT: 2.2,              /* countdown to next aimed-burst telegraph */
    attack: "idle",          /* idle | telegraph | burst */
    attackT: 0, shotsLeft: 0, shotT: 0,
    rockT: 6,                /* occasional rock spawn */
    radialT: 6,              /* P2 radial-burst timer */
    radialWindup: false, windupT: 0,
    charging: false,         /* telegraph glow (aimed burst or radial) */
    flashT: 0
  };
}

function _norm(a) {
  a = a % _BTAU;
  return a < 0 ? a + _BTAU : a;
}

/* True when the point (px,py) hits a protective segment: inside the ring
   band and outside the single rotating gap. The gap rotates with segAngle,
   so there is always an opening to shoot through. */
function segmentBlocks(boss, px, py) {
  const dx = px - boss.x, dy = py - boss.y;
  const d = Math.hypot(dx, dy);
  if (d < 34 || d > 62) return false;
  const rel = _norm(Math.atan2(dy, dx) - boss.segAngle);
  return rel >= BOSS_SEG_GAP;
}

function staggerBoss(boss, dur) {
  if (!boss || boss.state === "dying") return;
  boss.state = "stagger";
  boss.stateT = dur || 1.5;
  boss.charging = false;
  boss.radialWindup = false;
  boss.attack = "idle";
}

/* Deal damage to the core. Returns { died, phaseChanged }.
   hp <= 45 starts Phase 2 (brief stagger + hook); hp <= 0 starts dying. */
function damageBoss(boss, dmg, hooks) {
  if (!boss || boss.state === "dying") return { died: false, phaseChanged: false };
  boss.hp -= dmg;
  boss.flashT = 0.15;
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.state = "dying";
    boss.stateT = 2;
    boss.charging = false;
    boss.radialWindup = false;
    boss.attack = "idle";
    if (hooks && hooks.onDeath) hooks.onDeath(boss);
    return { died: true, phaseChanged: false };
  }
  if (boss.phase === 1 && boss.hp <= BOSS_PHASE2_HP) {
    boss.phase = 2;
    staggerBoss(boss, 1.5);
    if (hooks && hooks.onPhase2) hooks.onPhase2(boss);
    return { died: false, phaseChanged: true };
  }
  return { died: false, phaseChanged: false };
}

/* Advance the boss one frame. env: { shipX, shipY,
   spawnEBullet(x, y, angle, speed), spawnRock(x, y, size, vyBonus) }. */
function updateBoss(boss, dt, env) {
  if (!boss) return;
  if (boss.flashT > 0) boss.flashT -= dt;
  if (boss.state === "dying") { boss.stateT -= dt; return; }
  if (boss.state === "stagger") {
    boss.stateT -= dt;
    if (boss.stateT <= 0) boss.state = "fight";
    return; /* frozen: no movement, no rotation, no attacks */
  }
  if (boss.state === "enter") {
    boss.stateT += dt;
    const p = Math.min(1, boss.stateT / 2);
    boss.y = -90 + (130 + 90) * p;
    boss.x = _BW / 2;
    boss.segAngle += 0.4 * dt;
    if (p >= 1) { boss.state = "fight"; boss.y = 130; }
    return;
  }
  /* fight */
  boss.driftT += dt;
  const rotSpeed = boss.phase === 2 ? 0.75 : 0.45;
  boss.segAngle += rotSpeed * dt;
  boss.x = _BW / 2 + Math.sin(boss.driftT * 0.45) * 230;
  boss.y = 130 + Math.sin(boss.driftT * 0.3) * 28;

  boss.rockT -= dt;
  if (boss.rockT <= 0) {
    if (env && env.spawnRock) env.spawnRock((Math.random() * (_BW - 120)) + 60, -50, "big", 0);
    boss.rockT = boss.phase === 2 ? 5 : 7;
  }

  if (boss.radialWindup) {
    boss.windupT -= dt;
    if (boss.windupT <= 0) {
      boss.radialWindup = false;
      boss.charging = false;
      if (env && env.spawnEBullet) {
        for (let i = 0; i < 8; i++) env.spawnEBullet(boss.x, boss.y, (i / 8) * _BTAU, 180);
      }
      boss.radialT = 6.5;
    }
    return; /* winding up: no aimed shots meanwhile */
  }
  if (boss.phase === 2) {
    boss.radialT -= dt;
    if (boss.radialT <= 0) {
      boss.radialWindup = true;
      boss.windupT = 0.7;
      boss.charging = true;
      return;
    }
  }

  if (boss.attack === "telegraph") {
    boss.attackT -= dt;
    if (boss.attackT <= 0) {
      boss.attack = "burst";
      boss.shotsLeft = boss.phase === 2 ? 3 : 2;
      boss.shotT = 0;
    }
  } else if (boss.attack === "burst") {
    boss.shotT -= dt;
    if (boss.shotT <= 0 && boss.shotsLeft > 0) {
      if (env && env.spawnEBullet) {
        const a = Math.atan2(env.shipY - boss.y, env.shipX - boss.x);
        env.spawnEBullet(boss.x, boss.y + 10, a, 180);
      }
      boss.shotsLeft--;
      boss.shotT = 0.18;
    }
    if (boss.shotsLeft <= 0) {
      boss.attack = "idle";
      boss.charging = false;
      boss.fireT = boss.phase === 2 ? 1.6 : 2.4;
    }
  } else {
    boss.fireT -= dt;
    if (boss.fireT <= 0) {
      boss.attack = "telegraph";
      boss.attackT = 0.5;
      boss.charging = true;
    }
  }
}

/* Draw the boss: pulsing core, 5 rotating protective arc segments with
   one open gap, telegraph glow / aim line, radial wind-up ring. */
function drawBoss(ctx, boss, ship) {
  if (!boss) return;
  const t = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  /* radial wind-up ring (P2): brighter, thicker, plus an expanding
     inner ring so the burst telegraph is unmistakable */
  if (boss.radialWindup) {
    const p = 1 - Math.max(0, boss.windupT) / 0.7;
    ctx.strokeStyle = "rgba(255,45,120," + (0.5 + 0.5 * p) + ")";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 60 + p * 40, 0, _BTAU); ctx.stroke();
    ctx.strokeStyle = "rgba(255,225,77," + (0.3 + 0.5 * p) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 30 + p * 55, 0, _BTAU); ctx.stroke();
  }
  /* protective segments: 5 arcs covering the ring except the gap */
  const blocked = _BTAU - BOSS_SEG_GAP;
  const segLen = blocked / 5;
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const a0 = boss.segAngle + BOSS_SEG_GAP + i * segLen + 0.05;
    const a1 = boss.segAngle + BOSS_SEG_GAP + (i + 1) * segLen - 0.05;
    ctx.strokeStyle = boss.phase === 2 ? "#ff5d3a" : "#b06cff";
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0, 0, BOSS_RING_R, a0, a1); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  /* gap marker: two small chevrons at the gap edges */
  ctx.fillStyle = "#ffe14d";
  for (const e of [boss.segAngle, boss.segAngle + BOSS_SEG_GAP]) {
    ctx.beginPath();
    ctx.arc(Math.cos(e) * BOSS_RING_R, Math.sin(e) * BOSS_RING_R, 3, 0, _BTAU);
    ctx.fill();
  }
  /* telegraph: aim line toward the ship while charging an aimed burst */
  if (boss.charging && !boss.radialWindup && ship) {
    ctx.save();
    ctx.rotate(Math.atan2(ship.y - boss.y, ship.x - boss.x));
    ctx.strokeStyle = "rgba(255,45,120,.55)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(420, 0); ctx.stroke();
    ctx.restore();
  }
  /* core */
  const pulse = 1 + Math.sin(t * 5) * 0.08;
  const coreR = BOSS_CORE_R * pulse;
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, coreR + 10);
  const coreColor = boss.state === "stagger" ? "#ffffff"
    : boss.flashT > 0 ? "#ffffff"
    : boss.phase === 2 ? "#ff5d3a" : "#ff2d78";
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, coreColor);
  grad.addColorStop(1, "rgba(255,45,120,0)");
  ctx.fillStyle = grad;
  ctx.shadowColor = coreColor; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(0, 0, coreR + 10, 0, _BTAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = boss.state === "stagger" ? "#ffe14d" : "#1a0533";
  ctx.beginPath(); ctx.arc(0, 0, coreR * 0.55, 0, _BTAU); ctx.fill();
  /* fractured plates on the core */
  ctx.strokeStyle = "rgba(234,246,255,.7)"; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = t * 0.6 + (i * _BTAU) / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * coreR * 0.4, Math.sin(a) * coreR * 0.4);
    ctx.lineTo(Math.cos(a + 0.7) * coreR * 0.85, Math.sin(a + 0.7) * coreR * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

const Boss = {
  BOSS_MAX_HP, BOSS_PHASE2_HP, BOSS_SEG_GAP, BOSS_RING_R, BOSS_CORE_R,
  createBoss, segmentBlocks, staggerBoss, damageBoss, updateBoss, drawBoss
};
if (typeof module !== "undefined" && module.exports) module.exports = Boss;
