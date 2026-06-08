import { NextRequest, NextResponse } from 'next/server'
import {
  tmdbTrending, rawgPopular,
  normalizeTmdbMovie, normalizeTmdbSeries, normalizeRawgGame,
} from '@/lib/external-api'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // movie | series | game | all

  try {
    if (type === 'movie') {
      const data = await tmdbTrending('movie', 'week')
      return NextResponse.json({ results: data.slice(0, 20).map(normalizeTmdbMovie) })
    }

    if (type === 'series') {
      const data = await tmdbTrending('tv', 'week')
      return NextResponse.json({ results: data.slice(0, 20).map(normalizeTmdbSeries) })
    }

    if (type === 'game') {
      const data = await rawgPopular()
      return NextResponse.json({ results: data.slice(0, 20).map(normalizeRawgGame) })
    }

    // all — default homepage
    const [movies, series, games] = await Promise.all([
      tmdbTrending('movie', 'week'),
      tmdbTrending('tv', 'week'),
      rawgPopular(),
    ])

    return NextResponse.json({
      movies:  movies.slice(0, 10).map(normalizeTmdbMovie),
      series:  series.slice(0, 10).map(normalizeTmdbSeries),
      games:   games.slice(0, 10).map(normalizeRawgGame),
    })
  } catch (err) {
    console.error('Popular fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
