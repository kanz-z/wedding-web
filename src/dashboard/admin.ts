// src/dashboard/admin.ts — Fase 6D: Admin management (CRUD, role-based access)

import { show, hide } from '@/shared/ui';
import { showToast, escapeHtml, formatTime } from '@/shared/ui';
import {
  fetchAdmins,
  insertAdmin,
  deleteAdmin,
  adminUsers,
  currentAdminRole,
  currentAdminId,
  fetchCurrentAdmin,
} from './state';

export function initAdmin(): void {
  window.addEventListener('page-changed', ((e: CustomEvent) => {
    if (e.detail.page === 'admin') loadAdmins();
  }) as EventListener);

  document.getElementById('admin-error-retry')?.addEventListener('click', loadAdmins);
  initAddAdminModal();
}

async function loadAdmins(): Promise<void> {
  show(document.getElementById('admin-skeleton'));
  hide(document.getElementById('admin-tbody'));
  hide(document.getElementById('admin-empty'));
  hide(document.getElementById('admin-error'));

  try {
    await fetchCurrentAdmin();
    await fetchAdmins();
    hide(document.getElementById('admin-skeleton'));

    const tbody = document.getElementById('admin-tbody');
    if (!adminUsers.length) {
      if (tbody) tbody.innerHTML = '';
      show(document.getElementById('admin-empty'));
      return;
    }

    renderAdminTable();
    show(tbody);
  } catch {
    hide(document.getElementById('admin-skeleton'));
    show(document.getElementById('admin-error'));
  }
}

function renderAdminTable(): void {
  const tbody = document.getElementById('admin-tbody');
  if (!tbody) return;

  const roleBadge = (role: string): string => {
    const map: Record<string, string> = {
      superadmin: 'role-badge--superadmin',
      admin: 'role-badge--admin',
      operator: 'role-badge--operator',
    };
    const label = role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'Operator';
    return `<span class="badge-dash ${map[role] || ''}">${label}</span>`;
  };

  /**
   * Cek apakah current admin boleh menghapus admin dengan role tertentu.
   *   Superadmin → hapus Admin & Operator
   *   Admin      → hapus Operator
   *   Operator   → tidak bisa hapus siapa pun
   *   Role setara tidak boleh saling hapus
   */
  const canDelete = (targetRole: string): boolean => {
    if (currentAdminRole === 'superadmin') return targetRole === 'admin' || targetRole === 'operator';
    if (currentAdminRole === 'admin') return targetRole === 'operator';
    return false;
  };

  const isSuperadmin = currentAdminRole === 'superadmin';

  tbody.innerHTML = adminUsers
    .map(
      (a) => {
        const canDel = a.id !== currentAdminId && canDelete(a.role);
        return `
    <tr>
      <td class="guest-name">${escapeHtml(a.email)}</td>
      <td>${roleBadge(a.role)}</td>
      <td class="mono-time">${formatTime(a.created_at)}</td>
      <td>
        <div class="row-actions">
          <button title="Hapus" data-delete-admin="${a.id}"
            ${!canDel ? 'disabled class="is-disabled"' : ''}>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
      },
    )
    .join('');

  // Delete listeners (6.12)
  tbody.querySelectorAll<HTMLButtonElement>('[data-delete-admin]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteAdmin!;
      const email = adminUsers.find((a) => a.id === id)?.email ?? '';
      if (!confirm(`Hapus admin "${email}"?`)) return;
      try {
        await deleteAdmin(id);
        showToast('Admin dihapus');
        renderAdminTable();
      } catch {
        showToast('Gagal menghapus admin', true);
      }
    });
  });

  // Show/hide Tambah Admin button based on role
  const addBtn = document.querySelector<HTMLButtonElement>('#page-admin .page-head .btn-dash-accent');
  if (addBtn) {
    addBtn.style.display = isSuperadmin ? '' : 'none';
  }
}

// --- Modal Tambah Admin (6.11) ---

function initAddAdminModal(): void {
  const overlay = document.getElementById('admin-modal-overlay');
  if (!overlay) return;

  const openBtn = document.querySelector<HTMLButtonElement>('#page-admin .page-head .btn-dash-accent');
  const closeBtns = overlay.querySelectorAll('[data-modal-close]');
  const saveBtn = document.getElementById('admin-save-btn');

  openBtn?.addEventListener('click', () => {
    if (currentAdminRole !== 'superadmin') {
      showToast('Hanya superadmin yang dapat menambah admin', true);
      return;
    }
    show(overlay);
  });

  closeBtns.forEach((b) => b.addEventListener('click', () => hide(overlay)));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide(overlay);
  });

  saveBtn?.addEventListener('click', async () => {
    const emailInput = document.getElementById('admin-email') as HTMLInputElement;
    const roleSelect = document.getElementById('admin-role') as HTMLSelectElement;
    const email = emailInput.value.trim();
    const role = roleSelect.value as 'superadmin' | 'admin' | 'operator';

    if (!email) {
      showToast('Email harus diisi', true);
      return;
    }

    try {
      await insertAdmin(email, role);
      showToast('Admin berhasil ditambahkan');
      hide(overlay);
      renderAdminTable();
      emailInput.value = '';
    } catch {
      showToast('Gagal menambahkan admin', true);
    }
  });
}
