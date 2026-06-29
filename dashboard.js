(function () {
  "use strict";

  var SUPABASE_URL = "https://liyfsapgadickknsfbus.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpeWZzYXBnYWRpY2trbnNmYnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDIwNDMsImV4cCI6MjA5NzY3ODA0M30.aQ37-_9-wl2pbDtqKSavOvrsUU-F-sIzv6g3hG23dHw";
  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  var currentUser = null;
  var toastTimer = null;

  // dom refs
  var loginScreen = document.getElementById("login-screen");
  var dashScreen = document.getElementById("dashboard-screen");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var loginSubmit = document.getElementById("login-submit");
  var whoEmail = document.getElementById("who-email");
  var toastEl = document.getElementById("toast");
  var sideNav = document.getElementById("sideNav");
  var overlay = document.getElementById("overlay");
  var hamburger = document.getElementById("hamburger");

  // state
  var allTamu = [];
  var tamuFilter = "all";
  var tamuSearch = "";
  var allGb = [];
  var gbFilter = "all";
  var html5QrScanner = null;

  // ---------- helpers ----------
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

  // ---------- auth ----------
  function verifyAdmin(user) {
    return sb
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
      var sessionRes = await sb.auth.getSession();
      if (sessionRes.error) throw sessionRes.error;
      var session = sessionRes.data && sessionRes.data.session;
      if (session && session.user) {
        var isAdmin = await verifyAdmin(session.user);
        if (isAdmin) {
          enterDashboard(session.user);
          return;
        }
        await sb.auth.signOut();
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
      var res = await sb.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (res.error) {
        setLoginError("Email atau password salah.");
        return;
      }
      var isAdmin = await verifyAdmin(res.data.user);
      if (!isAdmin) {
        await sb.auth.signOut();
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

  // ---------- side-nav ----------
  function switchTab(tabId) {
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.remove("active");
    });
    document.querySelectorAll(".side-nav-menu a").forEach(function (a) {
      a.classList.remove("active");
    });
    document.getElementById(tabId).classList.add("active");
    var link = document.querySelector(
      '.side-nav-menu a[data-tab="' + tabId + '"]',
    );
    if (link) link.classList.add("active");
    // lazy load
    if (tabId === "tab-overview") loadOverview();
    if (tabId === "tab-tamu") loadTamuRSVP();
    if (tabId === "tab-guestbook") loadGuestbook();
    if (tabId === "tab-pesan-privat") loadPesanPrivat();
    if (tabId === "tab-admin") loadAdminList();
    // ponytail: close mobile sidebar after tab switch
    sideNav.classList.remove("open");
    overlay.classList.remove("open");
  }

  document.querySelectorAll(".side-nav-menu a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      switchTab(this.dataset.tab);
    });
  });

  hamburger.addEventListener("click", function () {
    sideNav.classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay.addEventListener("click", function () {
    sideNav.classList.remove("open");
    overlay.classList.remove("open");
  });

  // logout
  document
    .getElementById("logout-btn")
    .addEventListener("click", async function () {
      this.disabled = true;
      try {
        await sb.auth.signOut();
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

  // ========== TAB 1: OVERVIEW ==========
  var _actItems = [];
  var _actPage = 0;
  var _actPageSize = 5;

  function renderActivityPagination() {
    var nav = document.getElementById("activity-pagination");
    var ul = nav.querySelector("ul");
    var totalPages = Math.max(1, Math.ceil(_actItems.length / _actPageSize));
    ul.innerHTML = "";
    if (totalPages <= 1) {
      nav.style.display = "none";
      return;
    }
    nav.style.display = "block";

    var prevLi = document.createElement("li");
    prevLi.className = "page-item" + (_actPage === 0 ? " disabled" : "");
    prevLi.innerHTML =
      '<a class="page-link" href="#" aria-label="Sebelumnya"><span aria-hidden="true">&laquo;</span></a>';
    prevLi.querySelector("a").addEventListener("click", function (e) {
      e.preventDefault();
      if (_actPage > 0) {
        _actPage--;
        renderActivityPage();
      }
    });
    ul.appendChild(prevLi);

    for (var i = 0; i < totalPages; i++) {
      var li = document.createElement("li");
      li.className = "page-item" + (i === _actPage ? " active" : "");
      li.innerHTML = '<a class="page-link" href="#">' + (i + 1) + "</a>";
      li.querySelector("a").addEventListener(
        "click",
        (function (p) {
          return function (e) {
            e.preventDefault();
            _actPage = p;
            renderActivityPage();
          };
        })(i),
      );
      ul.appendChild(li);
    }

    var nextLi = document.createElement("li");
    nextLi.className =
      "page-item" + (_actPage >= totalPages - 1 ? " disabled" : "");
    nextLi.innerHTML =
      '<a class="page-link" href="#" aria-label="Berikutnya"><span aria-hidden="true">&raquo;</span></a>';
    nextLi.querySelector("a").addEventListener("click", function (e) {
      e.preventDefault();
      if (_actPage < totalPages - 1) {
        _actPage++;
        renderActivityPage();
      }
    });
    ul.appendChild(nextLi);
  }

  function renderActivityPage() {
    var log = document.getElementById("activity-log");
    log.innerHTML = "";
    var from = _actPage * _actPageSize;
    var to = from + _actPageSize;
    var page = _actItems.slice(from, to);

    if (page.length === 0) {
      document.getElementById("activity-empty").style.display = "block";
    } else {
      document.getElementById("activity-empty").style.display = "none";
      var table = document.createElement("table");
      table.className = "activity-table";
      page.forEach(function (item) {
        var tr = document.createElement("tr");
        if (item._type === "rsvp") {
          tr.innerHTML =
            '<td><span class="activity-dot rsvp"></span>' +
            escapeHtml(item.nama) +
            "</td><td>" +
            item.status +
            " (" +
            item.jumlah_hadir +
            " org)</td><td>" +
            formatDate(item.created_at) +
            "</td>";
        } else {
          tr.innerHTML =
            '<td><span class="activity-dot gb"></span>' +
            escapeHtml(item.nama) +
            "</td><td>" +
            escapeHtml(item.pesan.substring(0, 60)) +
            "</td><td>" +
            formatDate(item.created_at) +
            "</td>";
        }
        table.appendChild(tr);
      });
      log.appendChild(table);
    }
    renderActivityPagination();
  }

  async function loadOverview() {
    document.getElementById("overview-error").style.display = "none";
    try {
      var [rsvpRes, gbRes] = await Promise.all([
        sb
          .from("rsvps")
          .select("status, jumlah_hadir, nama, created_at")
          .order("created_at", { ascending: false }),
        sb
          .from("guestbook")
          .select("nama, pesan, created_at")
          .eq("is_approved", true)
          .order("created_at", { ascending: false }),
      ]);
      if (rsvpRes.error) throw rsvpRes.error;
      var rsvps = rsvpRes.data || [];
      var hadir = rsvps.filter(function (r) {
        return r.status === "Hadir";
      });
      var absen = rsvps.filter(function (r) {
        return r.status === "Tidak Hadir";
      });

      document.getElementById("met-total").textContent = rsvps.length;
      document.getElementById("met-hadir").textContent = hadir.length;
      document.getElementById("met-absen").textContent = absen.length;
      document.getElementById("met-msg").textContent = (
        gbRes.data || []
      ).length;

      drawPieChart(hadir.length, absen.length);
      document.getElementById("overview-status").style.display =
        rsvps.length === 0 ? "block" : "none";

      // build merged activity list
      _actItems = [];
      rsvps.forEach(function (r) {
        _actItems.push({
          _type: "rsvp",
          nama: r.nama,
          status: r.status,
          jumlah_hadir: r.jumlah_hadir,
          created_at: r.created_at,
        });
      });
      (gbRes.data || []).forEach(function (g) {
        _actItems.push({
          _type: "gb",
          nama: g.nama,
          pesan: g.pesan,
          created_at: g.created_at,
        });
      });
      _actItems.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      _actPage = 0;
      renderActivityPage();
    } catch (err) {
      console.error("Overview error:", err);
      document.getElementById("overview-error").style.display = "block";
    }
  }

  function drawPieChart(hadir, absen) {
    var canvas = document.getElementById("pieChart");
    var ctx = canvas.getContext("2d");
    var total = hadir + absen;
    ctx.clearRect(0, 0, 180, 180);
    if (total === 0) return;

    var cx = 90,
      cy = 90,
      r = 70;
    var hadirAngle = (hadir / total) * 2 * Math.PI;

    // Hadir slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + hadirAngle);
    ctx.fillStyle = "#f14e95";
    ctx.fill();

    // Absen slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2 + hadirAngle, -Math.PI / 2 + 2 * Math.PI);
    ctx.fillStyle = "#444";
    ctx.fill();

    // center hole (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, 2 * Math.PI);
    ctx.fillStyle = "#0a0a0a";
    ctx.fill();

    // legend
    document.getElementById("pie-legend").innerHTML =
      '<div style="margin-bottom:0.35rem;"><span style="display:inline-block;width:12px;height:12px;background:#f14e95;border-radius:3px;vertical-align:middle;margin-right:8px;"></span>Hadir: <strong>' +
      hadir +
      "</strong></div>" +
      '<div><span style="display:inline-block;width:12px;height:12px;background:#444;border-radius:3px;vertical-align:middle;margin-right:8px;"></span>Tidak Hadir: <strong>' +
      absen +
      "</strong></div>";
  }

  // ========== TAB 2: TAMU & RSVP ==========

  function buildGuestIdSet(guests) {
    var set = {};
    guests.forEach(function (g) {
      set[g.id] = true;
    });
    return set;
  }

  function autoMatchOrphan(orphan, guests) {
    var name = (orphan.nama || "").toLowerCase().trim();
    var wa = (orphan.nomor_wa || "").trim();
    if (!name) return null;

    var best = null,
      bestScore = 0;
    guests.forEach(function (g) {
      var gName = (g.name || "").toLowerCase().trim();
      var score = 0;

      if (name === gName) score += 3;
      else if (name.indexOf(gName) !== -1 || gName.indexOf(name) !== -1)
        score += 1;

      if (wa && g.nomor_wa && wa === g.nomor_wa.trim()) score += 5;

      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    });
    return bestScore >= 2 ? best : null;
  }

  async function loadTamuRSVP() {
    document.getElementById("tamu-status").style.display = "none";
    document.getElementById("tamu-empty").style.display = "none";
    try {
      var [guestsRes, rsvpsRes] = await Promise.all([
        sb
          .from("guests")
          .select(
            "id, slug, name, pronoun, invited_count, created_at, side, nomor_wa",
          ),
        sb
          .from("rsvps")
          .select(
            "id, guest_id, nama, nomor_wa, jumlah_hadir, status, is_approved, checked_in, qr_token, pesan, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (guestsRes.error) throw guestsRes.error;
      if (rsvpsRes.error) throw rsvpsRes.error;

      var guests = guestsRes.data || [];
      var rsvps = rsvpsRes.data || [];

      var guestIdSet = buildGuestIdSet(guests);
      var linkedGuestIds = {};

      allTamu = [];

      // 1. Guest terdaftar + RSVP yg ter-link via guest_id
      guests.forEach(function (g) {
        var rsvp = rsvps.find(function (r) {
          return r.guest_id === g.id;
        });
        if (rsvp) linkedGuestIds[rsvp.id] = true;
        allTamu.push({
          id: rsvp ? rsvp.id : null,
          guest_id: g.id,
          nama: rsvp ? rsvp.nama : g.name,
          nomor_wa: rsvp ? rsvp.nomor_wa : g.nomor_wa || "",
          jumlah_hadir: rsvp ? rsvp.jumlah_hadir : g.invited_count,
          status: rsvp ? rsvp.status : null,
          is_approved: rsvp ? rsvp.is_approved : true,
          checked_in: rsvp ? rsvp.checked_in : false,
          qr_token: rsvp ? rsvp.qr_token : null,
          pesan: rsvp ? rsvp.pesan : null,
          created_at: rsvp ? rsvp.created_at : g.created_at,
          _slug: g.slug,
          _pronoun: g.pronoun,
          _invited_count: g.invited_count,
          _source: "guest",
          _side: g.side || null,
        });
      });

      // 2. RSVP orphan (guest_id null / guest_id tidak ditemukan)
      var unmatchedRsvps = rsvps.filter(function (r) {
        return !r.guest_id || !guestIdSet[r.guest_id];
      });

      unmatchedRsvps.forEach(function (r) {
        if (linkedGuestIds[r.id]) return;

        // Auto-match: cari guest by nama+WA
        var match = autoMatchOrphan(r, guests);
        allTamu.push({
          id: r.id,
          guest_id: match ? match.id : null,
          nama: r.nama,
          nomor_wa: r.nomor_wa || "",
          jumlah_hadir: r.jumlah_hadir,
          status: r.status,
          is_approved: r.is_approved,
          checked_in: r.checked_in,
          qr_token: r.qr_token,
          pesan: r.pesan,
          created_at: r.created_at,
          _slug: match ? match.slug : null,
          _pronoun: match ? match.pronoun : null,
          _invited_count: match ? match.invited_count : 0,
          _source: match ? "auto-matched" : "orphan",
          _side: match ? match.side || null : null,
        });
      });

      allTamu.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      if (allTamu.length === 0)
        document.getElementById("tamu-empty").style.display = "block";
      renderTamuTable();
      loadApprovalPending();
    } catch (err) {
      console.error("Tamu error:", err);
      document.getElementById("tamu-status").style.display = "block";
    }
  }

  function badgeSide(side) {
    if (side === "pria") return '<span class="badge pink m-1">Pria</span>';
    if (side === "wanita") return '<span class="badge m-1">Wanita</span>';
    if (side === "both")
      return '<span class="badge success m-1">Keduanya</span>';
    return "";
  }

  function badgeSource(source) {
    if (source === "orphan")
      return '<span class="badge warning ms-1">Baru</span>';
    if (source === "auto-matched")
      return '<span class="badge ms-1">Tercocok</span>';
    return "";
  }

  function renderTamuTable() {
    var tbody = document.getElementById("tamu-tbody");
    tbody.innerHTML = "";
    var search = (
      document.getElementById("tamu-search").value || ""
    ).toLowerCase();
    var filtered = allTamu.filter(function (t) {
      var matchSearch = !search || t.nama.toLowerCase().indexOf(search) !== -1;
      var matchFilter = true;
      if (tamuFilter === "pending") matchFilter = t.is_approved === false;
      else if (tamuFilter === "orphan")
        matchFilter = t._source === "orphan" || t._source === "auto-matched";
      else if (tamuFilter === "pria") matchFilter = t._side === "pria";
      else if (tamuFilter === "wanita") matchFilter = t._side === "wanita";
      else if (tamuFilter !== "all")
        matchFilter =
          tamuFilter === "null" ? !t.status : t.status === tamuFilter;
      return matchSearch && matchFilter;
    });

    document.getElementById("tamu-empty").style.display =
      filtered.length === 0 ? "block" : "none";

    filtered.forEach(function (t) {
      var tr = document.createElement("tr");
      var pesanTrunc = t.pesan
        ? escapeHtml(t.pesan).substring(0, 50) +
          (t.pesan.length > 50 ? "&hellip;" : "")
        : "-";
      tr.innerHTML =
        "<td>" +
        escapeHtml(t.nama) +
        badgeSource(t._source) +
        badgeSide(t._side) +
        "</td>" +
        "<td>" +
        escapeHtml(t.nomor_wa || "") +
        "</td>" +
        "<td>" +
        t.jumlah_hadir +
        "</td>" +
        '<td><span class="badge ' +
        (t.status === "Hadir"
          ? "pink"
          : t.status === "Tidak Hadir"
            ? "badge"
            : "warning") +
        '">' +
        (t.status || "Belum") +
        "</span>" +
        (!t.is_approved ? ' <span class="badge warning">Pending</span>' : "") +
        "</td>" +
        "<td>" +
        t.jumlah_hadir +
        "</td>" +
        "<td>" +
        (t.checked_in ? '<span class="badge success">&#10003;</span>' : "-") +
        "</td>" +
        '<td class="trunc-cell" title="' +
        (t.pesan ? escapeHtml(t.pesan) : "") +
        '">' +
        pesanTrunc +
        "</td>" +
        '<td style="white-space:nowrap">' +
        '<button class="btn-sm" onclick="editTamu(\'' +
        (t._source === "orphan" ? "" : t.guest_id) +
        '\')" title="Edit" style="margin-right:4px">' +
        '<i class="bi bi-pencil-fill"></i></button>' +
        '<button class="btn-sm" onclick="copyGuestLink(\'' +
        escapeAttr(t.nama) +
        "','" +
        (t.qr_token || "") +
        "','" +
        escapeAttr(t._pronoun || "") +
        '\')" title="Salin link">' +
        '<i class="bi bi-link-45deg"></i></button></td>';
      tbody.appendChild(tr);
      var cells = tr.querySelectorAll("td.trunc-cell");
      cells.forEach(function (c) {
        c.addEventListener("click", function () {
          this.classList.toggle("expanded");
        });
      });
    });
  }

  function setTamuFilter(filter, btn) {
    tamuFilter = filter;
    document
      .querySelectorAll("#tab-tamu .btn-group button")
      .forEach(function (b) {
        b.classList.remove("active");
      });
    btn.classList.add("active");
    renderTamuTable();
  }

  document
    .getElementById("tamu-search")
    .addEventListener("input", debounce(renderTamuTable, 300));

  function copyGuestLink(nama, token, pronoun) {
    var link =
      "https://wedding-web-reza-shila-2026.netlify.app/?n=" +
      encodeURIComponent(nama);
    if (pronoun) link += "&p=" + encodeURIComponent(pronoun);
    if (token) link += "&token=" + token; // Token ini untuk apaan btw? Lupa
    navigator.clipboard
      .writeText(link)
      .then(function () {
        showToast("Link tamu disalin!");
      })
      .catch(function () {
        prompt("Salin link ini:", link);
      });
  }

  function editTamu(guestId) {
    var entry = allTamu.find(function (t) {
      return (
        String(t.guest_id) === String(guestId) || // ponytail: string coercion for type-safe compare
        (!guestId && !t.guest_id && t._source === "orphan")
      );
    });
    console.warn("editTamu: guestId", guestId, "type:", typeof guestId, "matched:", entry ? entry.nama : "NOT FOUND");
    if (!entry) {
      showToast("Data tamu tidak ditemukan.", true);
      return;
    }

    if (entry._source === "orphan") {
      // Orphan RSVP → buka modal untuk create guest baru, pre-fill dari RSVP
      var guestData = null;
      var rsvpData = {
        id: entry.id,
        nomor_wa: entry.nomor_wa,
        status: entry.status,
        jumlah_hadir: entry.jumlah_hadir,
        pesan: entry.pesan,
      };
      showGuestModal(guestData, rsvpData);
      // Isi manual nama + WA
      document.getElementById("gf-name").value = entry.nama;
      document.getElementById("gf-nomor-wa").value = entry.nomor_wa;
      // ponytail: unique slug check against existing guests
      var baseSlug = entry.nama.toLowerCase().replace(/\s+/g, "-");
      var slug = baseSlug;
      var slugNum = 1;
      while (
        allTamu.some(function (t) {
          return t._slug === slug;
        })
      ) {
        slug = baseSlug + "-" + slugNum++;
      }
      document.getElementById("gf-slug").value = slug;
      return;
    }

    var guestData = {
      id: entry.guest_id,
      name: entry.nama,
      slug: entry._slug,
      side: entry._side || "",
      pronoun: entry._pronoun || "",
      invited_count: entry._invited_count,
    };
    var rsvpData = entry.id
      ? {
          id: entry.id,
          nomor_wa: entry.nomor_wa,
          status: entry.status,
          jumlah_hadir: entry.jumlah_hadir,
          pesan: entry.pesan,
        }
      : null;
    showGuestModal(guestData, rsvpData);
  }

  // approval
  async function loadApprovalPending() {
    var pending = allTamu.filter(function (t) {
      return !t.is_approved;
    });
    var badge = document.getElementById("badge-approval");
    badge.textContent = pending.length;
    badge.classList.toggle("show", pending.length > 0);

    var section = document.getElementById("approval-section");
    var list = document.getElementById("approval-list");
    section.style.display = pending.length > 0 ? "block" : "none";
    list.innerHTML = "";

    pending.forEach(function (t) {
      var div = document.createElement("div");
      div.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05);flex-wrap:wrap;gap:0.5rem;";
      div.innerHTML =
        "<span><strong>" +
        escapeHtml(t.nama) +
        "</strong> — " +
        escapeHtml(t.nomor_wa) +
        " — " +
        t.jumlah_hadir +
        " orang</span>";
      var btn = document.createElement("button");
      btn.className = "btn-pink";
      btn.textContent = "Approve";
      btn.addEventListener("click", function () {
        approveRSVP(t.id, btn);
      });
      div.appendChild(btn);
      list.appendChild(div);
    });
  }

  async function approveRSVP(rsvpId, btn) {
    btn.disabled = true;
    btn.textContent = "Memproses...";
    try {
      var res = await sb
        .from("rsvps")
        .update({
          is_approved: true,
          card_sent_at: new Date().toISOString(),
        })
        .eq("id", rsvpId);
      if (res.error) throw res.error;
      showToast("Tamu disetujui. Kirim kartu via WA ke nomor tamu.");
      loadTamuRSVP();
    } catch (err) {
      showToast("Gagal approve. Coba lagi.", true);
      btn.disabled = false;
      btn.textContent = "Approve";
    }
  }

  // guest CRUD
  function showGuestModal(guestData, rsvpData) {
    document.getElementById("guest-form").reset(); // ponytail: prevent stale data from prev modal
    document.getElementById("guest-modal").classList.add("show");
    var rsvpSection = document.getElementById("gf-rsvp-section");
    var slugRow = document.getElementById("gf-slug-row");
    if (guestData) {
      // ponytail: hide slug on edit — admin doesn't need to change it
      if (slugRow) slugRow.style.display = "none";
      document.getElementById("guest-modal-title").textContent = "Edit Tamu";
      document.getElementById("gf-id").value = guestData.id;
      document.getElementById("gf-name").value = guestData.name;
      document.getElementById("gf-slug").value = guestData.slug;
      document.getElementById("gf-side").value = guestData.side || "";
      document.getElementById("gf-pronoun").value = guestData.pronoun || "";
      document.getElementById("gf-count").value = guestData.invited_count;

      rsvpSection.style.display = "block";
      if (rsvpData && rsvpData.id) {
        document.getElementById("gf-rsvp-id").value = rsvpData.id;
        document.getElementById("gf-nomor-wa").value = rsvpData.nomor_wa || "";
        document.getElementById("gf-status").value = rsvpData.status || "";
        document.getElementById("gf-jumlah-hadir").value =
          rsvpData.jumlah_hadir || 1;
      } else {
        document.getElementById("gf-rsvp-id").value = "";
        document.getElementById("gf-nomor-wa").value = "";
        document.getElementById("gf-status").value = "";
        document.getElementById("gf-jumlah-hadir").value =
          guestData.invited_count;
      }
    } else {
      // ponytail: show slug on add so admin can set custom slug
      if (slugRow) slugRow.style.display = "block";
      document.getElementById("guest-modal-title").textContent = "Tambah Tamu";
      document.getElementById("guest-form").reset();
      document.getElementById("gf-id").value = "";
      document.getElementById("gf-count").value = 1;
      rsvpSection.style.display = "none";
    }
  }

  function closeGuestModal() {
    document.getElementById("guest-modal").classList.remove("show");
  }

  document
    .getElementById("guest-form")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      var id = document.getElementById("gf-id").value;
      var sideVal = document.getElementById("gf-side").value;
      var nomorWa = document.getElementById("gf-nomor-wa").value.trim();
      var data = {
        name: document.getElementById("gf-name").value.trim(),
        slug: document.getElementById("gf-slug").value.trim(),
        side: sideVal || null,
        pronoun: document.getElementById("gf-pronoun").value.trim() || null,
        invited_count: parseInt(document.getElementById("gf-count").value) || 1,
        nomor_wa: nomorWa || null,
      };
      if (!data.name || !data.slug) {
        showToast("Nama dan slug wajib diisi.", true);
        return;
      }

      // ponytail: guard against invalid side value
      if (sideVal && !["pria", "wanita", "both"].includes(sideVal)) {
        showToast("Pilih hubungan yang valid.", true);
        return;
      }

      try {
        var guestId = id;
        if (id) {
          var res = await sb.from("guests").update(data).eq("id", id);
          if (res.error) throw res.error;
        } else {
          // ponytail: check if slug already exists before insert
          var existingGuest = await sb.from("guests").select("id").eq("slug", data.slug).maybeSingle();
          if (existingGuest.error) throw existingGuest.error;
          if (existingGuest.data) {
            // Sudah ada guest dengan slug ini — UPDATE instead of INSERT
            var res = await sb.from("guests").update(data).eq("id", existingGuest.data.id);
            if (res.error) throw res.error;
            guestId = existingGuest.data.id;
          } else {
            var res = await sb.from("guests").insert([data]).select("id");
            if (res.error) throw res.error;
            guestId = res.data[0].id;
          }
        }

        // Save RSVP data
        var rsvpId = document.getElementById("gf-rsvp-id").value;
        var rsvpSection = document.getElementById("gf-rsvp-section");

        if (rsvpSection.style.display === "block") {
          var status = document.getElementById("gf-status").value;
          var jumlahHadir =
            parseInt(document.getElementById("gf-jumlah-hadir").value) || 1;

          var rsvpData = {
            guest_id: guestId,
            nama: data.name,
            nomor_wa: nomorWa,
            jumlah_hadir: jumlahHadir,
            status: status,
          };

          if (rsvpId) {
            var rsvpRes = await sb
              .from("rsvps")
              .update(rsvpData)
              .eq("id", rsvpId);
            if (rsvpRes.error) throw rsvpRes.error;
          } else if (status) {
            // ponytail: check duplicate RSVP before insert
            var existingRsvp = await sb.from("rsvps").select("id").eq("guest_id", guestId).maybeSingle();
            if (existingRsvp.error) throw existingRsvp.error;
            var rsvpRes;
            if (existingRsvp.data) {
              rsvpRes = await sb.from("rsvps").update(rsvpData).eq("id", existingRsvp.data.id);
            } else {
              rsvpRes = await sb.from("rsvps").insert([rsvpData]);
            }
            if (rsvpRes.error) throw rsvpRes.error;
          }
        } else if (nomorWa && guestId) {
          var rsvpData = {
            guest_id: guestId,
            nama: data.name,
            nomor_wa: nomorWa,
            jumlah_hadir:
              parseInt(document.getElementById("gf-count").value) || 1,
            status: null,
          };
          // ponytail: check duplicate RSVP before insert
          var existingRsvp = await sb.from("rsvps").select("id").eq("guest_id", guestId).maybeSingle();
          if (existingRsvp.error) throw existingRsvp.error;
          var rsvpRes;
          if (existingRsvp.data) {
            rsvpRes = await sb.from("rsvps").update(rsvpData).eq("id", existingRsvp.data.id);
          } else {
            rsvpRes = await sb.from("rsvps").insert([rsvpData]);
          }
          if (rsvpRes.error) throw rsvpRes.error;
        }

        showToast(id ? "Tamu diperbarui." : "Tamu ditambahkan.");
        closeGuestModal();
        loadTamuRSVP();
      } catch (err) {
        if (err.code === "23505") {
          showToast(
            "Slug sudah terpakai. Mungkin ada data duplikat. Refresh halaman lalu coba lagi, atau ganti slug.",
            true,
          );
        } else {
          showToast("Gagal menyimpan: " + (err.message || "unknown"), true);
        }
      }
    });

  document
    .getElementById("guest-modal")
    .addEventListener("click", function (e) {
      if (e.target === this) closeGuestModal();
    });

  // ========== TAB 3: GUESTBOOK ==========
  async function loadGuestbook() {
    document.getElementById("gb-status").classList.remove("show");
    document.getElementById("gb-empty").style.display = "none";
    try {
      var res = await sb
        .from("guestbook")
        .select("id, nama, pesan, is_approved, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (res.error) throw res.error;
      allGb = res.data || [];
      renderGbList();
    } catch (err) {
      document.getElementById("gb-status").textContent =
        "Gagal memuat guestbook.";
      document.getElementById("gb-status").classList.add("show");
    }
  }

  function renderGbList() {
    var container = document.getElementById("gb-list");
    container.innerHTML = "";
    var filtered = allGb;
    if (gbFilter === "pending")
      filtered = allGb.filter(function (e) {
        return !e.is_approved;
      });
    else if (gbFilter === "approved")
      filtered = allGb.filter(function (e) {
        return e.is_approved;
      });

    document.getElementById("gb-empty").style.display =
      filtered.length === 0 ? "block" : "none";

    filtered.forEach(function (entry) {
      var card = document.createElement("div");
      card.style.cssText =
        "background:var(--panel);border:1px solid var(--panel-border);border-left:3px solid " +
        (entry.is_approved ? "var(--pink)" : "var(--panel-border)") +
        ";border-radius:10px;padding:0.9rem 1rem;margin-bottom:0.65rem;";
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.35rem;">' +
        '<span style="font-weight:600;">' +
        escapeHtml(entry.nama) +
        "</span>" +
        '<span style="font-size:0.72rem;color:var(--ink-muted);">' +
        formatDate(entry.created_at) +
        "</span></div>" +
        '<div style="color:#d8d8d8;font-size:0.92rem;white-space:pre-wrap;word-break:break-word;margin-bottom:0.5rem;">' +
        escapeHtml(entry.pesan) +
        "</div>" +
        '<div style="text-align:right;">' +
        '<button class="' +
        (entry.is_approved ? "btn-danger" : "btn-sm") +
        '" data-id="' +
        entry.id +
        '" onclick="toggleGbApproval(\'' +
        entry.id +
        "', " +
        !entry.is_approved +
        ', this)">' +
        (entry.is_approved ? "Sembunyikan" : "Tampilkan") +
        "</button></div>";
      container.appendChild(card);
    });
  }

  window.toggleGbApproval = async function (id, newVal, btn) {
    btn.disabled = true;
    var origText = btn.textContent;
    btn.textContent = "Memproses...";
    try {
      var res = await sb
        .from("guestbook")
        .update({ is_approved: newVal })
        .eq("id", id);
      if (res.error) throw res.error;
      var entry = allGb.find(function (e) {
        return e.id === id;
      });
      if (entry) entry.is_approved = newVal;
      renderGbList();
      showToast(newVal ? "Pesan ditampilkan." : "Pesan disembunyikan.");
    } catch (err) {
      showToast("Gagal update.", true);
      btn.disabled = false;
      btn.textContent = origText;
    }
  };

  function setGbFilter(filter, btn) {
    gbFilter = filter;
    document
      .querySelectorAll("#tab-guestbook .btn-group button")
      .forEach(function (b) {
        b.classList.remove("active");
      });
    btn.classList.add("active");
    renderGbList();
  }

  // ========== TAB 4: QR SCANNER ==========
  function startScanner() {
    var resultEl = document.getElementById("scan-result");
    resultEl.className = "scan-result";
    resultEl.textContent = "";

    if (!html5QrScanner) {
      html5QrScanner = new Html5Qrcode("qr-reader");
    }

    document.getElementById("btn-start-scan").style.display = "none";
    document.getElementById("btn-stop-scan").style.display = "inline-flex";

    html5QrScanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        function (err) {
          console.debug("QR scan error (non-fatal):", err);
        },
      )
      .catch(function (err) {
        showToast("Gagal mengakses kamera: " + err, true);
        document.getElementById("btn-start-scan").style.display = "inline-flex";
        document.getElementById("btn-stop-scan").style.display = "none";
      });

    var qrEl = document.getElementById("qr-reader");
    if (qrEl) qrEl.classList.add("scanner-active");
  }

  function stopScanner() {
    if (html5QrScanner) {
      html5QrScanner
        .stop()
        .then(function () {
          document.getElementById("btn-start-scan").style.display =
            "inline-flex";
          document.getElementById("btn-stop-scan").style.display = "none";
          var qrEl = document.getElementById("qr-reader");
          if (qrEl) qrEl.classList.remove("scanner-active");
        })
        .catch(function () {});
    }
  }

  async function onScanSuccess(decodedText) {
    var resultEl = document.getElementById("scan-result");
    var raw = decodedText.trim();

    // Handle QR berisi URL (copyGuestLink format) atau UUID saja
    var token = raw;
    try {
      var url = new URL(raw);
      var maybe = url.searchParams.get("token");
      if (maybe) token = maybe;
    } catch (_) {}

    try {
      var res = await sb
        .from("rsvps")
        .select("id, nama, checked_in, jumlah_hadir")
        .eq("qr_token", token)
        .single();
      if (res.error || !res.data) {
        resultEl.className = "scan-result error";
        resultEl.textContent = "Tamu tidak terdaftar";
        stopScanner();
        return;
      }

      var tamu = res.data;
      if (tamu.checked_in) {
        var checkinRes = await sb
          .from("guest_checkins")
          .select("checked_in_at")
          .eq("rsvp_id", tamu.id)
          .single();
        var time = checkinRes.data
          ? formatTime(checkinRes.data.checked_in_at)
          : "sebelumnya";
        resultEl.className = "scan-result info";
        resultEl.textContent =
          escapeHtml(tamu.nama) + " — Sudah check-in pukul " + time;
        stopScanner();
        return;
      }

      await sb.from("guest_checkins").insert([
        {
          rsvp_id: tamu.id,
          method: "qr",
          guest_count_actual: tamu.jumlah_hadir,
        },
      ]);
      await sb.from("rsvps").update({ checked_in: true }).eq("id", tamu.id);

      resultEl.className = "scan-result success";
      resultEl.textContent =
        escapeHtml(tamu.nama) +
        " — Check-in berhasil! (" +
        tamu.jumlah_hadir +
        " org)";
      stopScanner();
      loadCheckinLog();
      loadTamuRSVP();
    } catch (err) {
      console.error("Scan error:", err);
      resultEl.className = "scan-result error";
      resultEl.textContent = "Gagal memproses check-in";
      stopScanner();
    }
  }

  // manual search
  var doManualSearch = debounce(async function () {
    var q = document.getElementById("manual-search").value.trim();
    var results = document.getElementById("manual-results");
    results.innerHTML = "";

    if (q.length < 2) return;

    try {
      var res = await sb
        .from("rsvps")
        .select("id, nama, checked_in, jumlah_hadir, status")
        .ilike("nama", "%" + q + "%")
        .limit(10);
      if (res.error) throw res.error;
      (res.data || []).forEach(function (t) {
        var div = document.createElement("div");
        div.style.cssText =
          "padding:0.5rem 0.75rem;background:var(--panel);border:1px solid var(--panel-border);border-radius:8px;margin-bottom:0.35rem;display:flex;justify-content:space-between;align-items:center;";
        div.innerHTML =
          "<span>" +
          escapeHtml(t.nama) +
          " — " +
          t.jumlah_hadir +
          " org " +
          (t.checked_in
            ? '<span class="badge success">Checked-in</span>'
            : '<span class="badge">' + (t.status || "Belum") + "</span>") +
          "</span>";
        if (!t.checked_in) {
          var btn = document.createElement("button");
          btn.className = "btn-pink";
          btn.textContent = "Check-in";
          btn.addEventListener("click", function () {
            manualCheckin(t, btn);
          });
          div.appendChild(btn);
        }
        results.appendChild(div);
      });
    } catch (err) {
      console.error("Manual search error:", err);
    }
  });
  document
    .getElementById("manual-search")
    .addEventListener("input", doManualSearch);

  async function manualCheckin(tamu, btn) {
    if (!confirm("Check-in " + tamu.nama + " (" + tamu.jumlah_hadir + " org)?"))
      return;
    btn.disabled = true;
    btn.textContent = "Memproses...";
    try {
      await sb.from("guest_checkins").insert([
        {
          rsvp_id: tamu.id,
          method: "manual",
          guest_count_actual: tamu.jumlah_hadir,
        },
      ]);
      await sb.from("rsvps").update({ checked_in: true }).eq("id", tamu.id);
      showToast(escapeHtml(tamu.nama) + " berhasil check-in!");
      document.getElementById("manual-search").value = "";
      document.getElementById("manual-results").innerHTML = "";
      loadCheckinLog();
      loadTamuRSVP();
    } catch (err) {
      showToast("Gagal check-in.", true);
      btn.disabled = false;
      btn.textContent = "Check-in";
    }
  }

  async function loadCheckinLog() {
    var log = document.getElementById("checkin-log");
    var empty = document.getElementById("checkin-empty");
    try {
      var res = await sb
        .from("guest_checkins")
        .select("rsvp_id(nama), checked_in_at, method, guest_count_actual")
        .order("checked_in_at", { ascending: false })
        .limit(20);
      if (res.error) throw res.error;
      var data = res.data || [];
      log.innerHTML = "";
      if (data.length === 0) {
        empty.style.display = "block";
        return;
      }
      empty.style.display = "none";
      data.forEach(function (c) {
        var div = document.createElement("div");
        div.style.cssText =
          "padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.85rem;";
        div.innerHTML =
          "<strong>" +
          escapeHtml((c.rsvp_id && c.rsvp_id.nama) || "?") +
          "</strong> — " +
          c.guest_count_actual +
          ' org — <span class="badge ' +
          (c.method === "qr" ? "pink" : "") +
          '">' +
          c.method +
          '</span> <span style="color:var(--ink-muted);font-size:0.75rem;">' +
          formatTime(c.checked_in_at) +
          "</span>";
        log.appendChild(div);
      });
    } catch (err) {
      console.error("Checkin log error:", err);
    }
  }

  // ========== TAB 5: PESAN PRIVAT ==========
  async function loadPesanPrivat() {
    document.getElementById("pp-loading").style.display = "block";
    document.getElementById("pp-empty").style.display = "none";
    document.getElementById("pp-error").style.display = "none";
    try {
      var res = await sb
        .from("rsvps")
        .select("nama, nomor_wa, pesan, created_at")
        .not("pesan", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (res.error) throw res.error;
      var data = res.data || [];
      var list = document.getElementById("pp-list");
      var loading = document.getElementById("pp-loading");
      var empty = document.getElementById("pp-empty");
      list.innerHTML = "";

      if (data.length === 0) {
        empty.style.display = "block";
        loading.style.display = "none";
        return;
      }

      empty.style.display = "none";
      data.forEach(function (item) {
        var card = document.createElement("div");
        card.style.cssText =
          "background:var(--panel);border:1px solid var(--panel-border);border-radius:10px;padding:0.9rem 1rem;margin-bottom:0.65rem;width:100%;";
        card.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.35rem;">' +
          '<span style="font-weight:600;">' +
          escapeHtml(item.nama) +
          "</span>" +
          '<span style="font-size:0.72rem;color:var(--ink-muted);">' +
          (item.nomor_wa ? escapeHtml(item.nomor_wa) : "") +
          " &middot; " +
          formatDate(item.created_at) +
          "</span></div>" +
          '<div style="color:#d8d8d8;font-size:0.92rem;white-space:pre-wrap;word-break:break-word;">' +
          escapeHtml(item.pesan) +
          "</div>";
        list.appendChild(card);
      });
      loading.style.display = "none";
    } catch (err) {
      console.error("Pesan privat error:", err);
      document.getElementById("pp-loading").style.display = "none";
      document.getElementById("pp-error").style.display = "block";
    }
  }

  // ========== TAB 6: ADMIN ==========
  async function loadAdminList() {
    var tbody = document.getElementById("admin-tbody");
    var status = document.getElementById("admin-status");
    try {
      var res = await sb.from("admin_users").select("email, role");
      if (res.error) throw res.error;
      tbody.innerHTML = "";
      (res.data || []).forEach(function (a) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          escapeHtml(a.email) +
          '</td><td><span class="badge ' +
          (a.role === "admin" ? "pink" : "") +
          '">' +
          a.role +
          "</span></td>";
        tbody.appendChild(tr);
      });
    } catch (err) {
      status.textContent = "Gagal memuat daftar admin.";
      status.style.display = "block";
    }
  }

  window.loadOverview = loadOverview;
  window.loadTamuRSVP = loadTamuRSVP;
  window.setTamuFilter = setTamuFilter;
  window.copyGuestLink = copyGuestLink;
  window.showGuestModal = showGuestModal;
  window.closeGuestModal = closeGuestModal;
  window.loadGuestbook = loadGuestbook;
  window.setGbFilter = setGbFilter;
  window.startScanner = startScanner;
  window.stopScanner = stopScanner;
  window.editTamu = editTamu;
  window.loadPesanPrivat = loadPesanPrivat;

  // ========== polling approval ==========
  var _prevPending = 0;
  setInterval(async function () {
    try {
      var res = await sb
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("is_approved", false);
      var count = res.count || 0;
      var badge = document.getElementById("badge-approval");
      badge.textContent = count;
      badge.classList.toggle("show", count > 0);
      if (count > _prevPending && _prevPending > 0) {
        showToast(count + " RSVP baru perlu persetujuan.");
      }
      _prevPending = count;
    } catch (e) {}
  }, 30000);

  // ========== init ==========
  init();
})();
