import { state } from './state';

export function showScreen(name) {
  state.loginScreen.classList.toggle("active", name === "login");
  state.dashScreen.classList.toggle("active", name === "dashboard");
}

export function showToast(message, isError) {
  clearTimeout(state.toastTimer);
  state.toastEl.textContent = message;
  state.toastEl.classList.toggle("error", !!isError);
  state.toastEl.classList.add("show");
  state.toastTimer = setTimeout(function() { state.toastEl.classList.remove("show"); }, 3200);
}

export function setLoginError(message) {
  state.loginError.textContent = message || "";
  state.loginError.classList.toggle("show", !!message);
}

export function setLoginLoading(isLoading) {
  state.loginSubmit.disabled = isLoading;
  state.loginSubmit.textContent = isLoading ? "Memproses\u2026" : "Masuk";
}

export function formatDate(iso) {
  try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
  catch(e) { return iso; }
}

export function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
  catch(e) { return iso; }
}

export function escapeHtml(str) {
  var d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

export function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

export function debounce(fn, ms) {
  var timer;
  return function() {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}
