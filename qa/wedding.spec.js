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
