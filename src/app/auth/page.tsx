'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleLogin = async () => {
    setLoading(true); setError('')
    const res = await signIn('credentials', { email: form.email, password: form.password, redirect: false })
    setLoading(false)
    if (res?.error) setError('Неверный email или пароль')
    else router.push('/')
  }

  const handleRegister = async () => {
    setLoading(true); setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    })
    const data = await res.json()
    if (!res.ok) { setLoading(false); setError(data.error || 'Ошибка'); return }
    // auto-login
    await signIn('credentials', { email: form.email, password: form.password, redirect: false })
    router.push('/')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '12px 14px', color: 'var(--text)',
    fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none',
    transition: 'border-color 0.2s', marginBottom: 12,
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', paddingTop: 80,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, letterSpacing: '0.1em', marginBottom: '2.5rem', textAlign: 'center' }}>
          RATEFLOW
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, padding: '10px', background: 'none', border: 'none',
                color: mode === m ? 'var(--text)' : 'var(--muted)',
                fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                borderBottom: mode === m ? '1px solid var(--text)' : '1px solid transparent',
                marginBottom: -1, transition: 'color 0.2s',
              }}>
              {m === 'login' ? 'ВОЙТИ' : 'РЕГИСТРАЦИЯ'}
            </button>
          ))}
        </div>

        {/* Form */}
        {mode === 'register' && (
          <input
            placeholder="Имя пользователя"
            value={form.username}
            onChange={e => set('username', e.target.value)}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--border2)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        )}
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = 'var(--border2)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <input
          placeholder="Пароль"
          type="password"
          value={form.password}
          onChange={e => set('password', e.target.value)}
          style={{ ...inputStyle, marginBottom: error ? 8 : 16 }}
          onFocus={e => (e.target.style.borderColor = 'var(--border2)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
        />

        {error && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
            ↳ {error}
          </div>
        )}

        <button
          onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          style={{
            width: '100%', background: 'var(--text)', color: 'var(--bg)',
            border: 'none', padding: '13px', borderRadius: 4,
            fontSize: 12, letterSpacing: '0.12em', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 500,
            opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
          }}
        >
          {loading ? '...' : mode === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}
        </button>
      </div>
    </div>
  )
}
