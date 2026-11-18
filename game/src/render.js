"use strict";
/* Starfall — render.js
   All canvas drawing: background, ship, rocks, orbs, bullets, particles,
   constellation anchors / lines / triangle, HUD, tutorial prompts and the
   title / pause / game-over panels. drawGame(G) reads one state object
   built by main.js; it never mutates game state. */

function drawGame(G) {
  const ctx = G.ctx;
  /* Reduced effects (G key): shake/flash cut to near zero here, at the
     single point where they reach the screen. */
  const effShake = G.reducedFx ? G.shake * 0.08 : G.shake;
  const effFlash = G.reducedFx ? G.flash * 0.1 : G.flash;
  ctx.save();
  if (effShake > 0) ctx.translate(rand(-effShake, effShake), rand(-effShake, effShake));
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0a0a2e"); g.addColorStop(0.55, "#0d1038"); g.addColorStop(1, "#050514");
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
  const neb = ctx.createRadialGradient(W * 0.78, H * 0.2, 10, W * 0.78, H * 0.2, 320);
  neb.addColorStop(0, "rgba(255,0,153,.14)"); neb.addColorStop(1, "rgba(255,0,153,0)");
  ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
  const neb2 = ctx.createRadialGradient(W * 0.15, H * 0.75, 10, W * 0.15, H * 0.75, 300);
  neb2.addColorStop(0, "rgba(0,229,255,.10)"); neb2.addColorStop(1, "rgba(0,229,255,0)");
  ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);
  for (const s of G.stars) {
    ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(s.tw));
    ctx.fillStyle = "#cfe9ff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.s * s.z, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawConstellation(ctx, G);
  for (const o of G.orbs) drawOrb(ctx, o);
  for (const r of G.rocks) drawRock(ctx, r);
  for (const c of (G.chargers || [])) drawCharger(ctx, c);
  for (const s of (G.shooters || [])) drawShooter(ctx, s);
  for (const b of (G.eBullets || [])) drawEBullet(ctx, b);
  if (G.boss) drawBoss(ctx, G.boss, G.ship);
  for (const b of G.bullets) {
    ctx.strokeStyle = "#aef7ff"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (G.state !== "over") drawShip(ctx, G);
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = "bold " + f.size + "px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(5,8,32,.9)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  if (G.detPulse) {
    const pr = G.detPulse.t / G.detPulse.max;
    ctx.strokeStyle = "rgba(255,225,77," + (1 - pr) + ")";
    ctx.lineWidth = 4 * (1 - pr) + 1;
    ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(G.detPulse.x, G.detPulse.y, 30 + pr * 320, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (effFlash > 0) { ctx.fillStyle = "rgba(255,60,90," + (effFlash * 0.25) + ")"; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.restore();
  drawHUD(ctx, G);
  if (G.boss) drawBossBar(ctx, G);
  /* Single announcement banner slot: fixed position below the reserved
     tutorial band (110–165), drawn only during active play. Text-only,
     so it stays fully legible at normal and reduced-effects settings. */
  if (G.state === "playing") drawBanner(ctx, G);
  if (G.state === "title") drawTitle(ctx, G);
  if (G.state === "paused") drawPaused(ctx, G);
  if (G.state === "over") drawOver(ctx, G);
  if (G.state === "victory") drawVictory(ctx, G);
  if (G.state === "upgrade") drawUpgrade(ctx, G);
  if (G.state === "playing" && G.tutorialActive) drawTutorialPrompt(ctx, G);
}

/* The single announcement banner (v1.1): one large message at a time,
   pill at y 196–236, below the tutorial band, above the playfield. */
function drawBanner(ctx, G) {
  const b = G.banner;
  if (!b) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 22px 'Segoe UI', sans-serif";
  const w = Math.min(760, ctx.measureText(b.text).width + 56);
  const x = (W - w) / 2, y = 196, h = 40;
  ctx.fillStyle = "rgba(5,8,32,.78)";
  ctx.strokeStyle = "rgba(0,229,255,.55)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = b.color || "#ffe14d";
  ctx.shadowColor = b.color || "#ffe14d"; ctx.shadowBlur = 10;
  ctx.fillText(b.text, W / 2, y + 28);
  ctx.restore();
}
function drawConstellation(ctx, G) {
  const c = G.constellation, n = c.anchors.length;
  if (!n) return;
  const t = performance.now() / 1000;
  ctx.save();
  if (n >= 2) {
    ctx.strokeStyle = "rgba(0,229,255,.9)"; ctx.lineWidth = 2.5;
    ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(c.anchors[0].x, c.anchors[0].y);
    ctx.lineTo(c.anchors[1].x, c.anchors[1].y);
    if (n === 3) { ctx.lineTo(c.anchors[2].x, c.anchors[2].y); ctx.closePath(); }
    ctx.stroke();
    if (n === 3) { ctx.fillStyle = "rgba(0,229,255,.08)"; ctx.fill(); }
    ctx.shadowBlur = 0;
  }
  c.anchors.forEach((a, i) => {
    const isFirst = i === 0 && n === 3;
    const pulse = isFirst ? 1 + Math.sin(t * 6) * 0.25 : 1;
    ctx.shadowColor = isFirst ? "#ffe14d" : "#00e5ff"; ctx.shadowBlur = 18;
    ctx.strokeStyle = isFirst ? "#ffe14d" : "#00e5ff"; ctx.lineWidth = isFirst ? 3 : 2;
    ctx.beginPath(); ctx.arc(a.x, a.y, 14 * pulse, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(5,8,32,.9)"; ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#eaf6ff"; ctx.font = "bold 11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), a.x, a.y + 0.5);
    if (isFirst) {
      ctx.fillStyle = "#ffe14d"; ctx.font = "bold 13px 'Segoe UI', sans-serif";
      ctx.fillText("RETURN", a.x, a.y - 28);
    }
    ctx.textBaseline = "alphabetic";
  });
  ctx.restore();
}

function drawShip(ctx, G) {
  const ship = G.ship;
  if (ship.invuln > 0 && Math.floor(performance.now() / 120) % 2 === 0) return; /* blink while invulnerable */
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle + Math.PI / 2);
  if (G.shieldTimer > 0) {
    ctx.strokeStyle = "rgba(0,229,255,.8)"; ctx.lineWidth = 2;
    ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (ship.thrust > 0) {
    ctx.fillStyle = "#ff9f1c";
    ctx.shadowColor = "#ff9f1c"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 12 + 14 + Math.random() * 10); ctx.lineTo(6, 12); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }
  const grad = ctx.createLinearGradient(0, -18, 0, 14);
  grad.addColorStop(0, "#aef7ff"); grad.addColorStop(0.5, "#00e5ff"); grad.addColorStop(1, "#0077ff");
  ctx.fillStyle = grad; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(5, 8); ctx.lineTo(0, 12); ctx.lineTo(-5, 8); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff2d78"; ctx.beginPath(); ctx.arc(0, -4, 3.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawRock(ctx, r) {
  ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
  ctx.fillStyle = "#2a2140"; ctx.strokeStyle = r.size === "big" ? "#ff5d8f" : "#ff9f43"; ctx.lineWidth = 2;
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < r.verts.length; i++) {
    const a = (i / r.verts.length) * TAU, rr = r.r * r.verts[i];
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,.14)";
  ctx.beginPath(); ctx.arc(-r.r * 0.3, -r.r * 0.25, r.r * 0.22, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawOrb(ctx, o) {
  const pulse = 1 + Math.sin(o.t * 6) * 0.15;
  ctx.save(); ctx.translate(o.x, o.y);
  ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 18; ctx.fillStyle = "#ffe14d";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const x = Math.cos(a) * 11 * pulse, y = Math.sin(a) * 11 * pulse;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff7c0"; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCharger(ctx, c) {
  ctx.save();
  if (c.phase === "telegraph") {
    /* dashed aim line toward the locked point + flashing + lock marker */
    ctx.strokeStyle = "rgba(255,180,40,.9)";
    ctx.setLineDash([10, 7]); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.lockX, c.lockY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,159,28,.9)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.lockX, c.lockY, 12 + Math.sin(performance.now() / 90) * 3, 0, TAU); ctx.stroke();
  }
  ctx.translate(c.x, c.y);
  const flash = c.phase === "telegraph" && Math.floor(performance.now() / 100) % 2 === 0;
  ctx.rotate(c.rot);
  ctx.fillStyle = flash ? "#ffd166" : "#ff5d3a";
  ctx.strokeStyle = "#ff9f1c"; ctx.lineWidth = 2;
  ctx.shadowColor = "#ff5d3a"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, 12); ctx.lineTo(-4, 0); ctx.lineTo(-10, -12); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(4, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawShooter(ctx, s) {
  ctx.save(); ctx.translate(s.x, s.y);
  if (s.charging) {
    ctx.strokeStyle = "rgba(255,45,120,.9)"; ctx.lineWidth = 3;
    ctx.shadowColor = "#ff2d78"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(performance.now() / 60) * 3, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = "rgba(176,108,255,.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
  ctx.fillStyle = "#3a1a5e"; ctx.strokeStyle = "#b06cff"; ctx.lineWidth = 2;
  ctx.shadowColor = "#b06cff"; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff2d78"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#eaf6ff";
  ctx.beginPath(); ctx.arc(-5, -5, 2, 0, TAU); ctx.arc(5, -5, 2, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawEBullet(ctx, b) {
  /* Magenta diamond with a pale core and dark outline: unmistakable
     against the cyan player bullets at a glance. */
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ff2d78"; ctx.shadowColor = "#ff2d78"; ctx.shadowBlur = 10;
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1;
  ctx.strokeRect(-4.5, -4.5, 9, 9);
  ctx.fillStyle = "#ffd6e8"; ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}
function drawBossBar(ctx, G) {
  const b = G.boss;
  /* Milestone C: moved down (was y=104) so the bar/label never collide
     with the HUD combo line at y≈102 when a triangle is ready. */
  const bw = 400, bx = (W - bw) / 2, by = 124;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff2d78"; ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.fillText("BOSS" + (b.phase === 2 ? " — PHASE 2" : " — PHASE 1"), W / 2, by - 6);
  ctx.fillStyle = "rgba(255,45,120,.18)";
  ctx.fillRect(bx, by, bw, 10);
  ctx.fillStyle = b.phase === 2 ? "#ff5d3a" : "#ff2d78";
  ctx.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 10);
  ctx.strokeStyle = "rgba(255,45,120,.7)"; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, 10);
}
function drawHUD(ctx, G) {
  /* Milestone C: dark scrim behind the whole HUD strip so score / sector /
     constellation text stays legible over bright nebulas and particles. */
  const scrim = ctx.createLinearGradient(0, 0, 0, 96);
  scrim.addColorStop(0, "rgba(5,8,32,.72)"); scrim.addColorStop(1, "rgba(5,8,32,0)");
  ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, 96);
  ctx.textAlign = "left"; ctx.font = "bold 20px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#eaf6ff"; ctx.fillText("SCORE  " + G.score, 18, 34);
  ctx.font = "13px 'Segoe UI', sans-serif"; ctx.fillStyle = "#7f8fc9";
  ctx.fillText("BEST  " + G.hiScore, 18, 54);
  ctx.textAlign = "center"; ctx.font = "bold 18px 'Segoe UI', sans-serif"; ctx.fillStyle = "#00e5ff";
  if (G.boss) {
    ctx.fillText("BOSS", W / 2, 34);
  } else if (G.tutorialActive) {
    ctx.fillText("SECTOR " + G.sector + " / 3 — TUTORIAL", W / 2, 34);
  } else {
    /* Real remaining time: 60 - sectorTime, the same sectorTime that
       drives the transition at >= 60. */
    const remain = Math.max(0, 60 - (G.sectorTime || 0));
    ctx.fillText("SECTOR " + G.sector + " / 3 — " + formatMmSs(Math.ceil(remain)) + " REMAINING", W / 2, 34);
  }
  /* sector progress bar (60s per sector); wider, thicker, bordered */
  if (!G.boss) {
    const bw = 220, bx = W / 2 - bw / 2, by = 40;
    const p = clamp((G.sectorTime || 0) / 60, 0, 1);
    ctx.fillStyle = "rgba(0,229,255,.18)"; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = "#00e5ff"; ctx.fillRect(bx, by, bw * p, 10);
    ctx.strokeStyle = "rgba(0,229,255,.6)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, 10);
  }
  /* constellation progress with star icons */
  const n = G.constellation.anchors.length;
  /* Clamp defensively: the HUD must never throw even if the count is ever out of range. */
  const shown = Math.max(0, Math.min(3, n));
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.fillStyle = n === 3 ? "#ffe14d" : "#eaf6ff";
  ctx.fillText("CONSTELLATION " + "★".repeat(shown) + "☆".repeat(3 - shown) + "  " + shown + "/3", W / 2, 66);
  if (n === 3) {
    const s = Math.ceil(G.constellation.timer);
    ctx.fillStyle = G.constellation.timer < 3 ? "#ff2d78" : "#ffe14d";
    ctx.font = "bold 16px 'Segoe UI', sans-serif";
    /* v1.2 (fix B): same words as the tutorial prompt, and both derive
       from the same state (anchors.length === 3). Was "RETURN TO CLOSE". */
    ctx.fillText("RETURN TO ANCHOR 1 — " + s + "s", W / 2, 88);
  }
  if (G.combo >= 2) {
    ctx.fillStyle = "#ffe14d"; ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillText("COMBO ×" + G.combo + "  (" + Math.ceil(G.comboTimer) + "s)", W / 2, n === 3 ? 102 : 80);
  }
  if (G.tutorialActive) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff9f1c"; ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillText("TUTORIAL", W - 18, 78);
    ctx.textAlign = "center";
  }
  ctx.textAlign = "right";
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < G.lives ? "#ff2d78" : "rgba(255,45,120,.18)";
    ctx.beginPath();
    const x = W - 24 - i * 30, y = 28;
    ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x - 8, y + 7); ctx.closePath(); ctx.fill();
  }
  if (G.shieldTimer > 0) { ctx.fillStyle = "#00e5ff"; ctx.font = "bold 13px 'Segoe UI', sans-serif"; ctx.fillText("SHIELD " + Math.ceil(G.shieldTimer) + "s", W - 18, 54); }
  if (G.muted) { ctx.fillStyle = "#7f8fc9"; ctx.font = "13px 'Segoe UI', sans-serif"; ctx.textAlign = "left"; ctx.fillText("MUTED (M)", 18, H - 16); }
  if (G.reducedFx) { ctx.fillStyle = "#7f8fc9"; ctx.font = "13px 'Segoe UI', sans-serif"; ctx.textAlign = "left"; ctx.fillText("REDUCED EFFECTS (G)", 18, H - 36); }
  /* Version identifier (v1.2): small, subtle, bottom-right HUD corner. */
  ctx.textAlign = "right";
  ctx.fillStyle = "#7f8fc9"; ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(VERSION, W - 18, H - 16);
}

function panel(ctx, w, h) {
  const x = (W - w) / 2, y = (H - h) / 2;
  ctx.fillStyle = "rgba(5,8,32,.82)"; ctx.strokeStyle = "rgba(0,229,255,.55)"; ctx.lineWidth = 2;
  ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  return { x, y };
}
/* Shared title-screen layout: the PLAY TUTORIAL button rect, used by
   render.js for drawing and by input.js for hit-testing. */
function titleTutorialButtonRect() {
  return { x: W / 2 - 160, y: (H - 460) / 2 + 308, w: 320, h: 38 };
}
function drawTitle(ctx, G) {
  const p = panel(ctx, 680, 460);
  ctx.textAlign = "center";
  ctx.fillStyle = "#00e5ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 26;
  ctx.font = "bold 68px 'Segoe UI', sans-serif";
  ctx.fillText("STARFALL", W / 2, p.y + 100);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff2d78"; ctx.font = "bold 24px 'Segoe UI', sans-serif";
  ctx.fillText("CONSTELLATION BREAKER", W / 2, p.y + 134);
  ctx.fillStyle = "#7f8fc9"; ctx.font = "bold 14px 'Segoe UI', sans-serif";
  ctx.fillText("SECTOR 1  ·  NEON ARCADE", W / 2, p.y + 160);
  ctx.fillStyle = "#eaf6ff"; ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillText("Shoot asteroids. Collect 3 stars. Return to the first star", W / 2, p.y + 198);
  ctx.fillText("to blast everything inside.", W / 2, p.y + 222);
  ctx.fillText("You have 3 lives — every 5th star in a row earns a shield.", W / 2, p.y + 250);
  ctx.fillStyle = "#ffe14d"; ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText("CLICK or SPACE to launch", W / 2, p.y + 296);
  const tb = titleTutorialButtonRect();
  ctx.fillStyle = "rgba(13,16,56,.9)";
  ctx.strokeStyle = "rgba(0,229,255,.7)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(tb.x, tb.y, tb.w, tb.h, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#00e5ff"; ctx.font = "bold 17px 'Segoe UI', sans-serif";
  ctx.fillText("▶ PLAY TUTORIAL  (T)", W / 2, tb.y + 26);
  ctx.fillStyle = "#7f8fc9"; ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.fillText("Arrows / WASD or mouse to fly  ·  Space / click to shoot  ·  P pause", W / 2, p.y + 372);
  ctx.fillText("M — mute  ·  G — reduced effects", W / 2, p.y + 396);
  if (G.hiScore > 0) { ctx.fillStyle = "#eaf6ff"; ctx.font = "bold 15px 'Segoe UI', sans-serif"; ctx.fillText("BEST SCORE  " + G.hiScore, W / 2, p.y + 424); }
  /* Version identifier (v1.2): small, bottom-right of the title panel. */
  ctx.textAlign = "right";
  ctx.fillStyle = "#7f8fc9"; ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText(VERSION, p.x + 664, p.y + 448);
}
function drawPaused(ctx, G) {
  const p = panel(ctx, 420, 170);
  ctx.textAlign = "center"; ctx.fillStyle = "#00e5ff"; ctx.font = "bold 36px 'Segoe UI', sans-serif";
  ctx.fillText("PAUSED", W / 2, p.y + 72);
  ctx.fillStyle = "#eaf6ff"; ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillText("Press P to resume  ·  R to restart", W / 2, p.y + 112);
  ctx.fillStyle = "#7f8fc9"; ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText("M — mute  ·  G — reduced effects", W / 2, p.y + 140);
}
function drawOver(ctx, G) {
  const p = panel(ctx, 580, 390);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff2d78"; ctx.shadowColor = "#ff2d78"; ctx.shadowBlur = 22;
  ctx.font = "bold 52px 'Segoe UI', sans-serif";
  ctx.fillText("GAME OVER", W / 2, p.y + 88);
  ctx.shadowBlur = 0;
  /* Render ONLY from the frozen results snapshot (captured once in
     gameOver()); the live clock no longer moves under this screen. */
  const S = G.finalStats || {
    score: G.score, hiScore: G.hiScore, constellationsCompleted: G.constellationsCompleted,
    bestCombo: G.bestCombo, starsGot: G.starsGot, kills: G.kills,
    timePlayed: Math.floor(G.timePlayed), shotsFired: G.shotsFired,
    sector: G.sector, bossReached: G.bossReached
  };
  const isBest = S.score >= S.hiScore && S.score > 0;
  ctx.fillStyle = "#ffe14d"; ctx.font = "bold 22px 'Segoe UI', sans-serif";
  ctx.fillText((isBest ? "★ NEW BEST!  " : "") + "SCORE  " + S.score, W / 2, p.y + 136);
  ctx.fillStyle = "#eaf6ff"; ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillText("Constellations closed: " + S.constellationsCompleted + "    ·    Best combo: ×" + S.bestCombo, W / 2, p.y + 176);
  ctx.fillText("Stars collected: " + S.starsGot + "    ·    Asteroids destroyed: " + S.kills, W / 2, p.y + 202);
  ctx.fillText("Mission time: " + formatMmSs(S.timePlayed) + "    ·    Shots fired: " + S.shotsFired, W / 2, p.y + 228);
  ctx.fillText("Personal best: " + S.hiScore + "    ·    Sector reached: " + (S.bossReached ? "BOSS" : S.sector), W / 2, p.y + 254);
  ctx.fillStyle = "#00e5ff"; ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText("CLICK or press SPACE to play again", W / 2, p.y + 312);
  drawResultsButtons(ctx, "over");
}
function drawVictory(ctx, G) {
  const p = panel(ctx, 620, 400);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe14d"; ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 24;
  ctx.font = "bold 56px 'Segoe UI', sans-serif";
  ctx.fillText("VICTORY", W / 2, p.y + 92);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#00e5ff"; ctx.font = "bold 20px 'Segoe UI', sans-serif";
  ctx.fillText("THE CELESTIAL MACHINE IS SHATTERED", W / 2, p.y + 126);
  /* Render ONLY from the frozen results snapshot (captured once in
     victory()); the live clock no longer moves under this screen. */
  const S = G.finalStats || {
    score: G.score, hiScore: G.hiScore, constellationsCompleted: G.constellationsCompleted,
    bestCombo: G.bestCombo, starsGot: G.starsGot, kills: G.kills,
    timePlayed: Math.floor(G.timePlayed), shotsFired: G.shotsFired,
    sector: G.sector, bossReached: G.bossReached
  };
  const isBest = S.score >= S.hiScore && S.score > 0;
  ctx.fillStyle = "#ffe14d"; ctx.font = "bold 22px 'Segoe UI', sans-serif";
  ctx.fillText((isBest ? "★ NEW BEST!  " : "") + "SCORE  " + S.score, W / 2, p.y + 168);
  ctx.fillStyle = "#eaf6ff"; ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillText("Constellations closed: " + S.constellationsCompleted + "    ·    Best combo: ×" + S.bestCombo, W / 2, p.y + 208);
  ctx.fillText("Stars collected: " + S.starsGot + "    ·    Asteroids destroyed: " + S.kills, W / 2, p.y + 234);
  ctx.fillText("Mission time: " + formatMmSs(S.timePlayed) + "    ·    Shots fired: " + S.shotsFired, W / 2, p.y + 260);
  ctx.fillText("Personal best: " + S.hiScore + "    ·    Sector reached: BOSS", W / 2, p.y + 286);
  ctx.fillStyle = "#00e5ff"; ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText("CLICK or press SPACE to play again", W / 2, p.y + 330);
  drawResultsButtons(ctx, "victory");
}
/* Shared results-screen layout: RETRY / TUTORIAL button rects, used by
   render.js for drawing and by input.js (via main.js resultsRects) for
   hit-testing. R / Space / click retries; T replays the tutorial. */
function resultsButtonRects(which) {
  const pY = which === "victory" ? (H - 400) / 2 : (H - 390) / 2;
  const y = pY + (which === "victory" ? 352 : 330);
  return {
    retry: { x: W / 2 - 215, y, w: 200, h: 40 },
    tutorial: { x: W / 2 + 15, y, w: 200, h: 40 }
  };
}
function drawResultsButtons(ctx, which) {
  const rr = resultsButtonRects(which);
  ctx.textAlign = "center";
  const btn = (r, label, color) => {
    ctx.fillStyle = "rgba(13,16,56,.9)";
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.font = "bold 17px 'Segoe UI', sans-serif";
    ctx.fillText(label, r.x + r.w / 2, r.y + 27);
  };
  btn(rr.retry, "RETRY  (R)", "#00e5ff");
  btn(rr.tutorial, "TUTORIAL  (T)", "#ffe14d");
}
function drawUpgrade(ctx, G) {
  const opts = G.upgradeOffer || [];
  const p = panel(ctx, 920, 380);
  ctx.textAlign = "center";
  ctx.fillStyle = "#00e5ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 18;
  ctx.font = "bold 34px 'Segoe UI', sans-serif";
  ctx.fillText("SECTOR CLEAR — CHOOSE AN UPGRADE", W / 2, p.y + 56);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#7f8fc9"; ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillText("Click a card or press 1 / 2 / 3", W / 2, p.y + 82);
  opts.forEach((u, i) => {
    const c = upgradeCardRect(i);
    ctx.fillStyle = "rgba(13,16,56,.9)";
    ctx.strokeStyle = "rgba(0,229,255,.6)"; ctx.lineWidth = 2;
    ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 14); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffe14d"; ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillText("[" + (i + 1) + "]", c.x + c.w / 2, c.y + 32);
    ctx.fillStyle = "#00e5ff"; ctx.font = "bold 22px 'Segoe UI', sans-serif";
    ctx.fillText(u.name, c.x + c.w / 2, c.y + 66);
    ctx.fillStyle = "#eaf6ff"; ctx.font = "15px 'Segoe UI', sans-serif";
    wrapText(ctx, u.desc, c.x + c.w / 2, c.y + 96, c.w - 32, 20);
    ctx.fillStyle = "#ffe14d"; ctx.font = "bold 14px 'Segoe UI', sans-serif";
    wrapText(ctx, u.effect, c.x + c.w / 2, c.y + 158, c.w - 32, 19);
  });
}
/* Simple centred word-wrap for card text. */
function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = String(text).split(" ");
  let line = "", yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy); line = w; yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}
function drawTutorialPrompt(ctx, G) {
  const prompts = [
    ["FLY — ARROWS / WASD or MOUSE", "Steer your ship toward the golden star"],
    ["SHOOT — HOLD SPACE", "Blast the slow asteroids drifting in"],
    ["COLLECT 3 STARS", "Each star drops a glowing anchor — watch the triangle form"],
    ["RETURN TO ANCHOR 1", "Fly back inside the pulsing gold ring to detonate"]
  ];
  /* v1.2 (fix B): the prompt derives from the SAME constellation state
     as the HUD ("RETURN TO ANCHOR 1 — Ns" in drawHUD), not from the
     tutorialStep counter alone. The old code showed the step-2
     "COLLECT 3 STARS" prompt while the HUD already said RETURN, because
     tutorialStep only flipped to 3 on the frame after the 3rd star was
     collected. Now, whenever 3 anchors are armed — in the tutorial or
     after an expiry re-arm — the return prompt shows on that very frame,
     and it clears back to COLLECT the moment the triangle expires or
     closes (anchors.length drops below 3). */
  const armed = G.constellation && G.constellation.anchors.length === 3;
  const pr = armed ? prompts[3] : prompts[Math.min(G.tutorialStep, prompts.length - 1)];
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe14d"; ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 12;
  ctx.font = "bold 24px 'Segoe UI', sans-serif";
  ctx.fillText(pr[0], W / 2, 128);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#eaf6ff"; ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillText(pr[1], W / 2, 152);
}
