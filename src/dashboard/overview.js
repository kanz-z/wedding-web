import { state } from './state';
import { escapeHtml, formatDate } from './utils';
import { renderPagination } from '../main/utils';

function renderActivityPagination() {
  var totalPages = Math.max(1, Math.ceil(state._actItems.length / state._actPageSize));
  renderPagination({
    container: document.getElementById("activity-pagination"),
    currentPage: state._actPage,
    totalPages: totalPages,
    onPageChange: function(page) { state._actPage = page; renderActivityPage(); },
  });
}

function renderActivityPage() {
  var log = document.getElementById("activity-log");
  log.innerHTML = "";
  var from = state._actPage * state._actPageSize;
  var to = from + state._actPageSize;
  var page = state._actItems.slice(from, to);
  if (page.length === 0) {
    document.getElementById("activity-empty").classList.remove("d-none");
  } else {
    document.getElementById("activity-empty").classList.add("d-none");
    var table = document.createElement("table");
    table.className = "activity-table";
    page.forEach(function(item) {
      var tr = document.createElement("tr");
      if (item._type === "rsvp") {
        tr.innerHTML = '<td><span class="activity-dot rsvp"></span>' + escapeHtml(item.nama) + "</td><td>" + item.status + " (" + item.jumlah_hadir + " org)</td><td>" + formatDate(item.created_at) + "</td>";
      } else {
        tr.innerHTML = '<td><span class="activity-dot gb"></span>' + escapeHtml(item.nama) + "</td><td>" + escapeHtml(item.pesan.substring(0, 60)) + "</td><td>" + formatDate(item.created_at) + "</td>";
      }
      table.appendChild(tr);
    });
    log.appendChild(table);
  }
  renderActivityPagination();
}

export async function loadOverview() {
  document.getElementById("overview-error").classList.add("d-none");
  try {
    var [rsvpRes, gbRes] = await Promise.all([
      state.dashboardSb.from("rsvps").select("status, jumlah_hadir, nama, created_at").order("created_at", { ascending: false }),
      state.dashboardSb.from("guestbook").select("nama, pesan, created_at").eq("is_approved", true).order("created_at", { ascending: false }),
    ]);
    if (rsvpRes.error) throw rsvpRes.error;
    var rsvps = rsvpRes.data || [];
    var hadir = rsvps.filter(function(r) { return r.status === "Hadir"; });
    var absen = rsvps.filter(function(r) { return r.status === "Tidak Hadir"; });
    document.getElementById("met-total").textContent = rsvps.length;
    document.getElementById("met-hadir").textContent = hadir.length;
    document.getElementById("met-absen").textContent = absen.length;
    document.getElementById("met-msg").textContent = (gbRes.data || []).length;
    drawPieChart(hadir.length, absen.length);
    document.getElementById("overview-status").classList.toggle("d-none", rsvps.length !== 0);
    state._actItems = [];
    rsvps.forEach(function(r) { state._actItems.push({ _type: "rsvp", nama: r.nama, status: r.status, jumlah_hadir: r.jumlah_hadir, created_at: r.created_at }); });
    (gbRes.data || []).forEach(function(g) { state._actItems.push({ _type: "gb", nama: g.nama, pesan: g.pesan, created_at: g.created_at }); });
    state._actItems.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    state._actPage = 0;
    renderActivityPage();
  } catch(err) {
    console.error("Overview error:", err);
    document.getElementById("overview-error").classList.remove("d-none");
  }
}

function drawPieChart(hadir, absen) {
  var canvas = document.getElementById("pieChart");
  var ctx = canvas.getContext("2d");
  var total = hadir + absen;
  ctx.clearRect(0, 0, 180, 180);
  if (total === 0) return;
  var cx = 90, cy = 90, r = 70;
  var hadirAngle = (hadir / total) * 2 * Math.PI;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + hadirAngle); ctx.fillStyle = "#f14e95"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2 + hadirAngle, -Math.PI / 2 + 2 * Math.PI); ctx.fillStyle = "#444"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 35, 0, 2 * Math.PI); ctx.fillStyle = "#0a0a0a"; ctx.fill();
  document.getElementById("pie-legend").innerHTML =
    '<div style="margin-bottom:0.35rem;"><span style="display:inline-block;width:12px;height:12px;background:#f14e95;border-radius:3px;vertical-align:middle;margin-right:8px;"></span>Hadir: <strong>' + hadir + '</strong></div>' +
    '<div><span style="display:inline-block;width:12px;height:12px;background:#444;border-radius:3px;vertical-align:middle;margin-right:8px;"></span>Tidak Hadir: <strong>' + absen + '</strong></div>';
}
