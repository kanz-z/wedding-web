// src/shared/ui.ts — utility functions dipakai bersama main & dashboard

/**
 * Escape string HTML — mencegah XSS saat render data user ke DOM.
 * Gunakan setiap kali menyisipkan string eksternal ke innerHTML.
 */
export function escapeHtml(str: string): string {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

/**
 * Escape string untuk konteks atribut HTML — escapeHtml() saja tidak cukup
 * karena tidak meng-handle karakter yang bisa memecah konteks atribut.
 * Gunakan setiap kali menyisipkan string ke title, aria-label, data-*, value, href, dll.
 */
export function escapeAttr(str: string): string {
  // ponytail: cukup handle karakter berbahaya di atribut, sisanya escapeHtml
  return escapeHtml(str)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/=/g, "&#61;");
}

/**
 * Format ISO datetime ke string ringkas: "22 Agu, 10:14"
 */
export function formatTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  const bulan = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return d.getDate() + " " + bulan[d.getMonth()] + ", " + hh + ":" + mm;
}

/**
 * Format ISO datetime ke string relatif: "Baru saja", "5 menit lalu", dst.
 */
export function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const now = Date.now();
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return Math.floor(diff / 60) + " menit lalu";
  if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu";
  if (diff < 604800) return Math.floor(diff / 86400) + " hari lalu";
  return new Date(iso).toLocaleDateString("id-ID", { dateStyle: "medium" });
}

/**
 * Render badge HTML.
 * @param type - kategori badge (success, danger, warning, info, muted, pink, purple)
 * @param label - teks di dalam badge
 */
export function badge(type: string, label: string): string {
  return `<span class="badge-dash badge-dash--${type}">${escapeHtml(label)}</span>`;
}

/**
 * Cek apakah user mengaktifkan preferensi reduced motion.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Debounce — tunda eksekusi fungsi sampai jeda `ms` berlalu sejak panggilan terakhir.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Global toast notification.
 * Me-render toast di elemen #toast. Jika tidak ada, dibuat otomatis.
 */
export function showToast(msg: string, isError?: boolean): void {
  let el = document.getElementById("toast") as HTMLElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast-global";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "toast-global" + (isError ? " is-error" : "");
  void el.offsetWidth;
  el.classList.add("show");

  const elAny = el as unknown as Record<string, unknown>;
  clearTimeout(elAny._timer as number | undefined);
  const TOAST_DURATION = 3000;
  elAny._timer = setTimeout(() => {
    el.classList.remove("show");
  }, TOAST_DURATION);
}

/**
 * Show a DOM element (remove d-none-important).
 */
export function show(el: HTMLElement | null): void {
  el?.classList.remove("d-none-important");
}

/**
 * Hide a DOM element (add d-none-important).
 */
export function hide(el: HTMLElement | null): void {
  el?.classList.add("d-none-important");
}

/**
 * Toggle visibility DOM element.
 */
export function toggle(el: HTMLElement | null): void {
  el?.classList.toggle("d-none-important");
}
