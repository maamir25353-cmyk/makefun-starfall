// Starfall — main.ts (Node 22, standard library + vendored make.fun library)
// Entry point the make.fun grader runs. It verifies the game bundle, copies
// game/ and screenshots/ from beside this file to /output, and writes
// /output/dossier.json via the vendored buildDossier — the summary the judge
// reads. It follows the kit starter's main.ts pattern exactly: the gate's
// dossier_matches check compares dossier.json byte-for-byte against what
// buildDossier writes, so the caps below are the starter's caps, unchanged.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The game itself is static: open game/index.html in a desktop browser.
// No network requests, no build step, no external assets.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const gameDir = join(here, "game");

// ---- validation (fails fast, writes nothing) ----
const errors: string[] = [];
const indexPath = join(gameDir, "index.html");
if (!existsSync(indexPath)) errors.push("game/index.html is missing");

// Scan every game file (html + js) for forbidden external patterns.
// "<script src=" is only forbidden when the src is absolute/external;
// relative local files (src="src/...") are how the split modules load.
function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}
const gameFiles = existsSync(gameDir)
  ? listFiles(gameDir).filter((f) => /\.(html|js)$/i.test(f))
  : [];
let allText = "";
for (const f of gameFiles) {
  const text = readFileSync(f, "utf8");
  allText += "\n" + text;
  for (const bad of ["http://", "https://", "<link ", "@import"]) {
    if (text.includes(bad)) errors.push(`${f} must be offline/self-contained, found: ${bad}`);
  }
  for (const m of text.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const src = m[1];
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) {
      errors.push(`${f} must load scripts locally, found external script src: ${src}`);
    }
  }
}
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  if (!html.includes("<script src=")) errors.push("game/index.html must load the game modules from game/src/");
}
// Required screen strings across the whole game bundle. WAVE was dropped
// deliberately: the sector rework replaced waves with sectors, so the
// required list is now STARFALL / GAME OVER / SECTOR / CONSTELLATION.
for (const need of ["STARFALL", "GAME OVER", "SECTOR", "CONSTELLATION"]) {
  if (!allText.includes(need)) errors.push(`game files are missing expected text: ${need}`);
}

const shots = existsSync(join(here, "screenshots"))
  ? readdirSync(join(here, "screenshots")).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
  : [];
if (shots.length < 3 || shots.length > 4) {
  errors.push(`expected 3 or 4 screenshots in screenshots/, found ${shots.length}`);
}

if (errors.length > 0) {
  console.error("Starfall check FAILED:");
  for (const e of errors) console.error(" - " + e);
  process.exit(1);
}

// ---- copy + dossier (kit starter's pattern) ----
// Wipe the output dir first so a stale file from an earlier run can never
// leak into the dossier; the grader runs in a fresh container, this only
// matters for local re-runs.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, "game"), { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });
if (existsSync(join(here, "screenshots"))) cpSync(join(here, "screenshots"), join(out, "screenshots"), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, "dossier.json"),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Human-readable build report (not part of the dossier: buildDossier reads
// only out/game and out/screenshots).
const bytes = gameFiles.reduce((sum, f) => sum + statSync(f).size, 0);
const report = [
  "# Starfall — build report",
  "",
  `- Game: game/index.html (${bytes} bytes total, split into game/src/ modules, loaded locally, offline, no external assets)`,
  `- Screenshots: ${shots.join(", ")}`,
  "- Controls: Arrows/WASD or mouse to fly, Space/click to shoot, P pause, M mute, R restart",
  "- Rules: 3 lives, constellation mechanic (collect 3 stars, return to the first anchor to detonate), star orbs build a combo (x1–x3.5), every 5th star earns a shield",
  "- How to play: open game/index.html in a desktop browser and click / press Space.",
  "",
].join("\n");
writeFileSync(join(out, "REPORT.md"), report);
console.log(report);
console.log("Starfall check OK — out/ written.");
