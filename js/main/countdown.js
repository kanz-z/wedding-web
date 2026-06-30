document.addEventListener("DOMContentLoaded", function () {
  simplyCountdown("#countdown", {
    year: 2026,
    month: 8,
    day: 22,
    hours: 10, // Target hour [0-23], default: 0
    minutes: 0, // Target minute [0-59], default: 0
    seconds: 0, // Target second [0-59], default: 0
    words: {
      // Custom labels, with lambda for plurals
      days: {
        root: "day",
        lambda: (root, n) => (n > 1 ? root + "s" : root),
      },
      hours: {
        root: "hour",
        lambda: (root, n) => (n > 1 ? root + "s" : root),
      },
      minutes: {
        root: "minute",
        lambda: (root, n) => (n > 1 ? root + "s" : root),
      },
      seconds: {
        root: "second",
        lambda: (root, n) => (n > 1 ? root + "s" : root),
      },
    },
    plural: true, // Use plurals for labels
    inline: false, // Inline format: e.g., "24 days, 4 hours, 2 minutes"
    inlineSeparator: ", ", // Separator for inline format, default: ", "
    inlineClass: "simply-countdown-inline", // CSS class for inline countdown
    enableUtc: false, // Use UTC time if true
    refresh: 1000, // Refresh interval in ms, default: 1000
    sectionClass: "simply-section", // CSS class for each countdown section
    amountClass: "simply-amount", // CSS class for numeric values
    wordClass: "simply-word", // CSS class for unit labels
    zeroPad: false, // Pad numbers with leading zero
    removeZeroUnits: false, // Remove units with zero value
    countUp: false, // Count up after reaching zero
    onEnd: () => {}, // Callback when countdown ends
    onStop: () => {}, // Callback when countdown is stopped
    onResume: () => {}, // Callback when countdown is resumed
    onUpdate: (params) => {}, // Callback when countdown is updated
  });
});
