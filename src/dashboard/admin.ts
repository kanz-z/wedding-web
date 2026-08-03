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
  const skel = document.getElementById('admin-skeleton');
  const tbody = document.getElementById('admin-tbody');
  const empty = document.getElementById('admin-empty');
  const err = document.getElementById('admin-error');

  show(skel);
  hide(tbody);
  hide(empty);
  hide(err);

  try {
    await fetchAdmins();
    hide(skel);

    if (!adminUsers.length) {
      if (tbody) tbody.innerHTML = '';
      show(empty);
      return;
    }

    renderAdminTable();
    show(tbody);
  } catch {
    hide(skel);
    show(err);
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
      couple: 'role-badge--couple',
    };
    const label = role === 'superadmin' ? 'Superadmin'
      : role === 'admin' ? 'Admin'
      : role === 'operator' ? 'Operator'
      : 'Mempelai';
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
