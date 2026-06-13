// ── CONFIG — замени на свой домен ──────────────────────────────────────────
const RATED_HOST = 'rated.yourdomain.com';   // без https://
const WS_URL     = `wss://${RATED_HOST}`;
const API_URL    = `https://${RATED_HOST}`;
// ────────────────────────────────────────────────────────────────────────────

let ws       = null;
let myCode   = null;
let myName   = null;
let isHost   = false;
let ignoreNext = false; // prevent echo loop

// ── STORAGE ─────────────────────────────────────────────────────────────────
function save(data) { chrome.storage.local.set(data); }
function load(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }

// ── UI HELPERS ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showRoom(code) {
  $('panel-setup').style.display = 'none';
  $('panel-room').style.display  = 'block';
  $('room-code-val').textContent = code;
}
function showSetup() {
  $('panel-setup').style.display = 'block';
  $('panel-room').style.display  = 'none';
  $('status-dot').classList.remove('connected');
}

function addChat(from, text, system = false) {
  const box = $('chat-box');
  const el  = document.createElement('div');
  el.className = 'chat-msg' + (system ? ' system' : '');
  el.innerHTML = system
    ? `<span class="chat-text">${escHtml(text)}</span>`
    : `<span class="chat-who">${escHtml(from)}</span><span class="chat-text">${escHtml(text)}</span>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function renderMembers(members) {
  const list = $('members-list');
  list.innerHTML = members.map((m, i) =>
    `<div class="member-chip ${i===0?'host':''}">${escHtml(m)}${i===0?' ♦':''}</div>`
  ).join('');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── WEBSOCKET ────────────────────────────────────────────────────────────────
function connect(code, username) {
  if (ws) { ws.close(); ws = null; }
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', code, username }));
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.type === 'sync') {
      isHost = msg.isHost;
      $('status-dot').classList.add('connected');
      addChat(null, `Вы в комнате ${code}${msg.isHost ? ' (хост)' : ''}`, true);
      // Tell content script current state
      sendToContent({ type: 'sync', state: msg.state, isHost: msg.isHost });
    }

    if (msg.type === 'members') renderMembers(msg.members);

    if (msg.type === 'play' || msg.type === 'pause' || msg.type === 'seek') {
      addChat(null, `${msg.from} → ${msg.type}${msg.type==='seek' ? ' '+fmtTime(msg.time) : ''}`, true);
      ignoreNext = true;
      sendToContent(msg);
    }

    if (msg.type === 'chat') addChat(msg.from, msg.text);

    if (msg.type === 'pong') {
      // drift: if our video time differs by >2s from host, seek
      if (!isHost) sendToContent({ type: 'driftCheck', state: msg.state });
    }
  };

  ws.onclose = () => {
    $('status-dot').classList.remove('connected');
    addChat(null, 'Соединение разорвано', true);
  };

  ws.onerror = () => {
    addChat(null, 'Ошибка WebSocket', true);
  };
}

function sendWS(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ── CONTENT SCRIPT BRIDGE ────────────────────────────────────────────────────
function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
  });
}

// Listen from content script (player events)
chrome.runtime.onMessage.addListener((msg) => {
  if (!ws || !myCode) return;

  if (ignoreNext && (msg.type === 'play' || msg.type === 'pause' || msg.type === 'seek')) {
    ignoreNext = false;
    return;
  }

  if (msg.type === 'play' || msg.type === 'pause' || msg.type === 'seek') {
    sendWS({ ...msg });
  }

  if (msg.type === 'playerFound') {
    $('player-dot').classList.add('found');
    $('player-text').textContent = `Найден: ${msg.site}`;
  }

  if (msg.type === 'playerLost') {
    $('player-dot').classList.remove('found');
    $('player-text').textContent = 'Плеер не найден';
  }

  if (msg.type === 'pingReply') {
    sendWS({ type: 'ping', time: msg.time });
  }
});

// ── ACTIONS ──────────────────────────────────────────────────────────────────
$('btn-join').onclick = async () => {
  const code = $('inp-code').value.trim().toUpperCase();
  const name = $('inp-name').value.trim();
  $('join-error').textContent = '';
  if (!code || code.length !== 6) { $('join-error').textContent = 'Введи 6-значный код'; return; }
  if (!name) { $('join-error').textContent = 'Введи ник'; return; }

  // verify room exists
  try {
    const r = await fetch(`${API_URL}/api/rooms/${code}`);
    if (!r.ok) { $('join-error').textContent = 'Комната не найдена'; return; }
  } catch {
    $('join-error').textContent = 'Сервер недоступен';
    return;
  }

  myCode = code; myName = name;
  save({ room: code, name });
  showRoom(code);
  connect(code, name);
  startPingLoop();
};

$('btn-create').onclick = async () => {
  const name = $('inp-host-name').value.trim();
  if (!name) return;

  // Ask user to create room on site first, or create via API if token stored
  const { ratedToken } = await load(['ratedToken']);
  let code;

  if (ratedToken) {
    try {
      const r = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ratedToken}` },
        body: JSON.stringify({ title: '' })
      });
      const data = await r.json();
      code = data.code;
    } catch { code = null; }
  }

  if (!code) {
    // Generate local code if no token — still works via WS
    code = Math.random().toString(36).slice(2,8).toUpperCase();
  }

  myCode = code; myName = name;
  save({ room: code, name });
  showRoom(code);
  connect(code, name);
  startPingLoop();
};

$('btn-leave').onclick = () => {
  if (ws) { ws.close(); ws = null; }
  myCode = null; myName = null;
  save({ room: null, name: null });
  showSetup();
  sendToContent({ type: 'leave' });
};

$('btn-copy').onclick = () => {
  const inviteUrl = `https://${RATED_HOST}?join=${myCode}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    const btn = $('btn-copy');
    btn.textContent = 'Скопировано';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Копировать'; btn.classList.remove('copied'); }, 2000);
  });
};

$('btn-send').onclick = sendChat;
$('chat-inp').onkeydown = e => { if (e.key === 'Enter') sendChat(); };

function sendChat() {
  const text = $('chat-inp').value.trim();
  if (!text || !ws) return;
  sendWS({ type: 'chat', text });
  addChat(myName, text);
  $('chat-inp').value = '';
}

// ── PING LOOP (drift correction every 5s) ────────────────────────────────────
let pingInterval = null;
function startPingLoop() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    sendToContent({ type: 'requestTime' });
  }, 5000);
}

// ── PLAYER STATUS POLL ───────────────────────────────────────────────────────
setInterval(() => {
  if (!myCode) return;
  sendToContent({ type: 'checkPlayer' });
}, 3000);

// ── INIT ─────────────────────────────────────────────────────────────────────
function fmtTime(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2,'0')}`;
}

(async () => {
  const { room, name } = await load(['room', 'name']);
  if (room && name) {
    myCode = room; myName = name;
    showRoom(room);
    connect(room, name);
    startPingLoop();
  }
})();
