// src/dashboard/tamu.ts
import { state, type DashboardState } from './state';
import { escapeHtml, escapeAttr, showToast, debounce } from './utils';
import { config } from '../config';
import { loadGuestbook } from './guestbook';

// ---- Types ----

interface GuestRow {
  id: string;
  slug: string | null;
  name: string;
  pronoun: string | null;
  invited_count: number;
  created_at: string;
  side: string | null;
  nomor_wa: string | null;
}

interface RsvpRow {
  id: string;
  guest_id: string | null;
  nama: string;
  nomor_wa: string | null;
  jumlah_hadir: number;
  status: string | null;
  is_approved: boolean;
  checked_in: boolean;
  qr_token: string | null;
  pesan: string | null;
  created_at: string;
}

interface TamuEntry {
  id: string | null;
  guest_id: string;
  nama: string;
  nomor_wa: string;
  jumlah_hadir: number;
  status: string | null;
  is_approved: boolean;
  checked_in: boolean;
  qr_token: string | null;
  pesan: string | null;
  created_at: string;
  _slug: string | null;
  _pronoun: string | null;
  _invited_count: number;
  _source: string;
  _side: string | null;
}

interface GuestModalData {
  id: string;
  name: string;
  slug: string | null;
  side: string;
  pronoun: string;
  invited_count: number;
}

interface RsvpModalData {
  id: string;
  nomor_wa: string;
  status: string | null;
  jumlah_hadir: number;
  pesan: string | null;
}

// ---- Helpers ----

function buildGuestIdSet(guests: GuestRow[]): Record<string, boolean> {
  const set: Record<string, boolean> = {};
  guests.forEach(function (g: GuestRow) {
    set[g.id] = true;
  });
  return set;
}

function autoMatchOrphan(orphan: RsvpRow, guests: GuestRow[]): GuestRow | null {
  const name = (orphan.nama || '').toLowerCase().trim();
  const wa = (orphan.nomor_wa || '').trim();
  if (!name) return null;
  let best: GuestRow | null = null;
  let bestScore = 0;
  guests.forEach(function (g: GuestRow) {
    const gName = (g.name || '').toLowerCase().trim();
    let score = 0;
    if (name === gName) score += 3;
    else if (name.indexOf(gName) !== -1 || gName.indexOf(name) !== -1) score += 1;
    if (wa && g.nomor_wa && wa === g.nomor_wa.trim()) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  });
  return bestScore >= 2 ? best : null;
}

// ---- Main ----

export async function loadTamuRSVP(): Promise<void> {
  state.selectedTamu = {};
  updateBatchButtons();
  const statusEl = document.getElementById('tamu-status');
  const emptyEl = document.getElementById('tamu-empty');
  if (statusEl) statusEl.classList.add('d-none');
  if (emptyEl) emptyEl.classList.add('d-none');
  try {
    const [guestsRes, rsvpsRes] = await Promise.all([
      state.dashboardSb
        .from('guests')
        .select('id, slug, name, pronoun, invited_count, created_at, side, nomor_wa'),
      state.dashboardSb
        .from('rsvps')
        .select(
          'id, guest_id, nama, nomor_wa, jumlah_hadir, status, is_approved, checked_in, qr_token, pesan, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(800),
    ]);
    if (guestsRes.error) throw guestsRes.error;
    if (rsvpsRes.error) throw rsvpsRes.error;
    const guests = (guestsRes.data || []) as GuestRow[];
    const rsvps = (rsvpsRes.data || []) as RsvpRow[];
    const guestIdSet = buildGuestIdSet(guests);
    const linkedGuestIds: Record<string, boolean> = {};
    (state.allTamu as TamuEntry[]).length = 0;
    guests.forEach(function (g: GuestRow) {
      const rsvp = rsvps.find(function (r: RsvpRow) {
        return r.guest_id === g.id;
      });
      if (rsvp) linkedGuestIds[rsvp.id] = true;
      const entry: TamuEntry = {
        id: rsvp ? rsvp.id : null,
        guest_id: g.id,
        nama: rsvp ? rsvp.nama : g.name,
        nomor_wa: rsvp ? (rsvp.nomor_wa ?? '') : (g.nomor_wa ?? ''),
        jumlah_hadir: rsvp ? rsvp.jumlah_hadir : g.invited_count,
        status: rsvp ? rsvp.status : null,
        is_approved: rsvp ? rsvp.is_approved : true,
        checked_in: rsvp ? rsvp.checked_in : false,
        qr_token: rsvp ? rsvp.qr_token : null,
        pesan: rsvp ? rsvp.pesan : null,
        created_at: rsvp ? rsvp.created_at : g.created_at,
        _slug: g.slug,
        _pronoun: g.pronoun,
        _invited_count: g.invited_count,
        _source: 'guest',
        _side: g.side || null,
      };
      (state.allTamu as TamuEntry[]).push(entry);
    });
    const unmatchedRsvps = rsvps.filter(function (r: RsvpRow) {
      return !r.guest_id || !guestIdSet[r.guest_id];
    });
    unmatchedRsvps.forEach(function (r: RsvpRow) {
      if (linkedGuestIds[r.id]) return;
      const match = autoMatchOrphan(r, guests);
      const entry: TamuEntry = {
        id: r.id,
        guest_id: match ? match.id : (null as unknown as string),
        nama: r.nama,
        nomor_wa: r.nomor_wa || '',
        jumlah_hadir: r.jumlah_hadir,
        status: r.status,
        is_approved: r.is_approved,
        checked_in: r.checked_in,
        qr_token: r.qr_token,
        pesan: r.pesan,
        created_at: r.created_at,
        _slug: match ? match.slug : null,
        _pronoun: match ? match.pronoun : null,
        _invited_count: match ? match.invited_count : 0,
        _source: match ? 'auto-matched' : 'orphan',
        _side: match ? match.side || null : null,
      };
      (state.allTamu as TamuEntry[]).push(entry);
    });
    (state.allTamu as TamuEntry[]).sort(function (a: TamuEntry, b: TamuEntry) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const emptyEl2 = document.getElementById('tamu-empty');
    if (state.allTamu.length === 0) {
      if (emptyEl2) emptyEl2.classList.remove('d-none');
    }
    renderTamuTable();
    loadApprovalPending();
  } catch (err) {
    console.error('Tamu error:', err);
    const statusEl2 = document.getElementById('tamu-status');
    if (statusEl2) statusEl2.classList.remove('d-none');
  }
}

function badgeSide(side: string | null | undefined): string {
  if (side === 'pria') return '<span class="badge pink m-1">Pria</span>';
  if (side === 'wanita') return '<span class="badge m-1">Wanita</span>';
  if (side === 'both') return '<span class="badge success m-1">Keduanya</span>';
  return '';
}

function badgeSource(source: string): string {
  if (source === 'orphan') return '<span class="badge warning ms-1">Baru</span>';
  if (source === 'auto-matched') return '<span class="badge ms-1">Tercocok</span>';
  return '';
}

function renderTamuTable(): void {
  const tbody = document.getElementById('tamu-tbody') as HTMLElement | null;
  if (!tbody) return;
  tbody.innerHTML = '';
  const searchInput = document.getElementById('tamu-search') as HTMLInputElement | null;
  const search = (searchInput?.value || '').toLowerCase();
  const tamuFilter = state.tamuFilter as string; // ponytail: widen DashboardState.tamuFilter at migration
  const filtered = (state.allTamu as TamuEntry[]).filter(function (t: TamuEntry) {
    const matchSearch = !search || t.nama.toLowerCase().indexOf(search) !== -1;
    let matchFilter = true;
    if (tamuFilter === 'pending') matchFilter = t.is_approved === false;
    else if (tamuFilter === 'orphan')
      matchFilter = t._source === 'orphan' || t._source === 'auto-matched';
    else if (tamuFilter === 'pria') matchFilter = t._side === 'pria';
    else if (tamuFilter === 'wanita') matchFilter = t._side === 'wanita';
    else if (tamuFilter === 'belum') matchFilter = !t.status || t.status === 'belum';
    else if (tamuFilter !== 'all') matchFilter = t.status === tamuFilter;
    return matchSearch && matchFilter;
  });
  const emptyEl = document.getElementById('tamu-empty');
  if (emptyEl) emptyEl.classList.toggle('d-none', filtered.length !== 0);
  filtered.forEach(function (t: TamuEntry) {
    const tr = document.createElement('tr');
    let displayName = t._pronoun ? escapeHtml(t._pronoun) + ' ' : '';
    displayName += escapeHtml(t.nama);
    const pesanTrunc = t.pesan
      ? escapeHtml(t.pesan).substring(0, 50) + (t.pesan.length > 50 ? '&hellip;' : '')
      : '-';
    const kuotaDisplay = t._invited_count != null ? String(t._invited_count) : '-';
    const hadirDisplay = t.status ? String(t.jumlah_hadir) : '-';
    let actions =
      '<button class="btn-sm" onclick="' +
      (t._source === 'orphan'
        ? "editOrphan('" + escapeAttr(String(t.id)) + "')"
        : "editTamu('" + escapeAttr(String(t.guest_id)) + "')") +
      '" title="Edit" style="margin-right:4px"><i class="bi bi-pencil-fill"></i></button>' +
      '<button class="btn-sm" onclick="copyGuestLink(\'' +
      escapeAttr(t._slug || '') +
      "','" +
      (t.qr_token || '') +
      "','" +
      escapeAttr(t._pronoun || '') +
      '\')" title="Salin link"><i class="bi bi-link-45deg"></i></button>';
    if (t.status && t.status !== 'belum' && !t.is_approved && t._invited_count > 2) {
      actions +=
        '<button class="btn-pink btn-sm ms-1" onclick="confirmGuest(\'' +
        t.guest_id +
        '\', this)" title="Konfirmasi tamu"><i class="bi bi-check-circle-fill"></i></button>';
    }
    actions += '</td>';
    tr.innerHTML =
      '<td style="width:36px"><input type="checkbox" class="tamu-checkbox" data-guest-id="' +
      escapeAttr(String(t.guest_id)) +
      '"' +
      (state.selectedTamu[t.guest_id] ? ' checked' : '') +
      ' onchange="toggleSelect(this.dataset.guestId, this.checked)"></td>' +
      '<td>' +
      displayName +
      badgeSource(t._source) +
      badgeSide(t._side) +
      '</td>' +
      "<td><code style='color:var(--ink-muted);font-size:0.75rem;'>" +
      (t._slug ? escapeHtml(t._slug) : '-') +
      '</code></td>' +
      '<td>' +
      escapeHtml(t.nomor_wa || '') +
      '</td>' +
      "<td class='text-center'>" +
      kuotaDisplay +
      '</td>' +
      '<td><span class="badge ' +
      (t.status === 'Hadir' ? 'pink' : t.status === 'Tidak Hadir' ? '' : 'belum') +
      '">' +
      (t.status || 'Belum') +
      '</span>' +
      (!t.is_approved ? ' <span class="badge warning">Pending</span>' : '') +
      '</td>' +
      "<td class='text-center'>" +
      hadirDisplay +
      '</td>' +
      '<td>' +
      (t.checked_in ? '<span class="badge success">&#10003;</span>' : '-') +
      '</td>' +
      '<td class="trunc-cell" title="' +
      (t.pesan ? escapeHtml(t.pesan) : '') +
      '">' +
      pesanTrunc +
      '</td>' +
      '<td style="white-space:nowrap">' +
      actions;
    tbody.appendChild(tr);
    const cells = tr.querySelectorAll('td.trunc-cell');
    cells.forEach(function (c: Element) {
      c.addEventListener('click', function (this: Element) {
        this.classList.toggle('expanded');
      });
    });
  });
}

export function setTamuFilter(filter: string, btn: HTMLElement): void {
  state.tamuFilter = filter as unknown as DashboardState['tamuFilter'];
  state.selectedTamu = {};
  updateBatchButtons();
  document.querySelectorAll('#tab-tamu .btn-group button').forEach(function (b: Element) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  renderTamuTable();
}

const tamuSearchEl = document.getElementById('tamu-search');
if (tamuSearchEl) {
  tamuSearchEl.addEventListener(
    'input',
    debounce(function () {
      state.selectedTamu = {};
      updateBatchButtons();
      renderTamuTable();
    }, 500)
  );
}

const importCsvFileEl = document.getElementById('import-csv-file') as HTMLInputElement | null;
if (importCsvFileEl) {
  importCsvFileEl.addEventListener('change', function (this: HTMLInputElement) {
    const file = this.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e: ProgressEvent<FileReader>) {
      const text = (e.target as FileReader).result as string;
      const lines = text.split('\n').filter(Boolean);
      const previewEl = document.getElementById('import-csv-preview');
      if (previewEl) {
        previewEl.innerHTML =
          'Ditemukan ' +
          lines.length +
          ' baris. 3 baris pertama:<br><code>' +
          escapeHtml(lines.slice(0, 3).join('<br>')) +
          '</code>';
      }
      const importTextEl = document.getElementById('import-text') as HTMLTextAreaElement | null;
      if (importTextEl) importTextEl.value = text;
    };
    reader.readAsText(file);
  });
}

export function copyGuestLink(
  slug: string | null,
  token: string | null | undefined,
  pronoun: string | null | undefined
): void {
  if (!slug) {
    showToast('Tamu belum memiliki slug - tidak bisa menyalin link.', true);
    return;
  }
  let link = config.SITE_URL + '/?n=' + encodeURIComponent(slug);
  if (pronoun) link += '&p=' + encodeURIComponent(pronoun);
  if (token) link += '&token=' + token;
  navigator.clipboard
    .writeText(link)
    .then(function () {
      showToast('Link tamu disalin!');
    })
    .catch(function () {
      prompt('Salin link ini:', link);
    });
}

export function editTamu(guestId: string): void {
  const entry = (state.allTamu as TamuEntry[]).find(function (t: TamuEntry) {
    return String(t.guest_id) === String(guestId);
  });
  if (!entry) {
    showToast('Data tamu tidak ditemukan.', true);
    return;
  }
  showGuestModal(
    {
      id: entry.guest_id,
      name: entry.nama,
      slug: entry._slug,
      side: entry._side || '',
      pronoun: entry._pronoun || '',
      invited_count: entry._invited_count,
    },
    entry.id
      ? {
          id: entry.id,
          nomor_wa: entry.nomor_wa,
          status: entry.status,
          jumlah_hadir: entry.jumlah_hadir,
          pesan: entry.pesan,
        }
      : null
  );
}

export function editOrphan(rsvpId: string): void {
  const entry = (state.allTamu as TamuEntry[]).find(function (t: TamuEntry) {
    return t.id === rsvpId && t._source === 'orphan';
  });
  if (!entry) {
    showToast('Data RSVP tidak ditemukan.', true);
    return;
  }
  const form = document.getElementById('guest-form') as HTMLFormElement | null;
  if (form) form.reset();
  const modal = document.getElementById('guest-modal');
  if (modal) modal.classList.add('show');
  const titleEl = document.getElementById('guest-modal-title');
  if (titleEl) titleEl.textContent = 'Tautkan RSVP ke Tamu';
  const gfId = document.getElementById('gf-id') as HTMLInputElement | null;
  if (gfId) gfId.value = '';
  const gfName = document.getElementById('gf-name') as HTMLInputElement | null;
  if (gfName) gfName.value = entry.nama || '';
  const gfNomorWa = document.getElementById('gf-nomor-wa') as HTMLInputElement | null;
  if (gfNomorWa) gfNomorWa.value = entry.nomor_wa || '';
  const gfPronoun = document.getElementById('gf-pronoun') as HTMLInputElement | null;
  if (gfPronoun) gfPronoun.value = entry._pronoun || '';
  const gfCount = document.getElementById('gf-count') as HTMLInputElement | null;
  if (gfCount) gfCount.value = String(entry._invited_count || entry.jumlah_hadir || 1);
  const gfSide = document.getElementById('gf-side') as HTMLSelectElement | null;
  if (gfSide) gfSide.value = entry._side || '';
  const slugRow = document.getElementById('gf-slug-row');
  if (slugRow) slugRow.classList.remove('d-none');
  const baseSlug = (entry.nama || 'tamu')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^-|-$/g, '');
  let slug = baseSlug;
  let slugNum = 1;
  while (
    (state.allTamu as TamuEntry[]).some(function (t: TamuEntry) {
      return t._slug === slug;
    })
  ) {
    slug = baseSlug + '-' + slugNum++;
  }
  const gfSlug = document.getElementById('gf-slug') as HTMLInputElement | null;
  if (gfSlug) gfSlug.value = slug;
  const rsvpSection = document.getElementById('gf-rsvp-section');
  if (rsvpSection) rsvpSection.classList.remove('d-none');
  const gfRsvpId = document.getElementById('gf-rsvp-id') as HTMLInputElement | null;
  if (gfRsvpId) gfRsvpId.value = entry.id || '';
  const gfStatus = document.getElementById('gf-status') as HTMLSelectElement | null;
  if (gfStatus) gfStatus.value = entry.status || '';
  const gfJumlahHadir = document.getElementById('gf-jumlah-hadir') as HTMLInputElement | null;
  if (gfJumlahHadir) gfJumlahHadir.value = String(entry.jumlah_hadir || 1);
}

async function loadApprovalPending(): Promise<void> {
  const pending = (state.allTamu as TamuEntry[]).filter(function (t: TamuEntry) {
    return !t.is_approved;
  });
  const badge = document.getElementById('badge-approval') as HTMLElement | null;
  if (badge) {
    badge.textContent = String(pending.length);
    badge.classList.toggle('show', pending.length > 0);
  }
  const section = document.getElementById('approval-section');
  const list = document.getElementById('approval-list');
  if (section) section.classList.toggle('d-none', pending.length === 0);
  if (list) {
    list.innerHTML = '';
    pending.forEach(function (t: TamuEntry) {
      const div = document.createElement('div');
      div.className = 'approval-item';
      div.innerHTML =
        '<span><strong>' +
        escapeHtml(t.nama) +
        '</strong> - ' +
        escapeHtml(t.nomor_wa) +
        ' - ' +
        t.jumlah_hadir +
        ' orang</span>';
      const btn = document.createElement('button');
      btn.className = 'btn-pink';
      btn.textContent = 'Approve';
      btn.addEventListener('click', function () {
        approveRSVP(t.id, btn);
      });
      div.appendChild(btn);
      list.appendChild(div);
    });
  }
}

async function approveRSVP(rsvpId: string | null, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  try {
    const res = await state.dashboardSb
      .from('rsvps')
      .update({ is_approved: true, card_sent_at: new Date().toISOString() })
      .eq('id', rsvpId);
    if (res.error) throw res.error;
    showToast('Tamu disetujui. Kirim kartu via WA ke nomor tamu.');
    loadTamuRSVP();
  } catch (err) {
    showToast('Gagal approve. Coba lagi.', true);
    btn.disabled = false;
    btn.textContent = 'Approve';
  }
}

export async function confirmGuest(guestId: string, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  const origHtml = btn.innerHTML;
  btn.innerHTML = '...';
  try {
    const res = await state.dashboardSb
      .from('rsvps')
      .update({ is_approved: true, card_sent_at: new Date().toISOString() })
      .eq('guest_id', guestId);
    if (res.error) throw res.error;
    showToast('Tamu dikonfirmasi.');
    loadTamuRSVP();
  } catch (err) {
    showToast('Gagal konfirmasi.', true);
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

export function showGuestModal(guestData: GuestModalData | null, rsvpData: RsvpModalData | null): void {
  const form = document.getElementById('guest-form') as HTMLFormElement | null;
  if (form) form.reset();
  const modal = document.getElementById('guest-modal');
  if (modal) modal.classList.add('show');
  const rsvpSection = document.getElementById('gf-rsvp-section');
  const slugRow = document.getElementById('gf-slug-row');
  if (guestData) {
    if (slugRow) slugRow.classList.add('d-none');
    const titleEl = document.getElementById('guest-modal-title');
    if (titleEl) titleEl.textContent = 'Edit Tamu';
    const gfId = document.getElementById('gf-id') as HTMLInputElement | null;
    if (gfId) gfId.value = guestData.id;
    const gfName = document.getElementById('gf-name') as HTMLInputElement | null;
    if (gfName) gfName.value = guestData.name;
    const gfSlug = document.getElementById('gf-slug') as HTMLInputElement | null;
    if (gfSlug) gfSlug.value = guestData.slug || '';
    const gfSide = document.getElementById('gf-side') as HTMLSelectElement | null;
    if (gfSide) gfSide.value = guestData.side || '';
    const gfPronoun = document.getElementById('gf-pronoun') as HTMLInputElement | null;
    if (gfPronoun) gfPronoun.value = guestData.pronoun || '';
    const gfCount = document.getElementById('gf-count') as HTMLInputElement | null;
    if (gfCount) gfCount.value = String(guestData.invited_count);
    if (rsvpSection) rsvpSection.classList.remove('d-none');
    if (rsvpData && rsvpData.id) {
      const gfRsvpId = document.getElementById('gf-rsvp-id') as HTMLInputElement | null;
      if (gfRsvpId) gfRsvpId.value = rsvpData.id;
      const gfNomorWa = document.getElementById('gf-nomor-wa') as HTMLInputElement | null;
      if (gfNomorWa) gfNomorWa.value = rsvpData.nomor_wa || '';
      const gfStatus = document.getElementById('gf-status') as HTMLSelectElement | null;
      if (gfStatus) gfStatus.value = rsvpData.status || '';
      const gfJumlahHadir = document.getElementById('gf-jumlah-hadir') as HTMLInputElement | null;
      if (gfJumlahHadir) gfJumlahHadir.value = String(rsvpData.jumlah_hadir || 1);
    } else {
      const gfRsvpId = document.getElementById('gf-rsvp-id') as HTMLInputElement | null;
      if (gfRsvpId) gfRsvpId.value = '';
      const gfNomorWa = document.getElementById('gf-nomor-wa') as HTMLInputElement | null;
      if (gfNomorWa) gfNomorWa.value = '';
      const gfStatus = document.getElementById('gf-status') as HTMLSelectElement | null;
      if (gfStatus) gfStatus.value = '';
      const gfJumlahHadir = document.getElementById('gf-jumlah-hadir') as HTMLInputElement | null;
      if (gfJumlahHadir) gfJumlahHadir.value = String(guestData.invited_count);
    }
  } else {
    if (slugRow) slugRow.classList.remove('d-none');
    const titleEl = document.getElementById('guest-modal-title');
    if (titleEl) titleEl.textContent = 'Tambah Tamu';
    if (form) form.reset();
    const gfId = document.getElementById('gf-id') as HTMLInputElement | null;
    if (gfId) gfId.value = '';
    const gfCount = document.getElementById('gf-count') as HTMLInputElement | null;
    if (gfCount) gfCount.value = '1';
    if (rsvpSection) rsvpSection.classList.add('d-none');
  }
}

export function closeGuestModal(): void {
  const modal = document.getElementById('guest-modal');
  if (modal) modal.classList.remove('show');
}

const guestModalEl = document.getElementById('guest-modal');
if (guestModalEl) {
  guestModalEl.addEventListener('click', function (this: HTMLElement, e: MouseEvent) {
    if (e.target === this) closeGuestModal();
  });
}

const guestFormEl = document.getElementById('guest-form') as HTMLFormElement | null;
if (guestFormEl) {
  guestFormEl.addEventListener('submit', async function (e: SubmitEvent) {
    e.preventDefault();
    const gfId = document.getElementById('gf-id') as HTMLInputElement | null;
    const gfSide = document.getElementById('gf-side') as HTMLSelectElement | null;
    const gfNomorWa = document.getElementById('gf-nomor-wa') as HTMLInputElement | null;
    const gfName = document.getElementById('gf-name') as HTMLInputElement | null;
    const gfSlug = document.getElementById('gf-slug') as HTMLInputElement | null;
    const gfPronoun = document.getElementById('gf-pronoun') as HTMLInputElement | null;
    const gfCount = document.getElementById('gf-count') as HTMLInputElement | null;
    const gfRsvpId = document.getElementById('gf-rsvp-id') as HTMLInputElement | null;
    const gfStatus = document.getElementById('gf-status') as HTMLSelectElement | null;
    const gfJumlahHadir = document.getElementById('gf-jumlah-hadir') as HTMLInputElement | null;
    const rsvpSection = document.getElementById('gf-rsvp-section');

    const id = gfId?.value || '';
    const sideVal = gfSide?.value || '';
    const nomorWa = (gfNomorWa?.value || '').trim();
    const data: Record<string, unknown> = {
      name: (gfName?.value || '').trim(),
      slug: (gfSlug?.value || '').trim(),
      side: sideVal || null,
      pronoun: (gfPronoun?.value || '').trim() || null,
      invited_count: parseInt(gfCount?.value || '') || 1,
      nomor_wa: nomorWa || null,
    };
    if (!data.name || !data.slug) {
      showToast('Nama dan slug wajib diisi.', true);
      return;
    }
    if (sideVal && !['pria', 'wanita', 'both'].includes(sideVal)) {
      showToast('Pilih hubungan yang valid.', true);
      return;
    }
    if (rsvpSection && !rsvpSection.classList.contains('d-none')) {
      const statusVal = gfStatus?.value || '';
      if (statusVal && !['Hadir', 'Tidak Hadir'].includes(statusVal)) {
        showToast('Pilih status kehadiran yang valid.', true);
        return;
      }
    }
    try {
      let guestId = id;
      if (id) {
        const res = await state.dashboardSb.from('guests').update(data).eq('id', id);
        if (res.error) throw res.error;
      } else {
        const existingGuest = await state.dashboardSb
          .from('guests')
          .select('id')
          .eq('slug', data.slug as string)
          .maybeSingle();
        if (existingGuest.error) throw existingGuest.error;
        if (existingGuest.data) {
          const res = await state.dashboardSb
            .from('guests')
            .update(data)
            .eq('id', (existingGuest.data as { id: string }).id);
          if (res.error) throw res.error;
          guestId = (existingGuest.data as { id: string }).id;
        } else {
          const res = await state.dashboardSb.from('guests').insert([data]).select('id');
          if (res.error) throw res.error;
          guestId = (res.data as { id: string }[])[0].id;
        }
      }
      const rsvpIdVal = gfRsvpId?.value || '';
      if (rsvpSection && !rsvpSection.classList.contains('d-none')) {
        const status = gfStatus?.value || '';
        const jumlahHadir = parseInt(gfJumlahHadir?.value || '') || 1;
        const rsvpData: Record<string, unknown> = {
          guest_id: guestId,
          nama: data.name,
          nomor_wa: nomorWa,
          jumlah_hadir: jumlahHadir,
          status: status,
        };
        if (rsvpIdVal) {
          const rsvpRes = await state.dashboardSb
            .from('rsvps')
            .update(rsvpData)
            .eq('id', rsvpIdVal);
          if (rsvpRes.error) throw rsvpRes.error;
        } else if (status) {
          const existingRsvp = await state.dashboardSb
            .from('rsvps')
            .select('id')
            .eq('guest_id', guestId)
            .maybeSingle();
          if (existingRsvp.error) throw existingRsvp.error;
          let rsvpRes;
          if (existingRsvp.data) {
            rsvpRes = await state.dashboardSb
              .from('rsvps')
              .update(rsvpData)
              .eq('id', (existingRsvp.data as { id: string }).id);
          } else {
            rsvpRes = await state.dashboardSb.from('rsvps').insert([rsvpData]);
          }
          if (rsvpRes?.error) throw rsvpRes.error;
        }
      } else if (nomorWa && guestId) {
        const rsvpData: Record<string, unknown> = {
          guest_id: guestId,
          nama: data.name,
          nomor_wa: nomorWa,
          jumlah_hadir: parseInt(gfCount?.value || '') || 1,
          status: null,
        };
        const existingRsvp = await state.dashboardSb
          .from('rsvps')
          .select('id')
          .eq('guest_id', guestId)
          .maybeSingle();
        if (existingRsvp.error) throw existingRsvp.error;
        let rsvpRes;
        if (existingRsvp.data) {
          rsvpRes = await state.dashboardSb
            .from('rsvps')
            .update(rsvpData)
            .eq('id', (existingRsvp.data as { id: string }).id);
        } else {
          rsvpRes = await state.dashboardSb.from('rsvps').insert([rsvpData]);
        }
        if (rsvpRes?.error) throw rsvpRes.error;
      }
      showToast(id ? 'Tamu diperbarui.' : 'Tamu ditambahkan.');
      closeGuestModal();
      loadTamuRSVP();
    } catch (err: unknown) {
      const code = (err as Record<string, unknown>).code;
      if (code === '23505') {
        showToast(
          'Slug sudah terpakai. Mungkin ada data duplikat. Refresh halaman lalu coba lagi, atau ganti slug.',
          true
        );
      } else {
        showToast('Gagal menyimpan: ' + ((err as Error).message || 'unknown'), true);
      }
    }
  });
}

function updateBatchButtons(): void {
  let count = 0;
  for (const k in state.selectedTamu) {
    if (state.selectedTamu[k]) count++;
  }
  const btnDownload = document.getElementById('btn-download-kartu') as HTMLButtonElement | null;
  const btnHapus = document.getElementById('btn-hapus') as HTMLButtonElement | null;
  const selectedCount = document.getElementById('selected-count');
  if (btnDownload) btnDownload.disabled = count === 0;
  if (btnHapus) btnHapus.disabled = count === 0;
  if (selectedCount) selectedCount.textContent =
    count > 0 ? count + ' tamu dipilih' : '';
}

// Expose for inline handlers
window.loadGuestbook = loadGuestbook;
