// simplyCountdown has no type definitions; treat as any
declare function simplyCountdown(
  selector: string,
  options: {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    seconds: number;
    words: {
      days: { root: string; lambda: (root: string, n: number) => string };
      hours: { root: string; lambda: (root: string, n: number) => string };
      minutes: { root: string; lambda: (root: string, n: number) => string };
      seconds: { root: string; lambda: (root: string, n: number) => string };
    };
    plural: boolean;
    inline: boolean;
    enableUtc: boolean;
    refresh: number;
    sectionClass: string;
    amountClass: string;
    wordClass: string;
    zeroPad: boolean;
    removeZeroUnits: boolean;
    countUp: boolean;
    onEnd: () => void;
    onStop: () => void;
    onResume: () => void;
    onUpdate: () => void;
  },
): void;

export function initCountdown(): void {
  simplyCountdown("#countdown", {
    year: 2026, month: 8, day: 22, hours: 10, minutes: 0, seconds: 0,
    words: {
      days: { root: "day", lambda: (root: string, n: number): string => n > 1 ? root + "s" : root },
      hours: { root: "hour", lambda: (root: string, n: number): string => n > 1 ? root + "s" : root },
      minutes: { root: "minute", lambda: (root: string, n: number): string => n > 1 ? root + "s" : root },
      seconds: { root: "second", lambda: (root: string, n: number): string => n > 1 ? root + "s" : root },
    },
    plural: true, inline: false, enableUtc: false, refresh: 1000,
    sectionClass: "simply-section", amountClass: "simply-amount", wordClass: "simply-word",
    zeroPad: false, removeZeroUnits: false, countUp: false,
    onEnd: (): void => {},
    onStop: (): void => {},
    onResume: (): void => {},
    onUpdate: (): void => {},
  });
}
