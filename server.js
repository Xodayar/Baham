const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let users = {};
let chatHistory = [];
let videoState = { 
  currentTime: 0, 
  paused: true, 
  src: 'sample.mp4', 
  title: 'ویدیو پیش‌فرض', 
  type: 'mp4' // یا 'youtube'
};

const MAX_CHAT_LENGTH = 200;
const MIN_MSG_INTERVAL = 700; // میلی‌ثانیه
const MAX_CHAT_HISTORY = 100;

// کمکی‌ها:
function isYouTube(link) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(link);
}
function getYouTubeId(url) {
  // پشتیبانی از watch?v=، youtu.be، embed، shorts و غیره
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
function isMP4(link) {
  return /\.(mp4)(\?.*)?$/i.test(link);
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

io.on('connection', (socket) => {
  let user = null;
  let lastMsgTime = 0;

  socket.on('join', ({ name }) => {
    name = (name || '').trim();
    if (!name) {
      socket.emit('join-error', 'نام کاربری نمی‌تواند خالی باشد.');
      return;
    }
    if (Object.values(users).some(u => u.name === name)) {
      socket.emit('join-error', 'این نام قبلاً انتخاب شده است.');
      return;
    }
    user = { id: socket.id, name };
    users[socket.id] = user;

    socket.emit('your-profile', user);
    socket.emit('chat-history', chatHistory);
    socket.emit('video-sync', videoState);
    io.emit('online-users', Object.values(users));

    const sysMsg = {
      text: `👋 ${user.name} به جمع پیوست.`,
      system: true,
      time: Date.now()
    };
    io.emit('system-message', sysMsg);
    chatHistory.push(sysMsg);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
  });

  socket.on('chat-message', (text) => {
    if (!user) return;
    text = (text || '').trim();
    if (!text) return;
    if (text.length > MAX_CHAT_LENGTH) {
      socket.emit('chat-error', `حداکثر ${MAX_CHAT_LENGTH} کاراکتر مجاز است.`);
      return;
    }
    if (Date.now() - lastMsgTime < MIN_MSG_INTERVAL) {
      socket.emit('chat-error', 'لطفاً کمی صبر کنید!');
      return;
    }
    lastMsgTime = Date.now();
    const msg = {
      user: { name: user.name, id: user.id },
      text,
      time: Date.now()
    };
    io.emit('chat-message', msg);
    chatHistory.push(msg);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
  });

  socket.on('video-action', (data) => {
    // data: { currentTime, paused }
    videoState = { ...videoState, ...data };
    socket.broadcast.emit('video-action', data);
  });

  socket.on('change-video', (link) => {
    if (typeof link !== 'string' || !link.trim()) {
      socket.emit('video-error', 'لینک ویدیو معتبر نیست.');
      return;
    }
    link = link.trim();
    let info = {};
    if (isYouTube(link)) {
      const youtubeId = getYouTubeId(link);
      if (!youtubeId) {
        socket.emit('video-error', 'لینک یوتیوب معتبر نیست.');
        return;
      }
      info = {
        src: link,
        type: 'youtube',
        youtubeId,
        title: `YouTube: ${youtubeId}`
      };
    } else if (isMP4(link)) {
      info = {
        src: link,
        type: 'mp4',
        title: getFileName(link)
      };
    } else {
      socket.emit('video-error', 'فقط لینک MP4 یا YouTube مجاز است.');
      return;
    }
    videoState = { ...videoState, ...info, currentTime: 0, paused: true };
    io.emit('change-video', info); // ارسال کل آبجکت ویدیو
    io.emit('video-sync', videoState);

    const sysMsg = {
      text: `🎬 ${user.name} ویدیو را تغییر داد به: ${info.title}`,
      system: true,
      time: Date.now()
    };
    io.emit('system-message', sysMsg);
    chatHistory.push(sysMsg);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
  });

  socket.on('disconnect', () => {
    if (user) {
      delete users[socket.id];
      io.emit('online-users', Object.values(users));
      const sysMsg = {
        text: `🚪 ${user.name} خارج شد.`,
        system: true,
        time: Date.now()
      };
      io.emit('system-message', sysMsg);
      chatHistory.push(sysMsg);
      if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
