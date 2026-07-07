// dashboard side navigation & tab switching

function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach(function (p) {
    p.classList.remove("active");
  });
  document.querySelectorAll(".side-nav-menu a").forEach(function (a) {
    a.classList.remove("active");
  });
  document.getElementById(tabId).classList.add("active");
  var link = document.querySelector(
    '.side-nav-menu a[data-tab="' + tabId + '"]'
  );
  if (link) link.classList.add("active");
  // lazy load
  if (tabId === "tab-overview") loadOverview();
  if (tabId === "tab-tamu") loadTamuRSVP();
  if (tabId === "tab-guestbook") loadGuestbook();
  if (tabId === "tab-pesan-privat") loadPesanPrivat();
  if (tabId === "tab-admin") loadAdminList();
  // close mobile sidebar after tab switch
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
