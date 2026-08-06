// src/dashboard/messages.ts — Fase 6A-6B: Pesan Publik + Pesan Privat

import { show, hide } from '@/shared/ui';
import { showToast, escapeHtml, formatTime } from '@/shared/ui';
import {
  fetchGuestbook,
  updateGuestbookApproval,
  guestbookEntries,
  fetchPrivateMessages,
  privateMessages,
} from './state';
import { supabase } from './supabase-client';
import { renderNotifications } from './ui';

// --- Realtime subscription guestbook ---

let guestbookChannel: ReturnType<typeof supabase.channel> | null = null;

function setupGuestbookRealtime(): void {
  guestbookChannel = supabase
    .channel('guestbook-changes')
    .on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table: 'guestbook' } as never,
      () => {
        const page = document.getElementById('page-public');
        if (page && !page.classList.contains('d-none-important')) {
          loadPublicMessages();
        }
      },
    )
    .subscribe();
}

// --- Init ---

export function initMessages(): void {
  setupGuestbookRealtime();

  window.addEventListener('page-changed', ((e: CustomEvent) => {
    if (e.detail.page === 'public') loadPublicMessages();
    else if (e.detail.page === 'private') loadPrivateMessages();
  }) as EventListener);

  document.getElementById('public-error-retry')?.addEventListener('click', loadPublicMessages);
  document.getElementById('private-error-retry')?.addEventListener('click', loadPrivateMessages);
}

// --- Pesan Publik (6.1–6.3) ---

async function loadPublicMessages(): Promise<void> {
  show(document.getElementById('public-skeleton'));
  hide(document.getElementById('public-messages-list'));
  hide(document.getElementById('public-empty'));
  hide(document.getElementById('public-error'));

  try {
    await fetchGuestbook();
    renderNotifications();
    hide(document.getElementById('public-skeleton'));

    if (guestbookEntries.length === 0) {
      show(document.getElementById('public-empty'));
      return;
    }

    renderPublicMessages();
    show(document.getElementById('public-messages-list'));
  } catch {
    hide(document.getElementById('public-skeleton'));
    show(document.getElementById('public-error'));
  }
}

function renderPublicMessages(): void {
  const container = document.getElementById('public-messages-list');
  if (!container) return;

  container.innerHTML = guestbookEntries
    .map(
      (entry) => `
    <div class="msg-card">
      <div>
        <div class="msg-card__name">${escapeHtml(entry.name)}</div>
        <p class="msg-card__text">${escapeHtml(entry.message)}</p>
        <span class="msg-card__time">${formatTime(entry.created_at)}</span>
      </div>
      <div class="msg-card__actions">
        <label class="visibility-switch">
          <input class="form-check-input" type="checkbox" data-guestbook-id="${entry.id}" ${entry.is_approved ? 'checked' : ''} />
          Tampil
        </label>
      </div>
    </div>
  `,
    )
    .join('');

  // Toggle listeners (6.2)
  container.querySelectorAll<HTMLInputElement>('.visibility-switch input').forEach((sw) => {
    sw.addEventListener('change', async function () {
      const id = this.dataset.guestbookId!;
      try {
        await updateGuestbookApproval(id, this.checked);
        showToast(this.checked ? 'Ucapan ditampilkan ke publik' : 'Ucapan disembunyikan dari publik');
        renderNotifications();
      } catch {
        showToast('Gagal mengubah status tampilan', true);
        this.checked = !this.checked;
      }
    });
  });
}

// --- Pesan Privat (6.4–6.5) ---

async function loadPrivateMessages(): Promise<void> {
  show(document.getElementById('private-skeleton'));
  hide(document.getElementById('private-messages-list'));
  hide(document.getElementById('private-empty'));
  hide(document.getElementById('private-error'));

  try {
    await fetchPrivateMessages();
    hide(document.getElementById('private-skeleton'));

    if (privateMessages.length === 0) {
      show(document.getElementById('private-empty'));
      return;
    }

    renderPrivateMessages();
    show(document.getElementById('private-messages-list'));
  } catch {
    hide(document.getElementById('private-skeleton'));
    show(document.getElementById('private-error'));
  }
}

function renderPrivateMessages(): void {
  const container = document.getElementById('private-messages-list');
  if (!container) return;

  container.innerHTML = privateMessages
    .map(
      (pm) => `
    <div class="msg-card">
      <div>
        <div class="msg-card__name">${escapeHtml(pm.name)}</div>
        <p class="msg-card__text">${escapeHtml(pm.notes)}</p>
      </div>
      <div class="msg-card__time">${formatTime(pm.created_at)}</div>
    </div>
  `,
    )
    .join('');
}
