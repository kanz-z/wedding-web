// src/dashboard/admin.ts — Fase 6D: Admin management (CRUD, role-based access)

import { show, hide } from '@/shared/ui';
import { escapeHtml, formatTime } from '@/shared/ui';
import {
  fetchAdmins,
  adminUsers,
} from './state';

export function initAdmin(): void {
  window.addEventListener('page-changed', ((e: CustomEvent) => {
    if (e.detail.page === 'admin') loadAdmins();
  }) as EventListener);

  document.getElementById('admin-error-retry')?.addEventListener('click', loadAdmins);
}

async function loadAdmins(): Promise<void> {
  show(document.getElementById('admin-skeleton'));
  hide(document.getElementById('admin-tbody'));
  hide(document.getElementById('admin-empty'));
  hide(document.getElementById('admin-error'));

  try {
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

  tbody.innerHTML = adminUsers
    .map(
      (a) => `
    <tr>
      <td>${escapeHtml(a.email)}</td>
      <td>${roleBadge(a.role)}</td>
      <td class="mono-time">${formatTime(a.created_at)}</td>
    </tr>
  `,
    )
    .join('');
}
