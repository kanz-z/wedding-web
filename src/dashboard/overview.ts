import { state } from './state';
import { escapeHtml, formatDate } from './utils';
import { renderPagination } from '../main/utils';

function renderActivityPagination(): void {
  const totalPages = Math.max(1, Math.ceil(state._actItems.length / state._actPageSize));
  renderPagination({
    container: document.getElementById('activity-pagination'),
    currentPage: state._actPage,
    totalPages,
    onPageChange: (page: number) => { state._actPage = page; renderActivityPage(); },
  });
}

function renderActivityPage(): void {
  const log = document.getElementById('activity-log')!;
  log.innerHTML = '';
  const from = state._actPage * state._actPageSize;
  const to = from + state._actPageSize;
  const page = state._actItems.slice(from, to);
  if (page.length === 0) {
    document.getElementById('activity-empty')!.classList.remove('d-none');
  } else {
    document.getElementById('activity-empty')!.classList.add('d-none');
    const table = document.createElement('table');
    table.className = 'activity-table';
    page.forEach((item) => {
      const tr = document.createElement('tr');
      if (item._type === 'rsvp') {
        tr.innerHTML = '<td><span class="activity-dot rsvp"></span>' + escapeHtml(item.nama) + '</td><td>' + item.status + ' (' + item.jumlah_hadir + ' org)</td><td>' + formatDate(item.created_at) + '</td>';
      } else {
        tr.innerHTML = '<td><span class="activity-dot gb"></span>' + escapeHtml(item.nama) + '</td><td>' + escapeHtml(item.pesan!.substring(0, 60)) + '</td><td>' + formatDate(item.created_at) + '</td>';
      }
      table.appendChild(tr);
    });
    log.appendChild(table);
  }
  renderActivityPagination();
}

export async function loadOverview(): Promise<void> {
  document.getElementById('overview-error')!.classList.add('d-none');
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- supabase response, typed via assertion below
    const [rsvpRes, gbRes] = await Promise.all([
      state.dashboardSb.from('rsvps').select('status, jumlah_hadir, nama, created_at').order('created_at', { ascending: false }),
      state.dashboardSb.from('guestbook').select('nama, pesan, created_at').eq('is_approved', true).order('created_at', { ascending: false }),
    ]) as [{ data: { status: string; jumlah_hadir: number; nama: string; created_at: string }[] | null; error: unknown }, { data: { nama: string; pesan: string; created_at: string }[] | null; error: unknown }];
    if (rsvpRes.error) throw rsvpRes.error;
    const rsvps = rsvpRes.data || [];
    const hadir = rsvps.filter((r) => r.status === 'Hadir');
    const absen = rsvps.filter((r) => r.status === 'Tidak Hadir');
    document.getElementById('met-total')!.textContent = String(rsvps.length);
    document.getElementById('met-hadir')!.textContent = String(hadir.length);
    document.getElementById('met-absen')!.textContent = String(absen.length);
    const gbData = gbRes.data || [];
    document.getElementById('met-msg')!.textContent = String(gbData.length);
    drawPieChart(hadir.length, absen.length);
    document.getElementById('overview-status')!.classList.toggle('d-none', rsvps.length !== 0);
    state._actItems = [];
    rsvps.forEach((r) => { state._actItems.push({ _type: 'rsvp', nama: r.nama, status: r.status, jumlah_hadir: r.jumlah_hadir, created_at: r.created_at }); });
    gbData.forEach((g) => { state._actItems.push({ _type: 'gb', nama: g.nama, pesan: g.pesan, created_at: g.created_at }); });
    state._actItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    state._actPage = 0;
    renderActivityPage();
  } catch (err: unknown) {
    console.error('Overview error:', err);
    document.getElementById('overview-error')!.classList.remove('d-none');
  }
}

function drawPieChart(hadir: number, absen: number): void {
  const canvas = document.getElementById('pieChart') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const total = hadir + absen;
  ctx.clearRect(0, 0, 180, 180);
  if (total === 0) return;
  const cx = 90, cy = 90, r = 70;
  const hadirAngle = (hadir / total) * 2 * Math.PI;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + hadirAngle); ctx.fillStyle = '#f14e95'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2 + hadirAngle, -Math.PI / 2 + 2 * Math.PI); ctx.fillStyle = '#444'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 35, 0, 2 * Math.PI); ctx.fillStyle = '#0a0a0a'; ctx.fill();
  document.getElementById('pie-legend')!.innerHTML =
    '<div style="margin-bottom:0.35rem;"><span style="display:inline-block;width:12px;height:12px;background:#f14e95;border-radius:3px;vertical-align:middle;margin-right:8px;"></span>Hadir: <strong>' + hadir + '</strong></div>' +
    '<div><span style="display:inline-block;width:12px;height:12px;background:#444;border-radius:3px;vertical-align:middle;margin-right:8px;"></span>Tidak Hadir: <strong>' + absen + '</strong></div>';
}
