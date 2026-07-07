// dashboard auth

function verifyAdmin(user) {
  return dashboardSb
    .rpc("check_current_admin")
    .then(function (res) {
      return !!res.data;
    })
    .catch(function () {
      return false;
    });
}

function enterDashboard(user) {
  currentUser = user;
  whoEmail.textContent = user.email || "";
  showScreen("dashboard");
  var qrEl = document.getElementById("qr-reader");
  if (qrEl) qrEl.classList.remove("scanner-active");
  loadOverview();
  loadTamuRSVP();
  loadGuestbook();
  loadCheckinLog();
}

async function init() {
  try {
    var sessionRes = await dashboardSb.auth.getSession();
    if (sessionRes.error) throw sessionRes.error;
    var session = sessionRes.data && sessionRes.data.session;
    if (session && session.user) {
      var isAdmin = await verifyAdmin(session.user);
      if (isAdmin) {
        enterDashboard(session.user);
        return;
      }
      await dashboardSb.auth.signOut();
    }
  } catch (err) {
    console.error("Session check failed:", err);
  }
  showScreen("login");
}

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  setLoginError(null);
  var email = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-password").value;
  if (!email || !password) {
    setLoginError("Email dan password wajib diisi.");
    return;
  }
  setLoginLoading(true);
  try {
    var res = await dashboardSb.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (res.error) {
      setLoginError("Email atau password salah.");
      return;
    }
    var isAdmin = await verifyAdmin(res.data.user);
    if (!isAdmin) {
      await dashboardSb.auth.signOut();
      setLoginError("Akun ini belum terdaftar sebagai admin.");
      return;
    }
    loginForm.reset();
    enterDashboard(res.data.user);
  } catch (err) {
    setLoginError("Tidak bisa terhubung ke server. Coba lagi.");
  } finally {
    setLoginLoading(false);
  }
});

document
  .getElementById("logout-btn")
  .addEventListener("click", async function () {
    this.disabled = true;
    try {
      await dashboardSb.auth.signOut();
    } catch (err) {}
    currentUser = null;
    this.disabled = false;
    if (html5QrScanner) {
      html5QrScanner.stop().catch(function () {});
      var qrEl = document.getElementById("qr-reader");
      if (qrEl) qrEl.classList.remove("scanner-active");
      html5QrScanner = null;
    }
    showScreen("login");
  });
