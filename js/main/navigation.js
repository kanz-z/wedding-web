const rootElement = document.querySelector(":root");
const audioIconWrapper = document.querySelector(".audio-icon-wrapper");
const audioIcon = document.querySelector(".audio-icon-wrapper i");
const backSong = document.querySelector("#backSong");
let isPlaying = false;

audioIconWrapper.onclick = function () {
  if (isPlaying) {
    backSong.pause();
    audioIcon.classList.remove("bi-disc");
    audioIcon.classList.add("bi-pause-circle");
  } else {
    backSong.play();
    audioIcon.classList.add("bi-disc");
    audioIcon.classList.remove("bi-pause-circle");
  }

  isPlaying = !isPlaying;
};

function disableScroll() {
  document.body.style.overflow = "hidden";
  document.body.style.height = "100vh";
  // Simpan scroll position untuk dikembalikan nanti
  window._scrollY = window.pageYOffset || document.documentElement.scrollTop;
}

function enableScroll() {
  document.body.style.overflow = "";
  document.body.style.height = "";
  window.scrollTo(0, window._scrollY || 0);
  playAudio();
}

disableScroll();

const bottomNav = document.querySelector(".bottom-nav");
const navItems = document.querySelectorAll(".bottom-nav .nav-item");
const navSections = document.querySelectorAll("section[id]");

function showBottomNav() {
  bottomNav.classList.add("nav-visible");
}

function setActiveNav(sectionId) {
  const mapped =
    sectionId === "hero" || sectionId === "welcome" ? "home" : sectionId;
  navItems.forEach((item) =>
    item.classList.toggle("active", item.dataset.section === mapped),
  );
}

navItems.forEach(function (item) {
  item.addEventListener("click", function () {
    setActiveNav(item.dataset.section);
  });
});

const navObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        setActiveNav(entry.target.id);
      }
    });
  },
  { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
);

navSections.forEach(function (section) {
  navObserver.observe(section);
});

document.getElementById("navToggle").addEventListener("click", function () {
  bottomNav.classList.toggle("nav-hidden");
});
document.getElementById("navRestore").addEventListener("click", function () {
  bottomNav.classList.remove("nav-hidden");
});
