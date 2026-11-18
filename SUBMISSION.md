# Starfall — submission dossier

Prepared 2026-11-17 (Tue) ~14:55 UTC. Bounty closes **Wed 18 Nov 2026, 6:00 PM UTC**
(2026-11-18T18:00:00Z) — about 27 hours from when the game was picked.
Prize: $1,000 USDC, 10 places paid — 1st $400, 2nd $200, 3rd $120, 4th–10th $40 each.
Bounty page: https://make.fun/bounty/best-game-01
Requirements: https://make.fun/api/competitions/best-game-01/requirements

## What is built (verified in this workspace)

- `game/index.html` — complete, original, single-file game (20,998 bytes).
  Neon arcade space game: ship, asteroids that split big→medium→small,
  star orbs + combo multiplier, escalating waves, 3 lives, shield every
  5th star, pause / restart / mute, title + game-over screens, high score
  in localStorage, synthesised WebAudio sounds, no network requests.
- `main.ts` — Node 22 entry point (no dependencies). Validates the game is
  offline/self-contained and that 3–4 screenshots exist, then writes `out/`.
- `LICENSE` — MIT, with SPDX-License-Identifier: MIT line.
- `README.md` — with the make.fun badges template (owner/repo + referral
  code still to be filled in once the repo exists).

## What was checked

- Node here is v24.22.1 — meets the ≥22.18 requirement.
- `main.ts` type-strips cleanly under Node 24 (`node --type-strip` equivalent
  run — see verification below). It currently FAILS its own check on purpose:
  `screenshots/` is empty, so it reports "expected 3 or 4 screenshots".
  That is the one remaining build step before submission.
- HTML checked: no `http://`, `https://`, `<script src`, `<link` or `@import`
  in game/index.html (only the README's make.fun badge links, which are
  not part of the game). All expected screens present (STARFALL, GAME OVER,
  WAVE, COMBO).

## What is NOT done — needs Bruce / delivery (do not submit yet)

1. **Screenshots (3–4, required).** No desktop Chrome exists in this
   workspace, so no real renders could be taken here. At delivery: open
   `game/index.html` in desktop Chrome, play a few seconds, and capture:
   (1) title screen, (2) mid-game with asteroids + a star orb,
   (3) a wave / combo moment, (4) game-over screen. Save as
   `screenshots/01-title.png` … `screenshots/04-gameover.png`, then re-run
   `node main.ts` — it should print "Starfall check OK".
2. **Starter kit file.** The bounty requires `vendor/makefun-game.ts`,
   copied from the kit unchanged. It was NOT fabricated here. Fetch it:
   `curl -sSL "https://make.fun/c/best-game-01/kit" | tar xz`
   then copy `vendor/makefun-game.ts` from the kit into `vendor/`.
3. **make.fun account + Solana wallet.** Submission needs a make.fun
   account with a Solana wallet (payout wallet), an API key, and a signed
   entry message. Bruce has not created one — this needs his go-ahead and
   his wallet. Do NOT create a wallet or account on his behalf without him.
4. **GitHub repo.** Needs a public repo created after 2026-11-15T18:00:00Z,
   owned by Bruce's GitHub account (or `.makefun/owner.json` naming his
   wallet), with README badges filled in (owner/repo), About set to
   homepage https://make.fun/bounty/best-game-01 and topics
   makefun, ai-agents, bounties, games. Bruce has no GitHub login on file
   with Muse — needs his account.
5. **Transcripts.** Entries received from 17 Nov 2026 00:00 UTC are rejected
   without transcripts. The kit CLI bundles the agent sessions that built
   the entry (`node cli/makefun.mjs bundle`). Note: a handed-over session
   takes no paid place (`handed_over_places: none`), so the entry must be
   submitted from a harness whose sessions are recorded.
6. **Submit before 18:00 UTC Wed 18 Nov** via the kit CLI
   (`node cli/makefun.mjs submit --competition best-game-01 …`), max 5
   submissions/day, 10 total; last submission before the deadline is final.

## Judging

An AI judge compares entries two at a time by their screenshots and an
outline of their source; entries rank by how often it picks them. The top
3 games are playable live from the bounty page once entries close. That is
why the screenshots matter as much as the code — they are the first thing
judged.
