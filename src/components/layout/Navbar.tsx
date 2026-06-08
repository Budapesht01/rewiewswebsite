'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalTitle } from '@/lib/external-api'

export default function Navbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ExternalTitle[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = (val: string) => {
    setQuery(val)
    clearTimeout(timerRef.current)
    if (val.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}&type=all`)
      const data = await res.json()
      setResults(data.results || [])
      setOpen(true)
      setLoading(false)
    }, 350)
  }

  const goToTitle = (item: ExternalTitle) => {
    setOpen(false)
    setQuery('')
    router.push(`/title/${item.externalSource}/${item.externalId}`)
  }

  const typeLabel = (t: string) => {
    if (t === 'movie') return 'ФИЛЬМ'
    if (t === 'series') return 'СЕРИАЛ'
    return 'ИГРА'
  }

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', gap: '2rem' }}>
        {/* Logo */}
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.1em', flexShrink: 0 }}>
          RATEFLOW
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: 12, letterSpacing: '0.1em', color: 'var(--muted)' }}>
          <Link href="/catalog?type=movie" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>ФИЛЬМЫ</Link>
          <Link href="/catalog?type=series" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>СЕРИАЛЫ</Link>
          <Link href="/catalog?type=game" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>ИГРЫ</Link>
        </div>

        {/* Search */}
        <div ref={searchRef} style={{ flex: 1, position: 'relative', maxWidth: 480 }}>
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Поиск фильмов, сериалов, игр..."
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '8px 12px',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocusCapture={e => (e.target.style.borderColor = 'var(--border2)')}
            onBlurCapture={e => (e.target.style.borderColor = 'var(--border)')}
          />
          {loading && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '1px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          )}
          {open && results.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 4, overflow: 'hidden', zIndex: 200, boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            }}>
              {results.slice(0, 8).map((item, i) => (
                <button
                  key={i}
                  onClick={() => goToTitle(item)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {item.coverImage ? (
                    <img src={item.coverImage} alt="" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 48, background: 'var(--surface2)', borderRadius: 2, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ color: 'var(--text)', fontSize: 13 }}>{item.title}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                      {typeLabel(item.type)} {item.year > 0 ? `· ${item.year}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auth */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          {session ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                  padding: '6px 12px', color: 'var(--text)', fontSize: 12, letterSpacing: '0.08em',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {session.user?.username || session.user?.name}
              </button>
              {menuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, overflow: 'hidden', minWidth: 140, zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  <Link href="/profile" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 14px', fontSize: 12, letterSpacing: '0.08em', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>МОЙ ПРОФИЛЬ</Link>
                  <button onClick={() => { signOut(); setMenuOpen(false) }} style={{ width: '100%', display: 'block', padding: '10px 14px', fontSize: 12, letterSpacing: '0.08em', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>ВЫЙТИ</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth" style={{
              background: 'var(--text)', color: 'var(--bg)',
              padding: '6px 14px', borderRadius: 4,
              fontSize: 12, letterSpacing: '0.08em', fontWeight: 500,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              ВОЙТИ
            </Link>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </nav>
  )
}
