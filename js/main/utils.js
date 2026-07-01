function showToast(msg, isError) {
  var el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast-global";
    document.body.appendChild(el);
  }

  clearTimeout(el._timer);
  clearTimeout(el._hideTimer);
  el.textContent = msg;
  el.className = "toast-global" + (isError ? " is-error" : "");

  // Trigger reflow biar transisi opacity jalan
  void el.offsetWidth;
  el.classList.add("show");

  el._timer = setTimeout(function () {
    el.classList.remove("show");
    el._hideTimer = setTimeout(function () {
      el.style.display = "none";
    }, 250);
  }, 3000);
}

function showRsvpModal(msg, isError) {
  var overlay = getRsvpModalOverlay();
  var modal = overlay.querySelector(".rsvp-modal");
  var icon = overlay.querySelector(".rsvp-modal-icon i");
  overlay.querySelector(".rsvp-modal-message").textContent = msg;
  modal.classList.toggle("is-error", !!isError);
  icon.className = isError
    ? "bi bi-exclamation-circle-fill"
    : "bi bi-check-circle-fill";
  overlay.style.display = "flex";
  void overlay.offsetWidth; // reflow — biar transition opacity berjalan
  overlay.classList.add("show");
}

function hideRsvpModal() {
  var overlay = document.getElementById("rsvp-modal-overlay");
  if (!overlay || !overlay.classList.contains("show")) return;
  overlay.classList.remove("show");
  setTimeout(function () {
    overlay.style.display = "none";
  }, 300); // ponytail: tetap inline karena setTimeout + display toggle pattern
}

function getRsvpModalOverlay() {
  var overlay = document.getElementById("rsvp-modal-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "rsvp-modal-overlay";
  overlay.className = "rsvp-modal-overlay";
  overlay.innerHTML =
    '<div class="rsvp-modal" role="alertdialog" aria-modal="true" aria-live="assertive">' +
    '<button type="button" class="rsvp-modal-close" aria-label="Tutup">&times;</button>' +
    '<div class="rsvp-modal-icon"><i class="bi bi-check-circle-fill"></i></div>' +
    '<p class="rsvp-modal-message"></p></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) hideRsvpModal();
  });
  overlay
    .querySelector(".rsvp-modal-close")
    .addEventListener("click", hideRsvpModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideRsvpModal();
  });
  return overlay;
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(function () {
      var toast = document.getElementById("gift-toast");
      toast.classList.add("show");
      setTimeout(function () {
        toast.classList.remove("show");
      }, 1800);
    })
    .catch(function () {
      prompt("Salin nomor rekening:", text);
    });
}

function escapeHtml(str) {
  var d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function createPageItem(html, enabled, onClick, isActive) {
  var li = document.createElement("li");
  li.className = "page-item";
  if (!enabled) li.className += " disabled";
  if (isActive) li.className += " active";

  var a = document.createElement("a");
  a.className = "page-link";
  a.href = "#";
  a.innerHTML = html;
  a.addEventListener("click", function (e) {
    e.preventDefault();
    if (enabled) onClick();
  });

  li.appendChild(a);
  return li;
}

function renderPagination(config) {
  var container = config.container; // Elemen yang akan diisi pagination
  var currentPage = config.currentPage; // Halaman saat ini (0-indexed)
  var totalPages = config.totalPages; // Total halaman
  var onPageChange = config.onPageChange; // Callback saat halaman berubah (menerima page number)

  container.innerHTML = "";

  if (totalPages <= 1) {
    container.classList.add("d-none");
    return;
  }

  container.classList.remove("d-none");

  // Buat list element untuk pagination
  var ul = document.createElement("ul");
  ul.className = "pagination justify-content-center";

  // Prev button
  var prevLi = createPageItem(
    '<span aria-hidden="true">&laquo;</span>',
    currentPage > 0,
    function () {
      if (currentPage > 0) onPageChange(currentPage - 1);
    },
  );
  ul.appendChild(prevLi);

  // Page number buttons
  for (var i = 0; i < totalPages; i++) {
    ul.appendChild(
      createPageItem(
        String(i + 1),
        true,
        (function (page) {
          return function () {
            onPageChange(page);
          };
        })(i),
        i === currentPage,
      ),
    );
  }

  // Next button
  var nextLi = createPageItem(
    '<span aria-hidden="true">&raquo;</span>',
    currentPage < totalPages - 1,
    function () {
      if (currentPage < totalPages - 1) onPageChange(currentPage + 1);
    },
  );
  ul.appendChild(nextLi);

  container.appendChild(ul);
}
