function playAudio() {
  var promise = backSong.play();

  if (promise !== undefined) {
    promise.catch(function (error) {
      // Autoplay gagal — browser butuh user interaction
      console.warn("Audio play ditolak browser:", error);
      // Tampilkan indikasi ke user bahwa audio perlu diaktifkan
      audioIconWrapper.style.display = "flex";
      isPlaying = false;
      audioIconWrapper.classList.add("needs-interaction");
    });
  }

  backSong.volume = 0.5;
  audioIconWrapper.style.display = "flex";
  isPlaying = true;
}

document.addEventListener("visibilitychange", function () {
  if (document.hidden && backSong && !backSong.paused) {
    backSong.pause();
  } else if (!document.hidden && isPlaying && backSong.paused) {
    // Hanya resume jika sebelumnya sedang playing
    backSong.play().catch(function () {
      // Silent catch — browser mungkin masih butuh interaction
    });
  }
});
