function showToast(msg, isError) {
  var el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText =
      "position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#1c1c1c;border:1px solid rgba(255,255,255,0.12);color:#f3f3f3;padding:0.6rem 1.1rem;border-radius:999px;font-size:0.85rem;z-index:9999;max-width:90vw;text-align:center;transition:opacity 0.25s;display:none;";
    document.body.appendChild(el);
  }
  if (el._timer) clearTimeout(el._timer);
  if (el._hideTimer) clearTimeout(el._hideTimer);
  el.textContent = msg;
  el.style.cssText =
    "display:block;opacity:0;transition:opacity 0.25s;" +
    (isError
      ? "background:#dc3545;border-color:rgba(255,107,122,0.5);"
      : "background:var(--pink);border-color:;");
  // Force reflow so the opacity transition triggers
  void el.offsetWidth;
  el.style.opacity = "1";
  el._timer = setTimeout(function () {
    el.style.opacity = "0";
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
  void overlay.offsetWidth; // reflow biar transition fade-up jalan
  overlay.classList.add("show");
}

function hideRsvpModal() {
  var overlay = document.getElementById("rsvp-modal-overlay");
  if (!overlay || !overlay.classList.contains("show")) return;
  overlay.classList.remove("show");
  setTimeout(function () {
    overlay.style.display = "none";
  }, 300);
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
