'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MAX_SCORE } from '@/lib/criteria'

interface ReviewItem {
  _id: string
  externalId: string
  externalSource: string
  type: string
  totalScore: number
  comment?: string
  createdAt: string
}

interface ProfileData {
  user: { _id: string; username: string; email: string; createdAt: string }
  reviews: ReviewItem[]
}

const SOURCE_LABEL: Record<string, string> = {
  tmdb_movie: 'Фильм',
  tmdb_tv: 'Сериал',
  rawg: 'Игра',
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch(`/api/users/${session.user.id}`)
      .then(r => r.json())
      .then(setData)
  }, [session])

  if (!data) {
    return (
      <div style={{ paddingTop: 100, maxWidth: 800, margin: '0 auto', padding: '100px 1.5rem' }}>
        <div className="skeleton" style={{ height: 32, width: 200, borderRadius: 4, marginBottom: 40 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 6, marginBottom: 12 }} />
        ))}
      </div>
    )
  }

  const { user, reviews } = data
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.totalScore, 0) / reviews.length : null

  return (
    <div style={{ paddingTop: 80, maxWidth: 900, margin: '0 auto', padding: '4rem 1.5rem' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem', marginBottom: '3rem' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
          ПРОФИЛЬ
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, letterSpacing: '0.04em', marginBottom: '1rem' }}>
          {user.username}
        </h1>
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>ОЦЕНОК</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>{reviews.length}</div>
          </div>
          {avg && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>СР. ОЦЕНКА</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>{avg.toFixed(1)}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>НА САЙТЕ С</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>{new Date(user.createdAt).getFullYear()}</div>
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        МОИ ОЦЕНКИ
      </h2>

      {reviews.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>
          Вы ещё не оценили ни одного произведения.{' '}
          <Link href="/" style={{ textDecoration: 'underline' }}>На главную →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reviews.map(r => {
            const pct = (r.totalScore / MAX_SCORE) * 100
            return (
              <Link
                key={r._id}
                href={`/title/${r.externalSource}/${r.externalId}`}
                style={{ display: 'block' }}
              >
                <div className="glass hover-lift" style={{ borderRadius: 6, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 4 }}>
                      {SOURCE_LABEL[r.externalSource] || r.type} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                    <div style={{ fontSize: 13 }}>{r.externalSource}/{r.externalId}</div>
                    {r.comment && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 400 }}>
                        {r.comment}
                      </div>
                    )}
                    <div className="score-bar" style={{ marginTop: 8, maxWidth: 200 }}>
                      <div className="score-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, flexShrink: 0 }}>
                    {r.totalScore.toFixed(1)}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
