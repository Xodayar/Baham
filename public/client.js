const socket = io();

let myName = '';
let myProfile = null;

// نمایش مودال ورود تا نام وارد شود
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');

joinForm.onsubmit = e => {
  e.preventDefault();
  myName = nameInput.value.trim() || "کاربر ناشناس";
  socket.emit('join', { name: myName });
  joinModal.style.display = "none";
};

socket.on('your-profile', profile => {
  myProfile = profile;
  document.getElementById('username').textContent = myProfile.name;
});

// نمایش کاربران آنلاین
socket.on('online-users', users => {
  document.getElementById('online-users').innerHTML = `${users.length} نفر آنلاین <i class="users-icon"></i>`;
});

// نمایش تاریخچه چت
socket.on('chat-history', history => {
  history.forEach(msg => addMessage(msg));
  scrollChatToBottom();
});

// پیام سیستمی
socket.on('system-message', msg => {
  addMessage(msg);
  scrollChatToBottom();
});

// پیام جدید چت
socket.on('chat-message', msg => {
  addMessage(msg);
  scrollChatToBottom();
});

function addMessage(msg) {
  const chat = document.getElementById('chat-messages');
  const div = document.createElement('div');

  if (msg.system) {
    div.className = 'message system';
    div.textContent = msg.text;
  } else {
    let isMe = false;
    if (myProfile && msg.user && msg.user.id && myProfile.id) {
      isMe = msg.user.id === myProfile.id;
    } else if (myProfile && msg.user && msg.user.name) {
      isMe = msg.user.name === myProfile.name;
    }

    div.className = 'message' + (isMe ? ' me' : '');

    const time = new Date(msg.time);
    const t = time.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="meta">${msg.user.name} • ${t}</div>${escapeHTML(msg.text)}`;
  }

  chat.appendChild(div);
}

function escapeHTML(txt) {
  // **FIXED**: Correctly escape HTML to prevent XSS
  return String(txt).replace(/[<>&"]/g, c => ({
    '<': '<',
    '>': '>',
    '&': '&',
    '"': '"'
  }[c]));
}

function scrollChatToBottom() {
  const chat = document.getElementById('chat-messages');
  chat.scrollTop = chat.scrollHeight;
}

// ارسال پیام چت
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
chatForm.onsubmit = e => {
  e.preventDefault();
  const txt = chatInput.value.trim();
  if (!txt) return;
  socket.emit('chat-message', txt);
  chatInput.value = '';
};

// همگام‌سازی ویدیو
const video = document.getElementById('video');
const ytPlayerDiv = document.getElementById('youtube-player');
let ytPlayer = null;
let currentType = 'mp4';
let ignoreEvent = false;

// ---- START: Custom Player Integration ----
let customPlayer = null;

// Callbacks to send data to the server via our custom player
const syncCallbacks = {
    onPlay: (currentTime) => {
        if (ignoreEvent || currentType !== 'mp4') return;
        socket.emit('video-action', { paused: false, currentTime });
    },
    onPause: (currentTime) => {
        if (ignoreEvent || currentType !== 'mp4') return;
        socket.emit('video-action', { paused: true, currentTime });
    },
    onSeek: (currentTime) => {
        if (ignoreEvent || currentType !== 'mp4') return;
        socket.emit('video-action', { currentTime });
    }
};
// ---- END: Custom Player Integration ----


// YouTube IFrame API آماده است؟
let youTubeAPIReady = false;
window.onYouTubeIframeAPIReady = function() {
  youTubeAPIReady = true;
  if (pendingYouTubeId) {
    loadYouTubePlayer(pendingYouTubeId, pendingYouTubeTime, pendingYouTubeAutoplay);
    pendingYouTubeId = null;
  }
};

let pendingYouTubeId = null;
let pendingYouTubeTime = 0;
let pendingYouTubeAutoplay = false;

// دریافت وضعیت اولیه ویدیو
socket.on('video-sync', state => {
  if (!state.type || state.type === 'mp4') {
    switchToMP4(state.src || video.src, state.currentTime || 0, !state.paused);
    if (state.paused) video.pause();
    else video.play();
  } else if (state.type === 'youtube') {
    switchToYouTube(state.youtubeId, state.currentTime || 0, !state.paused);
  }
});

// دریافت اکشن ویدیو از سرور
socket.on('video-action', data => {
  ignoreEvent = true;
  if (currentType === 'mp4') {
    if ('currentTime' in data) video.currentTime = data.currentTime;
    if ('paused' in data) {
      if (data.paused) video.pause();
      else video.play();
    }
  } else if (currentType === 'youtube' && ytPlayer) {
    if ('currentTime' in data) ytPlayer.seekTo(data.currentTime, true);
    if ('paused' in data) {
      if (data.paused) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
    }
  }
  setTimeout(()=>ignoreEvent=false, 400);
});

// ======== منوی تغییر ویدیو ========
const videoMenuBtn = document.getElementById('video-menu-btn');
const videoModal = document.getElementById('video-modal');
const videoForm = document.getElementById('video-form');
const videoInput = document.getElementById('video-link-input');
const videoCancelBtn = document.getElementById('video-cancel-btn');
const videoTitle = document.getElementById('video-title');
const videoLinkError = document.getElementById('video-link-error');

if(videoMenuBtn) videoMenuBtn.onclick = () => {
  videoModal.style.display = 'flex';
  videoInput.value = '';
  videoLinkError.style.display = 'none';
  setTimeout(()=>videoInput.focus(), 100);
};
if(videoCancelBtn) videoCancelBtn.onclick = () => {
  videoModal.style.display = 'none';
  videoLinkError.style.display = 'none';
};
if(videoForm) videoForm.onsubmit = e => {
  e.preventDefault();
  const link = videoInput.value.trim();
  if (!isValidVideoLink(link)) {
    videoLinkError.textContent = 'لینک معتبر وارد کنید (mp4 یا YouTube)';
    videoLinkError.style.display = 'block';
    return;
  }
  socket.emit('change-video', link);
  videoModal.style.display = 'none';
  videoLinkError.style.display = 'none';
};

socket.on('change-video', link => {
  setVideoSource(link);
});

function setVideoSource(link) {
  if (isYouTube(link)) {
    const videoId = getYouTubeId(link);
    if (videoId) {
      switchToYouTube(videoId, 0, true);
      setYouTubeTitle(videoId);
      return;
    }
  }
  switchToMP4(link, 0, true);
  videoTitle.textContent = getFileName(link);
}

function switchToYouTube(videoId, seekTo = 0, autoplay = false) {
    currentType = 'youtube';
    document.querySelector('.player-container').style.display = 'none'; // Hide custom player
    ytPlayerDiv.style.display = 'block'; // Show YouTube player
    video.style.display = 'none';

    if (ytPlayer && ytPlayer.destroy) {
        ytPlayer.destroy();
        ytPlayer = null;
        ytPlayerDiv.innerHTML = '';
    }
    if (!youTubeAPIReady) {
        pendingYouTubeId = videoId;
        pendingYouTubeTime = seekTo;
        pendingYouTubeAutoplay = autoplay;
        return;
    }
    loadYouTubePlayer(videoId, seekTo, autoplay);
}

function loadYouTubePlayer(videoId, seekTo = 0, autoplay = false) {
  ytPlayerDiv.innerHTML = '';
  ytPlayer = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      'autoplay': autoplay ? 1 : 0, 'controls': 1, 'rel': 0,
      'modestbranding': 1, 'enablejsapi': 1
    },
    events: {
      'onReady': function(event) {
        if (seekTo) event.target.seekTo(seekTo, true);
        if (autoplay) event.target.playVideo();
      },
      'onStateChange': function(event) {
        if (ignoreEvent) return;
        if (event.data === YT.PlayerState.PLAYING) {
          socket.emit('video-action', { paused: false, currentTime: ytPlayer.getCurrentTime() });
        } else if (event.data === YT.PlayerState.PAUSED) {
          socket.emit('video-action', { paused: true, currentTime: ytPlayer.getCurrentTime() });
        }
      }
    }
  });

  let lastTime = 0;
  if (window._ytSeekInterval) clearInterval(window._ytSeekInterval);
  window._ytSeekInterval = setInterval(() => {
    if (!ytPlayer || ignoreEvent || typeof ytPlayer.getCurrentTime !== 'function') return;
    const t = ytPlayer.getCurrentTime();
    if (Math.abs(t - lastTime) > 2) {
      socket.emit('video-action', { currentTime: t });
    }
    lastTime = t;
  }, 1200);
}

function switchToMP4(src, seekTo = 0, autoplay = false) {
    currentType = 'mp4';
    document.querySelector('.player-container').style.display = 'block';
    ytPlayerDiv.style.display = 'none';

    if (ytPlayer && ytPlayer.destroy) {
        ytPlayer.destroy();
        ytPlayer = null;
        ytPlayerDiv.innerHTML = '';
    }

    video.src = src;
    video.load();
    video.currentTime = seekTo || 0;
    
    // Initialize custom player
    if (!customPlayer) {
        customPlayer = new CustomPlayer(video, syncCallbacks);
    }
    
    if (autoplay) video.play();
}

async function setYouTubeTitle(videoId) {
  try {
    let res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$${videoId}&format=json`);
    let data = await res.json();
    videoTitle.textContent = data.title;
  } catch {
    videoTitle.textContent = 'YouTube: ' + videoId;
  }
}

function isValidVideoLink(link) {
  if (!link) return false;
  if (isYouTube(link)) return true;
  return /\.(mp4)(\?.*)?$/i.test(link);
}
function isYouTube(link) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(link);
}
function getYouTubeId(url) {
  let patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  ];
  for (let p of patterns) {
    let m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
function getFileName(url) {
  try {
    let name = decodeURIComponent(url.split('/').pop().split('?')[0]);
    if (!name) return 'ویدیو';
    return name.length > 30 ? name.slice(0,27)+'...' : name;
  } catch {
    return 'ویدیو';
  }
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (videoModal.style.display === 'flex') videoModal.style.display = 'none';
    if (joinModal.style.display === 'flex') joinModal.style.display = 'none';
  }
});
videoModal && videoModal.addEventListener('click', e => {
  if (e.target === videoModal) videoModal.style.display = 'none';
});
joinModal && joinModal.addEventListener('click', e => {
  if (e.target === joinModal) joinModal.style.display = 'none';
});