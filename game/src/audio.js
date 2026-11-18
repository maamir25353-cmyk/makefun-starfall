"use strict";
/* Starfall — audio.js
   Shared constants/helpers + WebAudio synth sounds (no files).
   Loaded first; every other module uses W/H/TAU/rand/clamp/dist2.
   Soundtrack (Milestone C): a quiet bass/pad arpeggio loop (Am–F–C–G,
   ~100 BPM eighth notes) that starts only after the first user gesture
   (audio() is only ever called from gesture-driven paths), stays well
   under the sfx, and is silenced by mute via its own gain node. */
const W = 960, H = 640;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

const VERSION = "v1.2"; /* visible version identifier (title screen + HUD corner) */
/* "mm:ss" for the HUD sector countdown and the results "Mission time". */
function formatMmSs(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

let AC = null, muted = false;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === "suspended") AC.resume();
  if (AC) startMusic();
  return AC;
}
/* Apply mute consistently to sfx (tone() early-returns when muted) and
   to the soundtrack (its gain node goes to 0). Call after toggling. */
function setMuted(m) {
  muted = m;
  if (musicGain && AC) {
    try { musicGain.gain.setValueAtTime(muted ? 0 : 0.5, AC.currentTime); } catch (e) {}
  }
}

/* ---------- soundtrack ---------- */
let musicGain = null, musicTimer = null, musicStep = 0, musicNextT = 0;
const MUSIC_STEP = 0.3; /* eighth note at ~100 BPM */
const MUSIC_CHORDS = [
  { root: 110.00, tones: [220.00, 261.63, 329.63] }, /* Am */
  { root: 87.31,  tones: [174.61, 220.00, 261.63] }, /* F  */
  { root: 130.81, tones: [196.00, 261.63, 329.63] }, /* C  */
  { root: 98.00,  tones: [196.00, 246.94, 293.66] }  /* G  */
];
function musicNote(freq, t, dur, type, vol) {
  if (!AC || !musicGain || muted) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
function scheduleMusicStep() {
  if (!AC) return;
  const chord = MUSIC_CHORDS[Math.floor(musicStep / 8) % MUSIC_CHORDS.length];
  const s = musicStep % 8;
  const t = musicNextT;
  if (s === 0 || s === 4) musicNote(chord.root, t, 0.55, "triangle", 0.05); /* soft bass */
  /* pad arpeggio: one quiet chord tone per step, cycling */
  musicNote(chord.tones[s % 3], t, 0.85, "sine", 0.016);
  if (s === 6) musicNote(chord.root * 2, t, 0.4, "sine", 0.012);
  musicStep++;
  musicNextT += MUSIC_STEP;
}
function startMusic() {
  if (musicTimer || !AC) return;
  try {
    musicGain = AC.createGain();
    musicGain.gain.value = muted ? 0 : 0.5;
    musicGain.connect(AC.destination);
  } catch (e) { musicGain = null; return; }
  musicStep = 0;
  musicNextT = AC.currentTime + 0.1;
  /* Lookahead scheduler: schedule ~0.35s ahead, every 120ms. */
  musicTimer = setInterval(() => {
    if (!AC || muted) return;
    while (musicNextT < AC.currentTime + 0.35) scheduleMusicStep();
  }, 120);
}
function tone(freq, dur, type, vol, slideTo) {
  if (muted) return; const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || "square"; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ac.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.08, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
const sfx = {
  shoot() { tone(880, 0.09, "square", 0.045, 320); },
  boom()  { tone(160, 0.28, "sawtooth", 0.10, 40); },
  hit()   { tone(220, 0.35, "sawtooth", 0.12, 50); },
  star()  { tone(660, 0.12, "sine", 0.09, 1320); },
  wave()  { tone(440, 0.18, "triangle", 0.08, 880); },
  over()  { tone(330, 0.7, "triangle", 0.10, 55); },
  /* constellation sounds */
  anchor() { tone(520, 0.12, "sine", 0.10, 780); },
  line()   { tone(660, 0.10, "sine", 0.09, 990); tone(990, 0.16, "sine", 0.07, 1320); },
  ready()  { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, "triangle", 0.09), i * 70)); },
  detonate() {
    tone(180, 0.55, "sawtooth", 0.15, 28);
    tone(90, 0.65, "sine", 0.17, 36);
    tone(1200, 0.28, "square", 0.06, 90);
    tone(1568, 0.35, "sine", 0.08, 2093);
  },
  fail() { tone(330, 0.22, "sawtooth", 0.09, 180); tone(220, 0.32, "sawtooth", 0.08, 110); }
};
