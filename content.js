// ── RATED Watch Party — Content Script ─────────────────────────────────────
// Runs on every page. Finds a <video> element, intercepts play/pause/seek,
// applies commands received from popup.

(function() {
  'use strict';

  let video      = null;
  let inRoom     = false;
  let amHost     = false;
  let applying   = false;   // true while we apply a remote command → don't echo back
  let scanTimer  = null;

  // ── FIND VIDEO ──────────────────────────────────────────────────────────────
  function findVideo() {
    // Prefer the largest visible video element
    const videos = [...document.querySelectorAll('video')].filter(v => v.offsetWidth > 0);
    if (!videos.length) return null;
    return videos.reduce((a, b) => (a.offsetWidth * a.offsetHeight > b.offsetWidth * b.offsetHeight ? a : b));
  }

  function detectSite() {
    const h = location.hostname;
    if (h.includes('youtube.com'))     return 'YouTube';
    if (h.includes('kinopoisk.ru'))    return 'Кинопоиск';
    if (h.includes('netflix.com'))     return 'Netflix';
    if (h.includes('okko.tv'))         return 'Okko';
    if (h.includes('ivi.ru'))          return 'IVI';
    if (h.includes('twitch.tv'))       return 'Twitch';
    if (h.includes('vimeo.com'))       return 'Vimeo';
    return location.hostname;
  }

  function attachVideo(v) {
    if (video === v) return;
    if (video) detachVideo();
    video = v;

    video.addEventListener('play',    onPlay);
    video.addEventListener('pause',   onPause);
    video.addEventListener('seeked',  onSeeked);

    chrome.runtime.sendMessage({ type: 'playerFound', site: detectSite() });
  }

  function detachVideo() {
    if (!video) return;
    video.removeEventListener('play',   onPlay);
    video.removeEventListener('pause',  onPause);
    video.removeEventListener('seeked', onSeeked);
    video = null;
    chrome.runtime.sendMessage({ type: 'playerLost' });
  }

  function scan() {
    const v = findVideo();
    if (v && v !== video) attachVideo(v);
    if (!v && video)      detachVideo();
  }

  // ── PLAYER EVENT HANDLERS ───────────────────────────────────────────────────
  function onPlay() {
    if (applying || !inRoom) return;
    chrome.runtime.sendMessage({ type: 'play', time: video.currentTime });
  }

  function onPause() {
    if (applying || !inRoom) return;
    chrome.runtime.sendMessage({ type: 'pause', time: video.currentTime });
  }

  let lastSeek = 0;
  function onSeeked() {
    if (applying || !inRoom) return;
    const now = Date.now();
    if (now - lastSeek < 300) return; // debounce double-fires
    lastSeek = now;
    chrome.runtime.sendMessage({ type: 'seek', time: video.currentTime });
  }

  // ── APPLY REMOTE COMMAND ────────────────────────────────────────────────────
  function applyCommand(msg) {
    if (!video) return;
    applying = true;

    if (msg.type === 'play') {
      if (msg.time != null) video.currentTime = msg.time;
      video.play().catch(() => {});
    } else if (msg.type === 'pause') {
      if (msg.time != null) video.currentTime = msg.time;
      video.pause();
    } else if (msg.type === 'seek') {
      video.currentTime = msg.time;
    }

    // Release lock after a tick so our own events don't fire
    setTimeout(() => { applying = false; }, 400);
  }

  // ── DRIFT CHECK ─────────────────────────────────────────────────────────────
  function driftCheck(state) {
    if (!video || amHost) return;
    // Estimate host time accounting for latency
    const elapsed = (Date.now() - state.updatedAt) / 1000;
    const hostTime = state.paused ? state.time : state.time + elapsed;
    const diff = Math.abs(video.currentTime - hostTime);
    if (diff > 2.5) {
      applying = true;
      video.currentTime = hostTime;
      if (!state.paused && video.paused) video.play().catch(() => {});
      if (state.paused && !video.paused) video.pause();
      setTimeout(() => { applying = false; }, 400);
    }
  }

  // ── MESSAGES FROM POPUP ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'sync') {
      inRoom = true;
      amHost = msg.isHost;
      // Sync state on join
      if (!msg.isHost && video) {
        applyCommand({ type: msg.state.paused ? 'pause' : 'play', time: msg.state.time });
      }
    }

    if (msg.type === 'leave') {
      inRoom = false;
      amHost = false;
    }

    if ((msg.type === 'play' || msg.type === 'pause' || msg.type === 'seek') && inRoom && !amHost) {
      applyCommand(msg);
    }

    if (msg.type === 'driftCheck') {
      driftCheck(msg.state);
    }

    if (msg.type === 'checkPlayer') {
      scan();
    }

    if (msg.type === 'requestTime') {
      if (video) chrome.runtime.sendMessage({ type: 'pingReply', time: video.currentTime });
    }
  });

  // ── SCAN ON LOAD AND DOM CHANGES ────────────────────────────────────────────
  scan();

  // Watch for dynamically loaded players (SPA sites)
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 600);
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  // Also scan periodically as fallback (some sites swap video src)
  setInterval(scan, 4000);

})();
