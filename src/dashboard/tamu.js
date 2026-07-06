// src/dashboard/tamu.js
import { state } from './state';
import { escapeHtml, escapeAttr, showToast, debounce } from './utils';
import { config } from '../config';
import { loadGuestbook } from './guestbook';

function buildGuestIdSet(guests) {
  var set = {};
  guests.forEach(function(g) { set[g.id] = true; });
  return set;
}

function autoMatchOrphan(orphan, guests) {
  var name = (orphan.nama || "").toLowerCase().trim();
  var wa = (orphan.nomor_wa || "").trim();
  if (!name) return null;
  var best = null, bestScore = 0;
  guests.forEach(function(g) {
    var gName = (g.name || "").toLowerCase().trim();
    var score = 0;
    if (name === gName) score += 3;
    else if (name.indexOf(gName) !== -1 || gName.indexOf(name) !== -1) score += 1;
    if (wa && g.nomor_wa && wa === g.nomor_wa.trim()) score += 5;
    if (score > bestScore) { bestScore = score; best = g; }
  });
  return bestScore >= 2 ? best : null;
}

export async function loadTamuRSVP() {
  state.selectedTamu = {};
  updateBatchButtons();
  document.getElementById("tamu-status").classList.add("d-none");
  document.getElementById("tamu-empty").classList.add("d-none");
  try {
    var [guestsRes, rsvpsRes] = await Promise.all([
      state.dashboardSb.from("guests").select("id, slug, name, pronoun, invited_count, created_at, side, nomor_wa"),
      state.dashboardSb.from("rsvps").select("id, guest_id, nama, nomor_wa, jumlah_hadir, status, is_approved, checked_in, qr_token, pesan, created_at").order("created_at", { ascending: false }).limit(800),
    ]);
    if (guestsRes.error) throw guestsRes.error;
    if (rsvpsRes.error) throw rsvpsRes.error;
    var guests = guestsRes.data || [];
    var rsvps = rsvpsRes.data || [];
    var guestIdSet = buildGuestIdSet(guests);
    var linkedGuestIds = {};
    state.allTamu.length = 0;
    guests.forEach(function(g) {
      var rsvp = rsvps.find(function(r) { return r.guest_id === g.id; });
      if (rsvp) linkedGuestIds[rsvp.id] = true;
      state.allTamu.push({
        id: rsvp ? rsvp.id : null, guest_id: g.id, nama: rsvp ? rsvp.nama : g.name,
        nomor_wa: rsvp ? rsvp.nomor_wa : g.nomor_wa || "", jumlah_hadir: rsvp ? rsvp.jumlah_hadir : g.invited_count,
        status: rsvp ? rsvp.status : null, is_approved: rsvp ? rsvp.is_approved : true,
        checked_in: rsvp ? rsvp.checked_in : false, qr_token: rsvp ? rsvp.qr_token : null,
        pesan: rsvp ? rsvp.pesan : null, created_at: rsvp ? rsvp.created_at : g.created_at,
        _slug: g.slug, _pronoun: g.pronoun, _invited_count: g.invited_count, _source: "guest", _side: g.side || null,
      });
    });
    var unmatchedRsvps = rsvps.filter(function(r) { return !r.guest_id || !guestIdSet[r.guest_id]; });
    unmatchedRsvps.forEach(function(r) {
      if (linkedGuestIds[r.id]) return;
      var match = autoMatchOrphan(r, guests);
      state.allTamu.push({
        id: r.id, guest_id: match ? match.id : null, nama: r.nama, nomor_wa: r.nomor_wa || "",
        jumlah_hadir: r.jumlah_hadir, status: r.status, is_approved: r.is_approved,
        checked_in: r.checked_in, qr_token: r.qr_token, pesan: r.pesan, created_at: r.created_at,
        _slug: match ? match.slug : null, _pronoun: match ? match.pronoun : null,
        _invited_count: match ? match.invited_count : 0, _source: match ? "auto-matched" : "orphan",
        _side: match ? match.side || null : null,
      });
    });
    state.allTamu.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    if (state.allTamu.length === 0) document.getElementById("tamu-empty").classList.remove("d-none");
    renderTamuTable();
    loadApprovalPending();
  } catch(err) {
    console.error("Tamu error:", err);
    document.getElementById("tamu-status").classList.remove("d-none");
  }
}

function badgeSide(side) {
  if (side === "pria") return '<span class="badge pink m-1">Pria</span>';
  if (side === "wanita") return '<span class="badge m-1">Wanita</span>';
  if (side === "both") return '<span class="badge success m-1">Keduanya</span>';
  return "";
}

function badgeSource(source) {
  if (source === "orphan") return '<span class="badge warning ms-1">Baru</span>';
  if (source === "auto-matched") return '<span class="badge ms-1">Tercocok</span>';
  return "";
}

function renderTamuTable() {
  var tbody = document.getElementById("tamu-tbody");
  tbody.innerHTML = "";
  var search = (document.getElementById("tamu-search").value || "").toLowerCase();
  var filtered = state.allTamu.filter(function(t) {
    var matchSearch = !search || t.nama.toLowerCase().indexOf(search) !== -1;
    var matchFilter = true;
    if (state.tamuFilter === "pending") matchFilter = t.is_approved === false;
    else if (state.tamuFilter === "orphan") matchFilter = t._source === "orphan" || t._source === "auto-matched";
    else if (state.tamuFilter === "pria") matchFilter = t._side === "pria";
    else if (state.tamuFilter === "wanita") matchFilter = t._side === "wanita";
    else if (state.tamuFilter === "belum") matchFilter = !t.status || t.status === "belum";
    else if (state.tamuFilter !== "all") matchFilter = t.status === state.tamuFilter;
    return matchSearch && matchFilter;
  });
  document.getElementById("tamu-empty").classList.toggle("d-none", filtered.length !== 0);
  filtered.forEach(function(t) {
    var tr = document.createElement("tr");
    var displayName = t._pronoun ? escapeHtml(t._pronoun) + " " : "";
    displayName += escapeHtml(t.nama);
    var pesanTrunc = t.pesan ? escapeHtml(t.pesan).substring(0, 50) + (t.pesan.length > 50 ? "&hellip;" : "") : "-";
    var kuotaDisplay = t._invited_count != null ? t._invited_count : "-";
    var hadirDisplay = t.status ? t.jumlah_hadir : "-";
    var actions =
      '<button class="btn-sm" onclick="' +
      (t._source === "orphan" ? "editOrphan(\'" + escapeAttr(String(t.id)) + "\')" : "editTamu(\'" + escapeAttr(String(t.guest_id)) + "\')") +
      '" title="Edit" style="margin-right:4px"><i class="bi bi-pencil-fill"></i></button>' +
      '<button class="btn-sm" onclick="copyGuestLink(\'' + escapeAttr(t._slug || "") + "','" + (t.qr_token || "") + "','" + escapeAttr(t._pronoun || "") + '\')" title="Salin link"><i class="bi bi-link-45deg"></i></button>';
    if (t.status && t.status !== "belum" && !t.is_approved && t._invited_count > 2) {
      actions += '<button class="btn-pink btn-sm ms-1" onclick="confirmGuest(\'' + t.guest_id + '\', this)" title="Konfirmasi tamu"><i class="bi bi-check-circle-fill"></i></button>';
    }
    actions += "</td>";
    tr.innerHTML =
      '<td style="width:36px"><input type="checkbox" class="tamu-checkbox" data-guest-id="' + escapeAttr(String(t.guest_id)) + '"' +
      (state.selectedTamu[t.guest_id] ? " checked" : "") + ' onchange="toggleSelect(this.dataset.guestId, this.checked)"></td>' +
      "<td>" + displayName + badgeSource(t._source) + badgeSide(t._side) + "</td>" +
      "<td><code style='color:var(--ink-muted);font-size:0.75rem;'>" + (t._slug ? escapeHtml(t._slug) : "-") + "</code></td>" +
      "<td>" + escapeHtml(t.nomor_wa || "") + "</td>" +
      "<td class='text-center'>" + kuotaDisplay + "</td>" +
      '<td><span class="badge ' + (t.status === "Hadir" ? "pink" : t.status === "Tidak Hadir" ? "" : "belum") + '">' + (t.status || "Belum") + "</span>" +
      (!t.is_approved ? ' <span class="badge warning">Pending</span>' : "") + "</td>" +
      "<td class='text-center'>" + hadirDisplay + "</td>" +
      "<td>" + (t.checked_in ? '<span class="badge success">&#10003;</span>' : "-") + "</td>" +
      '<td class="trunc-cell" title="' + (t.pesan ? escapeHtml(t.pesan) : "") + '">' + pesanTrunc + "</td>" +
      '<td style="white-space:nowrap">' + actions;
    tbody.appendChild(tr);
    var cells = tr.querySelectorAll("td.trunc-cell");
    cells.forEach(function(c) { c.addEventListener("click", function() { this.classList.toggle("expanded"); }); });
  });
}

export function setTamuFilter(filter, btn) {
  state.tamuFilter = filter;
  state.selectedTamu = {};
  updateBatchButtons();
  document.querySelectorAll("#tab-tamu .btn-group button").forEach(function(b) { b.classList.remove("active"); });
  btn.classList.add("active");
  renderTamuTable();
}

document.getElementById("tamu-search").addEventListener("input", debounce(function() {
  state.selectedTamu = {};
  updateBatchButtons();
  renderTamuTable();
}, 500));

document.getElementById("import-csv-file").addEventListener("change", function() {
  var file = this.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split("\n").filter(Boolean);
    document.getElementById("import-csv-preview").innerHTML = "Ditemukan " + lines.length + " baris. 3 baris pertama:<br><code>" + escapeHtml(lines.slice(0, 3).join("<br>")) + "</code>";
    document.getElementById("import-text").value = text;
  };
  reader.readAsText(file);
});

export function copyGuestLink(slug, token, pronoun) {
  if (!slug) { showToast("Tamu belum memiliki slug - tidak bisa menyalin link.", true); return; }
  var link = config.SITE_URL + "/?n=" + encodeURIComponent(slug);
  if (pronoun) link += "&p=" + encodeURIComponent(pronoun);
  if (token) link += "&token=" + token;
  navigator.clipboard.writeText(link).then(function() { showToast("Link tamu disalin!"); }).catch(function() { prompt("Salin link ini:", link); });
}

export function editTamu(guestId) {
  var entry = state.allTamu.find(function(t) { return String(t.guest_id) === String(guestId); });
  if (!entry) { showToast("Data tamu tidak ditemukan.", true); return; }
  showGuestModal({
    id: entry.guest_id, name: entry.nama, slug: entry._slug, side: entry._side || "",
    pronoun: entry._pronoun || "", invited_count: entry._invited_count,
  }, entry.id ? { id: entry.id, nomor_wa: entry.nomor_wa, status: entry.status, jumlah_hadir: entry.jumlah_hadir, pesan: entry.pesan } : null);
}

export function editOrphan(rsvpId) {
  var entry = state.allTamu.find(function(t) { return t.id === rsvpId && t._source === "orphan"; });
  if (!entry) { showToast("Data RSVP tidak ditemukan.", true); return; }
  document.getElementById("guest-form").reset();
  document.getElementById("guest-modal").classList.add("show");
  document.getElementById("guest-modal-title").textContent = "Tautkan RSVP ke Tamu";
  document.getElementById("gf-id").value = "";
  document.getElementById("gf-name").value = entry.nama || "";
  document.getElementById("gf-nomor-wa").value = entry.nomor_wa || "";
  document.getElementById("gf-pronoun").value = entry._pronoun || "";
  document.getElementById("gf-count").value = entry._invited_count || entry.jumlah_hadir || 1;
  document.getElementById("gf-side").value = entry._side || "";
  var slugRow = document.getElementById("gf-slug-row");
  if (slugRow) slugRow.classList.remove("d-none");
  var baseSlug = (entry.nama || "tamu").toLowerCase().replace(/\s+/g, "-").replace(/^-|-$/g, "");
  var slug = baseSlug;
  var slugNum = 1;
  while (state.allTamu.some(function(t) { return t._slug === slug; })) { slug = baseSlug + "-" + slugNum++; }
  document.getElementById("gf-slug").value = slug;
  var rsvpSection = document.getElementById("gf-rsvp-section");
  rsvpSection.classList.remove("d-none");
  document.getElementById("gf-rsvp-id").value = entry.id;
  document.getElementById("gf-status").value = entry.status || "";
  document.getElementById("gf-jumlah-hadir").value = entry.jumlah_hadir || 1;
}

async function loadApprovalPending() {
  var pending = state.allTamu.filter(function(t) { return !t.is_approved; });
  var badge = document.getElementById("badge-approval");
  badge.textContent = pending.length;
  badge.classList.toggle("show", pending.length > 0);
  var section = document.getElementById("approval-section");
  var list = document.getElementById("approval-list");
  section.classList.toggle("d-none", pending.length === 0);
  list.innerHTML = "";
  pending.forEach(function(t) {
    var div = document.createElement("div");
    div.className = "approval-item";
    div.innerHTML = "<span><strong>" + escapeHtml(t.nama) + "</strong> - " + escapeHtml(t.nomor_wa) + " - " + t.jumlah_hadir + " orang</span>";
    var btn = document.createElement("button");
    btn.className = "btn-pink";
    btn.textContent = "Approve";
    btn.addEventListener("click", function() { approveRSVP(t.id, btn); });
    div.appendChild(btn);
    list.appendChild(div);
  });
}

async function approveRSVP(rsvpId, btn) {
  btn.disabled = true; btn.textContent = "Memproses...";
  try {
    var res = await state.dashboardSb.from("rsvps").update({ is_approved: true, card_sent_at: new Date().toISOString() }).eq("id", rsvpId);
    if (res.error) throw res.error;
    showToast("Tamu disetujui. Kirim kartu via WA ke nomor tamu.");
    loadTamuRSVP();
  } catch(err) { showToast("Gagal approve. Coba lagi.", true); btn.disabled = false; btn.textContent = "Approve"; }
}

export async function confirmGuest(guestId, btn) {
  btn.disabled = true; var origHtml = btn.innerHTML; btn.innerHTML = "...";
  try {
    var res = await state.dashboardSb.from("rsvps").update({ is_approved: true, card_sent_at: new Date().toISOString() }).eq("guest_id", guestId);
    if (res.error) throw res.error;
    showToast("Tamu dikonfirmasi."); loadTamuRSVP();
  } catch(err) { showToast("Gagal konfirmasi.", true); btn.disabled = false; btn.innerHTML = origHtml; }
}

export function showGuestModal(guestData, rsvpData) {
  document.getElementById("guest-form").reset();
  document.getElementById("guest-modal").classList.add("show");
  var rsvpSection = document.getElementById("gf-rsvp-section");
  var slugRow = document.getElementById("gf-slug-row");
  if (guestData) {
    if (slugRow) slugRow.classList.add("d-none");
    document.getElementById("guest-modal-title").textContent = "Edit Tamu";
    document.getElementById("gf-id").value = guestData.id;
    document.getElementById("gf-name").value = guestData.name;
    document.getElementById("gf-slug").value = guestData.slug;
    document.getElementById("gf-side").value = guestData.side || "";
    document.getElementById("gf-pronoun").value = guestData.pronoun || "";
    document.getElementById("gf-count").value = guestData.invited_count;
    rsvpSection.classList.remove("d-none");
    if (rsvpData && rsvpData.id) {
      document.getElementById("gf-rsvp-id").value = rsvpData.id;
      document.getElementById("gf-nomor-wa").value = rsvpData.nomor_wa || "";
      document.getElementById("gf-status").value = rsvpData.status || "";
      document.getElementById("gf-jumlah-hadir").value = rsvpData.jumlah_hadir || 1;
    } else {
      document.getElementById("gf-rsvp-id").value = "";
      document.getElementById("gf-nomor-wa").value = "";
      document.getElementById("gf-status").value = "";
      document.getElementById("gf-jumlah-hadir").value = guestData.invited_count;
    }
  } else {
    if (slugRow) slugRow.classList.remove("d-none");
    document.getElementById("guest-modal-title").textContent = "Tambah Tamu";
    document.getElementById("guest-form").reset();
    document.getElementById("gf-id").value = "";
    document.getElementById("gf-count").value = 1;
    rsvpSection.classList.add("d-none");
  }
}

export function closeGuestModal() { document.getElementById("guest-modal").classList.remove("show"); }

document.getElementById("guest-modal").addEventListener("click", function(e) { if (e.target === this) closeGuestModal(); });

document.getElementById("guest-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var id = document.getElementById("gf-id").value;
  var sideVal = document.getElementById("gf-side").value;
  var nomorWa = document.getElementById("gf-nomor-wa").value.trim();
  var data = {
    name: document.getElementById("gf-name").value.trim(),
    slug: document.getElementById("gf-slug").value.trim(),
    side: sideVal || null,
    pronoun: document.getElementById("gf-pronoun").value.trim() || null,
    invited_count: parseInt(document.getElementById("gf-count").value) || 1,
    nomor_wa: nomorWa || null,
  };
  if (!data.name || !data.slug) { showToast("Nama dan slug wajib diisi.", true); return; }
  if (sideVal && !["pria", "wanita", "both"].includes(sideVal)) { showToast("Pilih hubungan yang valid.", true); return; }
  var rsvpSection = document.getElementById("gf-rsvp-section");
  if (rsvpSection && !rsvpSection.classList.contains("d-none")) {
    var statusVal = document.getElementById("gf-status").value;
    if (statusVal && !["Hadir", "Tidak Hadir"].includes(statusVal)) { showToast("Pilih status kehadiran yang valid.", true); return; }
  }
  try {
    var guestId = id;
    if (id) {
      var res = await state.dashboardSb.from("guests").update(data).eq("id", id);
      if (res.error) throw res.error;
    } else {
      var existingGuest = await state.dashboardSb.from("guests").select("id").eq("slug", data.slug).maybeSingle();
      if (existingGuest.error) throw existingGuest.error;
      if (existingGuest.data) {
        var res = await state.dashboardSb.from("guests").update(data).eq("id", existingGuest.data.id);
        if (res.error) throw res.error;
        guestId = existingGuest.data.id;
      } else {
        var res = await state.dashboardSb.from("guests").insert([data]).select("id");
        if (res.error) throw res.error;
        guestId = res.data[0].id;
      }
    }
    var rsvpId = document.getElementById("gf-rsvp-id").value;
    if (!rsvpSection.classList.contains("d-none")) {
      var status = document.getElementById("gf-status").value;
      var jumlahHadir = parseInt(document.getElementById("gf-jumlah-hadir").value) || 1;
      var rsvpData = { guest_id: guestId, nama: data.name, nomor_wa: nomorWa, jumlah_hadir: jumlahHadir, status: status };
      if (rsvpId) {
        var rsvpRes = await state.dashboardSb.from("rsvps").update(rsvpData).eq("id", rsvpId);
        if (rsvpRes.error) throw rsvpRes.error;
      } else if (status) {
        var existingRsvp = await state.dashboardSb.from("rsvps").select("id").eq("guest_id", guestId).maybeSingle();
        if (existingRsvp.error) throw existingRsvp.error;
        var rsvpRes;
        if (existingRsvp.data) { rsvpRes = await state.dashboardSb.from("rsvps").update(rsvpData).eq("id", existingRsvp.data.id); }
        else { rsvpRes = await state.dashboardSb.from("rsvps").insert([rsvpData]); }
        if (rsvpRes.error) throw rsvpRes.error;
      }
    } else if (nomorWa && guestId) {
      var rsvpData = { guest_id: guestId, nama: data.name, nomor_wa: nomorWa, jumlah_hadir: parseInt(document.getElementById("gf-count").value) || 1, status: null };
      var existingRsvp = await state.dashboardSb.from("rsvps").select("id").eq("guest_id", guestId).maybeSingle();
      if (existingRsvp.error) throw existingRsvp.error;
      var rsvpRes;
      if (existingRsvp.data) { rsvpRes = await state.dashboardSb.from("rsvps").update(rsvpData).eq("id", existingRsvp.data.id); }
      else { rsvpRes = await state.dashboardSb.from("rsvps").insert([rsvpData]); }
      if (rsvpRes.error) throw rsvpRes.error;
    }
    showToast(id ? "Tamu diperbarui." : "Tamu ditambahkan.");
    closeGuestModal();
    loadTamuRSVP();
  } catch(err) {
    if (err.code === "23505") { showToast("Slug sudah terpakai. Mungkin ada data duplikat. Refresh halaman lalu coba lagi, atau ganti slug.", true); }
    else { showToast("Gagal menyimpan: " + (err.message || "unknown"), true); }
  }
});

function updateBatchButtons() {
  var count = 0;
  for (var k in state.selectedTamu) { if (state.selectedTamu[k]) count++; }
  document.getElementById("btn-download-kartu").disabled = count === 0;
  document.getElementById("btn-hapus").disabled = count === 0;
  document.getElementById("selected-count").textContent = count > 0 ? count + " tamu dipilih" : "";
}

// Expose for inline handlers
window.loadGuestbook = loadGuestbook;
