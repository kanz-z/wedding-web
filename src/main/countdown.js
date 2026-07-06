// src/main/countdown.js
export function initCountdown() {
  simplyCountdown("#countdown", {
    year: 2026, month: 8, day: 22, hours: 10, minutes: 0, seconds: 0,
    words: {
      days: { root: "day", lambda: function(root, n) { return n > 1 ? root + "s" : root; } },
      hours: { root: "hour", lambda: function(root, n) { return n > 1 ? root + "s" : root; } },
      minutes: { root: "minute", lambda: function(root, n) { return n > 1 ? root + "s" : root; } },
      seconds: { root: "second", lambda: function(root, n) { return n > 1 ? root + "s" : root; } },
    },
    plural: true, inline: false, enableUtc: false, refresh: 1000,
    sectionClass: "simply-section", amountClass: "simply-amount", wordClass: "simply-word",
    zeroPad: false, removeZeroUnits: false, countUp: false,
    onEnd: function(){}, onStop: function(){}, onResume: function(){}, onUpdate: function(){},
  });
}
