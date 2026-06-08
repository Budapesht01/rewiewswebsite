import { NextRequest, NextResponse } from 'next/server'
import {
  tmdbSearch, rawgSearch,
  normalizeTmdbMovie, normalizeTmdbSeries, normalizeRawgGame,
  ExternalTitle,
} from '@/lib/external-api'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()
  const type  = searchParams.get('type') // movie | series | game | all

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results: ExternalTitle[] = []

    if (!type || type === 'movie' || type === 'all') {
      const movies = await tmdbSearch(query, 'movie')
      results.push(...movies.slice(0, 5).map(normalizeTmdbMovie))
    }

    if (!type || type === 'series' || type === 'all') {
      const series = await tmdbSearch(query, 'tv')
      results.push(...series.slice(0, 5).map(normalizeTmdbSeries))
    }

    if (!type || type === 'game' || type === 'all') {
      const games = await rawgSearch(query)
      results.push(...games.slice(0, 5).map(normalizeRawgGame))
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
