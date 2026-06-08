'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ExternalTitle } from '@/lib/external-api'
import { getCriteria, calculateScore, MAX_SCORE } from '@/lib/criteria'
import { ContentType } from '@/types'

interface Review {
  _id: string
  userId: { _id: string; username: string } | string
  totalScore: number
  criteria: Record<string, number>
  comment?: string
  createdAt: string
}

interface TitleData {
  title: ExternalTitle
  reviews: Review[]
  avgScore: number | null
  reviewsCount: number
}

function ScoreDisplay({ score, max = MAX_SCORE }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, lineHeight: 1 }}>{score.toFixed(1)}</span>
        <span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>/ {max}</span>
      </div>
      <div className="score-bar" style={{ width: 160 }}>
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CriterionSlider({
  label, value, onChange
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.3 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, minWidth: 20, textAlign: 'right' }}>{value}</span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>1</span>
        <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>10</span>
      </div>
    </div>
  )
}

export default function TitlePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const source = params.source as string
  const id = params.id as string

  const [data, setData] = useState<TitleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  const type: ContentType = source === 'rawg' ? 'game' : source === 'tmdb_movie' ? 'movie' : 'series'
  const criteria = getCriteria(type)

  const defaultCriteria = () =>
    Object.fromEntries(criteria.map(c => [c.key, 5]))

  const [criteriaValues, setCriteriaValues] = useState<Record<string, number>>(defaultCriteria())
  const [comment, setComment] = useState('')

  const liveScore = calculateScore(criteriaValues, type)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/external/${source}/${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [source, id])

  // pre-fill if user already rated
  useEffect(() => {
    if (!data || !session) return
    const myReview = data.reviews.find(r =>
      typeof r.userId !== 'string'
        ? r.userId._id === session.user.id
        : r.userId === session.user.id
    )
    if (myReview) {
      setCriteriaValues(myReview.criteria)
      setComment(myReview.comment || '')
    }
  }, [data, session])

  const handleSubmit = async () => {
    if (!session) { router.push('/auth'); return }
    setSubmitting(true)
    setSubmitMsg('')
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: id, externalSource: source, type, criteria: criteriaValues, comment }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (res.ok) {
      setSubmitMsg(json.updated ? 'Оценка обновлена!' : 'Оценка сохранена!')
      // refresh data
      const d = await fetch(`/api/external/${source}/${id}`).then(r => r.json())
      setData(d)
      setRatingOpen(false)
    } else {
      setSubmitMsg(json.error || 'Ошибка')
    }
  }

  if (loading) {
    return (
      <div style={{ paddingTop: 80, maxWidth: 1280, margin: '0 auto', padding: '100px 1.5rem' }}>
        <div className="skeleton" style={{ height: 40, width: 300, borderRadius: 4, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 20, width: 200, borderRadius: 4, marginBottom: 32 }} />
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div className="skeleton" style={{ width: 240, height: 360, borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 10, borderRadius: 3 }} />
            <div className="skeleton" style={{ height: 16, marginBottom: 10, borderRadius: 3 }} />
            <div className="skeleton" style={{ height: 16, width: '70%', borderRadius: 3 }} />
          </div>
        </div>
      </div>
    )
  }

  if (!data?.title) {
    return (
      <div style={{ paddingTop: 100, textAlign: 'center', color: 'var(--muted)' }}>
        Не найдено. <Link href="/" style={{ textDecoration: 'underline' }}>На главную</Link>
      </div>
    )
  }

  const { title, reviews, avgScore, reviewsCount } = data

  return (
    <div style={{ paddingTop: 60 }}>
      {/* Backdrop */}
      {title.backdropImage && (
        <div style={{ position: 'relative', height: 320, overflow: 'hidden' }}>
          <img src={title.backdropImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.25)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, var(--bg))' }} />
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem 4rem', marginTop: title.backdropImage ? -120 : 0 }}>
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Poster */}
          {title.coverImage && (
            <div style={{ flexShrink: 0, width: 200, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={title.coverImage} alt={title.title} style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
              {type === 'game' ? 'ИГРА' : type === 'movie' ? 'ФИЛЬМ' : 'СЕРИАЛ'}
              {title.year > 0 ? ` · ${title.year}` : ''}
              {title.genre.length > 0 ? ` · ${title.genre.slice(0, 3).join(', ')}` : ''}
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 52px)', lineHeight: 0.95, letterSpacing: '0.02em', marginBottom: '1.25rem' }}>
              {title.title}
            </h1>

            {title.originalTitle && title.originalTitle !== title.title && (
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{title.originalTitle}</div>
            )}

            {title.description && (
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 560, marginBottom: '1.5rem' }}>
                {title.description.slice(0, 400)}{title.description.length > 400 ? '...' : ''}
              </p>
            )}

            {/* Score block */}
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {avgScore ? (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                    ОЦЕНКА RATEFLOW · {reviewsCount} {reviewsCount === 1 ? 'ОТЗЫВ' : 'ОТЗЫВОВ'}
                  </div>
                  <ScoreDisplay score={avgScore} />
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Оценок пока нет</div>
              )}
            </div>

            {/* Rate button */}
            <button
              onClick={() => { if (!session) { router.push('/auth'); return; } setRatingOpen(v => !v) }}
              style={{
                background: ratingOpen ? 'transparent' : 'var(--text)',
                color: ratingOpen ? 'var(--text)' : 'var(--bg)',
                border: '1px solid var(--border2)',
                padding: '10px 24px', borderRadius: 4,
                fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {ratingOpen ? 'ЗАКРЫТЬ' : 'ОЦЕНИТЬ'}
            </button>
          </div>
        </div>

        {/* Rating form */}
        {ratingOpen && (
          <div style={{ marginTop: '3rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280, maxWidth: 600 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
                ВЫСТАВИТЬ ОЦЕНКУ
              </h3>
              {criteria.map(c => (
                <CriterionSlider
                  key={c.key}
                  label={`${c.label} ×${c.multiplier}`}
                  value={criteriaValues[c.key] ?? 5}
                  onChange={v => setCriteriaValues(prev => ({ ...prev, [c.key]: v }))}
                />
              ))}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>КОММЕНТАРИЙ (НЕОБЯЗАТЕЛЬНО)</div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Ваши впечатления..."
                  rows={4}
                  style={{
                    width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '10px 12px', color: 'var(--text)',
                    fontSize: 13, fontFamily: 'var(--font-body)', resize: 'vertical', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border2)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            {/* Live score */}
            <div style={{ minWidth: 200 }}>
              <div style={{ position: 'sticky', top: 80, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '1.5rem' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>ВАШ СЧЁТ</div>
                <ScoreDisplay score={liveScore} />
                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      width: '100%', background: 'var(--text)', color: 'var(--bg)',
                      border: 'none', padding: '10px', borderRadius: 4,
                      fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontWeight: 500,
                      opacity: submitting ? 0.6 : 1, transition: 'opacity 0.2s',
                    }}
                  >
                    {submitting ? '...' : 'СОХРАНИТЬ'}
                  </button>
                  {submitMsg && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{submitMsg}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div style={{ marginTop: '4rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
              ОЦЕНКИ · {reviewsCount}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reviews.map(r => (
                <div key={r._id} className="glass" style={{ borderRadius: 6, padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {typeof r.userId === 'object' ? r.userId.username : 'Аноним'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 10, fontFamily: 'var(--font-mono)' }}>
                        {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.04em' }}>
                      {r.totalScore.toFixed(1)}
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>/ {MAX_SCORE}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 16px' }}>
                    {criteria.map(c => (
                      <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '80%' }}>{c.label.split(',')[0]}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{r.criteria[c.key] ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                  {r.comment && (
                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      {r.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
