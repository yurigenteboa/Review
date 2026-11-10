import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useWatchlist } from '../../lib/diary'
import { displayName } from '../../lib/format'
import { useFriends } from '../../lib/social'
import { Avatar, Cover } from '../review/ReviewCard'

import { t, tp } from '../../lib/i18n'
const MAX_FRIENDS = 8
const MAX_LIST = 6

/**
 * Painel à direita do Início no desktop (>= 1100 px): pedidos de amizade,
 * amigos e o começo da sua lista de "quero ver/ouvir/ir".
 * Só é montado no desktop, então no celular não faz nenhuma consulta a mais.
 */
export function HomeAside() {
  const { userId } = useAuth()
  const friends = useFriends()
  const list = useWatchlist(userId)

  const all = friends.data ?? []
  const received = all.filter((f) => f.status === 'pendente' && !f.requested_by_me)
  const accepted = all.filter((f) => f.status === 'aceita')
  const queue = list.data ?? []

  return (
    <aside className="page-aside" aria-label={t('Amigos e sua lista')}>
      {received.length > 0 && (
        <Link to="/amigos" className="aside-callout tap">
          <strong>{tp(received.length, '{n} pedido de amizade', '{n} pedidos de amizade')}</strong>
          <span>{t('Responder em Amigos')}</span>
        </Link>
      )}

      <section className="aside-section">
        <header className="aside-section__head">
          <h2>{t('Amigos')}</h2>
          <Link to="/amigos" className="aside-section__more">
            {accepted.length > MAX_FRIENDS ? t('Ver todos ({n})', { n: accepted.length }) : t('Gerenciar')}
          </Link>
        </header>
        {friends.isLoading && <p className="aside-empty">{t('Carregando…')}</p>}
        {!friends.isLoading && accepted.length === 0 && (
          <p className="aside-empty">
            {t('Ainda ninguém.')} <Link to="/amigos">{t('Mande seu link de convite.')}</Link>
          </p>
        )}
        <ul className="aside-people">
          {accepted.slice(0, MAX_FRIENDS).map((f) => (
            <li key={f.id}>
              <Link to={`/u/${f.id}`} className="aside-person tap">
                <Avatar profile={f} size={36} />
                <span className="aside-person__text">
                  <strong>{displayName(f)}</strong>
                  {f.username && <span>@{f.username}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="aside-section">
        <header className="aside-section__head">
          <h2>{t('Na sua lista')}</h2>
          {queue.length > 0 && (
            <Link to="/perfil?aba=quero" className="aside-section__more">
              {t('Ver tudo ({n})', { n: queue.length })}
            </Link>
          )}
        </header>
        {!list.isLoading && queue.length === 0 && (
          <p className="aside-empty">{t('Marque “Quero ver” num filme, álbum ou bar e ele aparece aqui.')}</p>
        )}
        <ul className="watch-grid aside-grid">
          {queue.slice(0, MAX_LIST).map((r) => (
            <li key={r.item_id}>
              <Link to={`/item/${r.item.id}`} className="tap watch-card" aria-label={r.item.title}>
                <Cover item={r.item} fill radius={10} />
                <span className="watch-card__title">{r.item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
