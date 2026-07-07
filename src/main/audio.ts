// src/main/audio.ts
import { backSong, audioIconWrapper, audioIcon, setPlaying, isPlaying } from './navigation';

export function playAudio(): void {
  const bs = backSong;
  const wrapper = audioIconWrapper;
  const icon = audioIcon;
  if (!bs || !wrapper || !icon) return;

  const promise = bs.play();
  if (promise !== undefined) {
    promise.catch(function (_error: unknown) {
      console.warn('Audio play ditolak browser:', _error);
      if (wrapper) {
        wrapper.classList.remove('d-none');
        wrapper.classList.add('needs-interaction');
      }
      setPlaying(false);
    });
  }
  bs.volume = 0.5;
  wrapper.classList.remove('d-none');
  setPlaying(true);
}

// Audio icon toggle (moved from navigation.js)
if (audioIconWrapper && audioIcon && backSong) {
  const bs = backSong;
  const icon = audioIcon;
  audioIconWrapper.onclick = function () {
    if (isPlaying) {
      bs.pause();
      icon.classList.remove('bi-disc');
      icon.classList.add('bi-pause-circle');
    } else {
      bs.play();
      icon.classList.add('bi-disc');
      icon.classList.remove('bi-pause-circle');
    }
    setPlaying(!isPlaying);
  };
}

document.addEventListener('visibilitychange', function () {
  if (document.hidden && backSong && !backSong.paused) {
    backSong.pause();
  } else if (!document.hidden && isPlaying && backSong && backSong.paused) {
    backSong.play().catch(function () { /* ignore audio errors on visibility resume */ });
  }
});
