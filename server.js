require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const path = require('path');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.json());
// Serve static files — works both locally (public/) and on Render
const publicDir = require('fs').existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : __dirname;
app.use(express.static(publicDir));

// ─── DB CONNECTION ────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const criterionSchema = new mongoose.Schema({
  name: String,
  score: { type: Number, min: 0, max: 10 },
  multiplier: Number
});

const reviewSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username:  String,
  tmdbId:    Number,
  mediaType: { type: String, enum: ['movie', 'tv', 'game'] },
  criteria:  [criterionSchema],
  totalScore: Number,
  comment:   String,
  signatureData: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username:      { type: String, unique: true, trim: true },
  email:         { type: String, unique: true, lowercase: true },
  password:      String,
  avatar:        { type: Number, default: 0 },
  signatureData: { type: String, default: null },
  createdAt:     { type: Date, default: Date.now }
});

const User   = mongoose.model('User', userSchema);
const Review = mongoose.model('Review', reviewSchema);

// ─── ROOM SCHEMA ──────────────────────────────────────────────────────────────
const roomSchema = new mongoose.Schema({
  code:      { type: String, unique: true },        // 6-char invite code
  hostId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hostName:  String,
  title:     { type: String, default: '' },         // optional label
  createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL 24h
});
const Room = mongoose.model('Room', roomSchema);

// ─── ROOM HELPERS ─────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// In-memory state per room:
// rooms[code] = { clients: Map<ws, { username, isHost }>, state: { paused, time, updatedAt } }
const rooms = {};

function getRoom(code) {
  if (!rooms[code]) rooms[code] = { clients: new Map(), state: { paused: true, time: 0, updatedAt: Date.now() } };
  return rooms[code];
}

function broadcast(code, payload, excludeWs = null) {
  const room = rooms[code];
  if (!room) return;
  const msg = JSON.stringify(payload);
  room.clients.forEach((info, ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

function broadcastMembers(code) {
  const room = rooms[code];
  if (!room) return;
  const members = [...room.clients.values()].map(c => c.username);
  room.clients.forEach((info, ws) => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'members', members }));
  });
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  let currentCode = null;
  let currentUser = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── JOIN ──────────────────────────────────────────────────────────────────
    if (msg.type === 'join') {
      const { code, username } = msg;
      if (!code || !username) return;
      currentCode = code.toUpperCase();
      currentUser = username;

      const room = getRoom(currentCode);
      const isHost = room.clients.size === 0;
      room.clients.set(ws, { username, isHost });

      ws.send(JSON.stringify({ type: 'sync', state: room.state, isHost }));
      broadcastMembers(currentCode);
      return;
    }

    if (!currentCode) return;
    const room = rooms[currentCode];
    if (!room) return;
    const me = room.clients.get(ws);
    if (!me) return;

    // ── PLAY / PAUSE ──────────────────────────────────────────────────────────
    if (msg.type === 'play' || msg.type === 'pause') {
      room.state.paused    = msg.type === 'pause';
      room.state.time      = msg.time ?? room.state.time;
      room.state.updatedAt = Date.now();
      broadcast(currentCode, { type: msg.type, time: room.state.time, from: currentUser }, ws);
      return;
    }

    // ── SEEK ──────────────────────────────────────────────────────────────────
    if (msg.type === 'seek') {
      room.state.time      = msg.time;
      room.state.updatedAt = Date.now();
      broadcast(currentCode, { type: 'seek', time: msg.time, from: currentUser }, ws);
      return;
    }

    // ── PING (drift correction) ───────────────────────────────────────────────
    if (msg.type === 'ping') {
      if (me.isHost) {
        room.state.time      = msg.time;
        room.state.updatedAt = Date.now();
      }
      ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now(), state: room.state }));
      return;
    }

    // ── CHAT ──────────────────────────────────────────────────────────────────
    if (msg.type === 'chat') {
      const text = String(msg.text || '').slice(0, 300);
      if (!text) return;
      broadcast(currentCode, { type: 'chat', from: currentUser, text }, null);
      return;
    }
  });

  ws.on('close', () => {
    if (!currentCode || !rooms[currentCode]) return;
    rooms[currentCode].clients.delete(ws);
    if (rooms[currentCode].clients.size === 0) {
      delete rooms[currentCode];
    } else {
      broadcastMembers(currentCode);
    }
  });
});

// ─── SCORING CRITERIA ─────────────────────────────────────────────────────────

const CRITERIA = {
  movie: [
    { name: 'Сценарий, Главный сюжет и Логика',                  multiplier: 1.3 },
    { name: 'Развитие персонажей и Актёрская игра',              multiplier: 1.3 },
    { name: 'Атмосфера, Вайб и Мироустройство',                  multiplier: 1.2 },
    { name: 'Масштаб съёмок и Постановка (Production Value)',    multiplier: 1.1 },
    { name: 'Режиссура, Операторская работа и Монтаж',           multiplier: 1.1 },
    { name: 'Саундтрек и Звук',                                  multiplier: 1.0 },
    { name: 'Темп, Плотность и Зрительский захват',              multiplier: 1.0 },
    { name: 'Кастинг и Второстепенные линии',                    multiplier: 1.0 },
    { name: 'Цельность и Качество финала',                       multiplier: 1.0 },
    { name: 'Культурный феномен и Влияние',                      multiplier: 1.0 },
    { name: 'Общее впечатление',                                 multiplier: 0, independent: true }
  ],
  tv: [
    { name: 'Сценарий, Главный сюжет и Логика',                  multiplier: 1.3 },
    { name: 'Развитие персонажей и Актёрская игра',              multiplier: 1.3 },
    { name: 'Атмосфера, Вайб и Мироустройство / Концепт',        multiplier: 1.2 },
    { name: 'Масштаб съёмок и Постановка (Production Value)',    multiplier: 1.1 },
    { name: 'Режиссура, Операторская работа и Монтаж',           multiplier: 1.1 },
    { name: 'Саундтрек и Звук',                                  multiplier: 1.0 },
    { name: 'Темп, Плотность и Бинж-фактор',                     multiplier: 1.0 },
    { name: 'Кастинг и Второстепенные линии',                    multiplier: 1.0 },
    { name: 'Цельность сезонов и Качество финала',               multiplier: 1.0 },
    { name: 'Культурный феномен и Влияние',                      multiplier: 1.0 },
    { name: 'Общее впечатление',                                 multiplier: 0, independent: true }
  ],
  game: [
    { name: 'Геймплей, Механики и Боевая система',               multiplier: 1.3 },
    { name: 'Сюжет, Нарратив и Сценарная структура',             multiplier: 1.3 },
    { name: 'Техническое исполнение и Визуальные детали',        multiplier: 1.1 },
    { name: 'Левелдизайн и Мироустройство / Лор',                multiplier: 1.2 },
    { name: 'Режиссура, Подача и Постановка кат-сцен',           multiplier: 1.1 },
    { name: 'Саундтрек и Звуковой дизайн',                       multiplier: 1.0 },
    { name: 'Арт-дизайн и Стилистика',                           multiplier: 1.0 },
    { name: 'Игровой темп и Плотность контента',                 multiplier: 1.0 },
    { name: 'Цельность проекта и Качество финала',               multiplier: 1.0 },
    { name: 'Влияние на индустрию и Наследие',                   multiplier: 1.0 },
    { name: 'Общее впечатление',                                 multiplier: 0, independent: true }
  ]
};

function calcTotal(criteria) {
  // sum of (score * multiplier) / sum of multipliers * 10 → scaled to 110 max
  const raw = criteria.reduce((s, c) => s + c.score * c.multiplier, 0);
  const maxRaw = criteria.reduce((s, c) => s + 10 * c.multiplier, 0);
  return parseFloat(((raw / maxRaw) * 110).toFixed(2));
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, signatureData } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'Все поля обязательны' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Минимум 6 символов' });

    console.log('REGISTER BODY:', req.body);

const exists = await User.findOne({
  $or: [{ email }, { username }]
});

console.log('FOUND USER:', exists);

if (exists) {
  return res.status(400).json({
    error: 'Пользователь уже существует'
  });
}
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hash, signatureData: signatureData || null });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, username: user.username, avatar: user.avatar } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, username: user.username, avatar: user.avatar } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// Return only the signature hash (first 200 chars of base64) so client can compare
// Full signature returned for canvas comparison
app.get('/api/auth/signature', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('signatureData');
    if (!user || !user.signatureData) return res.json({ signatureData: null });
    res.json({ signatureData: user.signatureData });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TMDB PROXY ───────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_HEADERS = {
  Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
  'Content-Type': 'application/json'
};

async function tmdb(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TMDB_BASE}${path}${sep}language=ru-RU`;
  const r = await fetch(url, { headers: TMDB_HEADERS });
  return r.json();
}

// TMDB fetch without language override (needed for external_ids)
async function tmdbRaw(path) {
  const url = `${TMDB_BASE}${path}`;
  const r = await fetch(url, { headers: TMDB_HEADERS });
  return r.json();
}

// Trending / popular
app.get('/api/media/trending', async (req, res) => {
  try {
    const [movies, tv] = await Promise.all([
      tmdb('/trending/movie/week'),
      tmdb('/trending/tv/week')
    ]);
    res.json({
      movies: movies.results?.slice(0, 12) || [],
      tv:     tv.results?.slice(0, 12) || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Genre sections for home page
// genre IDs: 28=Action, 27=Horror, 35=Comedy, 18=Drama, 53=Thriller, 878=Sci-Fi, 16=Animation, 80=Crime
app.get('/api/media/genres/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const endpoint = type === 'tv' ? 'tv' : 'movie';

    const [newReleases, action, horror, drama, thriller, scifi, comedy, crime, animation] = await Promise.all([
      tmdb(`/discover/${endpoint}?sort_by=release_date.desc&vote_count.gte=100`),
      tmdb(`/discover/${endpoint}?with_genres=28&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=27&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=18&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=53&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=878&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=35&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=80&sort_by=popularity.desc`),
      tmdb(`/discover/${endpoint}?with_genres=16&sort_by=popularity.desc`)
    ]);

    res.json({
      newReleases: newReleases.results?.slice(0, 20) || [],
      action:      action.results?.slice(0, 20) || [],
      horror:      horror.results?.slice(0, 20) || [],
      drama:       drama.results?.slice(0, 20) || [],
      thriller:    thriller.results?.slice(0, 20) || [],
      scifi:       scifi.results?.slice(0, 20) || [],
      comedy:      comedy.results?.slice(0, 20) || [],
      crime:       crime.results?.slice(0, 20) || [],
      animation:   animation.results?.slice(0, 20) || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catalogue page — discover with filters
app.get('/api/media/catalogue/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    const { genre, year_from, year_to, sort = 'popularity.desc', page = 1 } = req.query;

    let qs = `sort_by=${sort}&page=${page}&vote_count.gte=50`;
    if (genre) qs += `&with_genres=${genre}`;
    if (year_from) qs += `&${endpoint === 'tv' ? 'first_air_date' : 'release_date'}.gte=${year_from}-01-01`;
    if (year_to)   qs += `&${endpoint === 'tv' ? 'first_air_date' : 'release_date'}.lte=${year_to}-12-31`;

    const data = await tmdb(`/discover/${endpoint}?${qs}`);
    res.json({ results: data.results || [], total_pages: data.total_pages || 1, page: data.page || 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// IMDb rating via TMDB external IDs + OMDB
app.get('/api/media/imdb/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    // Use tmdbRaw — external_ids doesn't need/support language param
    const extIds = await tmdbRaw(`/${type}/${id}/external_ids`);
    const imdbId = extIds.imdb_id;

    console.log(`[IMDb] type=${type} id=${id} imdbId=${imdbId} OMDB_KEY=${process.env.OMDB_KEY ? 'set' : 'MISSING'}`);

    if (!imdbId) return res.json({ imdbRating: null, reason: 'no_imdb_id' });
    if (!process.env.OMDB_KEY) return res.json({ imdbRating: null, reason: 'no_omdb_key' });

    const omdbUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.OMDB_KEY}`;
    const r = await fetch(omdbUrl);
    const d = await r.json();

    console.log(`[IMDb] OMDB response: Response=${d.Response} imdbRating=${d.imdbRating} Error=${d.Error}`);

    const rating = d.imdbRating && d.imdbRating !== 'N/A' ? parseFloat(d.imdbRating) : null;
    res.json({ imdbRating: rating, imdbId });
  } catch (e) {
    console.error('[IMDb] error:', e.message);
    res.json({ imdbRating: null, error: e.message });
  }
});

// Batch scores — GET /api/media/scores?ids=1,2,3&type=tv
// Per-criterion averages for two-title comparison (VU meters)
app.get('/api/media/:type/:id/criteria-avg', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type !== 'movie' && type !== 'tv' && type !== 'game')
      return res.status(400).json({ error: 'Invalid type' });

    const reviews = await Review.find({ tmdbId: Number(id), mediaType: type });
    const criteriaList = CRITERIA[type] || [];
    const criteria = criteriaList.map((c, i) => {
      const scores = reviews.map(r => r.criteria[i]?.score).filter(v => typeof v === 'number');
      const avg = scores.length
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2))
        : null;
      return { name: c.name, multiplier: c.multiplier, independent: !!c.independent, avg };
    });
    const avgTotal = reviews.length
      ? parseFloat((reviews.reduce((s, r) => s + r.totalScore, 0) / reviews.length).toFixed(2))
      : null;

    res.json({ criteria, avgTotal, count: reviews.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/media/scores', async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    const type = req.query.type || 'tv';
    if (!ids.length) return res.json({});
    const reviews = await Review.find({ tmdbId: { $in: ids }, mediaType: type });
    const map = {};
    ids.forEach(id => {
      const rr = reviews.filter(r => r.tmdbId === id);
      if (rr.length) {
        map[id] = parseFloat((rr.reduce((s,r) => s + r.totalScore, 0) / rr.length).toFixed(2));
      }
    });
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search
app.get('/api/media/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const data = await tmdb(`/search/multi?query=${encodeURIComponent(q)}`);
    const results = (data.results || [])
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 12);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detail
app.get('/api/media/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type !== 'movie' && type !== 'tv')
      return res.status(400).json({ error: 'Invalid type' });

    const [detail, credits] = await Promise.all([
      tmdb(`/${type}/${id}`),
      tmdb(`/${type}/${id}/credits`)
    ]);

    // aggregate our scores
    const reviews = await Review.find({ tmdbId: Number(id), mediaType: type });
    const avgScore = reviews.length
      ? parseFloat((reviews.reduce((s, r) => s + r.totalScore, 0) / reviews.length).toFixed(2))
      : null;

    res.json({ ...detail, credits, ourScore: avgScore, reviewCount: reviews.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stats for hero
app.get('/api/stats', async (req, res) => {
  try {
    const [reviews, users] = await Promise.all([
      Review.countDocuments(),
      User.countDocuments()
    ]);
    res.json({ reviews, users });
  } catch(e) {
    res.json({ reviews: 0, users: 0 });
  }
});

// ─── CRITERIA ROUTE ───────────────────────────────────────────────────────────

app.get('/api/criteria/:type', (req, res) => {
  const { type } = req.params;
  const c = CRITERIA[type] || CRITERIA.movie;
  res.json(c);
});

// ─── REVIEWS ──────────────────────────────────────────────────────────────────

app.post('/api/reviews', auth, async (req, res) => {
  try {
    const { tmdbId, mediaType, criteria, comment, signatureData } = req.body;

    const existing = await Review.findOne({ userId: req.user.id, tmdbId, mediaType });
    if (existing) return res.status(400).json({ error: 'Вы уже оценили это произведение' });

    const totalScore = calcTotal(criteria);
    const review = await Review.create({
      userId: req.user.id,
      username: req.user.username,
      tmdbId, mediaType, criteria, comment, totalScore,
      signatureData: signatureData || null
    });
    res.json(review);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/reviews/:id', auth, async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, userId: req.user.id });
    if (!review) return res.status(404).json({ error: 'Не найдено' });

    const { criteria, comment, signatureData } = req.body;
    review.criteria   = criteria;
    review.comment    = comment;
    review.totalScore = calcTotal(criteria);
    if (signatureData) review.signatureData = signatureData;
    await review.save();
    res.json(review);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/reviews/:id', auth, async (req, res) => {
  try {
    await Review.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reviews/:type/:id', async (req, res) => {
  try {
    const reviews = await Review.find({
      tmdbId: Number(req.params.id),
      mediaType: req.params.type
    }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// My reviews
app.get('/api/profile/reviews', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id }).sort({ createdAt: -1 });
    // enrich with TMDB data
    const enriched = await Promise.all(reviews.map(async r => {
      try {
        const data = await tmdb(`/${r.mediaType}/${r.tmdbId}`);
        return {
          ...r.toObject(),
          title:    data.title || data.name,
          poster:   data.poster_path,
          year:     (data.release_date || data.first_air_date || '').slice(0, 4)
        };
      } catch {
        return r.toObject();
      }
    }));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────
// Genre name map (TMDB ids → readable label)
const GENRE_NAMES = {
  28: 'Боевик', 12: 'Приключения', 16: 'Анимация', 35: 'Комедия',
  80: 'Криминал', 99: 'Документальное', 18: 'Драма', 10751: 'Семейное',
  14: 'Фэнтези', 36: 'История', 27: 'Ужасы', 10402: 'Музыка',
  9648: 'Детектив', 10749: 'Романтика', 878: 'Фантастика', 10770: 'ТВ-фильм',
  53: 'Триллер', 10752: 'Военное', 37: 'Вестерн',
  10759: 'Боевик и приключения', 10762: 'Детское', 10763: 'Новости',
  10764: 'Реалити', 10765: 'Фантастика и фэнтези', 10766: 'Мыльная опера',
  10767: 'Ток-шоу', 10768: 'Война и политика'
};

// Full archive — reviews enriched with poster, year, genres, director/creator
app.get('/api/profile/archive', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const enriched = await Promise.all(reviews.map(async r => {
      try {
        const [detail, credits] = await Promise.all([
          tmdb(`/${r.mediaType}/${r.tmdbId}`),
          tmdb(`/${r.mediaType}/${r.tmdbId}/credits`)
        ]);
        const director = r.mediaType === 'movie'
          ? credits.crew?.find(c => c.job === 'Director')?.name
          : (detail.created_by?.[0]?.name || credits.crew?.find(c => c.job === 'Executive Producer')?.name);
        return {
          _id:        r._id,
          tmdbId:     r.tmdbId,
          mediaType:  r.mediaType,
          totalScore: r.totalScore,
          comment:    r.comment,
          criteria:   r.criteria,
          createdAt:  r.createdAt,
          title:      detail.title || detail.name,
          poster:     detail.poster_path,
          backdrop:   detail.backdrop_path,
          year:       (detail.release_date || detail.first_air_date || '').slice(0, 4),
          genres:     (detail.genres || []).map(g => GENRE_NAMES[g.id] || g.name),
          genreIds:   (detail.genres || []).map(g => g.id),
          director:   director || null
        };
      } catch {
        return { ...r.toObject(), title: '???', year: '', genres: [], genreIds: [], director: null };
      }
    }));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public profile
app.get('/api/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password -email');
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const reviews = await Review.find({ userId: user._id }).sort({ createdAt: -1 });
    const enriched = await Promise.all(reviews.map(async r => {
      try {
        const data = await tmdb(`/${r.mediaType}/${r.tmdbId}`);
        return { ...r.toObject(), title: data.title || data.name, poster: data.poster_path };
      } catch { return r.toObject(); }
    }));
    res.json({ user, reviews: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ROOM REST API ────────────────────────────────────────────────────────────

// List rooms for the host
app.get('/api/rooms', auth, async (req, res) => {
  try {
    const list = await Room.find({ hostId: req.user.id }).sort({ createdAt: -1 });
    const enriched = list.map(r => ({
      code: r.code,
      title: r.title,
      members: rooms[r.code] ? rooms[r.code].clients.size : 0
    }));
    res.json(enriched);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Create room
app.post('/api/rooms', auth, async (req, res) => {
  try {
    let code, tries = 0;
    do { code = genCode(); tries++; } while (await Room.exists({ code }) && tries < 10);
    const room = await Room.create({ code, hostId: req.user.id, hostName: req.user.username, title: req.body.title || '' });
    res.json({ code: room.code });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get room info (public — used for join verification)
app.get('/api/rooms/:code', async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code.toUpperCase() });
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    res.json({ code: room.code, title: room.title, members: rooms[room.code]?.clients.size || 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete room
app.delete('/api/rooms/:code', auth, async (req, res) => {
  try {
    await Room.findOneAndDelete({ code: req.params.code.toUpperCase(), hostId: req.user.id });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
