// src/main/audio.js
import { backSong, audioIconWrapper, audioIcon, setPlaying, isPlaying } from './navigation';

export function playAudio() {
  var promise = backSong.play();
  if (promise !== undefined) {
    promise.catch(function(error) {
      console.warn("Audio play ditolak browser:", error);
      audioIconWrapper.classList.remove("d-none");
      setPlaying(false);
      audioIconWrapper.classList.add("needs-interaction");
    });
  }
  backSong.volume = 0.5;
  audioIconWrapper.classList.remove("d-none");
  setPlaying(true);
}

// Audio icon toggle (moved from navigation.js)
audioIconWrapper.onclick = function() {
  if (isPlaying) {
    backSong.pause();
    audioIcon.classList.remove("bi-disc");
    audioIcon.classList.add("bi-pause-circle");
  } else {
    backSong.play();
    audioIcon.classList.add("bi-disc");
    audioIcon.classList.remove("bi-pause-circle");
  }
  setPlaying(!isPlaying);
};

document.addEventListener("visibilitychange", function() {
  if (document.hidden && backSong && !backSong.paused) {
    backSong.pause();
  } else if (!document.hidden && isPlaying && backSong.paused) {
    backSong.play().catch(function() {});
  }
});
