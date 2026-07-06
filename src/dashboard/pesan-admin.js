// src/dashboard/pesan-admin.js
import { state } from './state';
import { escapeHtml, formatDate } from './utils';

export async function loadPesanPrivat() {
  document.getElementById("pp-loading").classList.remove("d-none");
  document.getElementById("pp-empty").classList.add("d-none");
  document.getElementById("pp-error").classList.add("d-none");
  try {
    var res = await state.dashboardSb.from("rsvps").select("nama, nomor_wa, pesan, created_at").not("pesan", "is", null).order("created_at", { ascending: false }).limit(200);
    if (res.error) throw res.error;
    var data = res.data || [];
    var list = document.getElementById("pp-list");
    list.innerHTML = "";
    if (data.length === 0) { document.getElementById("pp-empty").classList.remove("d-none"); document.getElementById("pp-loading").classList.add("d-none"); return; }
    data.forEach(function(item) {
      var card = document.createElement("div");
      card.className = "pp-list-card";
      card.innerHTML = '<div class="pp-list-header"><span class="pp-list-name">' + escapeHtml(item.nama) + '</span><span class="pp-list-meta">' + (item.nomor_wa ? escapeHtml(item.nomor_wa) : "") + " - " + formatDate(item.created_at) + '</span></div><div class="pp-list-body">' + escapeHtml(item.pesan) + "</div>";
      list.appendChild(card);
    });
    document.getElementById("pp-loading").classList.add("d-none");
  } catch(err) {
    console.error("Pesan privat error:", err);
    document.getElementById("pp-loading").classList.add("d-none");
    document.getElementById("pp-error").classList.remove("d-none");
  }
}

export async function loadAdminList() {
  var tbody = document.getElementById("admin-tbody");
  var status = document.getElementById("admin-status");
  try {
    var res = await state.dashboardSb.from("admin_users").select("email, role");
    if (res.error) throw res.error;
    tbody.innerHTML = "";
    (res.data || []).forEach(function(a) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + escapeHtml(a.email) + '</td><td><span class="badge ' + (a.role === "admin" ? "pink" : "") + '">' + a.role + "</span></td>";
      tbody.appendChild(tr);
    });
  } catch(err) { status.textContent = "Gagal memuat daftar admin."; status.classList.remove("d-none"); }
}
