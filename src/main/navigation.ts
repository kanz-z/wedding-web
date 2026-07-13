// src/main/navigation.ts
export const rootElement = document.querySelector<HTMLElement>(':root');
export const audioIconWrapper = document.querySelector<HTMLElement>('.audio-icon-wrapper');
export const audioIcon = document.querySelector<HTMLElement>('.audio-icon-wrapper i');
export const backSong = document.querySelector<HTMLAudioElement>('#backSong');
export let isPlaying = false;

export function setPlaying(val: boolean): void {
  isPlaying = val;
}

export function disableScroll(): void {
  document.body.style.overflow = 'hidden';
  document.body.style.height = '100vh';
  (window as unknown as Record<string, unknown>)._scrollY = window.pageYOffset || document.documentElement.scrollTop;
}

export function enableScroll(): void {
  document.body.style.overflow = '';
  document.body.style.height = '';
  window.scrollTo(0, ((window as unknown as Record<string, unknown>)._scrollY as number) || 0);
}

disableScroll();

const bottomNav = document.querySelector<HTMLElement>('.bottom-nav');
const navItems = document.querySelectorAll<HTMLElement>('.bottom-nav .nav-item');
const navSections = document.querySelectorAll<HTMLElement>('section[id]');

export function showBottomNav(): void {
  if (bottomNav) bottomNav.classList.add('nav-visible');
}

export function setActiveNav(sectionId: string): void {
  const mapped =
    sectionId === 'hero' || sectionId === 'welcome' ? 'home' : sectionId;
  navItems.forEach(function (item: HTMLElement) {
    item.classList.toggle('active', item.dataset.section === mapped);
  });
}

navItems.forEach(function (item: HTMLElement) {
  item.addEventListener('click', function () {
    setActiveNav(item.dataset.section ?? '');
  });
});

const navObserver = new IntersectionObserver(
  function (entries: IntersectionObserverEntry[]) {
    entries.forEach(function (entry: IntersectionObserverEntry) {
      if (entry.isIntersecting) setActiveNav(entry.target.id);
    });
  },
  { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
);

navSections.forEach(function (section: HTMLElement) {
  navObserver.observe(section);
});

document.getElementById('navToggle')?.addEventListener('click', function () {
  if (bottomNav) bottomNav.classList.toggle('nav-hidden');
});
document.getElementById('navRestore')?.addEventListener('click', function () {
  if (bottomNav) bottomNav.classList.remove('nav-hidden');
});
