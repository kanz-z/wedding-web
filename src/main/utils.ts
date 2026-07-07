// src/main/utils.ts — ES module version

export function showToast(msg: string, isError?: boolean): void {
  let el = document.getElementById('toast') as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast-global';
    document.body.appendChild(el);
  }
  clearTimeout((el as unknown as Record<string, unknown>)._timer as number | undefined);
  clearTimeout((el as unknown as Record<string, unknown>)._hideTimer as number | undefined);
  el.textContent = msg;
  el.className = 'toast-global' + (isError ? ' is-error' : '');
  void el.offsetWidth;
  el.classList.add('show');
  (el as unknown as Record<string, ReturnType<typeof setTimeout>>)._timer = setTimeout(function () {
    el.classList.remove('show');
    (el as unknown as Record<string, ReturnType<typeof setTimeout>>)._hideTimer = setTimeout(function () {
      el.style.display = 'none';
    }, 250);
  }, 3000);
}

export function showRsvpModal(msg: string, isError?: boolean): void {
  const overlay = getRsvpModalOverlay();
  const modal = overlay.querySelector<HTMLElement>('.rsvp-modal');
  const icon = overlay.querySelector<HTMLElement>('.rsvp-modal-icon i');
  const msgEl = overlay.querySelector<HTMLElement>('.rsvp-modal-message');
  if (msgEl) msgEl.textContent = msg;
  if (modal) modal.classList.toggle('is-error', !!isError);
  if (icon) icon.className = isError ? 'bi bi-exclamation-circle-fill' : 'bi bi-check-circle-fill';
  overlay.style.display = 'flex';
  void overlay.offsetWidth;
  overlay.classList.add('show');
}

export function hideRsvpModal(): void {
  const overlay = document.getElementById('rsvp-modal-overlay');
  if (!overlay || !overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  setTimeout(function () {
    overlay.style.display = 'none';
  }, 300);
}

function getRsvpModalOverlay(): HTMLElement {
  let overlay = document.getElementById('rsvp-modal-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'rsvp-modal-overlay';
  overlay.className = 'rsvp-modal-overlay';
  overlay.innerHTML =
    '<div class="rsvp-modal" role="alertdialog" aria-modal="true" aria-live="assertive">' +
    '<button type="button" class="rsvp-modal-close" aria-label="Tutup">&times;</button>' +
    '<div class="rsvp-modal-icon"><i class="bi bi-check-circle-fill"></i></div>' +
    '<p class="rsvp-modal-message"></p></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e: Event) {
    if (e.target === overlay) hideRsvpModal();
  });
  overlay.querySelector<HTMLElement>('.rsvp-modal-close')?.addEventListener('click', hideRsvpModal);
  document.addEventListener('keydown', function (e: KeyboardEvent) {
    if (e.key === 'Escape') hideRsvpModal();
  });
  return overlay;
}

export function copyToClipboard(text: string): void {
  navigator.clipboard
    .writeText(text)
    .then(function () {
      const toast = document.getElementById('gift-toast');
      if (toast) {
        toast.classList.add('show');
        setTimeout(function () {
          toast.classList.remove('show');
        }, 1800);
      }
    })
    .catch(function () {
      prompt('Salin nomor rekening:', text);
    });
}

export function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

export function createPageItem(
  html: string,
  enabled: boolean,
  onClick: () => void,
  isActive?: boolean
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'page-item';
  if (!enabled) li.className += ' disabled';
  if (isActive) li.className += ' active';
  const a = document.createElement('a');
  a.className = 'page-link';
  a.href = '#';
  a.innerHTML = html;
  a.addEventListener('click', function (e: Event) {
    e.preventDefault();
    if (enabled) onClick();
  });
  li.appendChild(a);
  return li;
}

export function renderPagination(config: {
  container: HTMLElement | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}): void {
  const container = config.container;
  const currentPage = config.currentPage;
  const totalPages = config.totalPages;
  const onPageChange = config.onPageChange;
  if (!container) return;
  container.innerHTML = '';
  if (totalPages <= 1) {
    container.classList.add('d-none');
    return;
  }
  container.classList.remove('d-none');
  const ul = document.createElement('ul');
  ul.className = 'pagination justify-content-center';
  const prevLi = createPageItem(
    '<span aria-hidden="true">&laquo;</span>',
    currentPage > 0,
    function () {
      if (currentPage > 0) onPageChange(currentPage - 1);
    }
  );
  ul.appendChild(prevLi);
  for (let i = 0; i < totalPages; i++) {
    ul.appendChild(
      createPageItem(
        String(i + 1),
        true,
        (function (p: number) {
          return function () {
            onPageChange(p);
          };
        })(i),
        i === currentPage
      )
    );
  }
  const nextLi = createPageItem(
    '<span aria-hidden="true">&raquo;</span>',
    currentPage < totalPages - 1,
    function () {
      if (currentPage < totalPages - 1) onPageChange(currentPage + 1);
    }
  );
  ul.appendChild(nextLi);
  container.appendChild(ul);
}
