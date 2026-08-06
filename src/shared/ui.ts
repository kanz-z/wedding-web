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

// --- Download Loading ---

export interface DownloadLoadingInstance {
  setLoading: (label?: string) => void;
  setSuccess: (label?: string, autoHideMs?: number) => void;
  setError: (label?: string) => void;
  dismiss: () => void;
  el: HTMLElement;
}

export function createDownloadLoading(container: HTMLElement): DownloadLoadingInstance {
  const overlay = document.createElement("div");
  overlay.className = "download-loading-overlay";
  overlay.innerHTML = `<div class="download-loading-content"><div class="download-loading-spinner"></div><p class="download-loading-text">Menyiapkan...</p></div>`;
  container.style.position = "relative";
  container.appendChild(overlay);

  const textEl = overlay.querySelector(".download-loading-text") as HTMLElement;

  return {
    setLoading(label) {
      overlay.className = "download-loading-overlay";
      overlay.querySelector(".download-loading-spinner")?.classList.remove("d-none");
      if (textEl && label) textEl.textContent = label;
    },
    setSuccess(label, autoHideMs = 2500) {
      overlay.classList.add("is-success");
      overlay.querySelector(".download-loading-spinner")?.classList.add("d-none");
      if (textEl && label) textEl.textContent = label;
      if (autoHideMs > 0) setTimeout(() => this.dismiss(), autoHideMs);
    },
    setError(label) {
      overlay.classList.add("is-error");
      overlay.querySelector(".download-loading-spinner")?.classList.add("d-none");
      if (textEl && label) textEl.textContent = label;
    },
    dismiss() {
      overlay.remove();
      container.style.position = "";
    },
    el: overlay,
  };
}

// --- Invite Message ---

import { config } from "@/config";

export function generateInviteMessage(slug: string, nameOrOptions?: string | { name?: string; guestCount?: number }): string {
  const inviteUrl = `${config.SITE_URL}/invitation/${slug}`;
  const cardUrl = `${config.SITE_URL}/invitation/${slug}/card`;

  let name: string | undefined;
  let guestCount: number | undefined;

  if (typeof nameOrOptions === "string") {
    name = nameOrOptions;
  } else if (nameOrOptions) {
    name = nameOrOptions.name;
    guestCount = nameOrOptions.guestCount;
  }

  const greeting = name ? `Kepada Yth.\nBapak/Ibu/Saudara/i\n*${name}*` : "Kepada Yth.\nBapak/Ibu/Saudara/i";
  const quotaLine = (guestCount != null && guestCount > 1) ? `\n*Undangan ini berlaku untuk ${guestCount} orang.*\n` : "";

  return `${greeting}

*Assalamu'alaikum Wr. Wb.*
*Bismillahirahmanirrahim.*

Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i, teman sekaligus sahabat untuk menghadiri acara resepsi pernikahan kami.${quotaLine}
Berikut link untuk info lengkap dari acara kami:
${inviteUrl}

Link kartu undangan:
${cardUrl}

Merupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir dan memberikan doa restu.

*Wassalamu'alaikum Wr. Wb.*

Terima Kasih.

Hormat kami,
*Ashila Luqyana Danurdoro & Muhammad Reza Ramadhan*`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Modern Clipboard API (HTTPS atau localhost)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fallback ke textarea */ }
  }

  // 2. Textarea fallback — pakai setSelectionRange (non-deprecated), bukan execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);

    // iOS: perlu contentEditable + range untuk keyboard
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      ta.contentEditable = "true";
      ta.readOnly = false;
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      ta.setSelectionRange(0, text.length);
    } else {
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
    }

    const ok = document.execCommand("copy");
    return ok;
  } catch {
    return false;
  } finally {
    // Bersihkan textarea (bisa saja gagal dihapus jika sudah removed)
    try {
      const leftover = document.querySelector("textarea[readonly][style*='-9999px']");
      if (leftover) document.body.removeChild(leftover);
    } catch { /* ignore */ }
  }
}
