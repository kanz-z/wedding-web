# Debugging E2E Test Failures

## Checklist Cepat

### 1. Baca Error Message
- Buka HTML report: `npx playwright show-report`
- Lihat error stack trace di output terminal

### 2. Periksa Screenshot
- Screenshot diambil otomatis saat failure
- Lokasi: `test-results/[test-name]/[browser]/`
- Cari file `.png` — lihat state UI saat failure
- **Pertanyaan:** Apakah elemen yang diharapkan terlihat? Ada overlay/modal yang menghalangi?

### 3. Buka Trace
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```
- Trace menampilkan **setiap action** dengan screenshot di setiap langkah
- Cek tab "Source" untuk melihat line yang gagal
- Cek tab "Network" untuk memeriksa API calls
- Cek tab "Console" untuk error JavaScript

### 4. Periksa Video
- Video hanya direkam saat failure
- Lokasi: `test-results/[test-name]/[browser]/`
- Format: `.webm`
- Memberikan timeline visual lengkap sebelum failure terjadi

### 5. Jalankan Ulang dengan --headed
```bash
npm run test:headed
```
Melihat browser secara real-time membantu menemukan:
- Animasi yang belum selesai
- Popup/dialog tak terduga
- Loading state yang lambat
- Layout yang berbeda dari yang diharapkan

### 6. Debug Mode (Step-by-Step)
```bash
npm run test:debug
```
- Playwright Inspector terbuka
- Klik "Step over" untuk menjalankan langkah demi langkah
- Lihat state DOM di setiap langkah

### 7. Identifikasi Flakiness
```bash
# Jalankan 10x untuk melihat konsistensi
npx playwright test [file] --repeat-each=10

# Tambah retries untuk melihat pola
npx playwright test [file] --retries=3
```

### 8. Periksa Selector
```bash
# Buka Playwright Codegen untuk inspeksi live
npx playwright codegen [URL]
```
- Klik elemen di browser → Playwright men-generate selector optimal
- Update POM class dengan selector baru

## Penyebab Umum & Solusi

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Element not found | Selector berubah | Update di POM; gunakan `getByRole` |
| Timeout waiting | Loading lambat | Tambah `waitForResponse` atau naikkan timeout |
| Test kadang gagal | Race condition | Gunakan `waitForLoadState('networkidle')` |
| Overlay menghalangi | Modal/popup belum tertutup | Tambah `dismiss` dialog atau Escape |
| AOS animation blum selesai | Scroll fade-in 400ms | Gunakan `waitForTimeout(600)` khusus section scroll |
| API response lambat | Edge function cold start | Naikkan timeout jadi 15-30 detik |

## Kapan Meng-quarantine Test

Gunakan `test.fixme` atau `test.skip` jika:
- Bug production yang tidak akan segera diperbaiki → `test.fixme(true, 'Bug #123')`
- Test gagal hanya di browser tertentu → `test.fixme(!!process.env.CI, 'Flaky in CI — #456')`
- Test bergantung pada data eksternal yang tidak stabil

```typescript
test('flaky: RSVP dengan guest_count > 2', async ({ page }) => {
  test.fixme(!!process.env.CI, 'Flaky in CI — Issue #789');
  // ... test code
});
```
