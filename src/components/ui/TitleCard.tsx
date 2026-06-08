'use client'

import Link from 'next/link'
import { ExternalTitle } from '@/lib/external-api'
import { MAX_SCORE } from '@/lib/criteria'

interface Props {
  item: ExternalTitle
  ourScore?: number | null
  style?: React.CSSProperties
}

const TYPE_LABEL: Record<string, string> = {
  movie: 'ФИЛЬМ',
  series: 'СЕРИАЛ',
  game: 'ИГРА',
}

export default function TitleCard({ item, ourScore, style }: Props) {
  const href = `/title/${item.externalSource}/${item.externalId}`
  const scorePct = ourScore ? (ourScore / MAX_SCORE) * 100 : null

  return (
    <Link href={href} style={{ display: 'block', ...style }}>
      <div
        className="hover-lift glass"
        style={{ borderRadius: 6, overflow: 'hidden', cursor: 'pointer' }}
      >
        {/* Cover */}
        <div style={{ position: 'relative', paddingBottom: '150%', background: 'var(--surface2)' }}>
          {item.coverImage ? (
            <img
              src={item.coverImage}
              alt={item.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--muted)', fontSize: 11,
              letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
            }}>
              NO IMAGE
            </div>
          )}
          {/* Type badge */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(10,10,10,0.85)',
            border: '1px solid var(--border)',
            padding: '2px 6px', borderRadius: 2,
            fontSize: 9, letterSpacing: '0.12em',
            fontFamily: 'var(--font-mono)', color: 'var(--muted)',
          }}>
            {TYPE_LABEL[item.type] || item.type}
          </div>
          {/* Our score badge */}
          {ourScore && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: 'var(--text)', color: 'var(--bg)',
              padding: '3px 7px', borderRadius: 2,
              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500,
            }}>
              {ourScore.toFixed(1)}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '10px 12px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            {item.year > 0 ? item.year : '—'}
            {item.genre[0] ? ` · ${item.genre[0]}` : ''}
          </div>
          {/* Score bar */}
          {scorePct !== null && (
            <div style={{ marginTop: 8 }}>
              <div className="score-bar">
                <div className="score-bar-fill" style={{ width: `${scorePct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
