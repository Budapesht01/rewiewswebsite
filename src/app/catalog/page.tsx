'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import TitleCard from '@/components/ui/TitleCard'
import { ExternalTitle } from '@/lib/external-api'

const TABS = [
  { key: 'movie',  label: 'ФИЛЬМЫ' },
  { key: 'series', label: 'СЕРИАЛЫ' },
  { key: 'game',   label: 'ИГРЫ' },
]

export default function CatalogPage() {
  const searchParams = useSearchParams()
  const initialType = searchParams.get('type') || 'movie'
  const [activeType, setActiveType] = useState(initialType)
  const [items, setItems] = useState<ExternalTitle[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setItems([])
    fetch(`/api/popular?type=${activeType}`)
      .then(r => r.json())
      .then(d => { setItems(d.results || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [activeType])

  return (
    <div style={{ paddingTop: 80, maxWidth: 1280, margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, letterSpacing: '0.04em', marginBottom: '2rem' }}>
        КАТАЛОГ
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '2.5rem' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none',
              color: activeType === t.key ? 'var(--text)' : 'var(--muted)',
              fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              borderBottom: activeType === t.key ? '1px solid var(--text)' : '1px solid transparent',
              marginBottom: -1, transition: 'color 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.25rem' }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ paddingBottom: '150%', borderRadius: 4 }} />
              <div style={{ padding: '10px 0' }}>
                <div className="skeleton" style={{ height: 12, marginBottom: 6, borderRadius: 2 }} />
                <div className="skeleton" style={{ height: 10, width: '50%', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.25rem' }}>
          {items.map((item, i) => (
            <TitleCard
              key={item.externalId}
              item={item}
              style={{ animationDelay: `${i * 0.03}s`, opacity: 0, animation: 'fadeUp 0.5s ease forwards' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
