// dashboard guestbook (tab 3)

async function loadGuestbook() {
  document.getElementById("gb-status").classList.remove("show");
  document.getElementById("gb-empty").classList.add("d-none");
  try {
    var res = await dashboardSb
      .from("guestbook")
      .select("id, nama, pesan, is_approved, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (res.error) throw res.error;
    allGb = res.data || [];
    renderGbList();
  } catch (err) {
    document.getElementById("gb-status").textContent =
      "Gagal memuat guestbook.";
    document.getElementById("gb-status").classList.add("show");
  }
}

function renderGbList() {
  var container = document.getElementById("gb-list");
  container.innerHTML = "";
  var filtered = allGb;
  if (gbFilter === "pending")
    filtered = allGb.filter(function (e) {
      return !e.is_approved;
    });
  else if (gbFilter === "approved")
    filtered = allGb.filter(function (e) {
      return e.is_approved;
    });

  document.getElementById("gb-empty").classList.toggle(
    "d-none",
    filtered.length !== 0
  );

  filtered.forEach(function (entry) {
    var card = document.createElement("div");
    card.className = "gb-admin-card" + (entry.is_approved ? "" : " pending");
    card.innerHTML =
      '<div class="gb-admin-header">' +
      '<span class="gb-admin-name">' +
      escapeHtml(entry.nama) +
      "</span>" +
      '<span class="gb-admin-time">' +
      formatDate(entry.created_at) +
      "</span></div>" +
      '<div class="gb-admin-body">' +
      escapeHtml(entry.pesan) +
      "</div>" +
      '<div class="gb-admin-actions">' +
      '<button class="' +
      (entry.is_approved ? "btn-danger" : "btn-sm") +
      '" data-id="' +
      entry.id +
      '" onclick="toggleGbApproval(\'' +
      entry.id +
      "', " +
      !entry.is_approved +
      ', this)">' +
      (entry.is_approved ? "Sembunyikan" : "Tampilkan") +
      "</button></div>";
    container.appendChild(card);
  });
}

async function toggleGbApproval(id, newVal, btn) {
  btn.disabled = true;
  var origText = btn.textContent;
  btn.textContent = "Memproses...";
  try {
    var res = await dashboardSb
      .from("guestbook")
      .update({ is_approved: newVal })
      .eq("id", id);
    if (res.error) throw res.error;
    var entry = allGb.find(function (e) {
      return e.id === id;
    });
    if (entry) entry.is_approved = newVal;
    renderGbList();
    showToast(newVal ? "Pesan ditampilkan." : "Pesan disembunyikan.");
  } catch (err) {
    showToast("Gagal update.", true);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function setGbFilter(filter, btn) {
  gbFilter = filter;
  document
    .querySelectorAll("#tab-guestbook .btn-group button")
    .forEach(function (b) {
      b.classList.remove("active");
    });
  btn.classList.add("active");
  renderGbList();
}
