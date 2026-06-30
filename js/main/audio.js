function playAudio() {
  backSong.volume = 0.5;
  backSong.play();
  audioIconWrapper.style.display = "flex";
  isPlaying = true;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    backSong.pause();
  } else if (isPlaying) {
    backSong.play();
  }
});
