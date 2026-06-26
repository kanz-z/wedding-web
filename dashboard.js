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
      page.forEach(function (item) {
        var div = document.createElement("div");
        div.className = "log-item";
        if (item._type === "rsvp") {
          div.innerHTML =
            '<div class="log-dot rsvp"></div>' +
            '<div style="flex:1;"><strong>' +
            escapeHtml(item.nama) +
            "</strong> — " +
            item.status +
            " (" +
            item.jumlah_hadir +
            " org)</div>" +
            '<div class="log-time">' +
            formatDate(item.created_at) +
            "</div>";
        } else {
          div.innerHTML =
            '<div class="log-dot gb"></div>' +
            '<div style="flex:1;"><strong>' +
            escapeHtml(item.nama) +
            "</strong> — " +
            escapeHtml(item.pesan.substring(0, 60)) +
            "</div>" +
            '<div class="log-time">' +
            formatDate(item.created_at) +
            "</div>";
        }
        log.appendChild(div);
      });
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
  async function loadTamuRSVP() {
    document.getElementById("tamu-status").style.display = "none";
    document.getElementById("tamu-empty").style.display = "none";
    try {
      var [guestsRes, rsvpsRes] = await Promise.all([
        sb
          .from("guests")
          .select("id, slug, name, pronoun, invited_count, created_at"),
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

      var rsvpMap = {};
      rsvps.forEach(function (r) {
        rsvpMap[r.guest_id] = r;
      });

      allTamu = guests.map(function (g) {
        var r = rsvpMap[g.id];
        return {
          id: r ? r.id : null,
          guest_id: g.id,
          nama: r ? r.nama : g.name,
          nomor_wa: r ? r.nomor_wa : "",
          jumlah_hadir: r ? r.jumlah_hadir : g.invited_count,
          status: r ? r.status : null,
          is_approved: r ? r.is_approved : true,
          checked_in: r ? r.checked_in : false,
          qr_token: r ? r.qr_token : null,
          pesan: r ? r.pesan : null,
          created_at: r ? r.created_at : g.created_at,
          _slug: g.slug,
          _pronoun: g.pronoun,
          _invited_count: g.invited_count,
        };
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
        t.guest_id +
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
      // click-to-expand for truncated cells
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
      .querySelectorAll("#tab-tamu .filters button")
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
    if (token) link += "&token=" + token;
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
      return t.guest_id === guestId;
    });
    if (!entry) {
      showToast("Data tamu tidak ditemukan.", true);
      return;
    }
    var guestData = {
      id: entry.guest_id,
      name: entry.nama,
      slug: entry._slug,
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
    document.getElementById("guest-modal").classList.add("show");
    var rsvpSection = document.getElementById("gf-rsvp-section");
    if (guestData) {
      document.getElementById("guest-modal-title").textContent = "Edit Tamu";
      document.getElementById("gf-id").value = guestData.id;
      document.getElementById("gf-name").value = guestData.name;
      document.getElementById("gf-slug").value = guestData.slug;
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
      var data = {
        name: document.getElementById("gf-name").value.trim(),
        slug: document.getElementById("gf-slug").value.trim(),
        pronoun: document.getElementById("gf-pronoun").value.trim() || null,
        invited_count: parseInt(document.getElementById("gf-count").value) || 1,
      };
      if (!data.name || !data.slug) {
        showToast("Nama dan slug wajib diisi.", true);
        return;
      }

      try {
        var guestId = id;
        if (id) {
          var res = await sb.from("guests").update(data).eq("id", id);
          if (res.error) throw res.error;
        } else {
          var res = await sb.from("guests").insert([data]).select("id");
          if (res.error) throw res.error;
          guestId = res.data[0].id;
        }

        // Save RSVP data
        var rsvpId = document.getElementById("gf-rsvp-id").value;
        var rsvpSection = document.getElementById("gf-rsvp-section");
        var nomorWa = document.getElementById("gf-nomor-wa").value.trim();

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
            var rsvpRes = await sb.from("rsvps").insert([rsvpData]);
            if (rsvpRes.error) throw rsvpRes.error;
          }
        } else if (nomorWa && guestId) {
          // Simpan WA ke rsvps meski belum ada status
          var rsvpData = {
            guest_id: guestId,
            nama: data.name,
            nomor_wa: nomorWa,
            jumlah_hadir:
              parseInt(document.getElementById("gf-count").value) || 1,
            status: null,
          };
          var rsvpRes = await sb.from("rsvps").insert([rsvpData]);
          if (rsvpRes.error) throw rsvpRes.error;
        }

        showToast(id ? "Tamu diperbarui." : "Tamu ditambahkan.");
        closeGuestModal();
        loadTamuRSVP();
      } catch (err) {
        showToast("Gagal menyimpan: " + (err.message || "unknown"), true);
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
      .querySelectorAll("#tab-guestbook .filters button")
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
        { fps: 5, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        function () {}, // ignore errors
      )
      .catch(function (err) {
        showToast("Gagal mengakses kamera: " + err, true);
        document.getElementById("btn-start-scan").style.display = "inline-flex";
        document.getElementById("btn-stop-scan").style.display = "none";
      });
  }

  function stopScanner() {
    if (html5QrScanner) {
      html5QrScanner
        .stop()
        .then(function () {
          document.getElementById("btn-start-scan").style.display =
            "inline-flex";
          document.getElementById("btn-stop-scan").style.display = "none";
        })
        .catch(function () {});
    }
  }

  async function onScanSuccess(decodedText) {
    stopScanner();
    var resultEl = document.getElementById("scan-result");
    var token = decodedText.trim();

    try {
      var res = await sb
        .from("rsvps")
        .select("id, nama, checked_in, jumlah_hadir")
        .eq("qr_token", token)
        .single();
      if (res.error || !res.data) {
        resultEl.className = "scan-result error";
        resultEl.textContent = "Tamu tidak terdaftar";
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
      loadCheckinLog();
      loadTamuRSVP();
    } catch (err) {
      console.error("Scan error:", err);
      resultEl.className = "scan-result error";
      resultEl.textContent = "Gagal memproses check-in";
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
