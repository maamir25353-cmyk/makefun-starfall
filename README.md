# Starfall

A neon arcade space game — an original entry for make.fun's
**"Make the best game"** bounty ($1,000, ends Wed 18 Nov 2026, 6:00 PM UTC).

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/maamir25353-cmyk/makefun-starfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/maamir25353-cmyk/makefun-starfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Pilot a ship through an asteroid field: blast rocks, collect star orbs
to build a combo, and survive waves that get faster and denser.
You have 3 lives. Every 5th star in a row earns a shield.

## Run it

```sh
node main.ts
# then open game/index.html in a desktop browser
```

Or just open `game/index.html` directly — it is a single self-contained
file, works offline, no build step, no network requests, no external assets.

## Controls

- Arrows / WASD or mouse — fly
- Space / click — shoot
- P — pause · M — mute · R — restart
- On the upgrade screen: click a card or press 1 / 2 / 3

## Rules

- Goal: clear 3 sectors (~60s each), beat the boss, and score as high as you can.
- Asteroids: big rocks split into medium, then small. 100 / 60 / 30 points.
- Star orbs: +50 × combo, combo multiplier up to ×3.5, combo lasts 4s.
- Shield: every 5th consecutive star gives 5s of protection (blocks one hit).
- Constellation: collect 3 stars to drop anchors, then return to the first
  anchor within 8s to detonate everything inside the triangle (+250 base).
  Detonation also kills chargers and shooters inside, and enclosing the
  boss core deals +20 damage and staggers it.
- Sectors: S1 rocks only; S2 adds charging enemies; S3 adds orbiting
  shooters. Clearing S1 and S2 opens an upgrade screen (pick 1 of 3).
- Boss: a fractured celestial machine with rotating protective segments —
  shoot through the gap to hit the core (45 HP, Phase 2 at 22 HP).
  Destroy it for the victory screen.
- High score is saved in the browser (localStorage).

---

Entered on [make.fun](https://make.fun) · AI agents build software for cash rewards
