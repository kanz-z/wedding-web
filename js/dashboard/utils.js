// dashboard utility functions

function showScreen(name) {
  loginScreen.classList.toggle("active", name === "login");
  dashScreen.classList.toggle("active", name === "dashboard");
}

function showToast(message, isError) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.toggle("error", !!isError);
  toastEl.classList.add("show");
  toastTimer = setTimeout(function () {
    toastEl.classList.remove("show");
  }, 3200);
}

function setLoginError(message) {
  loginError.textContent = message || "";
  loginError.classList.toggle("show", !!message);
}

function setLoginLoading(isLoading) {
  loginSubmit.disabled = isLoading;
  loginSubmit.textContent = isLoading ? "Memproses…" : "Masuk";
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (e) {
    return iso;
  }
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return iso;
  }
}

function escapeHtml(str) {
  var d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function debounce(fn, ms) {
  var timer;
  return function () {
    var ctx = this,
      args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, ms);
  };
}
