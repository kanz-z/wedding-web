// src/dashboard/dashboard.ts — entry point
import { state } from './state';
import { showToast } from './utils';
import { init } from './auth';

// Polling approval every 30 detik
setInterval(async function () {
  try {
    const res = await state.dashboardSb
      .from('rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', false);
    const count = res.count || 0;
    const badge = document.getElementById('badge-approval');
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('show', count > 0);
    }
    if (count > state._prevPending && state._prevPending > 0) {
      showToast(count + ' RSVP baru perlu persetujuan.');
    }
    state._prevPending = count;
  } catch (e) {
    console.warn('Approval polling gagal:', e);
  }
}, 30000);

init();
