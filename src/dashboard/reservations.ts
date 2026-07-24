// src/dashboard/reservations.ts — Fase 6C: Reservasi grid + approval + copy link

import { show, hide, debounce } from '@/shared/ui';
import { showToast, escapeHtml } from '@/shared/ui';
import {
  guestList,
  fetchGuests,
  approveReservation,
  rejectReservation,
  updateReservationStatus,
  eventStatus,
  setEventStatus,
} from './state';
import { renderNotifications } from './ui';
import { config } from '@/config';

const BASE_URL = config.SITE_URL || window.location.origin;

export function initReservations(): void {
  window.addEventListener('page-changed', ((e: CustomEvent) => {
    if (e.detail.page === 'reservations') loadReservations();
  }) as EventListener);

  document.getElementById('res-error-retry')?.addEventListener('click', loadReservations);

  // Search (debounce 250ms — konsisten dengan search tamu)
  const resSearch = document.getElementById('res-search') as HTMLInputElement | null;
  const debouncedResSearch = debounce((q: string) => {
    document.querySelectorAll<HTMLElement>('#reservation-grid .reservation-card').forEach((card) => {
      card.style.display = (card.dataset.resName ?? '').includes(q) ? '' : 'none';
    });
  }, 250);

  resSearch?.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    document.getElementById('res-search-box')?.classList.toggle('has-value', !!q);
    debouncedResSearch(q);
  });

  document.getElementById('res-search-clear')?.addEventListener('click', () => {
    if (resSearch) resSearch.value = '';
    document.getElementById('res-search-box')?.classList.remove('has-value');
    document.querySelectorAll<HTMLElement>('#reservation-grid .reservation-card').forEach((card) => {
      card.style.display = '';
    });
  });

  // Event status toggle (6.9)
  initEventStatusToggle();
}

async function loadReservations(): Promise<void> {
  show(document.getElementById('res-skeleton'));
  // Hanya sembunyikan grid jika belum ada data — hindari flash saat reload
  if (guestList.length === 0) {
    hide(document.getElementById('reservation-grid'));
  }
  hide(document.getElementById('res-empty'));
  hide(document.getElementById('res-error'));

  try {
    await fetchGuests();
    hide(document.getElementById('res-skeleton'));

    if (guestList.length === 0) {
      show(document.getElementById('res-empty'));
      return;
    }

    renderReservations();
    show(document.getElementById('reservation-grid'));
  } catch (err) {
    hide(document.getElementById('res-skeleton'));
    // Jangan tampilkan error jika data sudah ada (aborted retry, dsb.)
    if (guestList.length === 0) {
      show(document.getElementById('res-error'));
    } else {
      console.error('Gagal refresh reservasi:', err);
    }
  }
}

function renderReservations(): void {
  const grid = document.getElementById('reservation-grid');
  if (!grid) return;

  grid.innerHTML = guestList
    .map(
      (r) => `
    <div class="reservation-card" data-res-name="${escapeHtml(r.name.toLowerCase())}">
      <div class="reservation-card__qr-mini"><i class="bi bi-qr-code"></i></div>
      <div style="flex:1;min-width:0">
        <div class="reservation-card__name">${escapeHtml(r.name)}</div>
        <div class="reservation-card__slug">/invitation/${escapeHtml(r.slug)}</div>
        ${
          r.approval_status === 'pending'
            ? `
          <div style="margin-top:6px;display:flex;gap:6px">
            <button class="btn-dash btn-dash-accent btn-approve" data-id="${r.id}" type="button" style="font-size:0.75rem;padding:2px 8px">Approve</button>
            <button class="btn-dash btn-dash-outline btn-reject" data-id="${r.id}" type="button" style="font-size:0.75rem;padding:2px 8px">Reject</button>
          </div>`
            : `
          <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
            <span class="badge-dash badge-dash--${r.approval_status === 'approved' ? 'success' : 'danger'}" style="display:inline-block">${
              r.approval_status === 'approved' ? 'Disetujui' : 'Ditolak'
            }</span>
            <button class="btn-edit-status" data-id="${r.id}" data-status="${r.approval_status}" type="button" title="Ubah status" style="font-size:0.7rem;padding:0 4px;background:none;border:1px solid var(--panel-border);border-radius:4px;color:var(--ink-muted);cursor:pointer;line-height:1.5">✎</button>
          </div>`
        }
        <div class="reservation-card__actions">
          <button type="button" data-copy-link="${BASE_URL}/invitation/${escapeHtml(r.slug)}"><i class="bi bi-clipboard"></i> Salin</button>
          <a href="${BASE_URL}/invitation/${escapeHtml(r.slug)}/card" target="_blank" rel="noopener" class="text-decoration-none"><button type="button"><i class="bi bi-eye"></i> Lihat Kartu</button></a>
        </div>
      </div>
    </div>
  `,
    )
    .join('');

  // Approve/reject listeners (6.7)
  grid.querySelectorAll<HTMLButtonElement>('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await approveReservation(btn.dataset.id!);
        renderNotifications();
        showToast('Reservasi disetujui');
        await loadReservations();
      } catch {
        showToast('Gagal menyetujui', true);
      }
    });
  });

  grid.querySelectorAll<HTMLButtonElement>('.btn-reject').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await rejectReservation(btn.dataset.id!);
        renderNotifications();
        showToast('Reservasi ditolak');
        await loadReservations();
      } catch {
        showToast('Gagal menolak', true);
      }
    });
  });

  // Copy link (6.6)
  grid.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard
        ?.writeText(btn.dataset.copyLink ?? '')
        .then(() => showToast('Tautan disalin'))
        .catch(() => showToast('Gagal menyalin tautan', true));
    });
  });

  // Edit status untuk reservasi yang sudah final (6.10)
  grid.querySelectorAll<HTMLButtonElement>('.btn-edit-status').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id!;
      const currentStatus = btn.dataset.status!;
      const guest = guestList.find(g => g.id === id);
      const guestName = guest?.name ?? 'tamu ini';

      const newStatus = confirm(
        'Ubah status reservasi "' + guestName + '"?\n\n' +
        'Status saat ini: ' + (currentStatus === 'approved' ? 'Disetujui' : 'Ditolak') + '\n\n' +
        'Klik OK untuk mengembalikan ke Pending\n' +
        'Klik Cancel untuk batal.'
      );
      if (!newStatus) return;

      try {
        await updateReservationStatus(id, 'pending');
        renderNotifications();
        showToast('Status dikembalikan ke pending');
        await loadReservations();
      } catch {
        showToast('Gagal mengubah status', true);
      }
    });
  });
}

// --- Event Status Toggle (6.9) ---

function initEventStatusToggle(): void {
  const sw = document.getElementById('event-status-switch') as HTMLInputElement | null;
  const label = document.getElementById('event-status-label');

  if (!sw || !label) return;

  sw.checked = eventStatus === 'online';
  label.textContent = eventStatus === 'online' ? 'Online' : 'Offline';
  label.className = `status-toggle__label ${eventStatus === 'online' ? 'is-online' : 'is-offline'}`;

  sw.addEventListener('change', () => {
    const status = sw.checked ? 'online' : 'offline';
    setEventStatus(status);
    label.textContent = status === 'online' ? 'Online' : 'Offline';
    label.className = `status-toggle__label ${status === 'online' ? 'is-online' : 'is-offline'}`;
    showToast(
      status === 'online'
        ? 'Undangan online — publik dapat mengakses'
        : 'Undangan offline — publik tidak dapat mengakses',
    );
  });
}
