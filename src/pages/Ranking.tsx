import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Reorder, useDragControls } from 'motion/react'
import { PageHeader } from '../components/ui/PageHeader'
import { RANKED_CATEGORIES, type CategoryId } from '../lib/categories'
import { CATEGORY_PLURAL } from '../lib/profileStats'
import { useAuth } from '../lib/auth'
import { haptic } from '../lib/haptics'
import { useMyPlaceRanks, useMyRankCounts, useRemoveRank, useSaveRankOrder, type PlaceRank } from '../lib/queries'
import { ErrorState } from './states'

import { t } from '../lib/i18n'
type Bucket = 1 | 2 | 3
const BUCKETS: { id: Bucket; label: string; emoji: string }[] = [
  { id: 3, label: t('Gostei'), emoji: '😍' },
  { id: 2, label: t('Ok'), emoji: '🙂' },
  { id: 1, label: t('Não gostei'), emoji: '😕' },
]

/** pos de cada lugar = tamanho do grupo − índice (o de cima é o maior). */
function withPositions(list: PlaceRank[]): PlaceRank[] {
  const out: PlaceRank[] = []
  for (const b of BUCKETS) {
    const group = list.filter((r) => r.bucket === b.id)
    group.forEach((r, i) => out.push({ ...r, pos: group.length - i }))
  }
  return out
}

/**
 * Fase 2 · "Meus lugares em ordem": seu ranking de bares, restaurantes e cafés.
 * Arraste pela alça (ou use ↑ ↓) para reordenar; subir o primeiro do "Ok" leva para o fim do "Gostei".
 * A nota das entradas já registradas não muda (é a nota do dia em que você foi).
 */
export default function Ranking() {
  const { userId } = useAuth()
  const [params, setParams] = useSearchParams()
  const counts = useMyRankCounts(userId)
  const fromUrl = params.get('cat') as CategoryId | null
  const firstWithData = RANKED_CATEGORIES.find((c) => (counts.data?.[c.id] ?? 0) > 0)?.id
  const cat: CategoryId = fromUrl && RANKED_CATEGORIES.some((c) => c.id === fromUrl) ? fromUrl : firstWithData ?? 'bar'

  const ranks = useMyPlaceRanks(cat, userId)
  const save = useSaveRankOrder(cat, userId)
  const remove = useRemoveRank(cat, userId)

  // cópia local para arrastar sem esperar o banco
  const [list, setList] = useState<PlaceRank[]>([])
  const saved = useRef<PlaceRank[]>([])
  useEffect(() => {
    if (!ranks.data) return
    const ordered = withPositions(ranks.data)
    saved.current = ranks.data
    setList(ordered)
  }, [ranks.data])

  const [status, setStatus] = useState<string>('')

  const commit = (next: PlaceRank[]): PlaceRank[] => {
    const placed = withPositions(next)
    setList(placed)
    const before = new Map(saved.current.map((r) => [r.item_id, r]))
    const changes = placed.filter((r) => {
      const b = before.get(r.item_id)
      return !b || b.bucket !== r.bucket || b.pos !== r.pos
    })
    if (changes.length === 0) return placed
    saved.current = placed
    setStatus(t('Salvando…'))
    save.mutate(
      changes.map(({ item_id, bucket, pos }) => ({ item_id, bucket, pos })),
      {
        onSuccess: () => setStatus(t('Ordem salva')),
        onError: () => setStatus(t('Não deu para salvar. Tente de novo.')),
      },
    )
    return placed
  }

  /** ↑/↓: anda uma casa na lista inteira; na borda do grupo, muda de grupo. */
  const move = (itemId: string, dir: -1 | 1) => {
    const i = list.findIndex((r) => r.item_id === itemId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    haptic()
    const next = [...list]
    const me = next[i]
    const other = next[j]
    if (other.bucket !== me.bucket) {
      // atravessa a fronteira: vira o último (subindo) ou o primeiro (descendo) do grupo vizinho
      next[i] = { ...me, bucket: other.bucket }
    } else {
      next[i] = other
      next[j] = me
    }
    const placed = commit(next)
    const now = placed.find((r) => r.item_id === itemId)
    const label = BUCKETS.find((b) => b.id === now?.bucket)?.label ?? ''
    setStatus(`${me.title}: ${placed.findIndex((r) => r.item_id === itemId) + 1}º (${label})`)
  }

  const reorderGroup = (bucket: Bucket, group: PlaceRank[]) => {
    const next: PlaceRank[] = []
    for (const b of BUCKETS) next.push(...(b.id === bucket ? group : list.filter((r) => r.bucket === b.id)))
    setList(next)
  }

  const plural = CATEGORY_PLURAL[cat]
  const total = list.length
  const indexOf = useMemo(() => new Map(list.map((r, i) => [r.item_id, i])), [list])

  return (
    <div className="page">
      <PageHeader title={t('Meus lugares em ordem')} subtitle={total ? `${total} ${plural}` : undefined}>
        <div className="chips no-scrollbar" role="group" aria-label={t('Categoria')}>
          {RANKED_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip tap"
              aria-pressed={c.id === cat}
              onClick={() => setParams({ cat: c.id }, { replace: true })}
            >
              {c.label}
              {counts.data?.[c.id] ? ` · ${counts.data[c.id]}` : ''}
            </button>
          ))}
        </div>
      </PageHeader>

      {ranks.isError ? (
        <ErrorState error={ranks.error} onRetry={() => void ranks.refetch()} />
      ) : ranks.isPending ? (
        <div className="rank-list" aria-busy="true" />
      ) : total === 0 ? (
        <p className="empty-note">
          {t('Você ainda não ranqueou {plural}. Ao registrar um, escolha “Gostei / Ok / Não gostei” e compare com os outros: ele entra aqui.', { plural })}
        </p>
      ) : (
        <>
          <p className="rank-hint">{t('Arraste pela alça ou use ↑ ↓. A nota das entradas que você já registrou não muda.')}</p>
          {BUCKETS.map((b) => {
            const group = list.filter((r) => r.bucket === b.id)
            return (
              <section key={b.id} className="rank-group" aria-labelledby={`rank-g${b.id}`}>
                <h2 id={`rank-g${b.id}`} className="rank-group__title">
                  <span aria-hidden="true">{b.emoji}</span> {b.label}
                  <span className="rank-group__count">{group.length}</span>
                </h2>
                {group.length === 0 ? (
                  <p className="rank-group__empty">{t('Nenhum aqui.')}</p>
                ) : (
                  <Reorder.Group axis="y" values={group} onReorder={(g) => reorderGroup(b.id, g)} className="rank-list" as="ol">
                    {group.map((r) => (
                      <RankRow
                        key={r.item_id}
                        rank={r}
                        place={(indexOf.get(r.item_id) ?? 0) + 1}
                        first={indexOf.get(r.item_id) === 0}
                        last={indexOf.get(r.item_id) === total - 1}
                        onDrop={() => commit(list)}
                        onMove={(d) => move(r.item_id, d)}
                        onRemove={() => {
                          remove.mutate(r.item_id)
                          setStatus(t('{title} saiu do ranking', { title: r.title }))
                        }}
                      />
                    ))}
                  </Reorder.Group>
                )}
              </section>
            )
          })}
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {status && status !== 'Salvando…' && <p className="rank-status">{status}</p>}
    </div>
  )
}

function RankRow({
  rank,
  place,
  first,
  last,
  onDrop,
  onMove,
  onRemove,
}: {
  rank: PlaceRank
  place: number
  first: boolean
  last: boolean
  onDrop: () => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const drag = useDragControls()
  const [confirm, setConfirm] = useState(false)
  return (
    <Reorder.Item value={rank} dragListener={false} dragControls={drag} onDragEnd={onDrop} className="rank-row" as="li">
      <button
        type="button"
        className="rank-row__handle"
        aria-label={t('Arrastar {title}', { title: rank.title })}
        onPointerDown={(e) => {
          e.preventDefault()
          haptic()
          drag.start(e)
        }}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <span className="rank-row__place">{place}º</span>
      <Link to={`/item/${rank.item_id}`} className="rank-row__title">
        {rank.title}
      </Link>
      <div className="rank-row__actions">
        <button type="button" className="icon-btn tap" aria-label={t('Subir {title}', { title: rank.title })} disabled={first} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className="icon-btn tap" aria-label={t('Descer {title}', { title: rank.title })} disabled={last} onClick={() => onMove(1)}>
          ↓
        </button>
        <button
          type="button"
          className={`link-btn rank-row__remove${confirm ? ' is-confirm' : ''}`}
          aria-label={confirm ? t('Confirmar: tirar {title} do ranking', { title: rank.title }) : t('Tirar {title} do ranking', { title: rank.title })}
          onClick={() => (confirm ? onRemove() : setConfirm(true))}
          onBlur={() => setConfirm(false)}
        >
          {confirm ? t('Tirar?') : '✕'}
        </button>
      </div>
    </Reorder.Item>
  )
}
