import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json()

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль минимум 6 символов' }, { status: 400 })
    }

    await connectDB()

    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    })
    if (exists) {
      return NextResponse.json({ error: 'Email или username уже занят' }, { status: 409 })
    }

    const user = new User({ username, email, passwordHash: password })
    await user.save()

    return NextResponse.json({ ok: true, username: user.username }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
