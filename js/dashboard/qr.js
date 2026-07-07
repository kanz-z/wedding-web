// dashboard QR scanner & check-in (tab 4)

function startScanner() {
  var resultEl = document.getElementById("scan-result");
  resultEl.className = "scan-result";
  resultEl.textContent = "";

  if (!html5QrScanner) {
    html5QrScanner = new Html5Qrcode("qr-reader");
  }

  document.getElementById("btn-start-scan").classList.add("d-none");
  document.getElementById("btn-stop-scan").classList.remove("d-none");

  html5QrScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      function (err) {
        console.debug("QR scan error (non-fatal):", err);
      }
    )
    .catch(function (err) {
      showToast("Gagal mengakses kamera: " + err, true);
      document.getElementById("btn-start-scan").classList.remove("d-none");
      document.getElementById("btn-stop-scan").classList.add("d-none");
    });

  var qrEl = document.getElementById("qr-reader");
  if (qrEl) qrEl.classList.add("scanner-active");
}

function stopScanner() {
  if (html5QrScanner) {
    html5QrScanner
      .stop()
      .then(function () {
        document.getElementById("btn-start-scan").classList.remove("d-none");
        document.getElementById("btn-stop-scan").classList.add("d-none");
        var qrEl = document.getElementById("qr-reader");
        if (qrEl) qrEl.classList.remove("scanner-active");
      })
      .catch(function () {});
  }
}

async function onScanSuccess(decodedText) {
  var resultEl = document.getElementById("scan-result");
  var raw = decodedText.trim();

  var token = raw;
  try {
    var url = new URL(raw);
    var maybe = url.searchParams.get("token");
    if (maybe) token = maybe;
  } catch (_) {}

  try {
    var res = await dashboardSb
      .from("rsvps")
      .select("id, nama, checked_in, jumlah_hadir")
      .eq("qr_token", token)
      .single();
    if (res.error || !res.data) {
      resultEl.className = "scan-result error";
      resultEl.textContent = "Tamu tidak terdaftar";
      stopScanner();
      return;
    }

    var tamu = res.data;
    if (tamu.checked_in) {
      var checkinRes = await dashboardSb
        .from("guest_checkins")
        .select("checked_in_at")
        .eq("rsvp_id", tamu.id)
        .single();
      var time = checkinRes.data
        ? formatTime(checkinRes.data.checked_in_at)
        : "sebelumnya";
      resultEl.className = "scan-result info";
      resultEl.textContent =
        escapeHtml(tamu.nama) + " — Sudah check-in pukul " + time;
      stopScanner();
      return;
    }

    await dashboardSb.from("guest_checkins").insert([
      {
        rsvp_id: tamu.id,
        method: "qr",
        guest_count_actual: tamu.jumlah_hadir,
      },
    ]);
    await dashboardSb.from("rsvps").update({ checked_in: true }).eq("id", tamu.id);

    resultEl.className = "scan-result success";
    resultEl.textContent =
      escapeHtml(tamu.nama) +
      " — Check-in berhasil! (" +
      tamu.jumlah_hadir +
      " org)";
    stopScanner();
    loadCheckinLog();
    loadTamuRSVP();
  } catch (err) {
    console.error("Scan error:", err);
    resultEl.className = "scan-result error";
    resultEl.textContent = "Gagal memproses check-in";
    stopScanner();
  }
}

var doManualSearch = debounce(async function () {
  var q = document.getElementById("manual-search").value.trim();
  var results = document.getElementById("manual-results");
  results.innerHTML = "";

  if (q.length < 2) return;

  try {
    var res = await dashboardSb
      .from("rsvps")
      .select("id, nama, checked_in, jumlah_hadir, status")
      .ilike("nama", "%" + q + "%")
      .limit(10);
    if (res.error) throw res.error;
    (res.data || []).forEach(function (t) {
      var div = document.createElement("div");
      div.className = "search-result-item";
      div.innerHTML =
        "<span>" +
        escapeHtml(t.nama) +
        " — " +
        t.jumlah_hadir +
        " org " +
        (t.checked_in
          ? '<span class="badge success">Checked-in</span>'
          : '<span class="badge">' + (t.status || "Belum") + "</span>") +
        "</span>";
      if (!t.checked_in) {
        var btn = document.createElement("button");
        btn.className = "btn-pink";
        btn.textContent = "Check-in";
        btn.addEventListener("click", function () {
          manualCheckin(t, btn);
        });
        div.appendChild(btn);
      }
      results.appendChild(div);
    });
  } catch (err) {
    console.error("Manual search error:", err);
  }
}, 500);

document
  .getElementById("manual-search")
  .addEventListener("input", doManualSearch);

async function manualCheckin(tamu, btn) {
  if (!confirm("Check-in " + tamu.nama + " (" + tamu.jumlah_hadir + " org)?"))
    return;
  btn.disabled = true;
  btn.textContent = "Memproses...";
  try {
    await dashboardSb.from("guest_checkins").insert([
      {
        rsvp_id: tamu.id,
        method: "manual",
        guest_count_actual: tamu.jumlah_hadir,
      },
    ]);
    await dashboardSb.from("rsvps").update({ checked_in: true }).eq("id", tamu.id);
    showToast(escapeHtml(tamu.nama) + " berhasil check-in!");
    document.getElementById("manual-search").value = "";
    document.getElementById("manual-results").innerHTML = "";
    loadCheckinLog();
    loadTamuRSVP();
  } catch (err) {
    showToast("Gagal check-in.", true);
    btn.disabled = false;
    btn.textContent = "Check-in";
  }
}

async function loadCheckinLog() {
  var log = document.getElementById("checkin-log");
  var empty = document.getElementById("checkin-empty");
  try {
    var res = await dashboardSb
      .from("guest_checkins")
      .select("rsvp_id(nama), checked_in_at, method, guest_count_actual")
      .order("checked_in_at", { ascending: false })
      .limit(20);
    if (res.error) throw res.error;
    var data = res.data || [];
    log.innerHTML = "";
    if (data.length === 0) {
      empty.classList.remove("d-none");
      return;
    }
    empty.classList.add("d-none");
    data.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "checkin-item";
      div.innerHTML =
        "<strong>" +
        escapeHtml((c.rsvp_id && c.rsvp_id.nama) || "?") +
        "</strong> — " +
        c.guest_count_actual +
        ' org — <span class="badge ' +
        (c.method === "qr" ? "pink" : "") +
        '">' +
        c.method +
        '</span> <span class="gb-admin-time">' +
        formatTime(c.checked_in_at) +
        "</span>";
      log.appendChild(div);
    });
  } catch (err) {
    console.error("Checkin log error:", err);
  }
}
