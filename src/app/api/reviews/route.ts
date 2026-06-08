import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Review from '@/models/Review'
import { calculateScore } from '@/lib/criteria'
import { ContentType } from '@/types'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { externalId, externalSource, type, criteria, comment } = body

    if (!externalId || !externalSource || !type || !criteria) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // validate criteria values (1-10)
    for (const [key, val] of Object.entries(criteria)) {
      const v = Number(val)
      if (isNaN(v) || v < 1 || v > 10) {
        return NextResponse.json(
          { error: `Критерий "${key}" должен быть от 1 до 10` },
          { status: 400 }
        )
      }
    }

    const totalScore = calculateScore(criteria as Record<string, number>, type as ContentType)

    await connectDB()

    const existing = await Review.findOne({
      userId: session.user.id,
      externalId,
      externalSource,
    })

    if (existing) {
      // update
      existing.criteria = criteria
      existing.totalScore = totalScore
      existing.comment = comment || ''
      await existing.save()
      return NextResponse.json({ review: existing, updated: true })
    }

    const review = await Review.create({
      userId: session.user.id,
      externalId,
      externalSource,
      type,
      criteria,
      totalScore,
      comment: comment || '',
    })

    return NextResponse.json({ review, updated: false }, { status: 201 })
  } catch (err) {
    console.error('Review error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
