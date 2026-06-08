// TMDB API - movies & series
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export const TMDB_HEADERS = {
  Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
  'Content-Type': 'application/json',
}

// RAWG API - games
const RAWG_BASE = 'https://api.rawg.io/api'

// ─── TMDB ──────────────────────────────────────────────────────────────────

export function tmdbImage(path: string | null, size: 'w300' | 'w500' | 'w780' | 'original' = 'w500') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export async function tmdbSearch(query: string, type: 'movie' | 'tv') {
  const res = await fetch(
    `${TMDB_BASE}/search/${type}?query=${encodeURIComponent(query)}&language=ru-RU&page=1`,
    { headers: TMDB_HEADERS }
  )
  const data = await res.json()
  return data.results ?? []
}

export async function tmdbGetMovie(id: number) {
  const res = await fetch(
    `${TMDB_BASE}/movie/${id}?language=ru-RU&append_to_response=credits`,
    { headers: TMDB_HEADERS }
  )
  return res.json()
}

export async function tmdbGetSeries(id: number) {
  const res = await fetch(
    `${TMDB_BASE}/tv/${id}?language=ru-RU&append_to_response=credits`,
    { headers: TMDB_HEADERS }
  )
  return res.json()
}

export async function tmdbTrending(type: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week') {
  const res = await fetch(
    `${TMDB_BASE}/trending/${type}/${timeWindow}?language=ru-RU`,
    { headers: TMDB_HEADERS }
  )
  const data = await res.json()
  return data.results ?? []
}

export async function tmdbPopular(type: 'movie' | 'tv') {
  const res = await fetch(
    `${TMDB_BASE}/${type}/popular?language=ru-RU&page=1`,
    { headers: TMDB_HEADERS }
  )
  const data = await res.json()
  return data.results ?? []
}

// ─── RAWG ───────────────────────────────────────────────────────────────────

export async function rawgSearch(query: string) {
  const res = await fetch(
    `${RAWG_BASE}/games?search=${encodeURIComponent(query)}&key=${process.env.RAWG_API_KEY}&page_size=10`
  )
  const data = await res.json()
  return data.results ?? []
}

export async function rawgGetGame(id: number | string) {
  const res = await fetch(
    `${RAWG_BASE}/games/${id}?key=${process.env.RAWG_API_KEY}`
  )
  return res.json()
}

export async function rawgPopular() {
  const res = await fetch(
    `${RAWG_BASE}/games?key=${process.env.RAWG_API_KEY}&ordering=-rating&page_size=20&metacritic=80,100`
  )
  const data = await res.json()
  return data.results ?? []
}

// ─── Normalize to unified format ────────────────────────────────────────────

export interface ExternalTitle {
  externalId: string
  externalSource: 'tmdb_movie' | 'tmdb_tv' | 'rawg'
  title: string
  originalTitle?: string
  type: 'movie' | 'series' | 'game'
  year: number
  genre: string[]
  description: string
  coverImage: string | null
  backdropImage: string | null
  rating?: number
  runtime?: number
  seasons?: number
}

export function normalizeTmdbMovie(m: Record<string, unknown>): ExternalTitle {
  return {
    externalId: String(m.id),
    externalSource: 'tmdb_movie',
    type: 'movie',
    title: (m.title as string) || (m.original_title as string) || '',
    originalTitle: m.original_title as string,
    year: m.release_date ? parseInt(String(m.release_date).slice(0, 4)) : 0,
    genre: ((m.genres as Array<{name: string}>) || []).map(g => g.name),
    description: (m.overview as string) || '',
    coverImage: tmdbImage(m.poster_path as string | null),
    backdropImage: tmdbImage(m.backdrop_path as string | null, 'w780'),
    rating: m.vote_average as number,
    runtime: m.runtime as number,
  }
}

export function normalizeTmdbSeries(s: Record<string, unknown>): ExternalTitle {
  return {
    externalId: String(s.id),
    externalSource: 'tmdb_tv',
    type: 'series',
    title: (s.name as string) || (s.original_name as string) || '',
    originalTitle: s.original_name as string,
    year: s.first_air_date ? parseInt(String(s.first_air_date).slice(0, 4)) : 0,
    genre: ((s.genres as Array<{name: string}>) || []).map(g => g.name),
    description: (s.overview as string) || '',
    coverImage: tmdbImage(s.poster_path as string | null),
    backdropImage: tmdbImage(s.backdrop_path as string | null, 'w780'),
    rating: s.vote_average as number,
    seasons: s.number_of_seasons as number,
  }
}

export function normalizeRawgGame(g: Record<string, unknown>): ExternalTitle {
  return {
    externalId: String(g.id),
    externalSource: 'rawg',
    type: 'game',
    title: g.name as string || '',
    year: g.released ? parseInt(String(g.released).slice(0, 4)) : 0,
    genre: ((g.genres as Array<{name: string}>) || []).map(g => g.name),
    description: (g.description_raw as string) || (g.description as string) || '',
    coverImage: (g.background_image as string) || null,
    backdropImage: (g.background_image_additional as string) || (g.background_image as string) || null,
    rating: g.rating as number,
  }
}
