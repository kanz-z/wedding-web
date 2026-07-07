// src/dashboard/pesan-admin.ts
import { state } from './state';
import { escapeHtml, formatDate } from './utils';

export async function loadPesanPrivat(): Promise<void> {
  const ppLoading = document.getElementById("pp-loading")!;
  const ppEmpty = document.getElementById("pp-empty")!;
  const ppError = document.getElementById("pp-error")!;

  ppLoading.classList.remove("d-none");
  ppEmpty.classList.add("d-none");
  ppError.classList.add("d-none");
  try {
    const res = await state.dashboardSb
      .from("rsvps")
      .select("nama, nomor_wa, pesan, created_at")
      .not("pesan", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    const data = res.data || [];
    const list = document.getElementById("pp-list")!;
    list.innerHTML = "";
    if (data.length === 0) {
      ppEmpty.classList.remove("d-none");
      ppLoading.classList.add("d-none");
      return;
    }
    data.forEach(function (item: Record<string, unknown>) {
      const card = document.createElement("div");
      card.className = "pp-list-card";
      card.innerHTML =
        '<div class="pp-list-header"><span class="pp-list-name">' +
        escapeHtml(item.nama as string) +
        '</span><span class="pp-list-meta">' +
        (item.nomor_wa ? escapeHtml(item.nomor_wa as string) : "") +
        " - " +
        formatDate(item.created_at as string) +
        '</span></div><div class="pp-list-body">' +
        escapeHtml(item.pesan as string) +
        "</div>";
      list.appendChild(card);
    });
    ppLoading.classList.add("d-none");
  } catch (err) {
    console.error("Pesan privat error:", err);
    ppLoading.classList.add("d-none");
    ppError.classList.remove("d-none");
  }
}

export async function loadAdminList(): Promise<void> {
  const tbody = document.getElementById("admin-tbody")!;
  const status = document.getElementById("admin-status")!;
  try {
    const res = await state.dashboardSb.from("admin_users").select("email, role");
    if (res.error) throw res.error;
    tbody.innerHTML = "";
    (res.data || []).forEach(function (a: Record<string, unknown>) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        escapeHtml(a.email as string) +
        '</td><td><span class="badge ' +
        (a.role === "admin" ? "pink" : "") +
        '">' +
        (a.role as string) +
        "</span></td>";
      tbody.appendChild(tr);
    });
  } catch (err) {
    status.textContent = "Gagal memuat daftar admin.";
    status.classList.remove("d-none");
  }
}
