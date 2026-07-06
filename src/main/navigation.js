// src/main/navigation.js
export const rootElement = document.querySelector(":root");
export const audioIconWrapper = document.querySelector(".audio-icon-wrapper");
export const audioIcon = document.querySelector(".audio-icon-wrapper i");
export const backSong = document.querySelector("#backSong");
export let isPlaying = false;

export function setPlaying(val) { isPlaying = val; }

export function disableScroll() {
  document.body.style.overflow = "hidden";
  document.body.style.height = "100vh";
  window._scrollY = window.pageYOffset || document.documentElement.scrollTop;
}

export function enableScroll() {
  document.body.style.overflow = "";
  document.body.style.height = "";
  window.scrollTo(0, window._scrollY || 0);
}

disableScroll();

export function showBottomNav() {
  bottomNav.classList.add("nav-visible");
}

export function setActiveNav(sectionId) {
  var mapped = sectionId === "hero" || sectionId === "welcome" ? "home" : sectionId;
  navItems.forEach(function(item) { item.classList.toggle("active", item.dataset.section === mapped); });
}

var bottomNav = document.querySelector(".bottom-nav");
var navItems = document.querySelectorAll(".bottom-nav .nav-item");
var navSections = document.querySelectorAll("section[id]");

navItems.forEach(function(item) {
  item.addEventListener("click", function() { setActiveNav(item.dataset.section); });
});

var navObserver = new IntersectionObserver(
  function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) setActiveNav(entry.target.id);
    });
  },
  { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
);

navSections.forEach(function(section) { navObserver.observe(section); });

document.getElementById("navToggle").addEventListener("click", function() { bottomNav.classList.toggle("nav-hidden"); });
document.getElementById("navRestore").addEventListener("click", function() { bottomNav.classList.remove("nav-hidden"); });
