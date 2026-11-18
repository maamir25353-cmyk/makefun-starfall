"use strict";
/* Starfall — input.js
   Keyboard + mouse state, focus-loss handling (pause + clear held keys).
   Listeners are registered exactly once, at load, via initInput(); reset
   never re-registers them. The game logic lives in main.js and is reached
   through the handlers passed to initInput().
   Upgrade screen: clicks on a card and keys 1/2/3 route to
   onUpgradeSelect(i) when state is "upgrade"; P never pauses there. */
const keys = {};
const Input = { keys, mouseX: undefined, mouseY: undefined, mouseDown: false, _init: false };

function initInput(cv, handlers) {
  if (Input._init) return;
  Input._init = true;
  addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    if (k === "m") handlers.toggleMute();
    if (k === "g" && handlers.toggleFx) handlers.toggleFx();
    if (k === "p") handlers.togglePause();
    if (k === "r") handlers.restart();
    if (k === "t" && handlers.startTutorial) handlers.startTutorial();
    if (handlers.isUpgrade && handlers.isUpgrade() && handlers.onUpgradeSelect
        && (k === "1" || k === "2" || k === "3")) {
      handlers.onUpgradeSelect(Number(k) - 1);
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      /* A launch/restart press is consumed by confirm(); it must not also
         register as a held fire key, or the launch tap would fire a bullet
         and skip the tutorial's shoot step. Only register the key when the
         game is already playing (mirrors the mouse handler). */
      if (handlers.isPlaying()) keys[k] = true;
      handlers.confirm();
    } else {
      keys[k] = true;
    }
  });
  addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
  cv.addEventListener("mousedown", e => {
    handlers.unlockAudio();
    if (handlers.isUpgrade && handlers.isUpgrade() && handlers.onUpgradeSelect
        && typeof upgradeCardRect === "function") {
      const r = cv.getBoundingClientRect();
      const gx = (e.clientX - r.left) * (W / r.width);
      const gy = (e.clientY - r.top) * (H / r.height);
      for (let i = 0; i < 3; i++) {
        const c = upgradeCardRect(i);
        if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) {
          handlers.onUpgradeSelect(i);
          return;
        }
      }
      return; /* click elsewhere on the upgrade screen: ignore */
    }
    /* Results screens: the TUTORIAL button replays the tutorial; a click
       elsewhere (including the RETRY button) falls through to the normal
       confirm path below, which retries. */
    if (handlers.resultsRects && handlers.startTutorial) {
      const rr = handlers.resultsRects();
      if (rr) {
        const r = cv.getBoundingClientRect();
        const gx = (e.clientX - r.left) * (W / r.width);
        const gy = (e.clientY - r.top) * (H / r.height);
        const t = rr.tutorial;
        if (gx >= t.x && gx <= t.x + t.w && gy >= t.y && gy <= t.y + t.h) {
          handlers.startTutorial();
          return;
        }
      }
    }
    /* Title screen: the PLAY TUTORIAL button launches the tutorial; a
       click elsewhere launches the normal mission. */
    if (handlers.isTitle && handlers.isTitle() && handlers.startTutorial
        && typeof titleTutorialButtonRect === "function") {
      const r = cv.getBoundingClientRect();
      const gx = (e.clientX - r.left) * (W / r.width);
      const gy = (e.clientY - r.top) * (H / r.height);
      const b = titleTutorialButtonRect();
      if (gx >= b.x && gx <= b.x + b.w && gy >= b.y && gy <= b.y + b.h) {
        handlers.startTutorial();
        return;
      }
    }
    Input.mouseDown = true;
    if (handlers.isPlaying()) handlers.fire();
    else handlers.confirm();
  });
  addEventListener("mouseup", () => { Input.mouseDown = false; });
  cv.addEventListener("mousemove", e => {
    const r = cv.getBoundingClientRect();
    Input.mouseX = (e.clientX - r.left) * (W / r.width);
    Input.mouseY = (e.clientY - r.top) * (H / r.height);
  });
  /* Focus loss: pause the game and drop every held key so the ship
     never keeps flying (or firing) while the player is away. */
  addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    Input.mouseDown = false;
    handlers.onBlur();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) handlers.onBlur(); });
}
