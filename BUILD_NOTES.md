# STARFALL: CONSTELLATION BREAKER — Build Notes

Milestones A + B + C. Single self-contained browser game: open
`game/index.html` directly (file:// works, no build step, no network
requests, no external assets, no remote services). Audio is WebAudio
synth only, and only after a user gesture; M toggles mute (sfx +
soundtrack); G toggles reduced effects.

## How to run

```sh
node main.ts
# then open game/index.html in a desktop browser
```

## Controls

- Arrows / WASD or mouse — fly (mouse glides the ship when no movement
  keys are held)
- Space / click (hold) — shoot
- P — pause · M — mute · G — reduced effects · R — restart (from pause, defeat, victory)
- Upgrade screen: click a card or press 1 / 2 / 3
- Click or Space — launch from the title screen; play again from
  defeat / victory
- T — play / replay the tutorial (title screen, defeat, victory); the
  title screen also has a ▶ PLAY TUTORIAL button, and the results
  screens have RETRY (R) and TUTORIAL (T) buttons. Retries skip the
  tutorial once it was completed once. Version v1.2.

## UI fixes v1.2 — pickup labels, tutorial prompt, version (2026-11-18)

- **Fix A — overlapping star pickup labels**: `collectStar()` in
  `game/src/main.js` used to add two floats per pickup — `"STAR ×n"` at
  the pickup point plus `"ANCHOR n/3"` 26px above it (and a third
  `"SHIELD!"` float at the ship on every 5th star in a row). Both rose
  at the same speed and pinned at y=172, so they drew over each other.
  Now each pickup produces exactly ONE compact float:
  `"STAR ×n · ANCHOR n/3"`, `"STAR ×n · TRIANGLE READY"`, or
  `"STAR ×n · TOO CLOSE — TRY ANOTHER STAR"` (rejected anchors), with
  `" · SHIELD!"` appended on the 5th-star shield. As a second guard,
  `addFloat()` shifts a new float down in 26px steps while it would land
  within 24px vertically of a live float, and clamps x so long lines
  never clip off the screen edges. Numbered anchors, the highlighted
  return ring, and the closure countdown are untouched.
- **Fix B — contradictory tutorial instructions**: after the 3rd star
  the HUD said "RETURN TO CLOSE" while the tutorial prompt still said
  "COLLECT 3 STARS" (the `tutorialStep` counter only flipped on the
  frame after the pickup). Both now derive from the same state —
  `constellation.anchors.length === 3` — and use the same words:
  HUD `"RETURN TO ANCHOR 1 — Ns"`, tutorial prompt
  `"RETURN TO ANCHOR 1"`. `drawTutorialPrompt()` in `game/src/render.js`
  overrides the step-based prompt whenever 3 anchors are armed, so the
  return prompt appears on the very frame the triangle arms; `collectStar()`
  also sets `tutorialStep = 3` on that frame. Expiry (`CONSTELLATION
  LOST`) and successful closure both drop the anchor count below 3, so
  the return prompt clears and the next instruction (collect again, or
  the sector countdown after the tutorial closes) shows correctly.
  Tutorial completion still moves into Sector 1 with the full 60s
  timer: `sectorTime` only accumulates outside the tutorial, so it is 0
  when the tutorial closes.
- **Version bump**: `VERSION = "v1.2"` in `game/src/audio.js` (title
  screen + HUD corner). README boss line corrected to the current build:
  45 HP, Phase 2 at 22 HP.

## Polish pass v1.1 — results timer, message zones, sector countdown, retry/tutorial, version (2026-11-17)

### Results timer (fix A)
Why: the results clock was wrong — it read 45s at death and 47s two
seconds later on the open results screen.
- **Cause**: `update()` in `game/src/main.js` started with
  `timePlayed += dt` *before* the `if (state !== "playing")` early
  return, so the clock kept growing while the results screen was open
  and while paused. `drawOver`/`drawVictory` also read live
  `G.timePlayed`.
- **Fix**: `gameOver()` and `victory()` capture an immutable
  `finalStats` snapshot exactly once (guarded — repeated terminal
  events never overwrite the first snapshot): score, hiScore,
  constellationsCompleted, bestCombo, starsGot, kills, timePlayed
  (floored to whole seconds at capture), shotsFired, sector,
  bossReached. Both results screens render only from that snapshot.
  `update()` now runs only cosmetics (star drift, flash/shake decay,
  detonation pulse, particles/floats) outside `"playing"`; `timePlayed`
  and `comboTimer` advance only in the playing path, so sector time,
  spawning, scoring, damage, pickups and progression all stop when the
  run ends, and the clock does not grow while paused or on the upgrade
  screen.
- **Mission time** = active play *including* the tutorial (it is active
  play), *excluding* pause / upgrade selection / results. Labelled
  "Mission time" (mm:ss) on both the defeat and victory screens
  (replaces "Time survived").

### Message zones (fix B)
Why: big floating texts ("STAR ×N", "TRIANGLE READY — RETURN!",
"CONSTELLATION LOST", "+1 LIFE", sector banners, boss warnings) could
overlap the tutorial prompt (y≈128/152) and each other.
- **Zones**: HUD strip 0–96 as before; tutorial instructions keep a
  reserved band (~110–165) no other message may enter; all large center
  announcements go through a single banner slot — one at a time in a
  fixed pill at y 196–236, ~1.6s each, FIFO queue (`announce()` in
  `main.js`, `drawBanner()` in `render.js`), consecutive duplicates
  dropped, queue capped at 4. Sector transitions, CONSTELLATION LOST,
  +1 LIFE, upgrade picks, BOSS WARNING, PHASE 2, BOSS DESTROYED,
  TRIANGLE READY and CONSTELLATION CLOSED all use it.
- **TRIANGLE READY float removed** (was redundant with the HUD
  countdown + the gold RETURN label on anchor 1); it now goes through
  the banner once.
- **Small floats** (score, STAR ×N, ANCHOR n/3, BLOCKED, SHIELD!) stay
  near their gameplay event, small size, clamped to y ≥ 172 and pinned
  there while rising, so they never enter the HUD strip, the tutorial
  band, or the closure countdown (HUD y=80).
- Banner is text-only, so it stays legible at normal and reduced-effects
  settings; reduced effects never hides essential text.

### Sector countdown (fix C)
- HUD now reads `SECTOR 1 / 3 — 00:42 REMAINING` (mm:ss of
  `60 − sectorTime`, the real sectorTime that drives the transition),
  `SECTOR 1 / 3 — TUTORIAL` during the tutorial, and `BOSS` with the
  existing health bar + phase label during the boss.
- Progress bar widened 140px → 220px, thicker (6 → 10px) with a
  stronger border.
- Transition condition unchanged (`sectorTime >= 60`, advances once,
  upgrade screen once, `clearHazards()` on transitions so the player
  cannot take an unfair hit while choosing); sector announcements go
  through the banner queue. `sectorTime` still accumulates only while
  playing with the tutorial finished.

### Retry vs tutorial (fix D)
- Tutorial completion is remembered in localStorage key
  `starfall-tutorial-done` (try/catch — if storage throws, an
  in-memory flag covers the current page session; never crashes), set
  when the tutorial constellation closes.
- `resetGame(mode)`: `"tutorial"` forces the playable tutorial,
  `"normal"` forces a direct mission, omitted auto-picks tutorial on
  first launch and a direct mission on retries once the tutorial was
  completed once. A direct mission has normal star spawning from the
  start, no tutorial rocks or prompts.
- Title screen: drawn `▶ PLAY TUTORIAL (T)` button (shared
  `titleTutorialButtonRect()` for drawing + click hit-testing) next to
  the normal launch; click elsewhere or Space launches as before.
  Results screens (defeat and victory): drawn `RETRY (R)` and
  `TUTORIAL (T)` buttons (shared `resultsButtonRects()`); R / Space /
  click retries, T replays the tutorial.
- **Behaviour change — reducedFx now persists across retries**: v1.1
  removes the `reducedFx = false` reset from `resetGame()` (before
  v1.1 a restart restored full effects). Mute persists as before, and
  personal best (hiScore, localStorage) is untouched.
- A fresh mission still resets score, lives, enemies, projectiles,
  anchors, combo, sector progress, boss state and upgrades.
- `resetGame()` clears held input (`keys` + `Input.mouseDown`) so the
  restart press cannot fire a bullet or choose an upgrade on the first
  frame (the existing `isPlaying()` guard in `input.js` covers the
  Space keydown case).

### Version (fix I)
- `VERSION = "v1.1"` in `game/src/audio.js` (shared constants), drawn
  small and subtle in the HUD bottom-right corner (every state) and at
  the bottom-right of the title panel. Used consistently here too. No
  external URLs added anywhere.

## Milestone C — balance, soundtrack, effects, readability, robustness (2026-11-17)

### Balance (the priority)
Why: the Milestone B play-test (7 full runs, competent automated
player) showed the run's cliff was S2→S3 — the player entered Sector 3
with 1 life and S3's density killed it in ~14s, before the boss. The
fix attacks both sides: less density, more margin.
- **Sector 2** — rocks 1.6s/max 18 → **1.9s/max 14**; chargers every
  12s → **16s**.
- **Sector 3** — rocks 1.2s/max 22 → **1.6s/max 16**; chargers every
  12s → **16s**; shooters every 15s → **20s**.
- **Sector 1 unchanged** (2.2s/max 12) — still gentle. Ramp is now
  S1 gentle → S2 noticeably harder → S3 hardest → boss climax, with no
  cliff between S1 and S2.
- **Rock fall speed capped lower** — spawn bonus was
  `(sector-1)*25 + min(40, timePlayed*0.1)` (up to +90 in S3); now
  `(sector-1)*20 + min(30, timePlayed*0.08)` (up to +70). Spawn
  interval decay also softened (`timePlayed*0.004` → `*0.003`, floor
  0.9s instead of 0.8s).
- **+1 life (cap 5) on every sector clear** — granted in
  `selectUpgrade` (after S1 and S2) and in `startBoss` (life refill
  before the boss). A player who starts a sector with 1 life reaches
  the boss with 4; a player who plays reasonably reaches it with 2–3.
- **Boss unchanged** — still 90 HP, rotating 1.15-rad gap, +20
  enclosure damage, 2 phases (P2 at hp ≤ 45). DPS sanity (simulated
  competent player, real boss code, gap-window firing with 0.25s bullet
  travel): **45.0s** to kill with 2 constellation enclosures,
  **71.0s** on bullets alone. That is a perfect-aim lower bound;
  human dodging and aim error push a real fight toward 60–120s, so the
  boss is not trivial and needed no change.

### Balance follow-up — shooter softening (2026-11-17, after the Milestone C play-test)
Why: the Milestone C build was play-tested twice (full runs, competent
automated player). Both runs reached Sector 3 but died there at ~31–33s,
before the boss — the player entered S3 with 2 lives and lost them to
rocks + shooter eBullets. The shooters were the sharpest S3 threat, so
only they were softened; S1/S2, the life grants, and the boss are untouched.
- **Shooter eBullets 180 → 150 px/s** (`updateShooters` in
  `game/src/enemies.js` now passes 150 to `spawnEBullet`). The boss's
  aimed and radial bullets still travel at 180.
- **Shooter fire interval 2.5s → 3.0s** (`s.fireT = 3.0` after firing).
  The shooter still telegraphs with the same 0.4s charge-up flash.
- **Nothing else changed** — S3 rocks stay 1.6s/max 16, chargers stay
  every 16s, shooters still spawn every 20s (max 2), shooter hp 2 /
  150 pts unchanged, boss unchanged (90 HP, 1.15-rad gap, +20
  enclosure, P2 at hp ≤ 45).

### Balance follow-up — boss HP 90 → 60 (2026-11-17, after 5 boss fights)
Why: the shooter-softened build was play-tested 5 more times (full runs).
The boss was reached in all 5 and the enclosure/stagger mechanic was
verified twice (+20 damage, stagger), but the boss was never beaten:
the automated player deals ~1–30 damage per boss fight (1 enclosure +
bullets) before dying, and 90 HP needs ~4–5 enclosures. A human who
deliberately builds triangles around the boss would do better, but the
fight as tuned is too long for ordinary play. Only the HP changed.
- **Boss HP 90 → 60** (`BOSS_MAX_HP` in `game/src/boss.js`).
  **Phase 2 now at hp ≤ 30** (`BOSS_PHASE2_HP`, half of 60, same ratio).
- **Nothing else changed** — 5 rotating segments, 1.15-rad gap, ring 48,
  core 26, +20 enclosure damage, 1.5s stagger, boss bullets still 180,
  P1/P2 attack patterns unchanged. 3 enclosures (3 × 20) now kill it,
  or 2 enclosures + bullets; the fight should land in the ~60–120s range.

### Balance follow-up — boss HP 60 → 45 (2026-11-18, after 37 full runs, 0 wins)
Why: the 60-HP build was play-tested 27 times in Milestone C/D plus 10
more times in the v1.1 polish pass (37 runs total, 0 legitimate wins).
The boss was reached 11 times; staggers and phase 2 are verified, but
the best run got the boss to 11 HP (of 60) and the best v1.1 run to
15 HP (of 60) with 1 stagger + ~25 bullet damage before dying in phase
2. The fight lasts ~60–75s of sustained fire while dodging dense
phase-2 eBullets; ordinary shooting DPS is too low to finish 60 HP
before the player's lives run out. A human who deliberately builds
triangles around the boss would do better, but the acceptance bar is
"beatable by ordinary play". Only the HP changed.
- **Boss HP 60 → 45** (`BOSS_MAX_HP` in `game/src/boss.js`).
  **Phase 2 now at hp ≤ 22** (`BOSS_PHASE2_HP`, half of 45, same ratio).
- **Nothing else changed** — 5 rotating segments, 1.15-rad gap, ring 48,
  core 26, +20 enclosure damage, 1.5s stagger, boss bullets still 180,
  P1/P2 attack patterns unchanged. 2 enclosures + ~5 bullets now kill
  it, or 1 enclosure + sustained fire; the v1.1 run that reached 15 HP
  would have won at 45. The fight should land in the ~45–90s range.
  This is a documented balance decision; Bruce may veto it (revert to
  60/30) — it is not a hidden change.

### Balance follow-up — boss ring gap 1.15 → 1.8 rad, slower rotation (2026-11-18)
Why: after the HP cut, 10 more full runs (runs 11–20, 0 wins) plus 2
runs with an improved test driver (attack runs that fly at the boss
with lead-aim on its drift, committed through the gap's rotation)
showed the bottleneck is damage throughput, not the HP total. Across
22 boss fights, ordinary shooting dealt 0–5 HP per 60–90s fight; the
latest run landed 0 bullet hits in ~48s despite 54 attack-run ticks
with lead-aim. The 1.15-rad gap (18% of the ring) on a drifting boss
admits almost no bullets, so the +20 stagger is the only reliable
damage and it lands 0–2 times per fight. The spec's own bar is
"ordinary shooting can still finish the boss" — the tuning failed it.
- **Ring gap 1.15 → 1.8 rad** (`BOSS_SEG_GAP` in `game/src/boss.js`,
  18% → 29% of the ring; the gap arc at r=48 is now ~86px wide).
  **Ring rotation 0.55 → 0.45 rad/s (P1), 0.95 → 0.75 rad/s (P2)**.
- **Nothing else changed** — 45 HP, phase 2 at hp ≤ 22, 5 segments,
  ring 48, core 26, +20 enclosure damage, 1.5s stagger, boss bullets
  still 180, P1/P2 attack patterns unchanged. The boss still has to be
  shot through the gap (segments still block); the gap is simply wide
  and slow enough that aimed fire lands. This is a documented balance
  decision; Bruce may veto it (revert to 1.15 / 0.55 / 0.95).

### Soundtrack
- Quiet evolving loop in `audio.js`: Am–F–C–G bass/pad arpeggio,
  eighth notes at ~100 BPM, soft triangle bass (vol 0.05) + sine pad
  tones (vol 0.016), via a 120ms lookahead scheduler — well under the
  sfx. Starts only after the first user gesture (`audio()` is only
  called from gesture-driven paths); keeps playing across sectors,
  pause, and restarts.
- **Mute (M)** silences everything: `tone()` early-returns when muted
  and `setMuted()` drives the soundtrack's own gain node to 0; it
  stays muted until toggled again.

### Effects
- Existing juice kept (thrust flame, impact/fragmentation bursts,
  pickup animation, constellation build/detonation pulse, sector
  banners, boss arrival/destruction). Hit-stop stays ~80ms, hit
  flashes brief, screen shake modest and bounded.
- **Reduced effects (G)** — cuts screen shake to 8% and flash to 10%
  (applied at the single point where they reach the screen, in
  `drawGame`) and halves particle counts (in `burst()`). HUD shows
  `REDUCED EFFECTS (G)` bottom-left while active; title, pause, and
  footer hints document the key. Persists across retries since v1.1
  (before v1.1 a restart restored full effects); mute and the
  soundtrack persist across restarts.
- **Bounds enforced** — particles capped at 400 (oldest dropped),
  player bullets capped at 60, floats capped at 30, enemy bullets
  already capped at 40.

### Readability
- HUD now sits over a dark top scrim (gradient to transparent at
  y≈96) so score/sector/constellation text stays legible over bright
  nebulas and particles.
- Floating score text gets a dark outline and is clamped to y ≥ 100 so
  floats never collide with the HUD.
- **Boss bar moved down** (y=104 → 124) — it previously collided with
  the HUD combo line at y≈102 when a triangle was ready during the
  boss.
- Enemy bullets (magenta diamonds) now have a white outline on top of
  the pale core, still clearly distinct from cyan player bullets.
- Charger telegraph strengthened: brighter, thicker dashed aim line
  plus a pulsing ring at the locked aim point. Boss P2 radial wind-up:
  thicker ring plus an expanding gold inner ring.
- Palette unchanged (cyan/magenta/deep-space).

### Performance / robustness
- `dt` still clamped at 0.05s; frame-rate independent loop unchanged.
- **Resize-safe**: canvas CSS now uses
  `width: min(96vw, 960px, calc(92vh * 1.5))` with
  `aspect-ratio: 960 / 640`, so the 960×640 internal resolution never
  distorts when the window resizes; HUD/controls are canvas-drawn and
  scale with it.
- Focus loss still pauses and clears held keys (verified in tests);
  listeners still registered once via `initInput` (verified: a second
  `initInput` call registers nothing); repeated restarts cannot
  accelerate the game or duplicate loops.
- `resetGame` no longer resets reduced effects (it persists across
  retries since v1.1); it already cleared lives, score, sector,
  upgrades, boss, enemies, particles, floats, and shield. Closure timer
  still freezes on pause and on the upgrade screen (re-verified in tests).

## The run (Milestone B, balance updated in C)

- **Sector 1** — tutorial (fly, shoot, collect 3 stars, return to the
  first anchor) + 60s of play. Rocks only, spawn ~2.2s, max 12.
- **Sector 2** — faster rocks (~1.9s, max 14) + charging enemies
  (one every ~16s, max 2 on screen). +1 life on clear.
- **Sector 3** — fastest rocks (~1.6s, max 16) + chargers (every ~16s)
  + orbiting shooters (one every ~20s, max 2 on screen). +1 life on
  clear, then +1 life again before the boss.
- **Boss** — after Sector 3 ends: a WARNING banner, the boss enters
  from the top over ~2s, then the fight. Destroy it for the victory
  screen.
- Sector time accumulates only while state is `playing` and the
  tutorial is finished. Entering a new sector clears rocks, chargers,
  shooters and enemy bullets, resets spawn timers, and shows a banner
  announcement. The HUD shows `SECTOR n / 3 — mm:ss REMAINING` (or
  `TUTORIAL` during the tutorial) plus a progress bar for
  sectorTime/60; during the boss it reads `BOSS`.
- No spawns on top of the player: rock/charger/shooter spawn x is at
  least 120px from the ship's x.

## Constellation (Milestone A, unchanged in B)

- Collect star orbs (+50 × combo, combo lasts 4s, best combo tracked).
  Each star drops an anchor; 3 anchors form a triangle.
- Return inside the pulsing gold ring around anchor 1 (radius 46px)
  within the closure timer (8s) to detonate: everything inside the
  triangle is destroyed, +250 base score + 50 per enemy caught (+ the
  enemy's own score). A 4th star while the triangle is ready gives
  score/combo only — never a 4th anchor.
- Degenerate triangles are refused: anchors closer than 70px
  ("TOO CLOSE") or near-collinear (area < 1200, "TOO STRAIGHT") keep
  progress and only cost the star's anchor.
- The closure timer decrements only in the `playing` path, so it
  freezes on pause and on the upgrade screen.
- Detonation also kills chargers and shooters inside the triangle
  (+150 each, as with rocks) and fizzles enemy bullets inside it.
  Enclosing the boss core deals +20 damage and staggers it ~1.5s.

## Enemies

- **Rocks** — big (hp 3, 100 pts) split into 2 medium (hp 2, 60 pts),
  medium split into 2 small (hp 1, 30 pts).
- **Chargers** (150 pts, hp 2) — orange/red diamond. Enter drifting
  down (~1s), telegraph ~0.9s (flash + dashed aim line, aim tracks the
  ship but locks in the last 0.2s), charge ~520 straight for ~0.7s,
  recover drifting slowly ~1s, then telegraph again.
- **Orbiting shooters** (150 pts, hp 2) — purple orbiter. Enter from
  the top, settle into a slow circular orbit around a fixed centre in
  the upper half, fire an aimed shot every ~3.0s after a 0.4s
  charge-up flash. Their bullets travel at 150 px/s (the boss's
  bullets are faster, 180 px/s).
- **Enemy bullets** — magenta/red diamonds, 150 px/s from shooters /
  180 px/s from the boss, capped at 40,
  despawn off-screen or after ~4s. Not shootable. Damage the ship
  exactly like a rock hit (lose a life, 2.2s invulnerability with
  blinking, combo reset), then destroyed. The shield blocks them.
- 3 lives; a hit gives 2.2s invulnerability. Every 5th consecutive
  star gives a 5s shield (blocks one hit). Nothing can kill the player
  during the tutorial.

## Upgrades

After Sector 1 and Sector 2, the game freezes on an upgrade screen:
3 cards drawn at random from the 6 not yet taken (never offered
twice). Each card shows name, one sentence, and the exact effect.

| Upgrade | Effect |
| --- | --- |
| Twin Shot | Two parallel bullets, offset ±8px perpendicular to aim |
| Rapid Fire | Fire cooldown 0.16s → 0.096s |
| Star Magnet | Magnet radius 90 → 180, pull speed 90 → 160 |
| Extended Closure | New triangles get a 12s closure timer (running triangles keep theirs) |
| Constellation Amplifier | Detonation base bonus 250 → 400 |
| Emergency Shield | Shield timer set to 12s on pick |

After choosing, the next sector starts (sector++, sectorTime = 0,
hazards cleared). P does not pause on the upgrade screen; M still
mutes.

## Boss

- 45 HP (reduced from 60 on 2026-11-18 — see "Boss HP 60 → 45" above;
  originally 90),
  hovers in the upper 40% drifting side to side (sinusoidal),
  never sits on the player. Core radius ~26, surrounded by 5 rotating
  protective arc segments with one rotating gap: bullets hitting a
  segment are destroyed (no damage); shots through the gap hit the
  core for 1 damage.
- **Phase 1** — slow aimed shots (0.5s charge flash, then a 2–3 shot
  burst) + an occasional rock.
- **Phase 2** (hp ≤ 22) — brief stagger + "PHASE 2" banner, faster
  aimed shots, a telegraphed radial burst (8 bullets, 0.7s wind-up
  with a visible ring), faster drift and segment rotation, more rocks.
- Enclosing the core in a constellation triangle: +20 damage and a
  ~1.5s stagger (stops attacking/moving, segments stop rotating,
  core flashes). A star orb spawns every ~4s during the boss so
  triangles are always buildable; rocks keep spawning slowly.
- Health bar at the top of the screen (under the HUD) with a `BOSS`
  label and phase indicator.
- At hp ≤ 0: ~2s destruction sequence (particle bursts, shake,
  flash, no attacks), then the victory screen.

## Victory / defeat / restart

- **Victory** — title `VICTORY`, final score, sector reached `BOSS`,
  constellations completed, best combo, personal best. Personal best
  is saved to localStorage exactly as on defeat. Click or Space plays
  again.
- **Defeat** — the existing game-over screen; "Sector reached" shows
  `BOSS` when the player dies during the boss.
- Restart (R / Space / click) from victory, defeat, or pause fully
  resets: score, lives, combo, upgrades, sector = 1, sectorTime = 0,
  boss removed, chargers/shooters/enemy bullets cleared, constellation
  reset, held input cleared. Since v1.1 a retry goes straight into a
  fresh mission (no tutorial) once the tutorial was completed once;
  T (or the on-screen button) replays the tutorial instead. Listeners
  are registered once at load (in `initInput`); `resetGame` registers
  none, so repeated restarts never duplicate listeners or accelerate
  the game.

## States

`title | playing | paused | upgrade | victory | over`

## Architecture

Classic scripts, loaded in order by `game/index.html` (`defer`),
one clear job per module; direct file:// opening works.

| File | Job |
| --- | --- |
| `game/src/audio.js` | Shared constants (W=960, H=640, TAU, rand, clamp, dist2) + WebAudio synth sfx |
| `game/src/constellation.js` | Constellation geometry: anchors, degenerate checks, closure timer (per-triangle override for Extended Closure), `pointInTriangle` |
| `game/src/upgrades.js` | Upgrade pool (6), random draw of 3 untaken, apply functions on a plain state object, shared `upgradeCardRect(i)` layout |
| `game/src/input.js` | Keyboard/mouse state, focus-loss pause; routes clicks and keys 1/2/3 to `onUpgradeSelect` on the upgrade screen; T key + title/results button hit-testing for tutorial replay; listeners registered once via `initInput` |
| `game/src/enemies.js` | Rocks/orbs arrays + spawning/movement; chargers, shooters, enemy bullets (`spawnCharger`, `spawnShooter`, `spawnEBullet`, `updateChargers`, `updateShooters`, `updateEBullets`) |
| `game/src/boss.js` | Boss state/logic (`createBoss`, `updateBoss`, `damageBoss`, `staggerBoss`, `segmentBlocks`) and drawing (`drawBoss`) |
| `game/src/render.js` | All canvas drawing from one state object `G`: background, ship, enemies, boss + health bar, HUD (sector countdown + progress bar, version), announcement banner, tutorial prompts, title / pause / upgrade / victory / game-over panels (title + results buttons) |
| `game/src/main.js` | State machine, game loop (dt-based, `requestAnimationFrame`, hit-stop), tutorial, combat, sectors, upgrade flow, boss fight, reset; results snapshot, banner queue, mission clock |

`vendor/makefun-game.ts` is unchanged (sha256 matches the kit copy).
`.makefun/owner.json` is kept. `screenshots/` is intentionally empty
(screenshots are captured by real browser play-testing, never
fabricated).

## Validation (Milestone C, 2026-11-17)

- `node --check` passes on all 8 `game/src/*.js` files.
- Unit + integration checks (`/tmp/test_milestoneC.js`, vm harness
  loading all sources as the browser does, stubbed DOM/canvas/
  AudioContext): **53 passed, 0 failed** — sector configs (S1 2.2/12,
  S2 1.9/14/16, S3 1.6/16/16/20); S3 rock speed max vy 155.6 over 7
  sampled rocks (cap 160, old cap 180); +1 life per sector clear and
  before the boss, cap 5 (a 1-life player reaches the boss with 4);
  boss DPS sim 45.0s with 2 enclosures / 71.0s bullets-only, boss
  still 90 HP / P2 at 45 / 1.15-rad gap; G toggles reduced effects
  (particles 20→10, first-translate shake 4.78→0.37, flash alpha
  0.25→0.025); particles capped at 400, bullets at 60, floats at 30
  and clamped below the HUD; muted sfx creates 0 oscillators, unmuted
  creates them, M toggles both ways; soundtrack schedules 64 notes in
  400ms unmuted and 0 while muted; canvas aspect-ratio CSS present;
  blur clears held keys + mouseDown and pauses; second `initInput`
  registers 0 new listeners; restart resets lives/score/sector/boss/
  upgrades/shield/parts/floats/shake/flash/hitStop and restores full
  effects, re-arms the tutorial; closure timer frozen on upgrade and
  pause, ticking while playing; `draw()` runs in all 6 states and with
  the boss fighting.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` — exit 1, fails only on the
  (intentionally empty) screenshots:
  `Starfall check FAILED: - expected 3 or 4 screenshots in screenshots/, found 0`.
- No-network grep on `game/` (`https?://|fetch(|XMLHttpRequest|
  WebSocket|import(|from '"http`): zero matches.
- `game/` is 77,367 bytes, 9 files; `game/index.html` 1,786 bytes
  (limits: index.html ≤ 1 MiB, game/ ≤ 48 MiB and ≤ 993 entries).
- Browser play-testing (full-run beatability, boss fight +
  victory/defeat/restart, mute, reduced effects, resize, focus loss,
  repeated restarts) is still to be done by the main agent — not
  covered by the automated checks above.

## Validation (Milestone B, 2026-11-17)

- `node --check` passes on all 8 `game/src/*.js` files.
- Unit checks (`/tmp/test_units.js`, not in the repo): 34 passed,
  0 failed — each upgrade applies exactly its stated effect; the
  draw always offers 3 distinct untaken upgrades (200 draws);
  per-triangle 12s closure timer, default still 8s; 4th anchor still
  refused; boss phase transition at hp ≤ 45, stagger freeze,
  segment gap/blocking, P1 aimed burst (2 shots), P2 radial burst
  (8 bullets), enter → fight in ~2s.
- Integration checks (`/tmp/test_integration.js`, vm harness loading
  all sources concatenated as the browser does, stubbed DOM/canvas):
  44 passed, 0 failed — sector advances at 60s with the upgrade
  screen after S1 and S2 (second offer excludes the first pick),
  boss after S3; closure timer frozen in `upgrade` and `paused`,
  ticking in `playing`; charger enter → telegraph → charge (~520) →
  recover; shooter fires enemy bullets; eBullets capped at 40;
  fair spawn keeps 120px from the ship; triangle enclosing the boss
  core deals +20 and staggers; phase 2 at hp 45; ~2s destruction →
  victory with hiscore saved; restart clears upgrades/boss/sector/
  enemy arrays and re-arms the tutorial; second `initInput` adds no
  listeners; a 200s soak of live play (auto-fire, steering,
  auto-picked upgrades) throws nothing and keeps arrays bounded;
  `draw()` runs without throwing in every state, with and without
  the boss.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` — expected to fail only on
  the (intentionally empty) screenshots; see the handoff for the
  exact result.
- Browser play-testing (sectors, upgrade screens, boss
  beatability, victory/defeat/restart) is still to be done by the
  main agent — not covered by the automated checks above.

## Validation (polish pass v1.1, 2026-11-17)

- `node --check` passes on all 8 `game/src/*.js` files.
- Unit check (`/tmp/test_polish_v11.js`, vm harness loading all sources
  as the browser does, stubbed DOM/canvas/localStorage): **46 passed,
  0 failed** — `formatMmSs` cases (00:00 / 00:05 / 00:42 / 01:00 /
  02:05 / negative → 00:00) and `VERSION === "v1.1"`; snapshot captures
  score/kills/stars/combo and floors timePlayed, snapshot-once guard
  holds on a second `gameOver()`/`victory()`; `timePlayed` advances
  while playing and is frozen on the results screen, while paused, and
  on the upgrade screen (comboTimer frozen while paused too); banner
  drops consecutive duplicates, queue capped at 4, FIFO advance after
  1.6s; floats clamped to y ≥ 172 and pinned at the band floor while
  rising; tutorial flag fresh/absent → tutorial on first launch,
  `markTutorialDone()` persists `starfall-tutorial-done=1`, stored flag
  → first launch is direct, explicit `"tutorial"`/`"normal"` modes;
  `reducedFx` persists across `resetGame()`; held keys + `mouseDown`
  cleared on reset; title tutorial button and results buttons
  in-canvas; real input wiring — T on title/defeat replays the
  tutorial, click on the tutorial button replays it, click elsewhere on
  the title launches a direct mission, R on defeat retries direct;
  `draw()` runs without throwing in all 6 states with a snapshot and a
  banner present.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` → exit 0, "Starfall check OK
  — out/ written." (3 screenshots; `out/` removed afterwards).
- No-network grep on `game/` (`fetch(|XMLHttpRequest|WebSocket|
  import(|https?://`): zero matches.
- Required strings STARFALL / GAME OVER / SECTOR / CONSTELLATION all
  present in `game/`.
- `vendor/makefun-game.ts` unchanged (md5
  2da03e097f2d64ae65e3d1c3586e652a); `.makefun/owner.json` kept;
  `screenshots/` untouched (still the 3 Milestone D shots).
- Browser play-testing of the new flows (banner readability in real
  play, tutorial-button clicks, retry skipping the tutorial, sector
  countdown legibility, results timer frozen on screen) is still to be
  done by the main agent — not covered by the automated checks above.

## Validation (Milestone D, 2026-11-17)

Final state at commit 1528768 (boss HP 60, phase 2 at hp ≤ 30;
earlier sections' "90 HP / P2 at 45" describe the pre-reduction build).

- `main.ts` rewritten on the kit starter's pattern: copies `game/` +
  `screenshots/` to `/output` (`MAKEFUN_OUTPUT_DIR` outside the
  grader) and writes `/output/dossier.json` via `buildDossier` from
  `vendor/makefun-game.ts` with the starter's caps exactly
  (text_max_bytes 163840, screenshots max 4 / max_bytes 262144,
  game_max_files 993, game_max_bytes 50331648, game_path_max_bytes
  1000). The same validation as before runs first (offline scan,
  required strings STARFALL / GAME OVER / SECTOR / CONSTELLATION,
  3–4 screenshots) and fails fast without writing.
- `dossier_matches` verified independently: recomputing
  `buildDossier` from `out/` gives byte-for-byte the same
  `dossier.json` (301,916 bytes, schema `makefun/dossier/v1`).
- `MAKEFUN_OUTPUT_DIR=out node main.ts` → exit 0, "Starfall check
  OK — out/ written." (with 3 screenshots in `screenshots/`).
- `node --check` passes on all 8 `game/src/*.js` files.
- No-network grep on `game/`: zero matches.
- `vendor/makefun-game.ts` unchanged (md5
  2da03e097f2d64ae65e3d1c3586e652a, sha256
  dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129);
  `.makefun/owner.json` kept; `game/` 77,455 bytes, 9 files;
  `game/index.html` 1,786 bytes (limits: index.html ≤ 1 MiB,
  game/ ≤ 48 MiB and ≤ 993 entries).
- Screenshots (from the final build, headless Chromium, JPEG,
  1280×800, each < 256 KiB): `1-early-gameplay.jpg` (56,017 B),
  `2-constellation-detonation.jpg` (58,649 B, triangle-ready /
  RETURN TO CLOSE), `3-boss-fight.jpg` (50,560 B, boss health bar +
  rotating segments). A 4th screenshot — a legitimate victory /
  results screen — is PENDING: the automated player has not won in
  27 full runs (20 before Milestone D + 7 in Milestone D: 1 initial
  run + a 6-attempt loop, 2026-11-17). Best in the Milestone D batch:
  attempt 5 reached the boss, staggered it with a constellation
  (hp 60 → 38) and got it to 37 HP before dying; best ever remains
  run 17, boss down to 11 HP of 60, phase 2 reached, 2
  constellation staggers in one fight. Nothing is faked or
  staged; the victory shot needs a real win.
- Kit pre-submit check on commit 1528768 + the final transcript
  bundle (`/tmp/transcripts-final.tar.gz`, 16 sessions, 20 usage
  rows attached): **13 passed, 0 failed, 6 skipped, 5 checked at
  submission** — "every check run here passes". Key passes:
  transcripts_present (16 sessions), transcripts_recorded
  (harness-recorded, paid-place eligible), thinking_wellformed,
  thinking_in_window (all 1659 timestamps in window),
  thinking_reproduces (1946 of 1950 counted lines authored, 99.7%,
  0 copied/pasted/read, 4 absent; main.ts 71 authored lines),
  thinking_turns (838), thinking_priced (20 usage records, each
  priced to a known model), thinking_revised, transcripts_run_record
  (handed-off prompt, no MCP), license_osi (MIT), entrypoint
  (node22), snapshot, competition_open. At-submission checks (site
  verifies later): repo_public, repo_owner, repo_created_after_open,
  commit_in_repo, duplicate_snapshot — all expected to pass once the
  commit is pushed after review.

## Play-test verification status (20+ full runs, headless Chromium)

Verified by legitimate play: title, tutorial (fly / shoot /
collect 3 stars / return to close), constellation mechanic
(anchors, luminous line, triangle, 8s/12s timer, detonation +250 /
+50 per enemy, degenerate rejection TOO CLOSE / TOO STRAIGHT,
timer expiry CONSTELLATION LOST, timer frozen on pause and on the
upgrade screen), sectors 1–3 at 60s each, both upgrade screens
(mouse + keyboard picks, no repeats, game frozen while open), all
6 upgrades apply exactly as stated, chargers (enter / telegraph /
charge / recover), shooters (orbit + aimed eBullets), +1 life on
sector clear and before the boss, boss reached 7 times, boss
phase 2 reached 2 times, constellation enclosure on the boss
verified 4 times (+20 damage, 1.5s stagger), boss bullets through
the rotating gap, defeat screen + R restart, zero console errors
in every run. NOT yet captured by the automated player: a
legitimate full victory (0 wins in 27 runs; closest was boss at
11 HP in run 17, and 37 HP with a stagger in Milestone D attempt
5). The automated driver reaches the boss reliably (6 of 7
Milestone D runs) but dies in the boss fight; a human playing
deliberately — building triangles around the boss core — is the
realistic route to a win, and the victory screenshot with it. The victory screen itself (`drawVictory`, state
`victory`, results + personal best) is implemented and unit-covered
(see Milestone B validation), but no real victory playthrough has
been recorded yet. Mute (M), reduced effects (G), resize and
focus-loss pause are implemented per Milestone C and code-checked;
a dedicated short browser test of those four is still open.
