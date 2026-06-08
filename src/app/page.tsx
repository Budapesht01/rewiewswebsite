'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TitleCard from '@/components/ui/TitleCard'
import { ExternalTitle } from '@/lib/external-api'

interface PopularData {
  movies: ExternalTitle[]
  series: ExternalTitle[]
  games: ExternalTitle[]
}

function Section({ title, items, href }: { title: string; items: ExternalTitle[]; href: string }) {
  return (
    <section style={{ marginBottom: '4rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '0.06em' }}>{title}</h2>
        <Link href={href} style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
          ВСЕ →
        </Link>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '1.25rem',
      }}>
        {items.slice(0, 10).map((item, i) => (
          <TitleCard
            key={item.externalId}
            item={item}
            style={{ animationDelay: `${i * 0.05}s`, opacity: 0, animation: 'fadeUp 0.5s ease forwards' }}
          />
        ))}
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.25rem', marginBottom: '4rem' }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 6, overflow: 'hidden' }}>
          <div className="skeleton" style={{ paddingBottom: '150%' }} />
          <div style={{ padding: '10px 12px 12px', background: 'var(--surface)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 13, marginBottom: 6, borderRadius: 2 }} />
            <div className="skeleton" style={{ height: 11, width: '60%', borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const [data, setData] = useState<PopularData | null>(null)

  useEffect(() => {
    fetch('/api/popular')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
  }, [])

  return (
    <div style={{ paddingTop: 80 }}>
      {/* Hero */}
      <div style={{
        padding: '5rem 1.5rem 4rem',
        maxWidth: 1280, margin: '0 auto',
        borderBottom: '1px solid var(--border)',
        marginBottom: '4rem',
      }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>
            МАТЕМАТИЧЕСКАЯ СИСТЕМА ОЦЕНКИ
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(56px, 8vw, 96px)', lineHeight: 0.95, letterSpacing: '0.02em', marginBottom: '1.5rem' }}>
            RATE<br />FLOW
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 420, lineHeight: 1.6 }}>
            Объективная оценка фильмов, сериалов и игр по 10 критериям с математическими множителями. Максимум — 110 баллов.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        {data ? (
          <>
            <Section title="ФИЛЬМЫ" items={data.movies} href="/catalog?type=movie" />
            <Section title="СЕРИАЛЫ" items={data.series} href="/catalog?type=series" />
            <Section title="ИГРЫ" items={data.games} href="/catalog?type=game" />
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>ФИЛЬМЫ</div>
            <Skeleton />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>СЕРИАЛЫ</div>
            <Skeleton />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '0.06em', marginBottom: '1.5rem' }}>ИГРЫ</div>
            <Skeleton />
          </>
        )}
      </div>
    </div>
  )
}
