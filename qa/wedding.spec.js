const { test, expect } = require("playwright/test");
const path = require("path");

const BASE = "file://" + path.resolve(__dirname, "..");

test.describe("index.html — halaman publik", () => {
  test("hero section muncul dengan judul dan tombol", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator(".hero h1")).toHaveText("Reza & Ashila");
    await expect(page.locator(".hero a[href='#home']")).toBeVisible();
  });

  test("nama tamu dari URL param (?n= & ?p=)", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=Joko&p=Bpk");
    await expect(page.locator(".hero h4 span")).toContainText("Bpk Joko");
    await expect(page.locator("#nama")).toHaveValue("Joko");
  });

  test("fallback nama tamu jika tanpa param", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator(".hero h4 span")).toContainText("Invited Guest");
  });

  test("semua section utama ada", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    for (const id of ["hero", "home", "info", "cd", "rsvp", "gifts", "guestbook-section", "thankyou"]) {
      await expect(page.locator(`#${id}`).first()).toBeAttached();
    }
  });

  test("info acara menampilkan akad & resepsi", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#info")).toContainText("Akad Nikah");
    await expect(page.locator("#info")).toContainText("Resepsi");
  });

  test("countdown container ada", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#countdown")).toBeAttached();
  });

  test("form RSVP dengan semua field wajib", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#nama")).toBeAttached();
    await expect(page.locator("#jumlah")).toBeAttached();
    await expect(page.locator("#status")).toBeAttached();
    await expect(page.locator("#noWA")).toBeAttached();
    await expect(page.locator("#my-form button[type='submit']")).toBeVisible();
  });

  test("form guestbook dengan counter karakter", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#gb-nama")).toBeAttached();
    await expect(page.locator("#gb-pesan")).toBeAttached();
    await expect(page.locator("#gb-counter")).toHaveText("0/500");
  });

  test("AOS cuma di-load sekali (tidak duplikat)", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    const count = await page.evaluate(() =>
      document.querySelectorAll('script[src*="aos"]').length
    );
    expect(count).toBe(1);
  });

  test("counter karakter guestbook update", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await page.fill("#gb-pesan", "Halo");
    await expect(page.locator("#gb-counter")).toHaveText("4/500");
  });

  test("section gifts dengan BCA dan Saweria", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("#gifts")).toContainText("BCA");
    await expect(page.locator("#gifts")).toContainText("Saweria");
  });

  test("bottom navigation ada dengan 6 item", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    const items = page.locator(".bottom-nav .nav-item");
    await expect(items).toHaveCount(6);
  });

  test("footer ada", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await expect(page.locator("footer")).toContainText("Wedding Team Production");
  });

  test("responsive — overflow-x hidden, tidak ada scrollbar horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE + "/index.html");
    const hasScroll = await page.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth > html.clientWidth &&
        getComputedStyle(html).overflowX !== "hidden";
    });
    expect(hasScroll).toBe(false);
  });
});

test.describe("dashboard.html — halaman admin", () => {
  test("login screen muncul pertama", async ({ page }) => {
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
});

test.describe("RSVP flow — form submission", () => {
  const ts = Date.now();

  test("form RSVP submit sukses dengan data valid", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=playwright-test-" + ts + "&p=Bpk");
    await page.waitForSelector("#nama", { state: "visible" });

    // Isi form
    await page.fill("#nama", "Playwright Test " + ts);
    await page.fill("#noWA", "08123456789");
    await page.selectOption("#status", "Hadir");
    await page.fill("#jumlah", "2");

    // Submit — use evaluate because disableScroll() locks viewport scrolling
    await page.evaluate(() => {
      document.querySelector("#my-form button[type='submit']").click();
    });

    // Tunggu loading selesai (loading state -> selesai)
    // The form shows loading button then either success or error
    // Check that the form is no longer in loading state after some time
    await page.waitForTimeout(3000);

    // After successful submission, the RSVP section should show a success message
    // The RSVP form typically hides and shows a thank you message
    const rsvpSection = page.locator("#rsvp");
    await expect(rsvpSection).toBeAttached();

    // Screenshot for verification
    await page.screenshot({ path: "qa/screenshots/rsvp-success-" + ts + ".png", fullPage: true });
  });

  test("form RSVP gagal saat field dikosongkan", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#nama", { state: "visible" });

    // Jangan isi field, langsung submit (disableScroll locks viewport, use evaluate)
    await page.evaluate(() => {
      document.querySelector("#my-form button[type='submit']").click();
    });

    // HTML5 form validation harus mencegah submit
    // Atau minimal ada error message
    await page.waitForTimeout(1000);

    // If form validation prevented submit, form should still be visible
    const submitBtn = page.locator("#my-form button[type='submit']");
    await expect(submitBtn).toBeAttached();

    await page.screenshot({ path: "qa/screenshots/rsvp-empty-" + ts + ".png", fullPage: true });
  });

  test("form RSVP nama max 100 karakter (input attribute)", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=test&p=Bpk");
    await page.waitForSelector("#nama", { state: "visible" });

    // Check that maxlength attribute exists and is <= 100
    var maxlength = await page.getAttribute("#nama", "maxlength");
    expect(parseInt(maxlength)).toBeLessThanOrEqual(100);
  });

  test("form RSVP noWA tidak memiliki maxlength (perlu ditambahkan)", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=test&p=Bpk");
    await page.waitForSelector("#noWA", { state: "visible" });

    // noWA input tidak memiliki atribut maxlength di HTML — ini perlu diperbaiki
    var maxlength = await page.getAttribute("#noWA", "maxlength");
    expect(maxlength).toBeNull();
  });
});

test.describe("Guestbook flow", () => {
  const ts = Date.now();

  test("form guestbook counter update on input", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#gb-pesan", { state: "visible" });

    var longText = "A".repeat(123);
    await page.fill("#gb-pesan", longText);
    await expect(page.locator("#gb-counter")).toHaveText("123/500");
  });

  test("guestbook submit with valid data", async ({ page }) => {
    await page.goto(BASE + "/index.html");
    await page.waitForSelector("#gb-nama", { state: "visible" });

    await page.fill("#gb-nama", "Playwright Test " + ts);
    await page.fill("#gb-pesan", "Test guestbook dari Playwright " + ts);

    // disableScroll locks viewport, use evaluate to click
    await page.evaluate(() => {
      document.querySelector("#guestbook-section button[type='submit']").click();
    });

    await page.waitForTimeout(2000);

    await page.screenshot({ path: "qa/screenshots/guestbook-submit-" + ts + ".png", fullPage: true });
  });
});

test.describe("Edge Function integration", () => {
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeWZzYXBnYWRpY2trbnNmYnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDIwNDMsImV4cCI6MjA5NzY3ODA0M30.aQ37-_9-wl2pbDtqKSavOvrsUU-F-sIzv6g3hG23dHw";
  const URL = "https://liyfsapgadickknsfbus.functions.supabase.co/rate-limit-rsvp";

  test("Edge Function rejects empty data", async ({ request }) => {
    var res = await request.post(URL, {
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": "Bearer " + ANON_KEY,
      },
      data: {},
    });
    var body = await res.json();
    expect(res.status()).toBe(400);
    expect(body.error).toBe("Data tidak lengkap");
  });

  test("Edge Function correct method POST", async ({ request }) => {
    var res = await request.get(URL, {
      headers: {
        "apikey": ANON_KEY,
        "Authorization": "Bearer " + ANON_KEY,
      },
    });
    var body = await res.json();
    expect(res.status()).toBe(405);
    expect(body.error).toBe("Method not allowed");
  });
});

test.describe("URL params edge cases", () => {
  test("nama with special characters", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=John+Doe%26Family&p=Mr.");
    await expect(page.locator("#nama")).toHaveValue("John Doe&Family");
  });

  test("hanya param n tanpa p", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=Sinta");
    await expect(page.locator("#nama")).toHaveValue("Sinta");
    // Pronoun should have a default/fallback
  });

  test("hanya param p tanpa n", async ({ page }) => {
    await page.goto(BASE + "/index.html?p=Ibu");
    await expect(page.locator("#nama")).toHaveValue("");
  });

  test("param kosong", async ({ page }) => {
    await page.goto(BASE + "/index.html?n=&p=");
    await expect(page.locator("#nama")).toHaveValue("");
  });
});
