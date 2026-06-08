import { NextRequest, NextResponse } from 'next/server'
import {
  tmdbGetMovie, tmdbGetSeries, rawgGetGame,
  normalizeTmdbMovie, normalizeTmdbSeries, normalizeRawgGame,
} from '@/lib/external-api'
import { connectDB } from '@/lib/db'
import Review from '@/models/Review'

// GET /api/external/[source]/[id]
// source: tmdb_movie | tmdb_tv | rawg
export async function GET(
  _req: NextRequest,
  { params }: { params: { source: string; id: string } }
) {
  const { source, id } = params

  try {
    let title = null

    if (source === 'tmdb_movie') {
      const raw = await tmdbGetMovie(parseInt(id))
      if (raw.success === false) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      title = normalizeTmdbMovie(raw)
    } else if (source === 'tmdb_tv') {
      const raw = await tmdbGetSeries(parseInt(id))
      if (raw.success === false) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      title = normalizeTmdbSeries(raw)
    } else if (source === 'rawg') {
      const raw = await rawgGetGame(id)
      if (raw.detail === 'Not found.') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      title = normalizeRawgGame(raw)
    } else {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    }

    // fetch reviews from our DB for this external title
    await connectDB()
    const reviews = await Review.find({
      externalSource: source,
      externalId: id,
    })
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    // compute avg score from our reviews
    const avgScore = reviews.length
      ? reviews.reduce((sum, r) => sum + r.totalScore, 0) / reviews.length
      : null

    return NextResponse.json({ title, reviews, avgScore, reviewsCount: reviews.length })
  } catch (err) {
    console.error('External title error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
