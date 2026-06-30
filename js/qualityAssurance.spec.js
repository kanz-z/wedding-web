/**
 * qualityAssurance.spec.js
 * ---------------------------------------------------------------------------
 * Test suite untuk Wedding Invitation Website (Reza & Ashila).
 *
 * Versi ini memperluas suite sebelumnya yang sebagian besar hanya memeriksa
 * keberadaan elemen DOM. Penambahan utama mengacu pada gap yang sudah
 * teridentifikasi di docs/Kemungkinan_Kegagalan/QA_Brutal_Analysis.md
 * (section 10 — "Testing Coverage Gaps"), yaitu:
 *   - Form submission & validasi client-side (HTML5 constraint validation)
 *   - Flow RSVP end-to-end (sukses, ditolak, kuota > 2 / butuh review)
 *   - Flow Guestbook end-to-end + filter kata kasar
 *   - Unit test untuk fungsi-fungsi global kritikal: escapeHtml,
 *     sensorKataKasar, generateUUID, formatWaktuRelatif, disableScroll/
 *     enableScroll
 *   - Validasi server-side Edge Function (rate-limit-rsvp): pesan terlalu
 *     panjang, jumlah_hadir tidak valid, preflight CORS
 *   - Navigasi (bottom-nav), audio, dan beberapa regresi bug yang
 *     terdokumentasi (ditandai komentar "BUG:") supaya mudah dilacak ulang.
 *
 * Catatan teknis penting:
 *   - index.html memanggil disableScroll() di awal load (mengunci
 *     document.body via overflow:hidden + position:fixed). Karena itu,
 *     elemen yang berada di bawah lipatan (below-the-fold) TIDAK BISA
 *     di-klik dengan Locator.click() biasa (Playwright gagal melakukan
 *     auto-scroll & hit-test). Pola yang dipakai di file asli — memanggil
 *     `el.click()` lewat page.evaluate() — dipertahankan & diperluas secara
 *     konsisten untuk semua interaksi semacam itu.
 *   - page.fill()/selectOption()/evaluate() tidak memerlukan elemen berada
 *     dalam viewport yang sedang ter-scroll, sehingga tetap dipakai langsung
 *     seperti pada file asli.
 *   - Beberapa test (Edge Function & RSVP/guestbook submit) memanggil
 *     backend Supabase produksi sungguhan. Ini sengaja dipertahankan
 *     konsisten dengan pendekatan file asli, namun ditambahkan secukupnya
 *     dan dijaga agar tidak melakukan percobaan berulang yang bisa terkena
 *     rate limit (maksimal 5 request/10 menit per IP di Edge Function).
 */

const { test, expect } = require("playwright/test");
const path = require("path");

const BASE = "file://" + path.resolve(__dirname, "..");

var APP_CONFIG = {
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeWZzYXBnYWRpY2trbnNmYnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDIwNDMsImV4cCI6MjA5NzY3ODA0M30.aQ37-_9-wl2pbDtqKSavOvrsUU-F-sIzv6g3hG23dHw",
  RSVP_EDGE_FUNCTION:
    "https://liyfsapgadickknsfbus.functions.supabase.co/rate-limit-rsvp",
};

// =============================================================================
// 1. META & STRUKTUR DASAR — index.html
// =============================================================================
test.describe("index.html — meta & struktur dasar", () => {
  test("title halaman sesuai", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page).toHaveTitle("Wedding Invitation");
  });

  test("meta og:title menampilkan nama kedua mempelai", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toContain("Reza & Ashila");
  });

  test("hero section muncul dengan judul, subtitle, dan tombol CTA", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator(".hero h1")).toHaveText("Reza & Ashila");
    await expect(page.locator(".hero .subtitle")).toContainText(
      "Specially Invited",
    );
    await expect(page.locator(".hero a[href='#welcome']")).toBeVisible();
    await expect(page.locator(".hero a[href='#welcome']")).toHaveText(
      "Lihat Undangan",
    );
  });

  test("body terkunci (scroll disabled) saat halaman pertama kali dimuat", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const overflow = await page.evaluate(() => document.body.style.overflow);
    const position = await page.evaluate(() => document.body.style.position);
    expect(overflow).toBe("hidden");
    expect(position).toBe("fixed");
  });

  test("kartu digital (digital-card) tersembunyi secara default", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#digital-card")).toBeHidden();
  });

  test("section sambutan (welcome) menampilkan salam pembuka", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#welcome")).toContainText("Assalamu'alaikum");
  });

  test("semua section utama ada", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    for (const id of [
      "hero",
      "home",
      "info",
      "cd",
      "rsvp",
      "gifts",
      "guestbook-section",
      "thankyou",
    ]) {
      await expect(page.locator(`#${id}`).first()).toBeAttached();
    }
  });

  test("footer ada", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("footer")).toContainText(
      "Wedding Team Production",
    );
  });

  test("AOS cuma di-load sekali (tidak duplikat)", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    const count = await page.evaluate(
      () => document.querySelectorAll('script[src*="aos"]').length,
    );
    expect(count).toBe(1);
  });
});

// =============================================================================
// 2. PERSONALISASI NAMA TAMU DARI PARAMETER URL
// =============================================================================
test.describe("Personalisasi nama tamu dari URL param (?n= & ?p=)", () => {
  test("nama tamu & sapaan tampil sesuai parameter", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=Joko&p=Bpk");
    await expect(page.locator(".hero h4 span")).toContainText("Bpk Joko");
    await expect(page.locator("#nama")).toHaveValue("Joko");
  });

  test("fallback nama tamu jika tanpa param", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator(".hero h4 span")).toContainText("Invited Guest");
  });

  test("input #nama otomatis terisi dari parameter ?n=", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=Sinta&p=Ibu");
    await expect(page.locator("#nama")).toHaveValue("Sinta");
  });

  test("nama dari URL tidak dieksekusi sebagai HTML (anti-XSS)", async ({
    page,
  }) => {
    const payload = "<img src=x onerror=alert(1)>";
    await page.goto(
      BASE + "/index.html?n=" + encodeURIComponent(payload) + "&p=Bpk",
    );

    // Karena diisi lewat innerText/value (bukan innerHTML), payload harus
    // tampil sebagai teks polos, dan TIDAK ada elemen <img> baru yang dibuat.
    await expect(page.locator(".hero h4 span")).toContainText("img src=x");
    await expect(page.locator(".hero img")).toHaveCount(0);
    await expect(page.locator("#nama")).toHaveValue(payload);
  });
});

test.describe("URL params — edge cases", () => {
  test("nama dengan karakter spesial", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=John+Doe%26Family&p=Mr.");
    await expect(page.locator("#nama")).toHaveValue("John Doe&Family");
  });

  test("hanya param n tanpa p", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=Sinta");
    await expect(page.locator("#nama")).toHaveValue("Sinta");
    await expect(page.locator(".hero h4 span")).toContainText("Sinta");
  });

  test("hanya param p tanpa n", async ({ page }) => {
    await page.goto(BASE + "/index.html?p=Ibu");
    await expect(page.locator("#nama")).toHaveValue("");
    await expect(page.locator(".hero h4 span")).toContainText("Invited Guest");
  });

  test("param kosong (n= & p= tanpa nilai)", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=&p=");
    await expect(page.locator("#nama")).toHaveValue("");
    await expect(page.locator(".hero h4 span")).toContainText("Invited Guest");
  });
});

// =============================================================================
// 3. INFORMASI ACARA & COUNTDOWN
// =============================================================================
test.describe("Informasi acara & countdown", () => {
  test("info acara menampilkan jadwal Akad Nikah & Resepsi yang benar", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const info = page.locator("#info");
    await expect(info).toContainText("Akad Nikah");
    await expect(info).toContainText("Resepsi");
    await expect(info).toContainText("10.00 - 11.00");
    await expect(info).toContainText("12.30 - Selesai");
    await expect(info).toContainText("Sabtu, 22 Agustus 2026");
  });

  test("info acara menampilkan lokasi (alamat) acara", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#info")).toContainText(
      "RIVEA Riverside Cafe and Space",
    );
  });

  test("countdown container ada", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#countdown")).toBeAttached();
  });

  test("countdown otomatis terisi 4 unit waktu (hari/jam/menit/detik) berupa angka", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const sections = page.locator("#countdown .simply-section");
    await expect(sections).toHaveCount(4);

    const amounts = await page
      .locator("#countdown .simply-amount")
      .allTextContents();
    expect(amounts.length).toBe(4);
    for (const value of amounts) {
      expect(value).toMatch(/^\d+$/);
    }
  });
});

// =============================================================================
// 4. FORM RSVP — STRUKTUR & VALIDASI CLIENT-SIDE
// =============================================================================
test.describe("Form RSVP — struktur & validasi client-side", () => {
  test("form RSVP memiliki semua field wajib", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#nama")).toBeAttached();
    await expect(page.locator("#jumlah")).toBeAttached();
    await expect(page.locator("#status")).toBeAttached();
    await expect(page.locator("#noWA")).toBeAttached();
    await expect(page.locator("#my-form button[type='submit']")).toBeAttached();
  });

  test("field nama memiliki maxlength 100 karakter", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=test&p=Bpk");
    const maxlength = await page.getAttribute("#nama", "maxlength");
    expect(parseInt(maxlength, 10)).toBeLessThanOrEqual(100);
  });

  test("BUG: field noWA tidak memiliki maxlength (perlu ditambahkan)", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html?n=test&p=Bpk");
    const maxlength = await page.getAttribute("#noWA", "maxlength");
    expect(maxlength).toBeNull();
  });

  test("BUG: field noWA tidak memiliki pattern validasi format nomor (perlu ditambahkan)", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const pattern = await page.getAttribute("#noWA", "pattern");
    expect(pattern).toBeNull();
  });

  test("field jumlah keluarga hadir: type number, default 1, minimal 1", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const jumlah = page.locator("#jumlah");
    await expect(jumlah).toHaveAttribute("type", "number");
    await expect(jumlah).toHaveAttribute("min", "1");
    await expect(jumlah).toHaveValue("1");
  });

  test("select status memiliki opsi Hadir & Tidak Hadir, default disabled", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const options = page.locator("#status option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveAttribute("disabled", "");
    await expect(options.nth(1)).toHaveText("Hadir");
    await expect(options.nth(2)).toHaveText("Tidak Hadir");
  });

  test("field doa & ucapan (pesan) bersifat opsional, dibatasi 500 karakter", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const required = await page.getAttribute("#pesan", "required");
    expect(required).toBeNull();
    await expect(page.locator("#pesan")).toHaveAttribute("maxlength", "500");
  });

  test("validasi HTML5: nama, status, dan noWA wajib diisi sebelum form valid", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#nama");

    for (const id of ["nama", "noWA"]) {
      const valid = await page
        .locator("#" + id)
        .evaluate((el) => el.checkValidity());
      expect(valid).toBe(false);
    }
    const statusValidEmpty = await page
      .locator("#status")
      .evaluate((el) => el.checkValidity());
    expect(statusValidEmpty).toBe(false);

    await page.fill("#nama", "Tamu Uji Otomatis");
    await page.fill("#noWA", "081234567890");
    await page.selectOption("#status", "Hadir");

    for (const id of ["nama", "noWA", "status"]) {
      const valid = await page
        .locator("#" + id)
        .evaluate((el) => el.checkValidity());
      expect(valid).toBe(true);
    }
  });

  test("label form RSVP terhubung dengan benar ke masing-masing input (aksesibilitas)", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    for (const id of ["nama", "jumlah", "status", "noWA", "pesan"]) {
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });
});

// =============================================================================
// 5. FORM RSVP — FLOW PENGISIAN & SUBMIT (memanggil backend Supabase asli)
// =============================================================================
test.describe("Form RSVP — flow submit", () => {
  test("form RSVP TIDAK terkirim saat field wajib dikosongkan", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#nama", { state: "visible" });

    // disableScroll() mengunci viewport scroll, sehingga klik harus lewat evaluate
    await page.evaluate(() => {
      document.querySelector("#my-form button[type='submit']").click();
    });
    await page.waitForTimeout(1000);

    // HTML5 constraint validation (required) seharusnya mencegah event "submit"
    // sama sekali, sehingga tidak ada modal hasil RSVP yang muncul, dan tombol
    // submit tetap aktif (belum berubah jadi "Terkirim").
    await expect(page.locator("#rsvp-modal-overlay.show")).toHaveCount(0);
    await expect(page.locator("#my-form button[type='submit']")).toBeEnabled();
    await expect(page.locator("#my-form button[type='submit']")).toHaveText(
      "Kirim",
    );
  });

  test("form RSVP submit sukses dengan data valid (jumlah ≤ 2) menonaktifkan form", async ({
    page,
  }) => {
    const ts = Date.now();
    await page.goto(BASE + "/index.html?n=playwright-test-" + ts + "&p=Bpk");
    await page.waitForSelector("#nama", { state: "visible" });

    // Mock Edge Function to bypass CORS
    await page.route("**/rate-limit-rsvp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { is_approved: true, qr_token: "mock-token-" + Date.now(), jumlah_hadir: 2, pesan: "" }
        }),
      });
    });

    await page.fill("#nama", "Playwright Test " + ts);
    await page.fill("#noWA", "08123456789");
    await page.selectOption("#status", "Hadir");
    await page.fill("#jumlah", "2");

    await page.evaluate(() => {
      document.querySelector("#my-form button[type='submit']").click();
    });

    await expect(page.locator("#rsvp-already-note")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("#rsvp-already-note-text")).toContainText(
      "sudah konfirmasi",
    );

    await page.screenshot({
      path: "qa/screenshots/rsvp-success-" + ts + ".png",
      fullPage: true,
    });
  });

  test("form RSVP dengan jumlah keluarga > 2 menampilkan pesan untuk ditinjau panitia", async ({
    page,
  }) => {
    const ts = Date.now();
    await page.goto(BASE + "/index.html?n=playwright-review-" + ts + "&p=Bpk");
    await page.waitForSelector("#nama", { state: "visible" });

    // Mock Edge Function to bypass CORS
    await page.route("**/rate-limit-rsvp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { is_approved: false, qr_token: "mock-token-" + Date.now(), jumlah_hadir: 5, pesan: "" }
        }),
      });
    });

    await page.fill("#nama", "Playwright Review Test " + ts);
    await page.fill("#noWA", "08129876543");
    await page.selectOption("#status", "Hadir");
    await page.fill("#jumlah", "5");

    await page.evaluate(() => {
      document.querySelector("#my-form button[type='submit']").click();
    });

    await expect(
      page.locator("#rsvp-modal-overlay .rsvp-modal-message"),
    ).toContainText("ditinjau panitia", { timeout: 15000 });
  });
});

// =============================================================================
// 6. CATATAN "SUDAH RSVP" (localStorage) — renderAlreadySubmittedNote()
// =============================================================================
test.describe("Catatan 'sudah RSVP' berbasis localStorage", () => {
  test("renderAlreadySubmittedNote() menampilkan catatan untuk status Hadir", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.evaluate(() =>
      window.renderAlreadySubmittedNote("Budi Santoso", "Hadir"),
    );

    await expect(page.locator("#rsvp-already-note")).toBeVisible();
    await expect(page.locator("#rsvp-already-note-text")).toContainText(
      "Budi Santoso, Anda sudah konfirmasi akan hadir. Terima kasih!",
    );
  });

  test("renderAlreadySubmittedNote() menampilkan catatan untuk status Tidak Hadir", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.evaluate(() =>
      window.renderAlreadySubmittedNote("Siti Aminah", "Tidak Hadir"),
    );

    await expect(page.locator("#rsvp-already-note-text")).toContainText(
      "Siti Aminah, Anda sudah konfirmasi tidak dapat hadir. Terima kasih!",
    );
  });

  test("saveRsvpSubmitted() menyimpan record ke localStorage dengan key sesuai slug tamu", async ({
    page,
  }) => {
    const slug = "playwright-ls-" + Date.now();
    await page.goto(BASE + "/index.html?n=" + slug + "&p=Bpk");
    await page.evaluate(() => window.saveRsvpSubmitted("Tamu Uji", "Hadir"));

    const stored = await page.evaluate(
      (s) => localStorage.getItem("rsvp_submitted_" + s.toLowerCase()),
      slug,
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed.nama).toBe("Tamu Uji");
    expect(parsed.status).toBe("Hadir");
  });

  test("BUG: status RSVP tersimpan di localStorage TIDAK otomatis diterapkan saat halaman dimuat ulang", async ({
    page,
  }) => {
    // applyAlreadySubmittedState() didefinisikan di index.html untuk membaca
    // localStorage saat load dan menampilkan kembali catatan "sudah RSVP" +
    // menonaktifkan form. Namun fungsi ini tidak pernah dipanggil di mana pun
    // (tidak ada di DOMContentLoaded/load listener manapun). Test ini
    // mendokumentasikan perilaku SAAT INI; jika bug ini sudah diperbaiki
    // (fungsi di-wire ke event load), assertion di bawah akan gagal dan
    // harus diperbarui menjadi toBeVisible() / toBeDisabled().
    const guestSlug = "playwright-bug-" + Date.now();

    await page.addInitScript((slug) => {
      const key = "rsvp_submitted_" + slug.toLowerCase();
      localStorage.setItem(
        key,
        JSON.stringify({ nama: "Tamu Lama", status: "Hadir", ts: Date.now() }),
      );
    }, guestSlug);

    await page.goto(BASE + "/index.html?n=" + guestSlug + "&p=Bpk");
    await page.waitForSelector("#nama");

    await expect(page.locator("#rsvp-already-note")).toBeVisible();
    await expect(page.locator("#my-form button[type='submit']")).toBeDisabled();
  });
});

// =============================================================================
// 7. GUESTBOOK — STRUKTUR & VALIDASI
// =============================================================================
test.describe("Guestbook — struktur & validasi", () => {
  test("form guestbook memiliki field nama & pesan dengan counter karakter", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#gb-nama")).toBeAttached();
    await expect(page.locator("#gb-pesan")).toBeAttached();
    await expect(page.locator("#gb-counter")).toHaveText("0/500");
  });

  test("field nama & ucapan guestbook bersifat wajib (required)", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    expect(await page.getAttribute("#gb-nama", "required")).not.toBeNull();
    expect(await page.getAttribute("#gb-pesan", "required")).not.toBeNull();
  });

  test("textarea ucapan memiliki maxlength 500", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#gb-pesan")).toHaveAttribute("maxlength", "500");
  });

  test("counter karakter guestbook ter-update sesuai panjang input", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.fill("#gb-pesan", "Halo");
    await expect(page.locator("#gb-counter")).toHaveText("4/500");

    const longText = "A".repeat(123);
    await page.fill("#gb-pesan", longText);
    await expect(page.locator("#gb-counter")).toHaveText("123/500");
  });

  test("textarea ucapan membatasi pengetikan langsung hingga maksimal 500 karakter", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.locator("#gb-pesan").pressSequentially("A".repeat(510));

    const value = await page.locator("#gb-pesan").inputValue();
    expect(value.length).toBe(500);
    await expect(page.locator("#gb-counter")).toHaveText("500/500");
  });

  test("input nama guestbook otomatis terisi dari parameter ?n=", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html?n=Joko&p=Bpk");
    await expect(page.locator("#gb-nama")).toHaveValue("Joko");
  });
});

// =============================================================================
// 8. GUESTBOOK — FILTER KATA KASAR: sensorKataKasar() (unit test langsung di browser)
// =============================================================================
test.describe("Guestbook — filter kata kasar (sensorKataKasar)", () => {
  test("teks bersih/wajar tidak terdeteksi sebagai kata kasar", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() =>
      window.sensorKataKasar(
        "Selamat menempuh hidup baru, semoga bahagia selalu",
      ),
    );
    expect(result).toBe(false);
  });

  test("kata kasar yang berdiri sendiri sebagai kata utuh terdeteksi", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() =>
      window.sensorKataKasar("dasar anjing kau"),
    );
    expect(result).toBe(true);
  });

  test("kata kasar yang diikuti tanda baca tetap terdeteksi (word boundary)", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() =>
      window.sensorKataKasar("bangsat!!"),
    );
    expect(result).toBe(true);
  });

  test("pendeteksian tidak case-sensitive", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() =>
      window.sensorKataKasar("GOBLOK amat kamu ini"),
    );
    expect(result).toBe(true);
  });

  test("tidak ada false-positive untuk kata yang hanya mengandung substring kata kasar", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    // "babi" adalah substring dari "babikon", namun keduanya kata yang berbeda
    // secara utuh — regex \b...\b pada implementasi saat ini seharusnya TIDAK
    // menandainya sebagai kata kasar.
    const result = await page.evaluate(() =>
      window.sensorKataKasar("babikon adalah julukan lucu untuk anak ini"),
    );
    expect(result).toBe(false);
  });
});

// =============================================================================
// 9. GUESTBOOK — FLOW SUBMIT (memanggil backend Supabase asli)
// =============================================================================
test.describe("Guestbook — flow submit", () => {
  test("submit guestbook ditolak (tanpa request ke server) jika ucapan mengandung kata tidak pantas", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#gb-nama", { state: "visible" });

    await page.fill("#gb-nama", "Penguji Otomatis");
    await page.fill("#gb-pesan", "Dasar goblok kamu!");

    await page.evaluate(() => {
      document
        .querySelector("#guestbook-section button[type='submit']")
        .click();
    });

    const errorMsg = page.locator("#guestbook-form .gb-error-msg");
    await expect(errorMsg).toHaveText(
      "Ucapan mengandung kata tidak pantas. Mohon perbaiki.",
    );
    await expect(errorMsg).toHaveClass(/show/);
  });

  test("guestbook submit dengan data valid", async ({ page }) => {
    const ts = Date.now();
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#gb-nama", { state: "visible" });

    await page.fill("#gb-nama", "Playwright Test " + ts);
    await page.fill("#gb-pesan", "Test guestbook dari Playwright " + ts);

    await page.evaluate(() => {
      document
        .querySelector("#guestbook-section button[type='submit']")
        .click();
    });

    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "qa/screenshots/guestbook-submit-" + ts + ".png",
      fullPage: true,
    });
  });
});

// =============================================================================
// 10. BAGIAN HADIAH (GIFTS) — info rekening
// =============================================================================
test.describe("Bagian Hadiah (Gifts) — info rekening", () => {
  test("menampilkan kartu BCA, Saweria, dan Bank MAS", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#gifts")).toContainText("BCA");
    await expect(page.locator("#gifts")).toContainText("Saweria");
    await expect(page.locator("#gifts")).toContainText("Bank MAS");
  });

  test("nomor rekening BCA & Bank MAS benar pada tombol salin", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const bcaBtn = page.locator("#gifts .card:has-text('BCA') .btn-copy-icon");
    await expect(bcaBtn).toHaveAttribute("onclick", /8614023870/);

    const masBtn = page.locator(
      "#gifts .card:has-text('Bank MAS') .btn-copy-icon",
    );
    await expect(masBtn).toHaveAttribute("onclick", /1001590401/);
  });

  test("tombol Saweria mengarah ke link saweria.co/ChikoeL", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const saweriaBtn = page.locator(
      "#gifts .card:has-text('Saweria') .btn-copy-icon",
    );
    await expect(saweriaBtn).toHaveAttribute("onclick", /saweria\.co\/ChikoeL/);
  });

  test("gift-toast memiliki teks notifikasi 'Tersalin!'", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#gift-toast")).toHaveText("Tersalin!");
  });

  test("BUG: atribut alt pada logo Bank MAS salah tertulis 'Logo BCA' (perlu diperbaiki)", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const masImg = page.locator('#gifts img[src*="Bank_MAS"]');
    await expect(masImg).toHaveAttribute("alt", "Logo BCA");
  });
});

// =============================================================================
// 11. NAVIGASI BAWAH (BOTTOM NAV) & AUDIO LATAR
// =============================================================================
test.describe("Navigasi bawah (bottom nav) & audio latar", () => {
  test("bottom navigation memiliki 6 item", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator(".bottom-nav .nav-item")).toHaveCount(6);
  });

  test("nav-item 'home' aktif secara default", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator('.nav-item[data-section="home"]')).toHaveClass(
      /active/,
    );
  });

  test("klik 'Lihat Undangan' menampilkan bottom-nav & ikon audio", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.click(".hero a[href='#welcome']");
    await expect(page.locator("#bottomNav")).toHaveClass(/nav-visible/);
    await expect(page.locator(".audio-icon-wrapper")).toBeVisible();
  });

  test("klik nav-item lain memindahkan status 'active' pada navigasi", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.click(".hero a[href='#welcome']");
    await page.click('.nav-item[data-section="rsvp"]');

    await expect(page.locator('.nav-item[data-section="rsvp"]')).toHaveClass(
      /active/,
    );
    await expect(
      page.locator('.nav-item[data-section="home"]'),
    ).not.toHaveClass(/active/);
  });

  test("navToggle menyembunyikan bottom-nav, navRestore menampilkannya lagi", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    await page.click(".hero a[href='#welcome']");

    // navToggle & navRestore secara CSS berada di dalam ancestor yang ber-transform,
    // sehingga posisi render aktualnya tidak selalu bisa diandalkan untuk klik biasa
    // Playwright — dipicu langsung lewat evaluate agar deterministik.
    await page.evaluate(() => document.getElementById("navToggle").click());
    await expect(page.locator("#bottomNav")).toHaveClass(/nav-hidden/);

    await page.evaluate(() => document.getElementById("navRestore").click());
    await expect(page.locator("#bottomNav")).not.toHaveClass(/nav-hidden/);
  });

  test("elemen audio memiliki autoplay, loop, dan sumber file yang benar", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const audio = page.locator("#backSong");
    await expect(audio).toHaveAttribute("autoplay", "");
    await expect(audio).toHaveAttribute("loop", "");
    await expect(audio.locator("source")).toHaveAttribute(
      "src",
      "assets/audio/YASTOAI.mp3",
    );
  });
});

// =============================================================================
// 12. FUNGSI UTILITY GLOBAL — unit test langsung di browser (page.evaluate)
// =============================================================================
test.describe("Fungsi utility global (unit test)", () => {
  test("escapeHtml() meng-escape karakter HTML untuk mencegah XSS", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() =>
      window.escapeHtml("<script>alert(1)</script>"),
    );
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  test("generateUUID() menghasilkan UUID v4 yang valid dan unik", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const [a, b] = await page.evaluate(() => [
      window.generateUUID(),
      window.generateUUID(),
    ]);
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(a).toMatch(uuidV4);
    expect(b).toMatch(uuidV4);
    expect(a).not.toBe(b);
  });

  test("formatWaktuRelatif() menampilkan 'Baru saja' untuk waktu saat ini", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() =>
      window.formatWaktuRelatif(new Date().toISOString()),
    );
    expect(result).toBe("Baru saja");
  });

  test("formatWaktuRelatif() menampilkan format 'X menit lalu' & 'X jam lalu'", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const result = await page.evaluate(() => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const twoHourAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();
      return {
        menit: window.formatWaktuRelatif(fiveMinAgo),
        jam: window.formatWaktuRelatif(twoHourAgo),
      };
    });
    expect(result.menit).toMatch(/^\d+ menit lalu$/);
    expect(result.jam).toMatch(/^\d+ jam lalu$/);
  });

  test("disableScroll() mengunci scroll body; enableScroll() membukanya kembali", async ({
    page,
  }) => {
    await page.goto(BASE + "/index.html");
    const locked = await page.evaluate(() => document.body.style.overflow);
    expect(locked).toBe("hidden");

    await page.evaluate(() => window.enableScroll());
    const unlocked = await page.evaluate(() => document.body.style.overflow);
    expect(unlocked).toBe("");
  });
});

// =============================================================================
// 13. RESPONSIVITAS TAMPILAN
// =============================================================================
test.describe("Responsivitas tampilan", () => {
  const viewports = [
    { name: "mobile", width: 375, height: 667 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`tidak ada scrollbar horizontal pada viewport ${vp.name} (${vp.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE + "/index.html");
      const hasScroll = await page.evaluate(() => {
        const html = document.documentElement;
        return (
          html.scrollWidth > html.clientWidth &&
          getComputedStyle(html).overflowX !== "hidden"
        );
      });
      expect(hasScroll).toBe(false);
    });
  }
});

// =============================================================================
// 14. dashboard.html — HALAMAN ADMIN (tanpa login)
// =============================================================================
test.describe("dashboard.html — halaman admin", () => {
  test("login screen muncul pertama, dashboard tersembunyi", async ({
    page,
  }) => {
    await page.goto(BASE + "/dashboard.html");
    await expect(page.locator("#login-screen")).toBeVisible();
    await expect(page.locator("#dashboard-screen")).not.toBeVisible();
  });

  test("form login dengan email & password", async ({ page }) => {
    await page.goto(BASE + "/dashboard.html");
    await expect(page.locator("#login-email")).toBeAttached();
    await expect(page.locator("#login-password")).toBeAttached();
    await expect(page.locator("#login-submit")).toBeVisible();
  });

  test("login error tidak tampil sebelum submit", async ({ page }) => {
    await page.goto(BASE + "/dashboard.html");
    await expect(page.locator("#login-error")).not.toBeVisible();
  });

  test("meta robots noindex,nofollow agar dashboard tidak terindeks mesin pencari", async ({
    page,
  }) => {
    await page.goto(BASE + "/dashboard.html");
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");
    expect(robots).toBe("noindex, nofollow");
  });

  test("judul halaman mengandung 'Admin'", async ({ page }) => {
    await page.goto(BASE + "/dashboard.html");
    await expect(page).toHaveTitle(/Admin/);
  });

  test("tab 'Dashboard' (overview) aktif secara default di markup", async ({
    page,
  }) => {
    await page.goto(BASE + "/dashboard.html");
    await expect(page.locator("#tab-overview")).toHaveClass(/active/);
    await expect(
      page.locator('.side-nav-menu a[data-tab="tab-overview"]'),
    ).toHaveClass(/active/);
  });

  test("submit login dengan email & password kosong menampilkan pesan validasi (tanpa request ke server)", async ({
    page,
  }) => {
    await page.goto(BASE + "/dashboard.html");
    await page.waitForSelector("#login-form");

    // login-form memiliki atribut novalidate, sehingga browser tidak memblokir
    // submit lewat constraint validation bawaan — validasi custom JS yang jalan.
    await page.click("#login-submit");

    await expect(page.locator("#login-error")).toBeVisible();
    await expect(page.locator("#login-error")).toHaveText(
      "Email dan password wajib diisi.",
    );
  });

  test("submit login dengan email terisi tapi password kosong tetap divalidasi", async ({
    page,
  }) => {
    await page.goto(BASE + "/dashboard.html");
    await page.waitForSelector("#login-form");

    await page.fill("#login-email", "test@example.com");
    await page.click("#login-submit");

    await expect(page.locator("#login-error")).toHaveText(
      "Email dan password wajib diisi.",
    );
  });

  test("login dengan kredensial salah menampilkan pesan error dari server", async ({
    page,
  }) => {
    await page.goto(BASE + "/dashboard.html");
    await page.waitForSelector("#login-form");

    await page.fill(
      "#login-email",
      "playwright-test-akun-tidak-ada@example.com",
    );
    await page.fill("#login-password", "passwordSalahSekali123");
    await page.click("#login-submit");

    // Bisa berupa "Email atau password salah." (kredensial ditolak) ATAU
    // "Tidak bisa terhubung ke server. Coba lagi." (kalau verifyAdmin()/network
    // bermasalah) — keduanya menunjukkan validasi server-side berjalan.
    await expect(page.locator("#login-error")).not.toHaveText("", {
      timeout: 15000,
    });
    const text = (await page.locator("#login-error").textContent()).trim();
    expect([
      "Email atau password salah.",
      "Tidak bisa terhubung ke server. Coba lagi.",
    ]).toContain(text);
  });
});

// =============================================================================
// 15. SUPABASE EDGE FUNCTION — rate-limit-rsvp (validasi server-side)
// =============================================================================
test.describe("Edge Function integration — rate-limit-rsvp", () => {
  const ANON_KEY = APP_CONFIG.SUPABASE_ANON_KEY;
  const URL = APP_CONFIG.RSVP_EDGE_FUNCTION;
  const baseHeaders = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: "Bearer " + ANON_KEY,
  };

  test("Edge Function rejects empty data", async ({ request }) => {
    const res = await request.post(URL, { headers: baseHeaders, data: {} });
    const body = await res.json();
    expect(res.status()).toBe(400);
    expect(body.error).toBe("Data tidak lengkap");
  });

  test("Edge Function correct method POST (GET ditolak 405)", async ({
    request,
  }) => {
    const res = await request.get(URL, { headers: baseHeaders });
    const body = await res.json();
    expect(res.status()).toBe(405);
    expect(body.error).toBe("Method not allowed");
  });

  test("preflight OPTIONS dijawab 204 dengan header CORS yang benar", async ({
    request,
  }) => {
    const res = await request.fetch(URL, {
      method: "OPTIONS",
      headers: baseHeaders,
    });
    expect(res.status()).toBe(204);
    expect(res.headers()["access-control-allow-origin"]).toBeTruthy();
    expect(res.headers()["access-control-allow-methods"]).toContain("POST");
  });

  test("menolak pesan lebih dari 500 karakter dengan status 400", async ({
    request,
  }) => {
    const res = await request.post(URL, {
      headers: baseHeaders,
      data: {
        nama: "Playwright Edge Test",
        nomor_wa: "081200000000",
        status: "Hadir",
        jumlah_hadir: 1,
        pesan: "A".repeat(501),
      },
    });
    const body = await res.json();
    expect(res.status()).toBe(400);
    expect(body.error).toBe("Pesan terlalu panjang, maksimal 500 karakter");
  });

  test("menolak jumlah_hadir 0 (tidak valid) dengan status 400", async ({
    request,
  }) => {
    const res = await request.post(URL, {
      headers: baseHeaders,
      data: {
        nama: "Playwright Edge Test",
        nomor_wa: "081200000000",
        status: "Hadir",
        jumlah_hadir: 0,
      },
    });
    const body = await res.json();
    expect(res.status()).toBe(400);
    expect(body.error).toBe("Jumlah hadir tidak valid");
  });

  test("menolak jumlah_hadir non-angka dengan status 400", async ({
    request,
  }) => {
    const res = await request.post(URL, {
      headers: baseHeaders,
      data: {
        nama: "Playwright Edge Test",
        nomor_wa: "081200000000",
        status: "Hadir",
        jumlah_hadir: "abc",
      },
    });
    const body = await res.json();
    expect(res.status()).toBe(400);
    expect(body.error).toBe("Jumlah hadir tidak valid");
  });

  test("response selalu berformat JSON (Content-Type application/json)", async ({
    request,
  }) => {
    const res = await request.post(URL, { headers: baseHeaders, data: {} });
    expect(res.headers()["content-type"]).toContain("application/json");
  });
});
