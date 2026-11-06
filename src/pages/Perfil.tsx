import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DiaryList, WatchlistGrid } from '../components/review/DiaryViews'
import { useMyServices } from '../lib/diary'
import { Avatar } from '../components/review/ReviewCard'
import { Glass } from '../components/ui/Glass'
import { signOut, useAuth } from '../lib/auth'
import { formatRating } from '../lib/categories'
import { displayName } from '../lib/format'
import { useMyProfile, useUpdateProfile, useUserReviews } from '../lib/queries'

const thisYear = String(new Date().getFullYear())

export default function Perfil() {
  const { userId, session } = useAuth()
  const { data: me } = useMyProfile(userId)
  const { data: mine = [] } = useUserReviews(userId)
  const update = useUpdateProfile()
  const [editing, setEditing] = useState(false)
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') === 'quero' ? 'quero' : 'diario'
  const setTab = (t: 'diario' | 'quero') => setParams(t === 'quero' ? { aba: 'quero' } : {}, { replace: true })
  const services = useMyServices()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')

  const startEditing = () => {
    setName(me?.display_name ?? '')
    setUsername(me?.username ?? '')
    setEditing(true)
  }

  const yearCount = mine.filter((r) => r.experienced_at.startsWith(thisYear)).length
  const items = new Set(mine.map((r) => r.item.id)).size
  const rated = mine.filter((r): r is typeof r & { rating: number } => r.rating != null)
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0
  const stats = [
    { value: String(yearCount), label: `em ${thisYear}` },
    { value: String(items), label: items === 1 ? 'item' : 'itens' },
    { value: rated.length ? formatRating(avg) : '–', label: 'nota média' },
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

      <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="segmented" role="tablist" aria-label="Suas listas" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <button type="button" role="tab" aria-selected={tab === 'diario'} aria-checked={tab === 'diario'} onClick={() => setTab('diario')}>
            Diário ({mine.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'quero'} aria-checked={tab === 'quero'} onClick={() => setTab('quero')}>
            Quero ver
          </button>
        </div>
        {tab === 'diario' ? (
          <DiaryList entries={mine} empty="Seu diário está vazio. Registre o primeiro pelo + da barra." />
        ) : (
          userId && <WatchlistGrid userId={userId} empty="Nada na lista. Toque no marcador da página de um filme (ou em “Quero …” nos outros itens)." />
        )}
        {services.data && services.data.length > 0 && tab === 'quero' && (
          <p className="field-hint" style={{ margin: 0 }}>
            Você assina: {services.data.map((s) => s.name).join(', ')}.
          </p>
        )}
      </div>

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
