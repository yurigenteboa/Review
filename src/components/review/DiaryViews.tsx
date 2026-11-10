// Diário (lista por mês) e "Quero ver" (grade com filtro de streaming), usados no seu perfil e no de amigos.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { requestCompose } from '../../lib/composeBus'
import { useMyServices, useWatchlist } from '../../lib/diary'
import { useDeleteReview } from '../../lib/queries'
import type { Review } from '../../lib/types'
import { SwipeRow } from '../ui/SwipeRow'
import { Cover, EntryLine } from './ReviewCard'

import { locale, t, tp } from '../../lib/i18n'
const monthLabel = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
}

/** Diário agrupado por mês: dia, capa, título e a linha da entrada. */
export function DiaryList({ entries, empty }: { entries: Review[]; empty: string }) {
  if (!entries.length) return <p className="empty-note">{empty}</p>
  const groups = new Map<string, Review[]>()
  for (const r of entries) {
    const key = r.experienced_at.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {[...groups.entries()].map(([key, list]) => (
        <section key={key} aria-label={monthLabel(key)}>
          <h3 className="diary-month">{monthLabel(key)}</h3>
          <ul className="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.map((r) => (
              <li key={r.id}>
                <DiaryRow review={r} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function DiaryRowLink({ review: r }: { review: Review }) {
  return (
    <Link to={`/item/${r.item.id}`} className="group__row tap diary-row">
      <span className="diary-row__day" aria-hidden="true">
        {Number(r.experienced_at.slice(8, 10))}
      </span>
      <Cover item={r.item} size={44} radius={8} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <strong className="diary-row__title">{r.item.title}</strong>
        <EntryLine review={r} />
      </span>
    </Link>
  )
}

/** M3: no seu diário, arrastar a linha para a esquerda mostra Editar e Apagar (apagar pede confirmação). */
function DiaryRow({ review: r }: { review: Review }) {
  const { userId } = useAuth()
  const del = useDeleteReview()
  const [confirm, setConfirm] = useState(false)
  if (r.user_id !== userId) return <DiaryRowLink review={r} />
  return (
    <SwipeRow
      actions={[
        { label: t('Editar'), onPress: () => requestCompose({ edit: r }) },
        {
          label: del.isPending ? t('Apagando…') : confirm ? t('Confirmar') : t('Apagar'),
          tone: 'danger',
          onPress: () => (confirm ? del.mutate(r) : setConfirm(true)),
        },
      ]}
    >
      <DiaryRowLink review={r} />
    </SwipeRow>
  )
}

/** "Quero ver" de uma pessoa. O filtro usa os streamings que VOCÊ assina. */
export function WatchlistGrid({ userId, empty }: { userId: string; empty: string }) {
  const list = useWatchlist(userId)
  const services = useMyServices()
  const [onlyMine, setOnlyMine] = useState(false)
  const mineIds = new Set((services.data ?? []).map((s) => s.provider_id))
  const rows = list.data ?? []

  // só filmes com a ficha do TMDB já guardada sabem onde estão passando
  const available = (r: (typeof rows)[number]) => (r.item.providers?.flatrate ?? []).some((p) => mineIds.has(p.id))
  const unknown = rows.filter((r) => r.item.source === 'tmdb-movie' && !r.item.providers).length
  const shown = onlyMine ? rows.filter(available) : rows

  if (list.isLoading) return <p className="empty-note">{t('Carregando…')}</p>
  if (!rows.length) return <p className="empty-note">{empty}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {mineIds.size > 0 && (
        <div className="chips no-scrollbar" role="group" aria-label={t('Filtrar quero ver')} style={{ margin: 0, padding: 0 }}>
          <button type="button" className="chip tap" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)} style={{ minHeight: 44 }}>
            {t('Tudo ({n})', { n: rows.length })}
          </button>
          <button type="button" className="chip tap" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)} style={{ minHeight: 44 }}>
            {t('No que eu assino ({n})', { n: rows.filter(available).length })}
          </button>
        </div>
      )}
      {mineIds.size === 0 && (
        <p className="field-hint" style={{ margin: 0 }}>
          {t('Dica: na página de um filme, em “Onde assistir”, toque em “Meus streamings” para filtrar esta lista pelo que você assina.')}
        </p>
      )}
      {onlyMine && shown.length === 0 && <p className="empty-note">{t('Nada desta lista está nos seus streamings agora.')}</p>}
      <ul className="watch-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((r) => (
          <li key={r.item_id}>
            <Link to={`/item/${r.item.id}`} className="tap watch-card" aria-label={r.item.title}>
              <Cover item={r.item} fill radius={12} />
              <span className="watch-card__title">{r.item.title}</span>
              {available(r) && <span className="watch-card__badge">{t('no seu streaming')}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {onlyMine && unknown > 0 && (
        <p className="field-hint" style={{ margin: 0 }}>
          {tp(unknown, '{n} filme ainda não tem dados de streaming: abra a página dele uma vez para atualizar.', '{n} filmes ainda não têm dados de streaming: abra a página deles uma vez para atualizar.')}
        </p>
      )}
    </div>
  )
}
