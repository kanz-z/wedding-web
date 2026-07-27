// src/dashboard/import-modal.ts — Modal Import Tamu (GAP-016)
// Mengenkapsulasi lifecycle modal import: tab CSV / Paste Text, preview file, dan submit

import { showModal, hideModal } from "./ui";
import { showToast } from "@/shared/ui";
import { insertGuest } from "./state";
import { populateKelompokFilter, renderGuestTable } from "./guests";
import { renderNotifications } from "./ui";

type ImportTab = "upload" | "paste";

interface ParseResult {
  name: string;
  guest_count: number;
  kategori: "keluarga" | "bukan";
  kelompok: string | null;
  nomor_wa: string | null;
  notes: string | null;
}

interface RowError {
  row: number;
  name: string;
  message: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class ImportModal {
  private overlay: HTMLElement;
  private dropzone: HTMLElement;
  private fileInput: HTMLInputElement;
  private previewEl: HTMLElement;
  private previewIdleEl: HTMLElement;
  private fileNameEl: HTMLElement;
  private fileSizeEl: HTMLElement;
  private pasteArea: HTMLTextAreaElement;
  private submitBtn: HTMLButtonElement;
  private tabs: NodeListOf<HTMLElement>;
  private panes: NodeListOf<HTMLElement>;

  private selectedFile: File | null = null;
  private activeTab: ImportTab = "upload";
  private isSubmitting = false;
  private boundKeydown: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.overlay = document.getElementById("import-modal-overlay")!;
    this.dropzone = document.getElementById("import-dropzone")!;
    this.fileInput = document.getElementById("import-file-input") as HTMLInputElement;
    this.previewEl = document.getElementById("import-file-preview")!;
    this.previewIdleEl = this.dropzone.querySelector(".import-dropzone__idle")!;
    this.fileNameEl = document.getElementById("import-file-name")!;
    this.fileSizeEl = document.getElementById("import-file-size")!;
    this.pasteArea = document.getElementById("import-paste-area") as HTMLTextAreaElement;
    this.submitBtn = document.getElementById("import-submit-btn") as HTMLButtonElement;
    this.tabs = document.querySelectorAll("[data-import-tab]");
    this.panes = document.querySelectorAll("[data-import-pane]");

    this.bindEvents();
  }

  // --- Public ---

  open(): void {
    this.reset();
    showModal("import-modal-overlay");
  }

  // --- Private: events ---

  private bindEvents(): void {
    // Tab switching
    this.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.importTab as ImportTab;
        if (target) this.switchTab(target);
      });
    });

    // Dropzone click
    this.dropzone.addEventListener("click", () => {
      if (this.activeTab === "upload") this.fileInput.click();
    });

    // File input change
    this.fileInput.addEventListener("change", () => {
      if (this.fileInput.files?.[0]) {
        this.handleFile(this.fileInput.files[0]);
      }
    });

    // Drag and drop
    this.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.dropzone.classList.add("is-dragover");
    });
    this.dropzone.addEventListener("dragleave", () => {
      this.dropzone.classList.remove("is-dragover");
    });
    this.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropzone.classList.remove("is-dragover");
      if (e.dataTransfer?.files?.[0]) {
        this.handleFile(e.dataTransfer.files[0]);
      }
    });

    // Submit
    this.submitBtn.addEventListener("click", () => this.submit());

    // Cancel / close
    document.getElementById("import-cancel-btn")?.addEventListener("click", () => {
      this.close();
    });
  }

  // --- Private: tab ---

  private switchTab(tab: ImportTab): void {
    this.activeTab = tab;
    this.tabs.forEach((t) => {
      t.classList.toggle("active", t.dataset.importTab === tab);
    });
    this.panes.forEach((p) => {
      p.classList.toggle("d-none-important", p.dataset.importPane !== tab);
    });
  }

  // --- Private: file ---

  private handleFile(file: File): void {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "tsv", "txt"].includes(ext)) {
      showToast("Hanya file CSV atau TSV yang didukung", true);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(
        `File terlalu besar (${this.formatSize(file.size)}). Maksimal ${this.formatSize(MAX_FILE_SIZE)}.`,
        true,
      );
      return;
    }
    this.selectedFile = file;
    this.fileNameEl.textContent = file.name;
    this.fileSizeEl.textContent = this.formatSize(file.size);
    this.previewIdleEl.classList.add("d-none-important");
    this.previewEl.classList.remove("d-none-important");
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // --- Private: parse ---

  private parseCSVLine(line: string): string[] {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === "," || ch === "\t") {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  /**
   * Header aliases (case-insensitive). Kolom yang tidak dikenali akan
   * di-skip sehingga urutan kolom tidak lagi kaku.
   */
  private static readonly HEADER_MAP: Record<string, keyof ParseResult> = {
    // Nama
    name: "name",
    nama: "name",
    // Guest count
    guest_count: "guest_count",
    "guest count": "guest_count",
    jumlah: "guest_count",
    jumlah_tamu: "guest_count",
    "jumlah tamu": "guest_count",
    // Kategori
    kategori: "kategori",
    category: "kategori",
    tipe: "kategori",
    // Kelompok
    kelompok: "kelompok",
    group: "kelompok",
    grup: "kelompok",
    keluarga: "kelompok",
    // Nomor WA
    nomor_wa: "nomor_wa",
    "nomor wa": "nomor_wa",
    phone: "nomor_wa",
    telepon: "nomor_wa",
    wa: "nomor_wa",
    nowa: "nomor_wa",
    // Notes
    notes: "notes",
    catatan: "notes",
    keterangan: "notes",
    note: "notes",
  };

  private parseTextToRows(raw: string): ParseResult[] {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    // Deteksi delimiter: cek tab dulu, lalu comma
    const firstLine = lines[0];
    const delim = firstLine.includes("\t") ? "\t" : ",";

    // Parse header → indeks kolom
    const headerCols = delim === "\t" ? firstLine.split("\t") : this.parseCSVLine(firstLine);
    const colMap: (keyof ParseResult | null)[] = headerCols.map((h) => {
      const key = h.trim().toLowerCase();
      return ImportModal.HEADER_MAP[key] ?? null;
    });

    // Fallback: jika header tidak dikenali sama sekali, gunakan mapping indeks lama
    const useFallback = colMap.every((c) => c === null);

    const result: ParseResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = delim === "\t" ? lines[i].split("\t") : this.parseCSVLine(lines[i]);

      if (useFallback) {
        if (cols.length < 1 || !cols[0]) continue;
        result.push({
          name: cols[0].trim(),
          guest_count: parseInt(cols[1], 10) || 1,
          kategori: cols[2]?.trim() === "keluarga" ? "keluarga" : "bukan",
          kelompok: cols[3]?.trim() || null,
          nomor_wa: cols[4]?.trim() || null,
          notes: cols[5]?.trim() || null,
        });
      } else {
        const row: ParseResult = {
          name: "",
          guest_count: 1,
          kategori: "bukan",
          kelompok: null,
          nomor_wa: null,
          notes: null,
        };
        for (let j = 0; j < colMap.length && j < cols.length; j++) {
          const field = colMap[j];
          if (!field) continue;
          const val = cols[j].trim();
          if (!val) continue;
          switch (field) {
            case "name":
              row.name = val;
              break;
            case "guest_count":
              row.guest_count = parseInt(val, 10) || 1;
              break;
            case "kategori":
              row.kategori = val.toLowerCase() === "keluarga" ? "keluarga" : "bukan";
              break;
            case "kelompok":
              row.kelompok = val || null;
              break;
            case "nomor_wa":
              row.nomor_wa = val || null;
              break;
            case "notes":
              row.notes = val || null;
              break;
          }
        }
        if (!row.name) continue;
        result.push(row);
      }
    }
    return result;
  }

  // --- Private: submit ---

  private async submit(): Promise<void> {
    if (this.isSubmitting) return;
    let rawText: string | null = null;

    if (this.activeTab === "upload") {
      if (!this.selectedFile) {
        showToast("Pilih file terlebih dahulu", true);
        return;
      }
      try {
        rawText = await this.selectedFile.text();
      } catch {
        showToast(
          "Gagal membaca file. Pastikan file berisi teks dan tidak rusak.",
          true,
        );
        return;
      }
    } else {
      rawText = this.pasteArea.value.trim();
      if (!rawText) {
        showToast("Tempel data tabel terlebih dahulu", true);
        return;
      }
    }

    const rows = this.parseTextToRows(rawText!);
    if (!rows.length) {
      showToast(
        "Tidak ada data tamu yang valid. Pastikan baris pertama adalah judul kolom.",
        true,
      );
      return;
    }

    // Lock UI agar tidak bisa ditutup saat proses
    this.isSubmitting = true;
    this.lockClose();

    this.submitBtn.disabled = true;
    const originalHtml = this.submitBtn.innerHTML;
    const updateProgress = (done: number, total: number): void => {
      this.submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Memproses ' +
        done +
        "/" +
        total +
        "…";
    };
    updateProgress(0, rows.length);

    let inserted = 0;
    let failed = 0;
    const errors: RowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name) {
        failed++;
        errors.push({ row: i + 2, name: "(kosong)", message: "Nama tidak boleh kosong" });
        continue;
      }
      try {
        await insertGuest({
          name: r.name,
          guest_count: r.guest_count,
          kategori: r.kategori,
          kelompok: r.kelompok,
          nomor_wa: r.nomor_wa,
          notes: r.notes,
        });
        inserted++;
      } catch (err: unknown) {
        failed++;
        const msg =
          err instanceof Error ? err.message : "Gagal menyimpan ke database";
        errors.push({ row: i + 2, name: r.name, message: msg });
      }
      updateProgress(i + 1, rows.length);
    }

    this.isSubmitting = false;
    this.submitBtn.disabled = false;
    this.submitBtn.innerHTML = originalHtml;
    this.unlockClose();

    // Semua gagal — jangan tutup modal, biarkan user koreksi data
    if (inserted === 0 && failed > 0) {
      const detail =
        errors.length <= 3
          ? errors
              .map((e) => "Baris " + e.row + " (" + e.name + "): " + e.message)
              .join("; ")
          : errors
              .slice(0, 3)
              .map((e) => "Baris " + e.row + ": " + e.message)
              .join("; ") + " +" + (errors.length - 3) + " galat lain";
      showToast("Import gagal: " + detail, true);
      return;
    }

    this.close();

    // Refresh UI
    populateKelompokFilter();
    renderGuestTable();
    renderNotifications();

    const msg =
      "Berhasil import " + inserted + " tamu" +
      (failed > 0 ? ", " + failed + " gagal" : "");
    showToast(msg, failed > 0);
  }

  // --- Private: close guard ---

  private lockClose(): void {
    // Prevent close via Escape key
    this.boundKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopImmediatePropagation();
    };
    document.addEventListener("keydown", this.boundKeydown, true);

    // Prevent close via overlay click
    this.overlay.style.pointerEvents = "none";

    // Disable cancel button
    const cancelBtn = document.getElementById("import-cancel-btn") as HTMLButtonElement | null;
    if (cancelBtn) cancelBtn.disabled = true;

    // Disable close button (×) di header
    const closeBtn = this.overlay.querySelector(".modal-dash__close") as HTMLButtonElement | null;
    if (closeBtn) closeBtn.disabled = true;
  }

  private unlockClose(): void {
    if (this.boundKeydown) {
      document.removeEventListener("keydown", this.boundKeydown, true);
      this.boundKeydown = null;
    }
    this.overlay.style.pointerEvents = "";

    const cancelBtn = document.getElementById("import-cancel-btn") as HTMLButtonElement | null;
    if (cancelBtn) cancelBtn.disabled = false;

    const closeBtn = this.overlay.querySelector(".modal-dash__close") as HTMLButtonElement | null;
    if (closeBtn) closeBtn.disabled = false;
  }

  // --- Private: reset ---

  private reset(): void {
    this.selectedFile = null;
    this.fileInput.value = "";
    this.previewIdleEl.classList.remove("d-none-important");
    this.previewEl.classList.add("d-none-important");
    this.fileNameEl.textContent = "";
    this.fileSizeEl.textContent = "";
    this.pasteArea.value = "";
    this.submitBtn.disabled = false;
    this.switchTab("upload");
  }

  private close(): void {
    if (this.isSubmitting) return;
    hideModal("import-modal-overlay");
  }
}

/** Singleton — di-init oleh dashboard.ts */
export let importModal: ImportModal | null = null;

export function initImportModal(): ImportModal {
  importModal = new ImportModal();
  return importModal;
}
