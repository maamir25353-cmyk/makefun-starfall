"use strict";
/* Starfall — main.js
   Game loop, state machine (title | playing | paused | upgrade | victory
   | over), tutorial flow, constellation integration, scoring, lives,
   sectors, upgrades, boss fight, reset.
   Listeners are registered once, at load, via initInput(); resetGame()
   only clears state — it never registers listeners. */

const cv = document.getElementById("game");
const ctx = cv.getContext("2d");

/* ---------- state ---------- */
let state = "title"; // title | playing | paused | upgrade | victory | over
let score = 0, hiScore = 0, lives = 3, combo = 0, comboTimer = 0, bestCombo = 0;
let kills = 0, starsGot = 0, shotsFired = 0, timePlayed = 0;
let constellationsCompleted = 0, sector = 1, sectorTime = 0;
let boss = null, bossReached = false, bossStarTimer = 4;
/* Results snapshot (v1.1): captured EXACTLY ONCE when the run ends, so
   the results screens render frozen final numbers. The old bug: update()
   added dt to timePlayed before the state check, so the clock kept
   running on the results screen (45s -> 47s) and while paused. */
let finalStats = null;
function captureFinalStats() {
  if (finalStats) return finalStats;
  finalStats = {
    score, hiScore, constellationsCompleted, bestCombo, starsGot, kills,
    timePlayed: Math.floor(timePlayed), shotsFired, sector, bossReached
  };
  return finalStats;
}
let reducedFx = false; /* G toggles reduced effects; persists across retries (v1.1) */
let upg = freshUpgradeState();
let takenUpgrades = new Set();
let upgradeOffer = [];
let chargerTimer = 8, shooterTimer = 10;
let shake = 0, flash = 0, spawnTimer = 0, starTimer = 4, shieldTimer = 0, hitStop = 0;
let tutorialActive = false, tutorialStep = 0, tutorialStepTime = 0, tutorialStartX = 0, tutorialStartY = 0;
let detPulse = null;
try { hiScore = parseInt(localStorage.getItem("starfall-hiscore") || "0", 10) || 0; } catch (e) {}
/* Tutorial completion (v1.1): remembered across sessions so retries skip
   the tutorial. try/catch — if storage throws, the in-memory flag still
   covers the current page session; never crashes. */
let tutorialDone = false;
try { tutorialDone = localStorage.getItem("starfall-tutorial-done") === "1"; } catch (e) {}
function markTutorialDone() {
  tutorialDone = true;
  try { localStorage.setItem("starfall-tutorial-done", "1"); } catch (e) {}
}

const ship = { x: W / 2, y: H - 110, vx: 0, vy: 0, r: 14, angle: -Math.PI / 2, invuln: 0, fireCd: 0, thrust: 0 };
const bullets = [], parts = [], floats = [], stars = [];
for (let i = 0; i < 130; i++)
  stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.2, 1), s: rand(0.6, 2.2), tw: rand(0, TAU) });
const constellation = createConstellation();

/* ---------- announcement banner (v1.1) ----------
   Single slot for large center announcements (sector transitions,
   CONSTELLATION LOST, +1 LIFE, boss warnings, TRIANGLE READY, upgrade
   picks). One visible at a time at a fixed position below the tutorial
   band (y 196–236), ~1.6s each, FIFO queue, consecutive duplicates
   dropped, queue capped so announcements can never pile up. */
const BANNER_DURATION = 1.6;
let bannerQueue = [];
let bannerCurrent = null;
let bannerT = 0;
function announce(text, color) {
  const item = { text, color: color || "#ffe14d" };
  if (bannerCurrent && bannerCurrent.text === text) return;
  if (bannerQueue.length && bannerQueue[bannerQueue.length - 1].text === text) return;
  if (bannerQueue.length >= 4) return; /* drop overflow, never pile up */
  bannerQueue.push(item);
}
function updateBanner(dt) {
  if (!bannerCurrent) {
    bannerCurrent = bannerQueue.shift() || null;
    bannerT = 0;
  } else {
    bannerT += dt;
    if (bannerT >= BANNER_DURATION) { bannerCurrent = null; bannerT = 0; }
  }
}
/* Drop the current banner and any queued TRIANGLE READY notice: once the
   triangle detonates or expires, that message is stale and must not sit
   on top of the detonation score float. */
function clearBanner() {
  bannerCurrent = null; bannerT = 0;
  bannerQueue = bannerQueue.filter(b => b.text !== "TRIANGLE READY — RETURN!");
}

/* ---------- helpers ---------- */
function burst(x, y, color, n, speed) {
  /* Reduced effects: half the particles. Particles are bounded: the
     array is capped at 400 (oldest dropped first). */
  const count = reducedFx ? Math.max(1, Math.floor(n / 2)) : n;
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU), s = rand(speed * 0.3, speed);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.9), max: 0.9, color, r: rand(1.5, 3.5) });
  }
  if (parts.length > 400) parts.splice(0, parts.length - 400);
}
function addFloat(x, y, text, color, size) {
  /* Small score/pickup floats only: clamped to y >= 172 so they never
     enter the HUD strip (0–96) or the reserved tutorial band (110–165),
     and never cover the closure countdown (HUD y=80). Large center
     messages go through announce() instead — never addFloat. A float
     landing in the banner band (196–236) is pushed just below it so the
     banner pill never hides a score number; it rises ~48px over its
     life, reaching the band only as it fades out.
     v1.2: ONE float per pickup — callers compose a single compact line
     (STAR + ANCHOR + SHIELD in one string) instead of stacking two
     floats at the same spot. The old pair ("STAR ×n" at y, "ANCHOR n/3"
     at y-26) overlapped once both rose and pinned at y=172. As a second
     guard, a new float is shifted down in 26px steps while it would sit
     within 24px vertically of a live float, and x is clamped so a long
     single-line float never clips off the screen edges. */
  let yy = clamp(y, 172, H - 24);
  if (yy >= 188 && yy <= 248) yy = 250;
  let xx = clamp(x, 120, W - 120);
  for (let tries = 0; tries < 3; tries++) {
    const clash = floats.some(f => Math.abs(f.x - xx) < 120 && Math.abs(f.y - yy) < 24);
    if (!clash) break;
    yy = Math.min(yy + 26, H - 24);
  }
  floats.push({ x: xx, y: yy, text, color, size: size || 16, life: 1.4 });
  if (floats.length > 30) floats.splice(0, floats.length - 30);
}
function addScore(base, x, y) {
  const mult = 1 + Math.min(combo, 10) * 0.25;
  const pts = Math.round(base * mult);
  score += pts;
  addFloat(x, y, "+" + pts, "#ffe14d", 15);
}

function saveHiScore() {
  if (score > hiScore) { hiScore = score; try { localStorage.setItem("starfall-hiscore", String(hiScore)); } catch (e) {} }
}

function clearHazards() {
  rocks.length = 0; chargers.length = 0; shooters.length = 0; eBullets.length = 0;
  spawnTimer = 0; starTimer = 2; chargerTimer = 8; shooterTimer = 10;
}

/* Spawn x at least 120px from the ship (never on top of the player). */
function fairSpawnX() {
  for (let tries = 0; tries < 12; tries++) {
    const x = rand(30, W - 30);
    if (Math.abs(x - ship.x) >= 120) return x;
  }
  return clamp(ship.x + 240, 30, W - 30);
}

/* Milestone C balance: S1 unchanged (gentle). S2/S3 density cut hard —
   the B play-test showed the run's cliff was S2→S3: the player entered
   S3 with 1 life and S3's 1.2s/22-rock density killed them in ~14s.
   S2 1.6s/18 → 1.9s/14, chargers 12s → 16s; S3 1.2s/22 → 1.6s/16,
   chargers 12s → 16s, shooters 15s → 20s. Ramp stays smooth: S1 gentle,
   S2 noticeably harder, S3 hardest, boss the climax. */
function sectorConfig(s) {
  if (s === 1) return { rockInterval: 2.2, rockMax: 12, chargerEvery: Infinity, shooterEvery: Infinity };
  if (s === 2) return { rockInterval: 1.9, rockMax: 14, chargerEvery: 16, shooterEvery: Infinity };
  return { rockInterval: 1.6, rockMax: 16, chargerEvery: 16, shooterEvery: 20 };
}

/* Milestone C: +1 life (cap 5) on every sector clear, so a reasonable
   player reaches the boss with 2–3 lives instead of 1. */
function grantLife(label) {
  if (lives < 5) {
    lives++;
    announce("+1 LIFE — " + label, "#ff2d78");
  } else {
    announce("LIVES FULL", "#ff2d78");
  }
}

function openUpgrade() {
  upgradeOffer = drawUpgradeOptions(takenUpgrades);
  state = "upgrade";
  sfx.wave();
}

function selectUpgrade(i) {
  const u = upgradeOffer[i];
  if (!u || state !== "upgrade") return;
  applyUpgrade(u.id, upg);
  takenUpgrades.add(u.id);
  if (u.id === "shield") shieldTimer = upg.shieldTimer;
  announce(u.name.toUpperCase() + "!", "#00e5ff");
  sfx.ready(); HapticsFX.notify("success");
  sector++;
  sectorTime = 0;
  clearHazards();
  grantLife("SECTOR CLEAR");
  announce("SECTOR " + sector + (sector === 3 ? " — FINAL STRETCH" : " — PRESSURE RISING"), "#ffe14d");
  state = "playing";
}

function startBoss() {
  clearHazards();
  boss = createBoss();
  bossReached = true;
  bossStarTimer = 3;
  grantLife("BOSS APPROACHES"); /* life refill before the boss */
  announce("⚠ WARNING — CELESTIAL MACHINE ⚠", "#ff2d78");
  sfx.wave();
}

function victory() {
  state = "victory";
  saveHiScore();
  captureFinalStats();
  sfx.ready();
  burst(ship.x, ship.y, "#ffe14d", 40, 360);
}

/* mode: "tutorial" forces the playable tutorial; "normal" forces a
   direct mission; omitted (auto): tutorial on first launch, direct
   mission on retries once the tutorial was completed once. */
function resetGame(mode) {
  score = 0; lives = 3; combo = 0; comboTimer = 0; bestCombo = 0;
  kills = 0; starsGot = 0; shotsFired = 0; timePlayed = 0;
  constellationsCompleted = 0; sector = 1; sectorTime = 0;
  boss = null; bossReached = false; bossStarTimer = 4;
  finalStats = null; /* a fresh run has no results snapshot yet */
  bannerQueue.length = 0; bannerCurrent = null; bannerT = 0;
  upg = freshUpgradeState();
  takenUpgrades = new Set();
  upgradeOffer = [];
  chargerTimer = 8; shooterTimer = 10;
  bullets.length = 0; rocks.length = 0; orbs.length = 0; chargers.length = 0; shooters.length = 0; eBullets.length = 0; parts.length = 0; floats.length = 0;
  ship.x = W / 2; ship.y = H - 110; ship.vx = 0; ship.vy = 0; ship.invuln = 2; ship.angle = -Math.PI / 2;
  spawnTimer = 0; starTimer = 4; shieldTimer = 0; shake = 0; flash = 0; hitStop = 0; detPulse = null;
  /* reducedFx PERSISTS across retries (v1.1 change: a restart no longer
     restores full effects); mute + soundtrack persist as before. */
  /* Clear held input so the restart press cannot fire a bullet or
     choose an upgrade on the first frame. */
  for (const k in keys) keys[k] = false;
  Input.mouseDown = false;
  Input.touchActive = false; Input.touchX = undefined; Input.touchY = undefined;
  resetConstellation(constellation);
  const wantTutorial = mode === "tutorial" ? true : mode === "normal" ? false : !tutorialDone;
  tutorialStep = 0; tutorialStepTime = 0;
  tutorialStartX = ship.x; tutorialStartY = ship.y;
  if (wantTutorial) {
    /* tutorial: teach by doing, right after launch */
    tutorialActive = true;
    for (let i = 0; i < 3; i++) spawnRock(rand(80, W - 80), rand(-160, -40), "big", -45); /* slow practice rocks */
    ensureTutorialStar();
  } else {
    /* direct mission: normal star spawning from the start, no tutorial
       rocks or prompts */
    tutorialActive = false;
  }
}

/* ---------- tutorial stars ---------- */
const TUTORIAL_SPOTS = [
  { x: W / 2, y: 300 }, { x: W / 2 + 200, y: 220 }, { x: W / 2 - 200, y: 180 },
  { x: W / 2 + 120, y: 420 }, { x: W / 2 - 260, y: 320 }, { x: 150, y: 150 },
  { x: W - 150, y: 420 }, { x: W / 2, y: 140 }
];
function ensureTutorialStar() {
  if (!tutorialActive) return;
  if (constellation.anchors.length >= 3) return;
  if (orbs.some(o => o.tutorial)) return;
  let spot = null;
  for (const s of TUTORIAL_SPOTS) {
    const farFromAnchors = constellation.anchors.every(a => dist2(s.x, s.y, a.x, a.y) > 170 * 170);
    const farFromShip = dist2(s.x, s.y, ship.x, ship.y) > 120 * 120;
    if (farFromAnchors && farFromShip) { spot = s; break; }
  }
  if (!spot) {
    for (let tries = 0; tries < 30 && !spot; tries++) {
      const cand = { x: rand(80, W - 80), y: rand(100, H - 140) };
      if (constellation.anchors.every(a => dist2(cand.x, cand.y, a.x, a.y) > 170 * 170)) spot = cand;
    }
  }
  if (!spot) return;
  const o = spawnOrb(spot.x, spot.y, 60);
  o.tutorial = true; o.vx = 0; o.vy = 0;
}

/* ---------- combat ---------- */
function fire() {
  if (ship.fireCd > 0) return;
  if (bullets.length >= 60) return; /* bounded projectiles */
  ship.fireCd = upg.fireCdBase;
  shotsFired++;
  const a = ship.angle;
  const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
  const offsets = upg.twin ? [-8, 8] : [0];
  for (const off of offsets) {
    bullets.push({
      x: ship.x + Math.cos(a) * 20 + px * off, y: ship.y + Math.sin(a) * 20 + py * off,
      vx: Math.cos(a) * 620 + ship.vx * 0.4, vy: Math.sin(a) * 620 + ship.vy * 0.4, life: 0.9
    });
  }
  sfx.shoot();
}
function breakRock(i) {
  const r = rocks[i]; rocks.splice(i, 1); kills++;
  burst(r.x, r.y, r.size === "big" ? "#ff5d8f" : "#ff9f43", r.size === "big" ? 22 : 14, 260);
  sfx.boom(); shake = Math.min(10, shake + 4);
  addScore(rockScore(r.size), r.x, r.y);
  for (const child of childSizes(r.size)) spawnRock(r.x + rand(-16, 16), r.y, child);
  if (Math.random() < 0.22) spawnOrb(r.x, r.y);
}
function hitShip(r) {
  if (tutorialActive) { /* nothing can kill the player during the tutorial */
    burst(ship.x, ship.y, "#00e5ff", 12, 200);
    rocks.splice(rocks.indexOf(r), 1);
    addFloat(ship.x, ship.y - 28, "TUTORIAL", "#ff9f1c", 14);
    return;
  }
  if (shieldTimer > 0) { breakRock(rocks.indexOf(r)); addFloat(ship.x, ship.y - 28, "BLOCKED", "#00e5ff", 16); return; }
  lives--; flash = 1; shake = 12; ship.invuln = 2.2;
  burst(ship.x, ship.y, "#00e5ff", 30, 320); sfx.hit(); HapticsFX.impact("heavy");
  rocks.splice(rocks.indexOf(r), 1);
  combo = 0; comboTimer = 0;
  if (lives <= 0) gameOver();
}
/* A hit from a charger, shooter, enemy bullet, or the boss itself.
   `remove` destroys the thing that hit the ship (null for the boss). */
function hitShipByEnemy(arr, obj, remove) {
  if (tutorialActive) return; /* chargers/shooters/eBullets never spawn in the tutorial */
  if (shieldTimer > 0) {
    if (remove) remove();
    else if (arr && obj) arr.splice(arr.indexOf(obj), 1);
    addFloat(ship.x, ship.y - 28, "BLOCKED", "#00e5ff", 16);
    return;
  }
  lives--; flash = 1; shake = 12; ship.invuln = 2.2;
  burst(ship.x, ship.y, "#00e5ff", 30, 320); sfx.hit(); HapticsFX.impact("heavy");
  if (remove) remove();
  else if (arr && obj) arr.splice(arr.indexOf(obj), 1);
  combo = 0; comboTimer = 0;
  if (lives <= 0) gameOver();
}
function gameOver() {
  state = "over"; sfx.over();
  saveHiScore();
  captureFinalStats();
}

/* ---------- constellation ---------- */
function collectStar(o) {
  combo++; comboTimer = 4; starsGot++;
  if (combo > bestCombo) bestCombo = combo;
  score += 50 * Math.min(combo, 10);
  burst(o.x, o.y, "#ffe14d", 14, 220); sfx.star();
  /* v1.2 (fix A): ONE compact pickup float per star. The old code added
     "STAR ×n" at the pickup point plus a second "ANCHOR n/3" float 26px
     above it (and a third "SHIELD!" float at the ship on every 5th star
     in a row); the pair rose at the same speed and both pinned at y=172,
     so they drew over each other. Now every part of the pickup message
     is composed into this single line. */
  let pickupText = "STAR ×" + combo;
  let pickupSize = 17;
  const res = tryAddAnchor(constellation, o.x, o.y, upg.closureTime);
  if (res.ok) {
    if (res.count === 1) { sfx.anchor(); pickupText += " · ANCHOR 1/3"; }
    else if (res.count === 2) { sfx.line(); pickupText += " · ANCHOR 2/3"; }
    else if (res.count === 3) {
      sfx.ready(); announce("TRIANGLE READY — RETURN!", "#ffe14d");
      pickupText += " · TRIANGLE READY";
      /* v1.2 (fix B): the tutorial step flips on the SAME frame the 3rd
         star arms the triangle, so the prompt cannot lag one frame
         behind the HUD. drawTutorialPrompt also derives from the
         constellation state directly, so this is belt-and-braces. */
      if (tutorialActive) { tutorialStep = 3; tutorialStepTime = 0; }
    }
  } else if (res.reason === "full") {
    /* Triangle already complete: the star counts for score/combo only —
       no anchor, no fail message, no fail sound. */
  } else {
    /* star still counts for score; the anchor is refused and progress is kept */
    sfx.fail();
    pickupText += res.reason === "close" ? " · TOO CLOSE" : " · TOO STRAIGHT";
    pickupText += " — TRY ANOTHER STAR";
  }
  if (combo > 0 && combo % 5 === 0) { shieldTimer = 5; pickupText += " · SHIELD!"; }
  addFloat(o.x, o.y, pickupText, res.ok || res.reason === "full" ? "#ffe14d" : "#ff2d78", pickupSize);
}
/* Hooks the boss calls on phase change / death (banners + sounds). */
function bossHooks() {
  return {
    onPhase2() { announce("PHASE 2 — THE MACHINE RAGES", "#ff2d78"); sfx.wave(); },
    onDeath() { announce("BOSS DESTROYED!", "#ffe14d"); sfx.detonate(); }
  };
}
function detonateConstellation() {
  const pts = constellation.anchors;
  const cx = (pts[0].x + pts[1].x + pts[2].x) / 3, cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
  let caught = 0, gained = upg.detBonus;
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    if (pointInTriangle(r, pts[0], pts[1], pts[2])) {
      caught++; gained += rockScore(r.size) + 50;
      rocks.splice(i, 1); kills++;
      burst(r.x, r.y, "#ffe14d", 16, 260);
      if (Math.random() < 0.15) spawnOrb(r.x, r.y);
    }
  }
  /* chargers and shooters inside the triangle die outright, same as rocks */
  for (let i = chargers.length - 1; i >= 0; i--) {
    const c = chargers[i];
    if (pointInTriangle(c, pts[0], pts[1], pts[2])) {
      caught++; gained += 150 + 50;
      chargers.splice(i, 1); kills++;
      burst(c.x, c.y, "#ffe14d", 16, 260);
    }
  }
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i];
    if (pointInTriangle(s, pts[0], pts[1], pts[2])) {
      caught++; gained += 150 + 50;
      shooters.splice(i, 1); kills++;
      burst(s.x, s.y, "#ffe14d", 16, 260);
    }
  }
  /* enemy bullets inside the triangle fizzle (no score) */
  for (let i = eBullets.length - 1; i >= 0; i--) {
    if (pointInTriangle(eBullets[i], pts[0], pts[1], pts[2])) {
      burst(eBullets[i].x, eBullets[i].y, "#ffe14d", 6, 160);
      eBullets.splice(i, 1);
    }
  }
  /* enclosing the boss core: +20 damage and a ~1.5s stagger */
  if (boss && boss.state !== "dying" && pointInTriangle(boss, pts[0], pts[1], pts[2])) {
    damageBoss(boss, 20, bossHooks());
    staggerBoss(boss, 1.5);
    addFloat(boss.x, boss.y - 50, "BOSS +20 — STAGGERED!", "#ffe14d", 20);
    burst(boss.x, boss.y, "#ffe14d", 24, 300);
  }
  score += gained;
  constellationsCompleted++;
  detPulse = { x: cx, y: cy, t: 0, max: 0.5 };
  flash = 0.7; shake = 10; hitStop = 0.08; /* brief hit-stop freeze, not a pause */
  sfx.detonate(); HapticsFX.impact("heavy");
  clearBanner(); /* the TRIANGLE READY notice is stale once detonated */
  addFloat(cx, cy - 10, "CONSTELLATION +" + gained, "#ffe14d", 22);
  burst(cx, cy, "#ffe14d", 30, 320);
  resetConstellation(constellation);
  if (tutorialActive) {
    tutorialActive = false;
    announce("CONSTELLATION CLOSED!", "#00e5ff");
    markTutorialDone();
    starTimer = 2; spawnTimer = 1;
  }
}

/* ---------- update ---------- */
function update(dt) {
  /* Cosmetic-only updates: these run in EVERY state, including the
     results screens, pause, and the upgrade screen. */
  for (const s of stars) { s.y += s.z * 22 * dt; s.tw += dt * 2; if (s.y > H + 4) { s.y = -4; s.x = rand(0, W); } }
  if (flash > 0) flash -= dt * 2;
  if (shake > 0) shake = Math.max(0, shake - dt * 30);
  if (detPulse) { detPulse.t += dt; if (detPulse.t >= detPulse.max) detPulse = null; }
  /* In "over" / "victory" / "paused" / "upgrade" / "title" only the
     cosmetics above plus particles/floats run: mission clock, combo
     timer, sector time, spawning, scoring, damage and pickups all stop. */
  if (state !== "playing") { updateFx(dt); return; }

  /* Active play only (the tutorial counts: it is active play). Mission
     time = active play, EXCLUDING pause / upgrade selection / results. */
  timePlayed += dt;
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  updateBanner(dt); /* banner advances only during active play */
  /* ship steering: keyboard, or glide toward the mouse only when no
     movement keys are held (a stationary pointer never fights keys) */
  const ax = (keys["arrowright"] || keys["d"] ? 1 : 0) - (keys["arrowleft"] || keys["a"] ? 1 : 0);
  const ay = (keys["arrowdown"] || keys["s"] ? 1 : 0) - (keys["arrowup"] || keys["w"] ? 1 : 0);
  /* Touch steering takes priority over the mouse glide (a touch device
     has no mouse position, but a hybrid laptop might): the ship glides
     toward the finger's offset target while the finger is down, and
     stops when it lifts (input.js clears touchX/touchY on touchend). */
  if (ax || ay) {
    ship.vx += ax * 1500 * dt; ship.vy += ay * 1500 * dt;
    ship.angle = Math.atan2(ship.vy, ship.vx);
    ship.thrust = 1;
  } else if (Input.touchActive && Input.touchX !== undefined) {
    const dx = Input.touchX - ship.x, dy = Input.touchY - ship.y, d = Math.hypot(dx, dy);
    if (d > 8) { ship.vx += (dx / d) * 1100 * dt; ship.vy += (dy / d) * 1100 * dt; ship.angle = Math.atan2(dy, dx); ship.thrust = 0.7; }
    else ship.thrust = 0;
  } else if (Input.mouseX !== undefined) {
    const dx = Input.mouseX - ship.x, dy = Input.mouseY - ship.y, d = Math.hypot(dx, dy);
    if (d > 8) { ship.vx += (dx / d) * 1100 * dt; ship.vy += (dy / d) * 1100 * dt; ship.angle = Math.atan2(dy, dx); ship.thrust = 0.7; }
    else ship.thrust = 0;
  } else ship.thrust = 0;
  ship.vx *= Math.pow(0.12, dt); ship.vy *= Math.pow(0.12, dt);
  ship.x = clamp(ship.x + ship.vx * dt, 20, W - 20);
  ship.y = clamp(ship.y + ship.vy * dt, 20, H - 20);
  if (ship.invuln > 0) ship.invuln -= dt;
  if (shieldTimer > 0) shieldTimer -= dt;
  ship.fireCd -= dt;
  /* Auto-fire on touch devices (Input.touchMode, set on first
     touchstart): the ship fires while playing with no need to hold.
     This also satisfies the tutorial's shoot step (step 1 waits for
     shotsFired > 0) for a touch player. Desktop is unchanged:
     Space or mouse hold still fires. */
  if (keys[" "] || Input.mouseDown || Input.touchMode) fire();

  /* tutorial flow */
  if (tutorialActive) {
    tutorialStepTime += dt;
    if (tutorialStep === 0 && (dist2(ship.x, ship.y, tutorialStartX, tutorialStartY) > 80 * 80 || tutorialStepTime > 5)) { tutorialStep = 1; tutorialStepTime = 0; }
    else if (tutorialStep === 1 && (shotsFired > 0 || tutorialStepTime > 8)) { tutorialStep = 2; tutorialStepTime = 0; }
    else if (tutorialStep === 2 && constellation.anchors.length === 3) { tutorialStep = 3; tutorialStepTime = 0; }
    else if (tutorialStep === 3 && constellation.anchors.length < 3) { tutorialStep = 2; tutorialStepTime = 0; }
    ensureTutorialStar();
    spawnTimer -= dt;
    if (spawnTimer <= 0) { if (rocks.length < 4) spawnRock(rand(60, W - 60), -50, "big", -55); spawnTimer = 7; }
  } else if (boss) {
    /* boss fight: rocks drift in slowly, stars come steadily so the
       player can always build triangles; sectorTime is frozen (HUD: BOSS) */
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (rocks.length < 8) spawnRock(fairSpawnX(), -50, "big", 0);
      spawnTimer = 3.5;
    }
    bossStarTimer -= dt;
    if (bossStarTimer <= 0) { spawnOrb(rand(60, W - 60), -20); bossStarTimer = 4; }
    updateBoss(boss, dt, {
      shipX: ship.x, shipY: ship.y,
      spawnEBullet(x, y, a, s) { spawnEBullet(x, y, a, s); },
      spawnRock(x, y, size, vb) { spawnRock(x, y, size, vb); }
    });
    if (boss.state === "dying") {
      shake = Math.max(shake, 6);
      if (Math.random() < 0.3) burst(boss.x + rand(-40, 40), boss.y + rand(-40, 40), Math.random() < 0.5 ? "#ff2d78" : "#ffe14d", 10, 260);
      if (boss.stateT <= 0) { const b = boss; boss = null; victory(); }
    }
  } else {
    /* sector play: sectorTime accumulates only here — playing, tutorial
       finished, no boss — so S1 is tutorial + 60s of play */
    sectorTime += dt;
    const cfg = sectorConfig(sector);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (rocks.length < cfg.rockMax)
        /* Milestone C: rock fall speed capped lower — old bonus reached
           +90 in S3 ((sector-1)*25 + min(40, t*0.1)); now +70 max
           ((sector-1)*20 + min(30, t*0.08)), so S3 rocks stay dodgeable. */
        spawnRock(fairSpawnX(), -50, (timePlayed > 60 && Math.random() < 0.3) ? "med" : "big", (sector - 1) * 20 + Math.min(30, timePlayed * 0.08));
      spawnTimer = Math.max(0.9, cfg.rockInterval - timePlayed * 0.003);
    }
    starTimer -= dt;
    if (starTimer <= 0) { spawnOrb(rand(60, W - 60), -20); starTimer = rand(3.5, 6); }
    if (cfg.chargerEvery !== Infinity) {
      chargerTimer -= dt;
      if (chargerTimer <= 0) {
        if (chargers.length < 2) spawnCharger(fairSpawnX(), -40);
        chargerTimer = cfg.chargerEvery;
      }
    }
    if (cfg.shooterEvery !== Infinity) {
      shooterTimer -= dt;
      if (shooterTimer <= 0) {
        if (shooters.length < 2) spawnShooter(fairSpawnX(), -40);
        shooterTimer = cfg.shooterEvery;
      }
    }
    if (sectorTime >= 60) {
      if (sector < 3) openUpgrade();
      else startBoss();
    }
  }

  /* sector transition happened above: freeze everything else this frame
     (the closure timer in particular must not tick on the upgrade screen) */
  if (state !== "playing") { updateFx(dt); return; }

  /* closure timer: only decrements here, in the playing path, so it
     freezes while paused (and during upgrade screens) */
  if (constellation.anchors.length === 3) {
    const a1 = constellation.anchors[0];
    if (dist2(ship.x, ship.y, a1.x, a1.y) < CLOSURE_RADIUS * CLOSURE_RADIUS) { detonateConstellation(); }
    else if (updateClosure(constellation, dt)) {
      resetConstellation(constellation);
      clearBanner(); /* drop the stale TRIANGLE READY notice first */
      announce("CONSTELLATION LOST", "#ff2d78");
      sfx.fail();
    }
  }

  updateEnemies(dt);
  updateChargers(dt, ship);
  updateShooters(dt, ship);
  updateEBullets(dt);
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) bullets.splice(i, 1);
  }
  /* bullets vs boss: segments block, the gap lets shots hit the core */
  if (boss && boss.state !== "dying") {
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const d = Math.hypot(b.x - boss.x, b.y - boss.y);
      if (d < 64) {
        if (segmentBlocks(boss, b.x, b.y)) {
          bullets.splice(j, 1);
          burst(b.x, b.y, "#b06cff", 5, 140);
        } else if (d < boss.r + 6) {
          bullets.splice(j, 1);
          burst(b.x, b.y, "#ffe14d", 8, 180);
          damageBoss(boss, 1, bossHooks());
        }
      }
    }
    /* flying into the boss hurts, like a rock */
    if (boss.state === "fight" && ship.invuln <= 0
        && dist2(ship.x, ship.y, boss.x, boss.y) < (boss.r + ship.r) * (boss.r + ship.r)) {
      hitShipByEnemy(null, null, null);
    }
  }
  /* bullets vs chargers / shooters (hp 2, score 150) */
  for (const arr of [chargers, shooters]) {
    const scoreFor = arr === chargers ? chargerScore : shooterScore;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      let destroyed = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + 4) * (e.r + 4)) {
          bullets.splice(j, 1); e.hp--;
          burst(b.x, b.y, "#7df9ff", 6, 160);
          if (e.hp <= 0) {
            arr.splice(i, 1); kills++;
            burst(e.x, e.y, "#ff9f43", 18, 260);
            sfx.boom(); shake = Math.min(10, shake + 4);
            addScore(scoreFor(), e.x, e.y);
            destroyed = true; break;
          }
        }
      }
      if (destroyed) continue;
      if (ship.invuln <= 0 && dist2(ship.x, ship.y, e.x, e.y) < (e.r + ship.r - 4) * (e.r + ship.r - 4)) {
        hitShipByEnemy(arr, e, null);
      }
    }
  }
  /* enemy bullets vs ship: same damage as a rock hit, then destroyed */
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    if (ship.invuln <= 0 && dist2(ship.x, ship.y, b.x, b.y) < (b.r + ship.r - 2) * (b.r + ship.r - 2)) {
      eBullets.splice(i, 1);
      hitShipByEnemy(eBullets, b, () => {}); /* already removed above */
    }
  }
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    let destroyed = false;
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (dist2(b.x, b.y, r.x, r.y) < (r.r + 4) * (r.r + 4)) {
        bullets.splice(j, 1); r.hp--;
        burst(b.x, b.y, "#7df9ff", 6, 160);
        if (r.hp <= 0) { breakRock(i); destroyed = true; break; }
      }
    }
    if (destroyed) continue;
    if (ship.invuln <= 0 && dist2(ship.x, ship.y, r.x, r.y) < (r.r + ship.r - 4) * (r.r + ship.r - 4)) {
      hitShip(r);
    }
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    /* gentle pickup assistance: magnet pull (upgraded by Star Magnet) */
    const dx = ship.x - o.x, dy = ship.y - o.y, d = Math.hypot(dx, dy);
    if (d < upg.magnetRadius && d > 1) { o.x += (dx / d) * upg.magnetSpeed * dt; o.y += (dy / d) * upg.magnetSpeed * dt; }
    if (d < (ship.r + o.r + 8)) {
      orbs.splice(i, 1);
      collectStar(o);
    }
  }
  updateFx(dt);
}
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); }
  /* Floats rise but never cross into the reserved tutorial band (110–165):
     they pin at y=172 and fade there. */
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.y -= 34 * dt; if (f.y < 172) f.y = 172; f.life -= dt; if (f.life <= 0) floats.splice(i, 1); }
}

/* ---------- draw ---------- */
function draw() {
  drawGame({
    ctx, state, score, hiScore, lives, combo, comboTimer, bestCombo,
    shieldTimer, muted, ship, bullets, rocks, orbs, chargers, shooters, eBullets,
    parts, floats, stars, boss, bossReached, sectorTime, upgradeOffer,
    constellation, tutorialActive, tutorialStep, constellationsCompleted,
    kills, starsGot, shotsFired, timePlayed, shake, flash, detPulse, sector,
    reducedFx, finalStats, banner: bannerCurrent
  });
}

/* ---------- input wiring (listeners registered once, at load) ----------
   doTogglePause / doToggleMute / doRestart are the single implementations
   shared by the keyboard (P/M/R) and the on-screen touch buttons, so the
   two routes can never drift apart. */
function doTogglePause() {
  if (state === "playing") state = "paused";
  else if (state === "paused") state = "playing";
}
function doToggleMute() {
  muted = !muted;
  if (typeof setMuted === "function") setMuted(muted);
}
function doRestart() {
  if (state === "over" || state === "paused" || state === "victory") { resetGame(); state = "playing"; }
}
initInput(cv, {
  unlockAudio() { audio(); },
  isPlaying() { return state === "playing"; },
  fire() { if (state === "playing") fire(); },
  toggleMute() { doToggleMute(); },
  toggleFx() {
    reducedFx = !reducedFx;
    announce(reducedFx ? "REDUCED EFFECTS ON" : "FULL EFFECTS ON", "#00e5ff");
  },
  togglePause() { doTogglePause(); },
  restart() { doRestart(); },
  isUpgrade() { return state === "upgrade"; },
  onUpgradeSelect(i) { selectUpgrade(i); },
  confirm() {
    if (state === "title") { audio(); resetGame(); state = "playing"; }
    else if (state === "over" || state === "victory") { resetGame(); state = "playing"; }
  },
  /* Title / results: T key or the PLAY TUTORIAL button replays the
     tutorial. Ignored in every other state. */
  startTutorial() {
    if (state === "title" || state === "over" || state === "victory") {
      audio(); resetGame("tutorial"); state = "playing";
    }
  },
  isTitle() { return state === "title"; },
  /* Results-screen button rects for click hit-testing (null elsewhere). */
  resultsRects() {
    if (state === "over") return resultsButtonRects("over");
    if (state === "victory") return resultsButtonRects("victory");
    return null;
  },
  onBlur() { if (state === "playing") state = "paused"; }
});

/* On-screen touch buttons (index.html #touch-ui, shown only once a touch
   has been detected via body.touch). Each tap also calls audio() so the
   first button tap unlocks iOS audio just like a canvas touch does. */
(function wireTouchButtons() {
  const btnPause = document.getElementById("btn-pause");
  const btnMute = document.getElementById("btn-mute");
  const btnRestart = document.getElementById("btn-restart");
  if (btnPause) btnPause.addEventListener("click", () => { audio(); doTogglePause(); });
  if (btnMute) btnMute.addEventListener("click", () => {
    audio(); doToggleMute();
    btnMute.classList.toggle("muted", muted);
  });
  if (btnRestart) btnRestart.addEventListener("click", () => { audio(); doRestart(); });
})();

/* ---------- main loop ---------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (hitStop > 0) { hitStop -= dt; draw(); requestAnimationFrame(loop); return; } /* hit-stop freeze */
  update(dt); draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
