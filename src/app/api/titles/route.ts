import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Title from '@/models/Title'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const type   = searchParams.get('type')
  const search = searchParams.get('search')
  const sort   = searchParams.get('sort') || 'createdAt'
  const page   = parseInt(searchParams.get('page') || '1')
  const limit  = 20

  const query: Record<string, unknown> = {}
  if (type && ['movie', 'series', 'game'].includes(type)) query.type = type
  if (search) query.$text = { $search: search }

  type SortOpt = { avgScore?: -1; year?: -1; createdAt?: -1 }
  const sortObj: SortOpt =
    sort === 'score' ? { avgScore: -1 } : sort === 'year' ? { year: -1 } : { createdAt: -1 }

  const [titles, total] = await Promise.all([
    Title.find(query).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
    Title.countDocuments(query),
  ])

  return NextResponse.json({ titles, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { title, originalTitle, type, year, genre, description, coverImage } = body

    if (!title || !type || !year) {
      return NextResponse.json({ error: 'Название, тип и год обязательны' }, { status: 400 })
    }

    await connectDB()
    const doc = await Title.create({
      title, originalTitle, type, year,
      genre: genre || [],
      description: description || '',
      coverImage,
      addedBy: session.user.id,
    })

    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
