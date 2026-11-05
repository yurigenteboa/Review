import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Cover } from '../components/review/ReviewCard'
import { Glass } from '../components/ui/Glass'
import { signOut, useAuth } from '../lib/auth'
import { formatRating } from '../lib/categories'
import { displayName } from '../lib/format'
import { useMyProfile, useUpdateProfile, useUserReviews } from '../lib/queries'

export default function Perfil() {
  const { userId, session } = useAuth()
  const { data: me } = useMyProfile(userId)
  const { data: mine = [] } = useUserReviews(userId)
  const update = useUpdateProfile()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')

  const startEditing = () => {
    setName(me?.display_name ?? '')
    setUsername(me?.username ?? '')
    setEditing(true)
  }

  const cats = new Set(mine.map((r) => r.item.category)).size
  const avg = mine.length ? mine.reduce((s, r) => s + r.rating, 0) / mine.length : 0
  const stats = [
    { value: String(mine.length), label: mine.length === 1 ? 'review' : 'reviews' },
    { value: String(cats), label: cats === 1 ? 'categoria' : 'categorias' },
    { value: mine.length ? formatRating(avg) : '–', label: 'nota média' },
  ]

  return (
    <div className="page">
      <div
        aria-hidden="true"
        style={{ height: 'calc(230px + var(--safe-top))', background: 'linear-gradient(135deg, #6E3AA8, #FF6B4A 55%, #FFB340)' }}
      />
      <Glass style={{ margin: '-120px 16px 0', position: 'relative', padding: 20 }}>
        {me && !editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar profile={me} size={68} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 22, letterSpacing: -0.4 }}>{displayName(me)}</strong>
              <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{me.username ? `@${me.username}` : session?.user.email}</span>
            </div>
            <button type="button" className="btn btn--plain tap" style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }} onClick={startEditing}>
              Editar
            </button>
          </div>
        )}

        {me && editing && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await update.mutateAsync({ id: me.id, display_name: name, username })
                setEditing(false)
              } catch {
                /* mensagem abaixo */
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <label>
              <span className="field-label">Nome</span>
              <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <span className="field-label">@ de usuário</span>
              <input
                className="field"
                value={username}
                maxLength={24}
                autoCapitalize="none"
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                placeholder="yuri"
              />
            </label>
            {update.error && <span role="alert" style={{ color: 'var(--cat-filme-ink)', fontSize: 14 }}>{(update.error as Error).message}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--primary tap" disabled={update.isPending} style={{ flex: 1 }}>
                Salvar
              </button>
              <button type="button" className="btn btn--plain tap" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 18 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderRadius: 16, background: 'var(--glass-bg)' }}>
              <strong style={{ fontSize: 22 }}>{s.value}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </Glass>

      <h2 style={{ margin: '24px 20px 10px', fontSize: 22, letterSpacing: -0.4 }}>Suas reviews</h2>
      {mine.length === 0 ? (
        <p style={{ margin: '0 20px', color: 'var(--text-3)' }}>Você ainda não fez nenhuma review.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '0 16px' }}>
          {mine.map((r) => (
            <Link key={r.id} to={`/item/${r.item.id}`} aria-label={r.item.title} className="tap" style={{ position: 'relative', aspectRatio: '1 / 1', display: 'block' }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <Cover item={r.item} fill radius={18} />
              </div>
              <span className="glass glass--pill" style={{ position: 'absolute', left: 8, bottom: 8, padding: '3px 8px', fontSize: 12, fontWeight: 700, boxShadow: 'none', color: 'var(--text)' }}>
                ★ {formatRating(r.rating)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div style={{ padding: '32px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="btn btn--plain tap" onClick={() => signOut()}>
          Sair da conta
        </button>
        <Link to="/kit" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
          Ver componentes do design system
        </Link>
      </div>
    </div>
  )
}
