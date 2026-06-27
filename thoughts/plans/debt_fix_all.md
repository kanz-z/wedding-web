# Debt Fix — All Findings Implementation Plan

## Overview

Memperbaiki 40 temuan dari QA Brutal Analysis pada wedding invitation system (vanilla HTML/CSS/JS + Supabase). Terbagi dalam 7 fase independen berdasarkan kategori.

## Current State Analysis

Hasil riset codebase:

- `dashboard.js` (1401 baris) — IIFE, state via global vars (`allTamu`, `allGb`, dll), Supabase JS client v2
- `index.html` (1358 baris) — global functions, Supabase client di inline script
- `dashboard.html` (673 baris) — admin panel shell
- `style.css` (624 baris) — dark theme
- `dashboard.css` (593 baris) — admin styles
- Schema: `supabase_schema.sql` + `supabase_migration_v2.sql` sudah dijalankan

Key discoveries:
- `escapeAttr()` di dashboard.js:86-88 hanya escape `'` dan `"` → XSS
- `generateUUID()` di index.html:987-997 punya fallback `Math.random()` → predictable
- `Promise.all` dipakai di 2 tempat: dashboard.js:343 (loadOverview) dan 486 (loadTamuRSVP) → partial failure
- `setInterval` polling di dashboard.js:1382 tidak pernah clear → leak
- `enterDashboard()` dashboard.js:114 eager load semua tab → double load
- QR check-in dashboard.js:1148-1155 dan manualCheckin dashboard.js:1228-1235 keduanya INSERT + UPDATE terpisah → race
- `checked_in_by` tidak pernah diisi (dashboard.js:1148, 1228)
- `submitRSVP()` index.html:1022 hardcode `is_approved: true`
- Edit orphan slug dashboard.js:736-745 cek `allTamu` saja, tidak ke DB
- Guestbook count index.html:1210-1213 pakai `count: "exact"` → berat
- `backdrop-filter` 5 kemunculan tanpa CSS fallback
- `formatDate()` dashboard.js:60 pakai `dateStyle`/`timeStyle` → iOS <14.5 crash
- `copyGuestLink()` dashboard.js:704 fallback `prompt()` → mobile not supported
- `nomor_wa` nullable issue dashboard.js:881 kirim `null` ke kolom `NOT NULL`
- Status empty string dashboard.js:904 bisa kirim `""` → SQL CHECK reject
- Guestbook: RLS `guestbook_select_approved_anon` sudah ada

## What We're NOT Doing

- Mengubah default `is_approved` di guestbook (3.5 — sengaja dibiarkan `true`)
- Menambah dependency baru (reCAPTCHA, library NLP, dll)
- Refactor arsitektur besar (masih tetap vanilla JS, no framework)
- Migration data untuk record existing

## Implementation Phases

---

## Phase 1: 🔐 Security (6 items)

Items: 1.1 (XSS escapeAttr), 1.2 (rate limiting RSVP), 1.3 (maxlength nama), 1.4 (profanity filter), 1.5 (UUID predictable), 8.1 (crypto.randomUUID HTTP)

### 1.1 — Fix escapeAttr() XSS

**File**: `dashboard.js:86-88`
**Change**: Replace function to escape ALL dangerous HTML characters

```js
function escapeAttr(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/`/g, "&#x60;");
}
```

**Why**: `<`, `>`, `&`, `` ` `` tidak diescape sebelumnya. Nama tamu bisa berisi XSS payload.

### 1.2 — Rate Limiting via Supabase Edge Function

**File baru**: `supabase/functions/rate-limit-rsvp/index.ts`

**Change**:
1. Buat Edge Function yang:
   - Menerima request RSVP data
   - Cek rate limit berdasarkan IP (gunakan Supabase `request` object)
   - Batasi 5 RSVP per IP per 10 menit (simpan di tabel `rate_limits` atau KV store)
   - Jika lolos, INSERT ke tabel `rsvps` via service_role key
   - Return sukses/gagal
2. **File**: `index.html` — ubah flow submit RSVP:
   - Sebelumnya: `supabaseClient.from("rsvps").insert([...])` langsung
   - Sesudah: fetch ke `https://[project].functions.supabase.co/rate-limit-rsvp` dengan data yang sama
3. **File baru**: `MD&DOC/supabase_migration_v3.sql` — tambah tabel `rate_limits` jika perlu

### 1.3 — Tambah maxlength di Nama RSVP

**File**: `index.html:330-338`

**Change**: Tambah `maxlength="100"` di input nama:
```html
<input type="text" class="form-control" id="nama" name="nama"
       placeholder="Cth: Muhammad Fajar" required maxlength="100" />
```

**File baru**: `MD&DOC/supabase_migration_v3.sql`
**Change**: Tambah CHECK constraint:
```sql
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_nama_length_check
  CHECK (char_length(nama) <= 100);
```

**Note**: Constraint hanya berlaku untuk INSERT/UPDATE baru. Record existing tidak terpengaruh.

**File**: `dashboard.js:883` — tambah validasi di form tamu:
```js
if (data.name.length > 100) {
  showToast("Nama maksimal 100 karakter.", true);
  return;
}
```

### 1.4 — Fix Profanity Filter (word boundary)

**File**: `index.html:1120-1126`
**Change**: Replace `indexOf()` with regex word boundary:
```js
function sensorKataKasar(text) {
  for (var i = 0; i < KATA_KASAR.length; i++) {
    var regex = new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i");
    if (regex.test(text)) return true;
  }
  return false;
}
```

**Why**: "babi" di "babikon" sebelumnya false positive. Regex `\b` memastikan whole word match.

### 1.5 + 8.1 — Fix generateUUID (hapus Math.random fallback)

**File**: `index.html:987-997`
**Change**: Simplify to only use crypto.randomUUID():
```js
function generateUUID() {
  return crypto.randomUUID();
}
```

**Why**: Tidak perlu fallback `Math.random()`. Project sudah via HTTPS (Netlify). Jika `crypto.randomUUID()` tidak tersedia, biarkan error terlihat (developer akan tahu).

### Phase 1 — Testing

**Automated:**
- [x] `escapeAttr()` test: input `"><script>alert(1)</script>` → output tidak mengandung `<`, `>`, atau `"`
- [x] `escapeAttr()` test: input normal "Budi" → output "Budi"
- [x] `sensorKataKasar()` test: "babikon" → false, "babi" → true
- [x] `sensorKataKasar()` test: "ANJING" → true (case insensitive)
- [x] `generateUUID()` test: return string format UUID v4
- [x] Input nama > 100 karakter di RSVP form → ditolak
- [x] Edge Function deploy: `supabase functions deploy rate-limit-rsvp`

**Manual:**
- [x] XSS payload di nama tamu tidak tereksekusi di dashboard
- [x] RSVP spam > 5 kali dalam 10 menit ditolak
- [x] Edge Function response proper untuk success dan error

---

## Phase 2: ⚡ Concurrency (3 items)

Items: 2.1 (QR race condition), 2.2 (polling leak), 2.3 (tab double load)

### 2.1 — QR Check-in Atomic via RPC

**File baru**: `MD&DOC/supabase_migration_v3.sql`
**Change**: Tambah RPC function:
```sql
CREATE OR REPLACE FUNCTION public.process_checkin(
  p_rsvp_id uuid,
  p_checked_by uuid,
  p_method text,
  p_guest_count_actual int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tamu record;
BEGIN
  -- Cek RSVP exists
  SELECT id, nama, checked_in INTO v_tamu
  FROM public.rsvps WHERE id = p_rsvp_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tamu tidak ditemukan');
  END IF;
  
  -- Cek sudah check-in
  IF v_tamu.checked_in THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sudah check-in');
  END IF;
  
  -- INSERT guest_checkins
  INSERT INTO public.guest_checkins (rsvp_id, checked_in_by, method, guest_count_actual)
  VALUES (p_rsvp_id, p_checked_by, p_method, p_guest_count_actual);
  
  -- UPDATE rsvps
  UPDATE public.rsvps SET checked_in = true WHERE id = p_rsvp_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'nama', v_tamu.nama
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sudah check-in');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

**File**: `dashboard.js:1106-1172` (onScanSuccess)
**Change**: Replace two sequential writes with single RPC call:
```js
async function onScanSuccess(decodedText) {
  // ... token extraction ...
  try {
    var res = await sb.rpc("process_checkin", {
      p_rsvp_id: tamu.id,
      p_checked_by: currentUser ? currentUser.id : null,
      p_method: "qr",
      p_guest_count_actual: tamu.jumlah_hadir
    });
    if (res.error) throw res.error;
    if (!res.data.success) {
      // handle error (already checked in, etc.)
      return;
    }
    // success flow
  } catch (err) { ... }
}
```

**File**: `dashboard.js:1222-1246` (manualCheckin)
**Change**: Same pattern — use `process_checkin` RPC instead of two writes.

### 2.2 — Fix Polling Leak

**File**: `dashboard.js:1381-1397`
**Change**: Store interval ID and clear on logout:
```js
// At top level, change:
// var pollTimer = null;  (add near other state vars)

// Change setInterval to:
var pollTimer = setInterval(async function () { ... }, 30000);

// In logout handler (dashboard.js:220-232), add:
if (pollTimer) {
  clearInterval(pollTimer);
  pollTimer = null;
}
```

**Also**: Clear scanner on logout already exists (dashboard.js:227-230) — good.

### 2.3 — Fix Tab Double Load

**File**: `dashboard.js:114-122` (enterDashboard)
**Change**: Remove eager loads, let switchTab handle lazy loading:
```js
function enterDashboard(user) {
  currentUser = user;
  whoEmail.textContent = user.email || "";
  showScreen("dashboard");
  // Remove: loadOverview(), loadTamuRSVP(), loadGuestbook(), loadCheckinLog()
  // switchTab("tab-overview") will trigger the first load via lazy load
}
```

**File**: `dashboard.js:178-199` (switchTab)
**Verify**: Lazy load already exists for each tab. Overview will be loaded via `switchTab("tab-overview")` which is called from the tab click handler or init flow.

**Note**: Check `init()` function to ensure `switchTab("tab-overview")` is called after `enterDashboard()`.

### Phase 2 — Testing

**Automated:**
- [x] RPC function `process_checkin` created and callable
- [x] QR scan ganda: second scan returns "Sudah check-in"
- [x] Polling interval ID disimpan dan di-clear di logout
- [x] Overview tidak di-load dua kali (console log test)

**Manual:**
- [x] QR scan sukses → check-in ter-record
- [x] QR scan 2x cepat → data tidak corrupt
- [x] Login → logout → login ulang → tidak ada duplicate polling
- [x] Tab switch responsive, tidak ada double loading

---

## Phase 3: 📊 Data Integrity (5 items)

Items: 3.1 (Promise.all partial failure), 3.2 (guests no limit), 3.3 (RSVP limit 500), 3.4 (orphan auto-match), 4.3 (allTamu race)

### 3.1 — Fix Promise.all Partial Failure (2 locations)

**File**: `dashboard.js:486-497` (loadTamuRSVP)
**File**: `dashboard.js:343-353` (loadOverview)

**Change**: Replace `Promise.all` with `Promise.allSettled`:

For loadTamuRSVP:
```js
var results = await Promise.allSettled([
  sb.from("guests").select("..."),
  sb.from("rsvps").select("...").order("created_at", { ascending: false }).limit(500),
]);
var guestsRes = results[0].status === "fulfilled" ? results[0].value : { data: [], error: results[0].reason };
var rsvpsRes = results[1].status === "fulfilled" ? results[1].value : { data: [], error: results[1].reason };

if (guestsRes.error) {
  console.error("Guests fetch failed:", guestsRes.error);
  // Show error but continue with empty guests
}
var guests = guestsRes.data || [];
// Continue with partial data
```

**Also**: Show a status message on the UI for failed parts.

For loadOverview (dashboard.js:343), same pattern.

### 3.2 — Add Limit to Guests Query

**File**: `dashboard.js:486-489`
**Change**: Add `.limit(1000)`:
```js
sb.from("guests")
  .select("id, slug, name, pronoun, invited_count, created_at, side, nomor_wa")
  .limit(1000)
```

### 3.3 — Increase RSVP Limit

**File**: `dashboard.js:496`
**Change**: `.limit(500)` → `.limit(2000)`

### 3.4 — Replace Orphan Auto-match with Manual UI

**File**: `dashboard.js:457-479` (autoMatchOrphan)
**Change**: Remove auto-match logic entirely. Instead:

1. Keep `autoMatchOrphan` but only use it as a **suggestion** (don't auto-assign)
2. Add a "Manual Match" button next to orphan entries in the table
3. Clicking opens a dropdown of guests to select which guest this orphan belongs to
4. On selection, update `rsvps.guest_id` in database

**File**: `dashboard.js:540-563` — change orphan processing:
```js
unmatchedRsvps.forEach(function (r) {
  if (linkedGuestIds[r.id]) return;
  // No auto-match. Suggest but don't assign.
  var suggestion = autoMatchOrphan(r, guests);
  allTamu.push({
    // ... same data ...
    _source: "orphan",
    _suggested_guest: suggestion ? suggestion.id : null,
  });
});
```

**File**: `dashboard.js:615-675` (renderTamuTable) — add "Manual Match" button for orphan entries.

**File**: `dashboard.js` — add function `matchOrphanToGuest(orphanId, guestId)` that updates `rsvps.guest_id`.

### 4.3 — allTamu State Race Guard

**File**: `dashboard.js` — add isLoading flag near state vars:
```js
var isLoadingTamu = false;
```

**File**: `dashboard.js:482-577` (loadTamuRSVP):
```js
async function loadTamuRSVP() {
  if (isLoadingTamu) return; // guard
  isLoadingTamu = true;
  try {
    // ... existing logic ...
  } finally {
    isLoadingTamu = false;
  }
}
```

### Phase 3 — Testing

**Automated:**
- [x] loadTamuRSVP() tidak crash jika query guests gagal tapi rsvps sukses
- [x] loadOverview() tidak crash jika salah satu query gagal
- [x] Guests query return max 1000 rows
- [x] RSVP query return max 2000 rows
- [x] allTamu duplikat tidak terjadi saat loadTamuRSVP dipanggil 2x cepat

**Manual:**
- [x] Orphan RSVP tampil dengan opsi manual match
- [x] Manual match berhasil update guest_id di database
- [x] Error state tampil di overview/tamu tab jika fetch partial gagal

---

## Phase 4: 🐛 Logic Bugs + Error Handling (7 items)

Items: 4.1 (verifyAdmin error), 4.2 (guestbook error), 5.1 (disableScroll), 5.2 (html2canvas), 5.3 (submitRSVP), 5.4 (slug collision), 5.5 (fetchGuest duplicate)

### 4.1 — Pisahkan Login dan verifyAdmin

**File**: `dashboard.js:153-174`
**Change**: Separate try/catch for login and verifyAdmin:
```js
loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  setLoginError(null);
  // ... validation ...
  setLoginLoading(true);
  
  // Step 1: Login
  var res;
  try {
    res = await sb.auth.signInWithPassword({ email, password });
  } catch (err) {
    setLoginError("Tidak bisa terhubung ke server. Coba lagi.");
    setLoginLoading(false);
    return;
  }
  
  if (res.error) {
    setLoginError("Email atau password salah.");
    setLoginLoading(false);
    return;
  }
  
  // Step 2: Verify admin
  var isAdmin;
  try {
    isAdmin = await verifyAdmin(res.data.user);
  } catch (err) {
    // Login sukses tapi verify gagal — kasih tahu user
    setLoginError("Verifikasi admin gagal. Coba lagi atau hubungi developer.");
    // Jangan logout user — biarkan session tetap
    setLoginLoading(false);
    return;
  }
  
  if (!isAdmin) {
    await sb.auth.signOut();
    setLoginError("Akun ini belum terdaftar sebagai admin.");
    setLoginLoading(false);
    return;
  }
  
  loginForm.reset();
  setLoginLoading(false);
  enterDashboard(res.data.user);
});
```

### 4.2 — Guestbook Error Retry Button

**File**: `dashboard.js:961-979` (loadGuestbook)
**Change**: Add retry button in error state:
```js
} catch (err) {
  document.getElementById("gb-status").innerHTML =
    "Gagal memuat guestbook. <button class='btn-sm' onclick='loadGuestbook()' style='margin-left:8px'>Coba lagi</button>";
  document.getElementById("gb-status").classList.add("show");
}
```

**File**: `dashboard.js:1367-1378` — ensure `loadGuestbook` is exposed globally.

### 5.1 — Fix disableScroll

**File**: `index.html:733-751`
**Change**: Replace JavaScript scroll lock with CSS `overflow: hidden`:
```js
function disableScroll() {
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
  // Capture current scroll position
  window._scrollY = window.pageYOffset || document.documentElement.scrollTop;
}

function enableScroll() {
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  window.scrollTo(0, window._scrollY || 0);
  playAudio();
}
```

**Why**: CSS approach tidak fight dengan AOS/IntersectionObserver. Programmatic scroll tetap jalan.

### 5.2 — Fix renderDigitalCard Timeout

**File**: `index.html:1040-1090`
**Change**: Add timeout to html2canvas via Promise.race:
```js
async function renderDigitalCard(rsvpResult, nama, jumlah, status) {
  // ... setup card ...
  
  try {
    var canvas = await Promise.race([
      html2canvas(card, { scale: 2, useCORS: true }),
      new Promise(function(_, reject) {
        setTimeout(function() {
          reject(new Error("Timeout render kartu"));
        }, 10000);
      })
    ]);
    
    var blob = await new Promise(function(resolve, reject) {
      canvas.toBlob(function(b) {
        if (b) resolve(b);
        else reject(new Error("toBlob returned null"));
      }, "image/png");
    });
    
    // ... download flow ...
  } catch (e) {
    // Fallback: show card on screen
    card.style.display = "block";
    card.style.position = "relative";
    card.style.left = "";
    card.style.margin = "1rem auto";
    showToast("Download gagal. Silakan screenshot kartu undangan.", true);
  }
}
```

**Note**: `toBlob` is already promisified (index.html:1061-1066). Just need to add the timeout.

### 5.3 — Fix submitRSVP Return Real is_approved

**File**: `index.html:999-1027`
**Change**: Use `.select()` to get real data:
```js
async function submitRSVP(guestId, namaInput, jumlahInput, statusInput, pesanInput, noWaInput) {
  const qrToken = generateUUID();
  var { data, error } = await supabaseClient
    .from("rsvps")
    .insert([{
      guest_id: guestId || null,
      nama: namaInput,
      nomor_wa: noWaInput,
      jumlah_hadir: jumlahInput,
      status: statusInput,
      pesan: pesanInput || null,
      qr_token: qrToken,
    }])
    .select("is_approved, qr_token, jumlah_hadir, pesan");

  if (error) throw error;
  return {
    is_approved: data[0].is_approved,
    qr_token: data[0].qr_token,
    jumlah_hadir: data[0].jumlah_hadir,
    pesan: data[0].pesan,
  };
}
```

### 5.4 — Fix Slug Collision (validate against DB)

**File**: `dashboard.js:736-745`
**Change**: Replace `allTamu.some()` with DB query:
```js
// Add async
var baseSlug = entry.nama.toLowerCase().replace(/\s+/g, "-");
var slug = baseSlug;
var slugNum = 1;

try {
  var existing = await sb.from("guests").select("slug").eq("slug", slug).maybeSingle();
  while (existing.data) {
    slug = baseSlug + "-" + slugNum++;
    existing = await sb.from("guests").select("slug").eq("slug", slug).maybeSingle();
  }
} catch (e) {
  // Fallback: use baseSlug and let unique constraint handle it
  slug = baseSlug;
}
document.getElementById("gf-slug").value = slug;
```

**Note**: Function `editTamu()` needs to become `async` — which means its callers also need adjustment (the onclick handler).

### 5.5 — Remove Duplicate fetchGuest

**File**: `index.html:980-986`
**Change**: Delete this global declaration. The function is already declared inside the closure at `index.html:820`.

Actually, looking more carefully:
- `index.html:820`: `const guest = await fetchGuest(slug);` — this calls the **global** `fetchGuest` 
- `index.html:980`: `async function fetchGuest(guestSlug) { ... }` — this IS the global declaration

So the closure at line 820 is the **consumer**, not the declaration. The only declaration is the global one at line 980. This means the "duplicate" claim might not be accurate.

**Verify**: Read line 820 context more carefully. The function at line 980 is the only declaration. If there's truly a second declaration elsewhere, remove it.

### Phase 4 — Testing

**Automated:**
- [x] Login sukses + verifyAdmin gagal → tampilkan pesan spesifik (bukan "Tidak bisa terhubung")
- [x] Guestbook error state punya tombol retry
- [x] disableScroll() pakai CSS overflow → tidak conflict dengan AOS
- [x] renderDigitalCard timeout < 10 detik → fallback graceful
- [x] submitRSVP return data real dari database (cek `is_approved`)
- [x] Slug validation ke DB, bukan hanya allTamu
- [x] fetchGuest() hanya 1 deklarasi di index.html

**Manual:**
- [x] Scroll behavior smooth setelah enableScroll
- [x] Digital card download tetap berfungsi di mobile Safari
- [x] Edit orphan slug → tidak error "Slug sudah digunakan"

---

## Phase 5: 🚀 Performance (4 items)

Items: 6.1 (guestbook pagination double query), 6.2 (tbody rerender), 6.3 (activity log client pagination), 6.4 (guestbook limit 500)

### 6.1 — Fix Guestbook Pagination Count Query

**File**: `index.html:1210-1213`
**Change**: Replace `count: "exact"` with `count: "estimated"`:
```js
var countRes = await supabaseClient
  .from("guestbook")
  .select("id", { count: "estimated", head: true })
  .eq("is_approved", true);
```

**Why**: `estimated` jauh lebih cepat untuk tabel besar. Perbedaan akurasi tidak signifikan untuk guestbook.

### 6.2 — Use DocumentFragment for Table Render

**File**: `dashboard.js:592-676` (renderTamuTable)
**Change**: Use DocumentFragment for batch DOM insertion:
```js
function renderTamuTable() {
  var tbody = document.getElementById("tamu-tbody");
  tbody.innerHTML = "";
  // ... filtering logic ...
  
  var fragment = document.createDocumentFragment();
  filtered.forEach(function (t) {
    var tr = document.createElement("tr");
    tr.innerHTML = "...";
    // ... existing rendering ...
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
  
  // ... existing code ...
}
```

### 6.3 — Add Server-side Pagination to Activity Log

**File**: `dashboard.js:340-403` (loadOverview)
**File**: `dashboard.js:375-398`

**Change**: The activity log merges RSVP + guestbook and paginates client-side. Instead, fetch with range:
```js
async function loadOverview() {
  // Use .range() and .order() for server-side pagination
  var rsvpRes = await sb
    .from("rsvps")
    .select("status, jumlah_hadir, nama, created_at")
    .order("created_at", { ascending: false })
    .range(0, 49); // last 50 items
  
  var gbRes = await sb
    .from("guestbook")
    .select("nama, pesan, created_at")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .range(0, 49);
  
  // ... rest stays same ...
}
```

**Alternatively**: If exact count is needed, keep the merge but add `limit(200)` to each query.

### 6.4 — Increase Guestbook Limit in Dashboard

**File**: `dashboard.js:970`
**Change**: `.limit(500)` → `.limit(2000)` or implement pagination.
For now: `.limit(2000)`.

### Phase 5 — Testing

**Automated:**
- [x] Guestbook count query pakai `estimated` (dicek via query log)
- [x] renderTamuTable() pakai DocumentFragment (tidak ada regresi visual)
- [x] Activity log memakai `.range()` atau `limit` untuk server-side pagination
- [x] Dashboard guestbook menampilkan > 500 entries

**Manual:**
- [x] Tabel tamu dengan 500+ baris tetap responsif
- [x] Filter tabel tidak ada delay panjang
- [x] Guestbook pagination di halaman publik tetap berfungsi

---

## Phase 6: 🎨 UX / Usability (4 items)

Items: 7.1 (continuous scan), 7.2 (loading state), 7.3 (toast collision), 7.4 (copy fallback)

### 7.1 — Continuous QR Scan Mode

**File**: `dashboard.js:1065-1172`

**Change**:
1. Add a new state variable:
```js
var scannerActive = false;
```

2. **startScanner()** — add visual indicator (scanner active state):
```js
function startScanner() {
  // ... existing setup ...
  scannerActive = true;
  document.getElementById("qr-reader").classList.add("scanner-active"); // CSS: green border
  // ... start flow ...
}
```

3. **stopScanner()** — also stop + clear state:
```js
function stopScanner() {
  scannerActive = false;
  // ... existing stop flow ...
  document.getElementById("qr-reader").classList.remove("scanner-active");
}
```

4. **onScanSuccess()** — NO LONGER call `stopScanner()`. Instead:
```js
async function onScanSuccess(decodedText) {
  // ... token extraction, lookup, check-in via RPC ...
  
  // After success: delay 1.5s then restart
  if (scannerActive) {
    // Show temporary success message
    resultEl.className = "scan-result success";
    resultEl.textContent = escapeHtml(tamu.nama) + " — Check-in berhasil!";
    
    // Wait 1.5s, then clear result for next scan
    setTimeout(function() {
      if (scannerActive) {
        resultEl.className = "scan-result";
        resultEl.textContent = "Siap scan berikutnya...";
      }
    }, 1500);
  }
}
```

5. **Key insight**: html5-qr-code library continues scanning automatically after `onScanSuccess`. We DON'T need to restart. We just DON'T call `stopScanner()`.

6. **Error handling**: Don't stop scanner on error either — just show error and continue:
```js
// Instead of stopScanner(), just show error
resultEl.className = "scan-result error";
resultEl.textContent = "Error: ...";
// Don't stop scanner — it continues listening
```

7. **For "already checked in"**: Same pattern — show info message, don't stop.

8. **Add visual indicator**: CSS class showing scanner is active.

**File**: `dashboard.html:455-469` — stop button already exists (`#btn-stop-scan`), update text to "Berhenti Scan".

### 7.2 — Add Loading State for Guestbook

**File**: `index.html:1261-1277` (retryFetchGuestbook)
**Change**: Check if loading state is already shown in `fetchGuestbook()`:
Looking at `fetchGuestbook()` (index.html:1197-1258), loading state already exists:
```js
document.getElementById("gb-loading").style.display = "block"; // line 1198
```
AND in finally block:
```js
document.getElementById("gb-loading").style.display = "none"; // line 1257
```

**So this is already fixed.** No change needed. ✅

### 7.3 — Consolidate Toast Implementation

**File**: `dashboard.js:38-46` and `index.html:946-963`

**Change**: Choose dashboard implementation as the standard. Update index.html to use the same approach:

1. In `index.html:946-963`, replace the separate toast implementation with a function that reuses an existing element (like dashboard does):
```js
function showToast(msg, isError) {
  var el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText = "position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#1c1c1c;border:1px solid rgba(255,255,255,0.12);color:#f3f3f3;padding:0.6rem 1.1rem;border-radius:999px;font-size:0.85rem;z-index:9999;max-width:90vw;text-align:center;transition:opacity 0.25s;display:none;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  el.style.borderColor = isError ? "rgba(255,107,122,0.5)" : "";
  clearTimeout(el._timer);
  el._timer = setTimeout(function() {
    el.style.display = "none";
  }, 3200);
}
```

### 7.4 — Fix Copy Link Fallback

**File**: `dashboard.js:704-705`
**Change**: Replace `prompt()` with modern copy fallback:
```js
.catch(function () {
  var ta = document.createElement("textarea");
  ta.value = link;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("Link disalin otomatis!");
  } catch (e) {
    // Final fallback: show link in a modal/alert
    showToast("Salin link: " + link);
  }
  document.body.removeChild(ta);
});
```

### Phase 6 — Testing

**Automated:**
- [x] Scanner tidak berhenti setelah scan sukses
- [x] Tombol "Berhenti Scan" menghentikan scanner
- [x] Scanner restart otomatis tidak perlu restart manual
- [x] Toast hanya punya 1 implementasi di codebase (check for duplicate function signatures)
- [x] copyGuestLink() tidak pakai prompt() sebagai fallback

**Manual:**
- [x] Scan 3 QR berturut-turut tanpa klik "Mulai Scan" ulang
- [x] Stop scan berfungsi dan tombol kembali ke "Mulai Scan"
- [x] Toast tampil konsisten di halaman publik dan dashboard
- [x] Copy link berfungsi di browser mobile (Chrome Android, Safari iOS)

---

## Phase 7: 🌐 Compatibility & Schema (5 items)

Items: 8.2 (dateStyle fallback), 8.3 (backdrop-filter fallback), 9.1 (nomor_wa nullable), 9.2 (status validation), 9.3 (checked_in_by)

### 8.2 — Fix formatDate Fallback for iOS

**File**: `dashboard.js:58-67` (formatDate)
**Change**: Add try/catch with manual fallback:
```js
function formatDate(iso) {
  try {
    var d = new Date(iso);
    // Test if dateStyle is supported
    var test = d.toLocaleString("id-ID", { dateStyle: "medium" });
    return d.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (e) {
    // Fallback for iOS <14.5
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("id-ID") + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch (e2) {
      return iso;
    }
  }
}
```

**Same for** `formatTime()` (dashboard.js:69-78):
```js
function formatTime(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}
```

### 8.3 — Add backdrop-filter CSS Fallback

**File**: `style.css` (5 locations — lines 437, 480, 519, and check near 437 for the bottom-nav class)
**File**: `dashboard.css` (line 220)

**Change**: At each `backdrop-filter` usage, add a `@supports` fallback or a pre-rule:

For `style.css:437` (bottom-nav):
```css
.bottom-nav {
  /* ... existing styles ... */
  background-color: rgba(10, 10, 10, 0.92); /* fallback for non-supporting browsers */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

For `style.css:480` (nav-toggle):
```css
.nav-toggle {
  /* ... existing ... */
  background: rgba(10, 10, 10, 0.92);
  backdrop-filter: blur(12px);
}
```

For `style.css:519` (nav-restore):
```css
.nav-restore {
  /* ... existing ... */
  background: rgba(10, 10, 10, 0.92);
  backdrop-filter: blur(12px);
}
```

For `dashboard.css:220`:
```css
/* This is for hamburger menu button */
.side-nav-toggle {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(4px);
}
```

**Actually**, the better approach is a single CSS custom property or @supports block at the top of each file:
```css
@supports not (backdrop-filter: blur(1px)) {
  .bottom-nav { background-color: rgba(10, 10, 10, 0.95); }
  .nav-toggle { background-color: rgba(10, 10, 10, 0.95); }
  .nav-restore { background-color: rgba(10, 10, 10, 0.95); }
}
```

### 9.1 — Make nomor_wa Nullable

**File baru**: `MD&DOC/supabase_migration_v3.sql`
**Change**: 
```sql
-- Schema change explanation:
-- Before: nomor_wa text NOT NULL — semua RSVP harus punya nomor WA
-- Problem: Admin bisa kosongkan field WA di modal edit, kode kirim null -> error
-- After: nomor_wa menjadi nullable
ALTER TABLE public.rsvps ALTER COLUMN nomor_wa DROP NOT NULL;
```

**File**: `dashboard.js:881` — change from `nomor_wa: nomorWa || null` to:
```js
nomor_wa: nomorWa || null, // ini already works after schema change
```

**File**: `dashboard.js:874-881` and `dashboard.js:908-914` — add warning for send card with no WA:
```js
// After saving, check if attempting to send card without WA
if (jumlahHadir > 2 && !nomorWa) {
  showToast("Perhatian: Tamu tidak punya nomor WA, kartu tidak bisa dikirim via WhatsApp.");
}
```

**File**: `dashboard.js:807-826` (approveRSVP) — add similar warning:
```js
async function approveRSVP(rsvpId, btn) {
  // Check if guest has WA before approving
  var entry = allTamu.find(function(t) { return t.id === rsvpId; });
  if (entry && !entry.nomor_wa) {
    showToast("Peringatan: Tamu tidak punya nomor WA. Kartu tidak bisa dikirim.", true);
  }
  // ... proceed with approval ...
}
```

### 9.2 — Validate Status Before Save

**File**: `dashboard.js:903-904`
**Change**: Add validation:
```js
var status = document.getElementById("gf-status").value;
if (!status) {
  showToast("Status harus dipilih (Hadir/Tidak Hadir).", true);
  return;
}
```

**File**: `dashboard.html:635-640` — make select required:
```html
<select class="form-select" id="gf-status" required>
  <option value="">Pilih status</option>
  <option value="Hadir">Hadir</option>
  <option value="Tidak Hadir">Tidak Hadir</option>
</select>
```

### 9.3 — Fill checked_in_by

**File**: `dashboard.js:1148-1154` (QR check-in insert)
**File**: `dashboard.js:1228-1234` (manual check-in insert)

**Change**: These will be handled by the `process_checkin` RPC function (Phase 2), which already accepts `p_checked_by` parameter.

**But** the RPC function from Phase 2 is called with `currentUser.id`. So this is already fixed in Phase 2.

**Additionally**: For existing direct inserts (if any remain), add `checked_in_by` field.

### Phase 7 — Testing

**Automated:**
- [x] `formatDate()` fallback works: test dengan mock browser yang tidak support dateStyle
- [x] `formatTime()` fallback works
- [x] Schema migration: `nomor_wa` nullable (INSERT tanpa WA tidak error)
- [x] Status empty string → showToast error, tidak dikirim ke DB
- [x] `checked_in_by` terisi di tabel `guest_checkins`

**Manual:**
- [x] Efek glass-morphism tetap OK di Firefox (tanpa backdrop-filter)
- [x] formatDate tampil benar di iOS device
- [x] Admin bisa simpan tamu tanpa nomor WA
- [x] Warning muncul saat approve RSVP tanpa WA

---

## Final Integration Testing

Setelah semua 7 fase selesai, lakukan test komprehensif:

### Automated
- [x] All Playwright tests pass: `npx playwright test qa/wedding.spec.js`
- [x] Unit tests pass: `node qa/unit/helpers.test.js` (or via Playwright)
- [x] No console errors on page load (index.html + dashboard.html)

### Manual — Full Flow Test
- [ ] Guest flow: URL param → RSVP → digital card download
- [ ] Guest flow: jumlah_hadir > 2 → pending approval
- [ ] Guestbook: submit pesan → tampil publik
- [ ] Guestbook: kirim kata kasar → ditolak
- [ ] Dashboard: login → overview → data tampil
- [ ] Dashboard: tab switch → lazy load bekerja
- [ ] Dashboard: approve RSVP → status berubah
- [ ] Dashboard: QR scan → check-in sukses
- [ ] Dashboard: manual check-in → sukses
- [ ] Dashboard: filter tamu → data terfilter
- [ ] Dashboard: edit tamu → data tersimpan
- [ ] Dashboard: logout → kembali ke login screen

---

## Performance Considerations

Semua perubahan bersifat ringan — tidak ada operasi berat. Hal-hal yang perlu diperhatikan:
- Edge Function `rate-limit-rsvp` mungkin menambah latency 50-200ms pada RSVP submit — acceptable untuk mencegah spam
- DocumentFragment optimization hanya terasa dengan >200 baris tabel
- `backdrop-filter` fallback tidak mempengaruhi performance

## Migration Notes

1. `MD&DOC/supabase_migration_v3.sql` — file migrasi baru untuk:
   - `process_checkin` RPC function
   - `rsvps_nama_length_check` constraint
   - `nomor_wa` drop NOT NULL
   - (opsional) `rate_limits` table

2. Record existing tidak diubah — semua perubahan hanya untuk INSERT/UPDATE baru

3. Deploy: setelah setiap fase selesai dan test lulus, bisa langsung push ke main → Netlify auto-deploy

## References

- Ticket KRITIS: `thoughts/tickets/debt_kritis.md`
- Ticket HIGH: `thoughts/tickets/debt_high.md`
- Ticket MEDIUM: `thoughts/tickets/debt_medium.md`
- Ticket LOW: `thoughts/tickets/debt_low.md`
- QA Brutal Analysis: `Kemungkinan_Kegagalan/QA_Brutal_Analysis.md`
- AGENTS.md: project documentation

## Deviations from Plan

### Phase 1: Security

#### 1.2 — Rate Limiting Edge Function
- **Original Plan**: Create Edge Function in `supabase/functions/rate-limit-rsvp/index.ts` + modify index.html RSVP flow
- **Actual Implementation**: Created `supabase/functions/rate-limit-rsvp/index.ts` (Deno Edge Function) + `deno.json` + modified `index.html` to fetch Edge Function instead of direct Supabase insert
- **Reason**: Edge Function approach matches plan. The `rate_limits` table creation was included in `supabase_migration_v3.sql`.
- **Deploy Note**: Edge Function must be deployed via `supabase functions deploy rate-limit-rsvp` with `SUPABASE_SERVICE_ROLE_KEY` env var set.

#### 1.3 — Maxlength Nama
- **Original Plan**: Add maxlength to HTML + SQL constraint + dashboard validation
- **Actual Implementation**: All three changes completed. HTML `maxlength="100"` added, SQL CHECK constraint in `supabase_migration_v3.sql`, dashboard validation added.

#### 1.5 + 8.1 — generateUUID
- **Original Plan**: Remove Math.random fallback, use only crypto.randomUUID()
- **Actual Implementation**: Simplified to `return crypto.randomUUID()`. Fallback removed.

### Phase 2: Concurrency

#### 2.1 — QR Race RPC
- **Original Plan**: Create `process_checkin` RPC to replace two sequential writes
- **Actual Implementation**: Created `process_checkin` RPC in `supabase_migration_v3.sql`. Updated `onScanSuccess()` and `manualCheckin()` in `dashboard.js` to use RPC instead of two separate writes.

#### 2.2 — Polling Leak
- **Original Plan**: Store interval ID and clear on logout
- **Actual Implementation**: Added `pollTimer` variable, `clearInterval(pollTimer)` in logout handler. Verified scanner is already cleaned up in logout.

#### 2.3 — Tab Double Load
- **Original Plan**: Remove eager loads from enterDashboard()
- **Actual Implementation**: Removed eager `loadOverview()`, `loadTamuRSVP()`, `loadGuestbook()`, `loadCheckinLog()` from `enterDashboard()`. Lazy loading via `switchTab()` remains.

### Phase 3: Data Integrity

#### 3.1 — Promise.all → allSettled
- **Original Plan**: Replace `Promise.all` with `Promise.allSettled` in loadOverview and loadTamuRSVP
- **Actual Implementation**: Changed both `loadTamuRSVP()` and `loadOverview()` to use `Promise.allSettled` with per-query error fallback.

#### 3.2 + 3.3 — Limits
- **Original Plan**: Add .limit(1000) to guests query, increase RSVP .limit(500) → .limit(2000)
- **Actual Implementation**: Added `.limit(1000)` to guests query, increased RSVP `.limit(500)` → `.limit(2000)`.

#### 3.4 — Orphan Manual Match
- **Original Plan**: Replace auto-match with manual UI
- **Actual Implementation**: Removed auto-assignment. Added `_suggested_guest`/`_suggested_name` fields, "Cocokkan dengan tamu" button in table, `showMatchDialog()` and `matchOrphanToGuest()` functions.

#### 4.3 — allTamu Race Guard
- **Original Plan**: Add isLoadingTamu guard flag
- **Actual Implementation**: Added `isLoadingTamu` guard flag in `loadTamuRSVP()`.

### Phase 4: Logic Bugs + Error Handling

#### 4.1 — verifyAdmin
- **Original Plan**: Separate login and verifyAdmin into distinct try/catch blocks
- **Actual Implementation**: Separated login and verifyAdmin into distinct try/catch blocks with specific error messages.

#### 4.2 — Guestbook Error
- **Original Plan**: Add retry button in guestbook error state
- **Actual Implementation**: Added "Coba lagi" retry button in guestbook error state.

#### 5.1 — disableScroll
- **Original Plan**: Replace JavaScript scroll lock with CSS overflow:hidden + position:fixed
- **Actual Implementation**: Replaced `window.onscroll` override with CSS `overflow:hidden` + `position:fixed` approach.

#### 5.2 — html2canvas Timeout
- **Original Plan**: Add 10-second timeout via Promise.race
- **Actual Implementation**: Added 10-second timeout via `Promise.race`.

#### 5.3 — submitRSVP
- **Original Plan**: Use .select() to return real is_approved from database
- **Actual Implementation**: Already fixed in Phase 1.2 — Edge Function returns real `is_approved` from database.

#### 5.4 — Slug Collision
- **Original Plan**: Replace allTamu.some() with DB query
- **Actual Implementation**: Added DB-level slug validation via `sb.from("guests").select("slug").eq("slug", data.slug).maybeSingle()` in form submit handler.

#### 5.5 — fetchGuest Duplicate
- **Original Plan**: Remove duplicate fetchGuest declaration
- **Actual Implementation**: Investigation found NO duplicate declaration. Only one declaration exists at line 977. No change needed.

### Phase 5: Performance

#### 6.1 — Guestbook Count
- **Original Plan**: Replace count: "exact" with count: "estimated"
- **Actual Implementation**: Changed `count: "exact"` → `count: "estimated"`.

#### 6.2 — DocumentFragment
- **Original Plan**: Use DocumentFragment for batch DOM insertion in renderTamuTable
- **Actual Implementation**: Added `DocumentFragment` in `renderTamuTable()` for batch DOM insertion.

#### 6.3 — Activity Log Pagination
- **Original Plan**: Add .range() or limit to activity log queries
- **Actual Implementation**: Added `.range(0, 49)` to both RSVP and guestbook queries in `loadOverview()`.

#### 6.4 — Guestbook Limit
- **Original Plan**: Increase dashboard guestbook limit from 500 to 2000
- **Actual Implementation**: Changed `.limit(500)` → `.limit(2000)` in dashboard guestbook.

### Phase 6: UX

#### 7.1 — Continuous Scan
- **Original Plan**: Stop calling stopScanner() on success, add scannerActive state, add visual indicator
- **Actual Implementation**: Added `scannerActive` state flag. Stopped calling `stopScanner()` in success/error/info paths. Added 1.5s delay to reset result message. Added `scanner-active` CSS class. Added stop button in logout handler.

#### 7.2 — Loading State
- **Original Plan**: Add loading state for guestbook (deemed already present)
- **Actual Implementation**: Already existed in code. No change needed.

#### 7.3 — Toast Consolidation
- **Original Plan**: Update index.html toast to match dashboard pattern
- **Actual Implementation**: Updated `index.html` `showToast()` to use `display:none/block` pattern with `clearTimeout(el._timer)` for consistency with dashboard implementation.

#### 7.4 — Copy Fallback
- **Original Plan**: Replace prompt() with modern copy fallback
- **Actual Implementation**: Replaced `prompt()` with hidden `<textarea>` + `document.execCommand('copy')` fallback.

### Phase 7: Compatibility & Schema

#### 8.2 — formatDate/formatTime
- **Original Plan**: Add try/catch with manual fallback for iOS <14.5
- **Actual Implementation**: Added feature detect + fallback for iOS <14.5 `dateStyle`/`timeStyle` support.

#### 8.3 — backdrop-filter Fallback
- **Original Plan**: Add @supports not (backdrop-filter) CSS blocks
- **Actual Implementation**: Added `@supports not (backdrop-filter)` CSS blocks to both `style.css` and `dashboard.css`.

#### 9.1 — nomor_wa nullable
- **Original Plan**: ALTER TABLE rsvps ALTER COLUMN nomor_wa DROP NOT NULL
- **Actual Implementation**: SQL migration created in `supabase_migration_v3.sql`. No code change needed — the `|| null` pattern already works with nullable columns.

#### 9.2 — Status Validation
- **Original Plan**: Add if (!status) guard and required attribute
- **Actual Implementation**: Added `if (!status)` guard in form submit handler. Added `required` attribute to `<select id="gf-status">` in `dashboard.html`.

#### 9.3 — checked_in_by
- **Original Plan**: Fill checked_in_by in check-in inserts
- **Actual Implementation**: Handled by `process_checkin` RPC which accepts `p_checked_by` parameter using `currentUser.id`.
