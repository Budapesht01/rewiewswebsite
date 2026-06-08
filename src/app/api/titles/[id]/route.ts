import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Title from '@/models/Title'
import Review from '@/models/Review'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectDB()
  const title = await Title.findById(params.id).lean()
  if (!title) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reviews = await Review.find({ titleId: params.id })
    .populate('userId', 'username')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return NextResponse.json({ title, reviews })
}
