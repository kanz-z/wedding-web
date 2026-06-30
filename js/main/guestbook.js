var GB_PAGE_SIZE = 5;
var gbCurrentPage = 0;
var gbTotalPages = 0;

var KATA_KASAR = [
  "anjing",
  "babi",
  "bangsat",
  "goblok",
  "tolol",
  "bodoh",
  "kontol",
  "memek",
  "jancok",
  "jancuk",
  "ngentot",
  "bajingan",
  "brengsek",
  "laknat",
  "sialan",
  "kampret",
  "bego",
  "setan",
];

function sensorKataKasar(text) {
  for (var i = 0; i < KATA_KASAR.length; i++) {
    var regex = new RegExp("\\b" + KATA_KASAR[i] + "\\b", "i");
    if (regex.test(text)) return true;
  }
  return false;
}

function formatWaktuRelatif(iso) {
  var now = new Date();
  var d = new Date(iso);
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return Math.floor(diff / 60) + " menit lalu";
  if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu";
  if (diff < 604800) return Math.floor(diff / 86400) + " hari lalu";
  return d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

async function submitGuestbook(namaInput, pesanInput, rsvpId) {
  const { error } = await supabaseClient.from("guestbook").insert([
    {
      rsvp_id: rsvpId || null,
      nama: namaInput,
      pesan: pesanInput,
    },
  ]);
  if (error) throw error;
}

async function fetchGuestbook(page) {
  document.getElementById("gb-loading").style.display = "block";
  document.getElementById("gb-error").style.display = "none";
  document.getElementById("gb-empty").style.display = "none";

  try {
    var from = page * GB_PAGE_SIZE;
    var to = from + GB_PAGE_SIZE - 1;

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("supabaseClient belum siap");
    }

    var countRes = await supabaseClient
      .from("guestbook")
      .select("id", { count: "estimated", head: true })
      .eq("is_approved", true);

    if (countRes.error) throw countRes.error;
    var total = countRes.count || 0;
    gbTotalPages = Math.max(1, Math.ceil(total / GB_PAGE_SIZE));

    var res = await supabaseClient
      .from("guestbook")
      .select("nama, pesan, created_at")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (res.error) throw res.error;

    var data = res.data || [];
    document.getElementById("gb-list").innerHTML = "";

    if (data.length === 0) {
      document.getElementById("gb-empty").style.display = "block";
    } else {
      data.forEach(function (m) {
        var div = document.createElement("div");
        div.className = "gb-entry";
        div.innerHTML =
          '<div class="gb-name">' +
          escapeHtml(m.nama) +
          "</div>" +
          '<div class="gb-msg">' +
          escapeHtml(m.pesan) +
          "</div>" +
          '<div class="gb-time">' +
          formatWaktuRelatif(m.created_at) +
          "</div>";
        document.getElementById("gb-list").appendChild(div);
      });
    }

    gbCurrentPage = page;
    renderPagination();
  } catch (err) {
    console.error("Gagal memuat ucapan:", err);
    document.getElementById("gb-error").style.display = "block";
  } finally {
    document.getElementById("gb-loading").style.display = "none";
  }
}

function renderPagination() {
  var nav = document.getElementById("gb-pagination");
  var ul = nav.querySelector("ul");
  ul.innerHTML = "";
  if (gbTotalPages <= 1) {
    nav.style.display = "none";
    return;
  }
  nav.style.display = "block";

  // prev
  var li = document.createElement("li");
  li.className = "page-item" + (gbCurrentPage === 0 ? " disabled" : "");
  li.innerHTML =
    '<a class="page-link" href="#" aria-label="Sebelumnya"><span aria-hidden="true">&laquo;</span></a>';
  li.querySelector("a").addEventListener("click", function (e) {
    e.preventDefault();
    if (gbCurrentPage > 0) fetchGuestbook(gbCurrentPage - 1);
  });
  ul.appendChild(li);

  // pages
  for (var i = 0; i < gbTotalPages; i++) {
    var li2 = document.createElement("li");
    li2.className = "page-item" + (i === gbCurrentPage ? " active" : "");
    li2.innerHTML = '<a class="page-link" href="#">' + (i + 1) + "</a>";
    li2.querySelector("a").addEventListener(
      "click",
      (function (p) {
        return function (e) {
          e.preventDefault();
          fetchGuestbook(p);
        };
      })(i),
    );
    ul.appendChild(li2);
  }

  // next
  var li3 = document.createElement("li");
  li3.className =
    "page-item" + (gbCurrentPage >= gbTotalPages - 1 ? " disabled" : "");
  li3.innerHTML =
    '<a class="page-link" href="#" aria-label="Berikutnya"><span aria-hidden="true">&raquo;</span></a>';
  li3.querySelector("a").addEventListener("click", function (e) {
    e.preventDefault();
    if (gbCurrentPage < gbTotalPages - 1) fetchGuestbook(gbCurrentPage + 1);
  });
  ul.appendChild(li3);
}

function retryFetchGuestbook(attempt) {
  attempt = attempt || 0;
  if (attempt >= 3) {
    fetchGuestbook(0);
    return;
  }
  setTimeout(
    function () {
      if (typeof supabaseClient !== "undefined" && supabaseClient) {
        fetchGuestbook(0);
      } else {
        retryFetchGuestbook(attempt + 1);
      }
    },
    300 * (attempt + 1),
  );
}

document
  .getElementById("guestbook-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    var namaEl = document.getElementById("gb-nama");
    var pesanEl = document.getElementById("gb-pesan");
    var errEl = document.createElement("div");
    errEl.className = "gb-error-msg";
    var existing = this.querySelector(".gb-error-msg");
    if (existing) existing.remove();

    var nama = namaEl.value.trim();
    var pesan = pesanEl.value.trim();

    if (!nama || !pesan) {
      errEl.textContent = "Nama dan ucapan wajib diisi.";
      errEl.classList.add("show");
      this.appendChild(errEl);
      return;
    }

    if (sensorKataKasar(pesan)) {
      errEl.textContent =
        "Ucapan mengandung kata tidak pantas. Mohon perbaiki.";
      errEl.classList.add("show");
      this.appendChild(errEl);
      return;
    }

    var gbSuccess = false;
    var span = this.querySelector("#statusMessage");
    span.textContent = "Mengirim...";

    try {
      await submitGuestbook(nama, pesan, null);
      showToast("Ucapan berhasil dikirim! Terima kasih.");
      namaEl.value = "";
      pesanEl.value = "";
      document.getElementById("gb-counter").textContent = "0/500";
      fetchGuestbook(0);
      gbSuccess = true;
      span.textContent = "Terkirim";
    } catch (err) {
      console.error("Gagal kirim ucapan:", err);
      showToast("Gagal mengirim ucapan. Coba lagi.", true);
    } finally {
      if (!gbSuccess) span.textContent = "Kirim Ucapan";
    }
  });

document.getElementById("gb-pesan").addEventListener("input", function () {
  document.getElementById("gb-counter").textContent =
    this.value.length + "/500";
});

document.getElementById("gb-nama").value = nama;
retryFetchGuestbook(0);
