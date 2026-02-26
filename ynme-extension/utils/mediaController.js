function getVideo() {
  return document.querySelector("video");
}

function play() {
  const video = getVideo();
  if (video) video.play();
}

function pause() {
  const video = getVideo();
  if (video) video.pause();
}

function seek(seconds) {
  const video = getVideo();
  if (video) video.currentTime += seconds;
}

function setVolume(value) {
  const video = getVideo();
  if (video) video.volume = value;
}

function getStatus() {
  const video = getVideo();
  if (!video) return { error: "NO_MEDIA" };

  return {
    title: document.title,
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    volume: video.volume
  };
}

// Since these might be used in content scripts directly without ES modules in some configurations,
// we defined them as global-scope functions in this file.
