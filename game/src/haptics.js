/* HapticsFX — haptic feedback bridge for Starfall on iOS (Capacitor).
 *
 * Loaded as a plain <script> (no build step): it talks to the
 * @capacitor/haptics plugin through the Capacitor runtime global that the
 * native shell injects into the WebView. On plain web (no Capacitor) every
 * method is a silent no-op, so the game works unchanged in a browser.
 *
 * Usage (wired in by the coordinator — this file only defines the API):
 *   HapticsFX.impact("heavy")     — constellation detonation, ship hit
 *   HapticsFX.notify("success")   — upgrade picked, sector cleared
 *   HapticsFX.notify("error")     — ship hit / life lost
 *   HapticsFX.select()            — upgrade-card highlight / menu move
 *
 * All methods are safe to call before Capacitor is ready and never throw
 * or return a rejected promise.
 */
(function () {
  "use strict";

  var IMPACT_STYLES = { light: true, medium: true, heavy: true };
  var NOTIFY_TYPES = { success: true, warning: true, error: true };

  function plugin() {
    try {
      var cap = window.Capacitor;
      if (!cap || !cap.Plugins || !cap.Plugins.Haptics) return null;
      return cap.Plugins.Haptics;
    } catch (e) {
      return null;
    }
  }

  /* Fire-and-forget: swallow any bridge error so haptics can never break
     gameplay. Returns a promise that always resolves. */
  function safeCall(fn) {
    try {
      var r = fn();
      if (r && typeof r.catch === "function") return r.catch(function () {});
      return Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }
  }

  window.HapticsFX = {
    /* style: "light" | "medium" | "heavy" (default "medium") */
    impact: function (style) {
      var h = plugin();
      if (!h || typeof h.impact !== "function") return Promise.resolve();
      var s = IMPACT_STYLES[style] ? style : "medium";
      return safeCall(function () { return h.impact({ style: s }); });
    },

    /* type: "success" | "warning" | "error" (default "success") */
    notify: function (type) {
      var h = plugin();
      if (!h || typeof h.notification !== "function") return Promise.resolve();
      var t = NOTIFY_TYPES[type] ? type : "success";
      return safeCall(function () { return h.notification({ type: t }); });
    },

    /* Light tick for selections / UI moves. */
    select: function () {
      var h = plugin();
      if (!h) return Promise.resolve();
      if (typeof h.selectionChanged === "function") {
        return safeCall(function () { return h.selectionChanged(); });
      }
      if (typeof h.impact === "function") {
        return safeCall(function () { return h.impact({ style: "light" }); });
      }
      return Promise.resolve();
    },

    /* Diagnostics only — true when running inside the Capacitor shell. */
    get available() {
      return !!plugin();
    }
  };
})();
