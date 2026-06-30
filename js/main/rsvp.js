function generateUUID() {
  return crypto.randomUUID();
}

async function submitRSVP(
  guestId,
  namaInput,
  jumlahInput,
  statusInput,
  pesanInput,
  noWaInput,
) {
  const qrToken = generateUUID();

  // Panggil Edge Function untuk rate limiting + insert
  var res = await fetch(APP_CONFIG.RSVP_EDGE_FUNCTION, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: APP_CONFIG.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + APP_CONFIG.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      guest_id: guestId || null,
      nama: namaInput,
      nomor_wa: noWaInput,
      jumlah_hadir: jumlahInput,
      status: statusInput,
      pesan: pesanInput || null,
      qr_token: qrToken,
    }),
  });

  if (!res.ok) {
    var errData = await res.json().catch(function () {
      return {};
    });
    throw new Error(errData.error || "Gagal mengirim RSVP. Silakan coba lagi.");
  }

  var data = await res.json();
  return {
    is_approved: data.data.is_approved,
    qr_token: data.data.qr_token,
    jumlah_hadir: data.data.jumlah_hadir,
    pesan: data.data.pesan,
  };
}

async function renderDigitalCard(rsvpResult, nama, jumlah, status) {
  var card = document.getElementById("digital-card");
  var qrDiv = document.getElementById("card-qr");
  card.querySelector(".card-nama").textContent = nama;
  card.querySelector(".card-status").textContent = status;
  card.querySelector(".card-kuota").textContent =
    "Berlaku untuk " + jumlah + " orang";
  qrDiv.innerHTML = "";

  new QRCode(qrDiv, {
    text: rsvpResult.qr_token,
    width: 120,
    height: 120,
    colorDark: "#0a0a0a",
    colorLight: "#ffffff",
  });

  card.style.display = "block";

  try {
    var canvas = await Promise.race([
      html2canvas(card, { scale: 2, useCORS: true }),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("Timeout render kartu"));
        }, 10000);
      }),
    ]);
    var blob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b);
        else reject(new Error("toBlob returned null"));
      }, "image/png");
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Undangan_" + nama.replace(/\s+/g, "_") + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    card.style.display = "none";
    showToast(
      "Kartu undangan berhasil diunduh. Simpan untuk ditunjukkan saat hari acara!",
    );
  } catch (e) {
    console.error("Download gagal:", e);
    card.style.display = "block";
    card.style.position = "relative";
    card.style.left = "";
    card.style.margin = "1rem auto";
    showToast(
      "Download gagal. Silakan screenshot kartu undangan di bawah ini.",
      true,
    );
  }
}

function renderAlreadySubmittedNote(nama, status) {
  var note = document.getElementById("rsvp-already-note");
  var noteText = document.getElementById("rsvp-already-note-text");
  if (!note || !noteText) return;
  var keterangan =
    status === "Tidak Hadir" ? "tidak dapat hadir" : "akan hadir";
  noteText.textContent =
    (nama ? nama + ", " : "") +
    "Anda sudah konfirmasi " +
    keterangan +
    ". Terima kasih!";
  note.style.display = "flex";
}

function applyAlreadySubmittedState() {
  var raw;
  try {
    raw = localStorage.getItem(getRsvpStorageKey());
  } catch (e) {
    return;
  }
  if (!raw) return;
  var record;
  try {
    record = JSON.parse(raw);
  } catch (e) {
    return;
  }
  renderAlreadySubmittedNote(record.nama, record.status);
  var form = document.getElementById("my-form");
  if (!form) return;
  form
    .querySelectorAll("input, select, textarea, button")
    .forEach(function (el) {
      el.disabled = true;
    });
  var submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Terkirim";
}

function getRsvpStorageKey() {
  return "rsvp_submitted_" + (urlParams.get("n") || "anon").toLowerCase();
}

function saveRsvpSubmitted(nama, status) {
  try {
    localStorage.setItem(
      getRsvpStorageKey(),
      JSON.stringify({ nama: nama, status: status, ts: Date.now() }),
    );
  } catch (e) {
    // Ignore quota or private mode errors
    // ponytail: localStorage failure is non-critical; data is in Supabase
  }
  renderAlreadySubmittedNote(nama, status);
}

window.addEventListener("load", function () {
  applyAlreadySubmittedState();
  const form = document.getElementById("my-form");
  const submitBtn = form.querySelector("button[type=submit]");
  const originalBtnText = submitBtn.textContent;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const namaInput = document.getElementById("nama").value.trim();
    const jumlahInput = parseInt(document.getElementById("jumlah").value) || 1;
    const statusInput = document.getElementById("status").value;
    const noWaInput = document.getElementById("noWA").value.trim();
    const pesanInput = document.getElementById("pesan").value.trim();

    if (!namaInput || !statusInput || !noWaInput) {
      showToast("Lengkapi nama, konfirmasi, dan nomor WA.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim...";

    var success = false;
    try {
      const slug = urlParams.get("n") || "";
      let guestId = null;
      if (slug) {
        const guest = await fetchGuest(slug);
        if (guest && guest.length > 0) guestId = guest[0].id;
      }

      const rsvpResult = await submitRSVP(
        guestId,
        namaInput,
        jumlahInput,
        statusInput,
        pesanInput,
        noWaInput,
      );

      if (statusInput === "Tidak Hadir") {
        showRsvpModal("Konfirmasi kehadiran berhasil dikirim. Terima kasih!");
        saveRsvpSubmitted(namaInput, statusInput);
        success = true;
        form
          .querySelectorAll("input, select, textarea, button")
          .forEach(function (el) {
            el.disabled = true;
          });
        submitBtn.textContent = "Terkirim";
        return;
      }

      if (jumlahInput <= 2 && rsvpResult.is_approved) {
        await renderDigitalCard(
          rsvpResult,
          namaInput,
          jumlahInput,
          statusInput,
        );
        saveRsvpSubmitted(namaInput, statusInput);
      } else if (jumlahInput > 2) {
        showRsvpModal(
          "Permintaan Anda sedang ditinjau panitia. Kartu undangan akan dikirim setelah disetujui.",
        );
        saveRsvpSubmitted(namaInput, statusInput);
      } else {
        showRsvpModal("Konfirmasi kehadiran berhasil dikirim. Terima kasih!");
        saveRsvpSubmitted(namaInput, statusInput);
      }

      success = true;
      form
        .querySelectorAll("input, select, textarea, button")
        .forEach(function (el) {
          el.disabled = true;
        });
      submitBtn.textContent = "Terkirim";
    } catch (error) {
      console.error("Gagal mengirim:", error);
      showRsvpModal(
        error.message || "Maaf, terjadi kesalahan. Silakan coba lagi.",
        true,
      );
    } finally {
      submitBtn.disabled = success;
      if (!success) submitBtn.textContent = originalBtnText;
    }
  });
});

async function fetchGuest(guestSlug) {
  const { data, error } = await supabaseClient.rpc("get_guest_by_slug", {
    guest_slug: guestSlug,
  });
  if (error) throw error;
  return data;
}
