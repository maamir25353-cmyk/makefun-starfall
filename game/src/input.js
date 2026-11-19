"use strict";
/* Starfall — input.js
   Keyboard + mouse + touch state, focus-loss handling (pause + clear held keys).
   Listeners are registered exactly once, at load, via initInput(); reset
   never re-registers them. The game logic lives in main.js and is reached
   through the handlers passed to initInput().
   Upgrade screen: clicks on a card and keys 1/2/3 route to
   onUpgradeSelect(i) when state is "upgrade"; P never pauses there.
   Touch (iPhone): drag steers the ship toward the finger, with the target
   offset TOUCH_OFFSET_Y game units ABOVE the touch point so the finger
   never covers the ship; a short tap behaves exactly like a mouse click
   (fire when playing, confirm otherwise). While playing on a touch
   device the ship auto-fires (Input.touchMode, set on first touchstart);
   desktop mouse hold-to-fire is unchanged. */
const keys = {};
const Input = {
  keys, mouseX: undefined, mouseY: undefined, mouseDown: false,
  touchMode: false, touchActive: false, touchX: undefined, touchY: undefined,
  _init: false
};
/* Finger offset: the steer target sits this many game units above the
   touch point, so the ship stays visible above the player's finger. */
const TOUCH_OFFSET_Y = 90;
/* Tap recognition: a touch that ends quickly without much movement. */
const TAP_MAX_MS = 400, TAP_MAX_MOVE_PX = 14;

function initInput(cv, handlers) {
  if (Input._init) return;
  Input._init = true;

  /* First real touch: mark the device as touch-capable, show the
     on-screen buttons (body.touch) and swap the hint bar to touch text.
     Runs once; desktop never sees it. */
  function enableTouchMode() {
    if (Input.touchMode) return;
    Input.touchMode = true;
    document.body.classList.add("touch");
    const hint = document.getElementById("hint");
    if (hint) hint.textContent = "DRAG TO FLY \u00b7 AUTO-FIRE \u00b7 TAP CARDS TO PICK UPGRADES";
  }
  function clearTouch() {
    Input.touchActive = false;
    Input.touchX = undefined;
    Input.touchY = undefined;
    touchId = null;
  }
  function toGame(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) };
  }
  /* Shared press path for mouse clicks and touch taps. pressDown (mouse
     only) holds Input.mouseDown for hold-to-fire; touch taps skip it —
     auto-fire covers firing on touch, and a stuck mouseDown with no
     matching mouseup would keep firing forever. */
  function handleCanvasPress(gx, gy, pressDown) {
    if (handlers.isUpgrade && handlers.isUpgrade() && handlers.onUpgradeSelect
        && typeof upgradeCardRect === "function") {
      for (let i = 0; i < 3; i++) {
        const c = upgradeCardRect(i);
        if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) {
          handlers.onUpgradeSelect(i);
          return;
        }
      }
      return; /* press elsewhere on the upgrade screen: ignore */
    }
    /* Results screens: the TUTORIAL button replays the tutorial; a press
       elsewhere (including the RETRY button) falls through to the normal
       confirm path below, which retries. */
    if (handlers.resultsRects && handlers.startTutorial) {
      const rr = handlers.resultsRects();
      if (rr) {
        const t = rr.tutorial;
        if (gx >= t.x && gx <= t.x + t.w && gy >= t.y && gy <= t.y + t.h) {
          handlers.startTutorial();
          return;
        }
      }
    }
    /* Title screen: the PLAY TUTORIAL button launches the tutorial; a
       press elsewhere launches the normal mission. */
    if (handlers.isTitle && handlers.isTitle() && handlers.startTutorial
        && typeof titleTutorialButtonRect === "function") {
      const b = titleTutorialButtonRect();
      if (gx >= b.x && gx <= b.x + b.w && gy >= b.y && gy <= b.y + b.h) {
        handlers.startTutorial();
        return;
      }
    }
    if (pressDown) Input.mouseDown = true;
    if (handlers.isPlaying()) handlers.fire();
    else handlers.confirm();
  }

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
    const g = toGame(e.clientX, e.clientY);
    handleCanvasPress(g.x, g.y, true);
  });
  addEventListener("mouseup", () => { Input.mouseDown = false; });
  cv.addEventListener("mousemove", e => {
    const r = cv.getBoundingClientRect();
    Input.mouseX = (e.clientX - r.left) * (W / r.width);
    Input.mouseY = (e.clientY - r.top) * (H / r.height);
  });

  /* ---------- touch ---------- */
  let touchId = null, touchStartX = 0, touchStartY = 0, touchStartT = 0, touchMoved = false;
  function trackedTouch(e) {
    for (let i = 0; i < e.changedTouches.length; i++)
      if (e.changedTouches[i].identifier === touchId) return e.changedTouches[i];
    return null;
  }
  cv.addEventListener("touchstart", e => {
    e.preventDefault();
    handlers.unlockAudio(); /* iOS blocks audio until a gesture unlocks it */
    enableTouchMode();
    if (touchId !== null) return; /* one steering finger at a time */
    const t = e.changedTouches[0];
    touchId = t.identifier;
    touchStartX = t.clientX; touchStartY = t.clientY;
    touchStartT = performance.now(); touchMoved = false;
    const g = toGame(t.clientX, t.clientY);
    Input.touchActive = true;
    Input.touchX = clamp(g.x, 20, W - 20);
    Input.touchY = clamp(g.y - TOUCH_OFFSET_Y, 20, H - 20);
  }, { passive: false });
  cv.addEventListener("touchmove", e => {
    e.preventDefault();
    const t = trackedTouch(e);
    if (!t) return;
    if (Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) > TAP_MAX_MOVE_PX) touchMoved = true;
    const g = toGame(t.clientX, t.clientY);
    Input.touchActive = true;
    Input.touchX = clamp(g.x, 20, W - 20);
    Input.touchY = clamp(g.y - TOUCH_OFFSET_Y, 20, H - 20);
  }, { passive: false });
  cv.addEventListener("touchend", e => {
    e.preventDefault();
    const t = trackedTouch(e);
    if (!t) return;
    const wasTap = !touchMoved && (performance.now() - touchStartT) < TAP_MAX_MS;
    const gx = t.clientX, gy = t.clientY;
    clearTouch();
    if (wasTap) {
      const g = toGame(gx, gy);
      handleCanvasPress(g.x, g.y, false);
    }
  }, { passive: false });
  cv.addEventListener("touchcancel", e => {
    e.preventDefault();
    clearTouch();
  }, { passive: false });

  /* Focus loss: pause the game and drop every held key so the ship
     never keeps flying (or firing) while the player is away. */
  addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    Input.mouseDown = false;
    clearTouch();
    handlers.onBlur();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) handlers.onBlur(); });
}
