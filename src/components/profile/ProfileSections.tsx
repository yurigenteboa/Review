import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '../review/ReviewCard'
import { Sheet } from '../ui/Sheet'
import { CATEGORIES, categoryById, type CategoryId } from '../../lib/categories'
import {
  isStale,
  linkDomain,
  useClearNow,
  useDeleteGoal,
  useFavorites,
  useGoals,
  useNow,
  useRankings,
  useRemoveFavorite,
  useSaveGoal,
  useSaveRanking,
  useSetFavorite,
  useSetNow,
  type GoalRow,
  type ProfileLink,
} from '../../lib/profileData'
import { CATEGORY_PLURAL, latestPerItem, type CategoryFilter } from '../../lib/profileStats'
import type { Item, Review, Visibility } from '../../lib/types'
import { VISIBILITY_LABEL } from '../../lib/types'
import { computeAchievements } from '../../lib/achievements'
import { ItemPicker } from './ItemPicker'

const thisYear = new Date().getFullYear()

/** Itens do diário da pessoa numa categoria (um por item, mais recente primeiro). */
const diaryItems = (entries: Review[], cat: CategoryId): Item[] =>
  latestPerItem(entries.filter((r) => r.item.category === cat)).map((r) => r.item)

// ---------- Links ----------

export function LinksRow({ links }: { links: ProfileLink[] }) {
  if (!links.length) return null
  return (
    <ul className="profile-links" aria-label="Links">
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="tap">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
            {l.label || linkDomain(l.url)}
          </a>
        </li>
      ))}
    </ul>
  )
}

// ---------- Agora ----------

const NOW_VERB: Record<CategoryId, string> = {
  album: 'ouvindo',
  filme: 'vendo',
  serie: 'vendo',
  jogo: 'jogando',
  livro: 'lendo',
  bar: 'indo ao',
  banheiro: 'usando',
  cidade: 'em',
}

export function NowLine({ userId, isMe, entries }: { userId: string; isMe: boolean; entries: Review[] }) {
  const now = useNow(userId)
  const [open, setOpen] = useState(false)
  const rows = now.data ?? []
  const fresh = rows.filter((r) => !isStale(r.set_at))
  const stale = rows.filter((r) => isStale(r.set_at))

  if (!fresh.length && !isMe) return null
  return (
    <>
      <div className="now-line">
        {fresh.length > 0 ? (
          <p>
            <span className="now-line__dot" aria-hidden="true" />
            {fresh.map((r, i) => (
              <span key={r.category}>
                {i > 0 && ' · '}
                {NOW_VERB[r.category]} <Link to={`/item/${r.item.id}`}>{r.item.title}</Link>
              </span>
            ))}
          </p>
        ) : (
          isMe && <p className="profile-section__hint">O que você está vendo, ouvindo ou jogando agora?</p>
        )}
        {isMe && (
          <button type="button" className="link-btn" onClick={() => setOpen(true)}>
            {fresh.length ? 'Mudar' : '+ Agora'}
          </button>
        )}
      </div>
      {isMe && stale.length > 0 && (
        <p className="profile-section__hint">
          Ainda está {stale.map((r) => `${NOW_VERB[r.category]} ${r.item.title}`).join(', ')}? Isso saiu do seu perfil depois de 60 dias.{' '}
          <button type="button" className="link-btn" onClick={() => setOpen(true)}>
            Atualizar
          </button>
        </p>
      )}
      {isMe && <NowSheet open={open} onClose={() => setOpen(false)} userId={userId} entries={entries} current={rows} />}
    </>
  )
}

function NowSheet({ open, onClose, userId, entries, current }: { open: boolean; onClose: () => void; userId: string; entries: Review[]; current: { category: CategoryId; item: Item; set_at: string }[] }) {
  const [pick, setPick] = useState<CategoryId | null>(null)
  const setNow = useSetNow()
  const clearNow = useClearNow()
  const cats: CategoryId[] = ['filme', 'serie', 'album', 'jogo', 'livro']
  return (
    <>
      <Sheet open={open && !pick} onClose={onClose} title="Agora">
        <p className="profile-section__hint" style={{ marginBottom: 12 }}>
          Aparece no topo do seu perfil para os amigos. Some sozinho depois de 60 dias sem mudar.
        </p>
        <div className="group">
          {cats.map((c) => {
            const cur = current.find((r) => r.category === c)
            return (
              <div key={c} className="group__row">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontWeight: 600 }}>{NOW_VERB[c][0].toUpperCase() + NOW_VERB[c].slice(1)}</strong>
                  <span className="profile-section__hint">{cur ? cur.item.title : categoryById(c).label}</span>
                </span>
                {cur && (
                  <button type="button" className="link-btn" disabled={clearNow.isPending} onClick={() => clearNow.mutate({ userId, category: c })}>
                    Tirar
                  </button>
                )}
                <button type="button" className="link-btn" onClick={() => setPick(c)}>
                  {cur ? 'Trocar' : 'Escolher'}
                </button>
              </div>
            )
          })}
        </div>
      </Sheet>
      {pick && (
        <ItemPicker
          open
          onClose={() => setPick(null)}
          title={`${NOW_VERB[pick][0].toUpperCase() + NOW_VERB[pick].slice(1)} agora`}
          category={pick}
          diary={diaryItems(entries, pick)}
          busy={setNow.isPending}
          onPick={(item) => setNow.mutate({ userId, category: pick, itemId: item.id }, { onSuccess: () => setPick(null) })}
        />
      )}
    </>
  )
}

// ---------- Vitrine de favoritos ----------

export function Showcase({ userId, isMe, showcase, cat, entries }: { userId: string; isMe: boolean; showcase: CategoryId[]; cat: CategoryFilter; entries: Review[] }) {
  const favs = useFavorites(userId)
  const [editing, setEditing] = useState(false)
  const [slot, setSlot] = useState<{ category: CategoryId; position: number } | null>(null)
  const setFav = useSetFavorite()
  const removeFav = useRemoveFavorite()
  const rows = favs.data ?? []

  // Quais categorias mostrar: a escolhida no filtro; em "Tudo", a vitrine do dono
  // (ou, se ele não escolheu, as categorias que já têm favorito).
  const withFavs = CATEGORIES.map((c) => c.id).filter((c) => rows.some((r) => r.category === c))
  const cats: CategoryId[] = cat !== 'all' ? [cat] : showcase.length ? showcase : withFavs
  if (!cats.length && !isMe) return null

  return (
    <section className="profile-section" aria-labelledby="sec-favs">
      <div className="profile-section__head">
        <h2 id="sec-favs" className="profile-section__title">Favoritos</h2>
        {isMe && cats.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Pronto' : 'Editar'}
          </button>
        )}
      </div>
      {!cats.length && (
        <p className="profile-section__hint">
          Escolha até 4 favoritos por categoria: toque em Editar perfil → Vitrine, ou filtre uma categoria aqui em cima.
        </p>
      )}
      {cats.map((c) => {
        const list = rows.filter((r) => r.category === c)
        if (!list.length && !isMe) return null
        return (
          <div key={c} className="fav-group">
            {(cats.length > 1 || cat === 'all') && <h3 className="fav-group__title">{categoryById(c).label}</h3>}
            <div className="fav-row">
              {[1, 2, 3, 4].map((pos) => {
                const f = list.find((r) => r.position === pos)
                if (f)
                  return (
                    <div key={pos} className="fav-row__item">
                      <Link to={`/item/${f.item.id}`} className="tap fav-row__link" aria-label={f.item.title}>
                        <span className="fav-row__cover">
                          <Cover item={f.item} fill radius={12} />
                        </span>
                        <span className="fav-row__title">{f.item.title}</span>
                      </Link>
                      {isMe && editing && (
                        <span className="fav-row__actions">
                          <button type="button" className="fav-row__btn" aria-label={`Trocar ${f.item.title}`} onClick={() => setSlot({ category: c, position: pos })}>
                            ↻
                          </button>
                          <button
                            type="button"
                            className="fav-row__btn"
                            aria-label={`Tirar ${f.item.title}`}
                            disabled={removeFav.isPending}
                            onClick={() => removeFav.mutate({ userId, category: c, position: pos })}
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                  )
                return isMe ? (
                  <button key={pos} type="button" className="fav-row__empty tap" aria-label={`Escolher favorito ${pos} de ${categoryById(c).label}`} onClick={() => setSlot({ category: c, position: pos })}>
                    +
                  </button>
                ) : (
                  <span key={pos} className="fav-row__placeholder" aria-hidden="true" />
                )
              })}
            </div>
          </div>
        )
      })}
      {slot && (
        <ItemPicker
          open
          onClose={() => setSlot(null)}
          title={`Favorito em ${CATEGORY_PLURAL[slot.category]}`}
          category={slot.category}
          diary={diaryItems(entries, slot.category)}
          busy={setFav.isPending}
          onPick={(item) => setFav.mutate({ userId, category: slot.category, position: slot.position, itemId: item.id }, { onSuccess: () => setSlot(null) })}
        />
      )}
    </section>
  )
}

// ---------- Metas do ano ----------

export function Goals({ userId, isMe, entries }: { userId: string; isMe: boolean; entries: Review[] }) {
  const goals = useGoals(userId, thisYear)
  const [editing, setEditing] = useState<GoalRow | 'new' | null>(null)
  const rows = goals.data ?? []
  if (!rows.length && !isMe) return null

  const progress = (g: GoalRow) =>
    entries.filter((r) => r.experienced_at.startsWith(String(g.year)) && (g.category == null || r.item.category === g.category)).length

  return (
    <section className="profile-section" aria-labelledby="sec-goals">
      <div className="profile-section__head">
        <h2 id="sec-goals" className="profile-section__title">Metas de {thisYear}</h2>
        {isMe && (
          <button type="button" className="link-btn" onClick={() => setEditing('new')}>
            + Meta
          </button>
        )}
      </div>
      {!rows.length && <p className="profile-section__hint">Quantos filmes, álbuns ou bares em {thisYear}? A barra anda sozinha com o diário.</p>}
      <div className="goals">
        {rows
          .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? ''))
          .map((g) => {
            const done = progress(g)
            const pct = Math.min(100, Math.round((done / g.target) * 100))
            const label = g.category ? CATEGORY_PLURAL[g.category] : 'registros no total'
            return (
              <div key={g.id} className="goal">
                <div className="goal__text">
                  <span>
                    <strong>{done}</strong> de {g.target} {label}
                  </span>
                  {isMe ? (
                    <button type="button" className="link-btn" onClick={() => setEditing(g)}>
                      {pct >= 100 ? 'Concluída ✓' : `${pct}%`}
                    </button>
                  ) : (
                    <span className="profile-section__hint">{pct >= 100 ? 'Concluída ✓' : `${pct}%`}</span>
                  )}
                </div>
                <div className="goal__bar" role="progressbar" aria-valuemin={0} aria-valuemax={g.target} aria-valuenow={Math.min(done, g.target)} aria-label={`Meta de ${label}`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
      </div>
      {isMe && editing && <GoalSheet goal={editing === 'new' ? null : editing} taken={rows} onClose={() => setEditing(null)} />}
    </section>
  )
}

function GoalSheet({ goal, taken, onClose }: { goal: GoalRow | null; taken: GoalRow[]; onClose: () => void }) {
  const save = useSaveGoal()
  const del = useDeleteGoal()
  const [category, setCategory] = useState<CategoryId | ''>(goal?.category ?? '')
  const [target, setTarget] = useState(String(goal?.target ?? 20))
  const [visibility, setVisibility] = useState<Visibility>(goal?.visibility ?? 'publico')
  const n = Number(target)
  const used = new Set(taken.filter((g) => g.id !== goal?.id).map((g) => g.category ?? ''))

  return (
    <Sheet open onClose={onClose} title={goal ? 'Editar meta' : `Nova meta de ${thisYear}`}>
      <form
        className="profile__edit"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ id: goal?.id, year: thisYear, category: category || null, target: n, visibility }, { onSuccess: onClose })
        }}
      >
        <label>
          <span className="field-label">O quê</span>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | '')}>
            <option value="" disabled={used.has('')}>Tudo (qualquer categoria)</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id} disabled={used.has(c.id)}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Quantos em {thisYear}</span>
          <input className="field" type="number" inputMode="numeric" min={1} max={1000} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <VisibilityPicker value={visibility} onChange={setVisibility} />
        {save.error && <span role="alert" className="form-error">{(save.error as Error).message}</span>}
        <button className="btn btn--primary tap" disabled={save.isPending || !(n >= 1 && n <= 1000)}>
          Salvar
        </button>
        {goal && (
          <button type="button" className="btn btn--plain tap" disabled={del.isPending} onClick={() => del.mutate(goal.id, { onSuccess: onClose })}>
            Apagar meta
          </button>
        )}
      </form>
    </Sheet>
  )
}

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <fieldset className="visibility-picker">
      <legend className="field-label">Quem vê</legend>
      <div className="segmented" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {(['publico', 'amigos', 'privado'] as Visibility[]).map((v) => (
          <button key={v} type="button" aria-pressed={value === v} aria-selected={value === v} onClick={() => onChange(v)}>
            {VISIBILITY_LABEL[v]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// ---------- Top 10 do ano ----------

export function TopTen({ userId, isMe, cat, entries }: { userId: string; isMe: boolean; cat: CategoryFilter; entries: Review[] }) {
  const [year, setYear] = useState(thisYear)
  const ranks = useRankings(userId, year)
  const [building, setBuilding] = useState<CategoryId | null>(null)
  const rows = (ranks.data ?? []).filter((r) => cat === 'all' || r.category === cat)
  const cats = CATEGORIES.map((c) => c.id).filter((c) => rows.some((r) => r.category === c))
  const buildable = (c: CategoryId) => latestPerItem(entries.filter((r) => r.item.category === c && r.experienced_at.startsWith(String(year)))).length >= 2
  const toBuild = (cat === 'all' ? CATEGORIES.map((c) => c.id) : [cat]).filter((c) => !cats.includes(c) && buildable(c))

  if (!rows.length && !isMe) return null
  return (
    <section className="profile-section" aria-labelledby="sec-top">
      <div className="profile-section__head">
        <h2 id="sec-top" className="profile-section__title">Top 10 de {year}</h2>
        <span className="top-years">
          {[thisYear, thisYear - 1].map((y) => (
            <button key={y} type="button" className="chip tap" aria-pressed={year === y} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </span>
      </div>
      {cats.map((c) => (
        <div key={c} className="fav-group">
          <div className="profile-section__head">
            <h3 className="fav-group__title">{categoryById(c).label}</h3>
            {isMe && (
              <button type="button" className="link-btn" onClick={() => setBuilding(c)}>
                Refazer
              </button>
            )}
          </div>
          <ol className="top-list">
            {rows
              .filter((r) => r.category === c)
              .map((r) => (
                <li key={r.item.id}>
                  <Link to={`/item/${r.item.id}`} className="group__row tap top-list__row">
                    <span className="top-list__pos">{r.position}</span>
                    <Cover item={r.item} size={40} radius={8} />
                    <span className="top-list__title">{r.item.title}</span>
                  </Link>
                </li>
              ))}
          </ol>
        </div>
      ))}
      {isMe && !rows.length && (
        <p className="profile-section__hint">Monte seu Top 10 de {year} comparando dois itens por vez. Leva poucos toques.</p>
      )}
      {isMe && toBuild.length > 0 && (
        <div className="top-build">
          {toBuild.map((c) => (
            <button key={c} type="button" className="chip tap" onClick={() => setBuilding(c)}>
              + Top 10 de {CATEGORY_PLURAL[c]}
            </button>
          ))}
        </div>
      )}
      {isMe && !rows.length && !toBuild.length && (
        <p className="profile-section__hint">Precisa de pelo menos 2 itens registrados em {year} numa categoria.</p>
      )}
      {building && <RankingBuilder year={year} category={building} entries={entries} onClose={() => setBuilding(null)} />}
    </section>
  )
}

/**
 * Montar o Top 10 por comparação (estilo Beli): cada item novo é encaixado na lista
 * por busca binária, perguntando "qual foi melhor?". Para não virar maratona, entram
 * só os 15 com nota mais alta daquele ano (empates incluídos até 20).
 */
type Step = { kind: 'compare'; candidate: Item; lo: number; hi: number } | { kind: 'done' }

function RankingBuilder({ year, category, entries, onClose }: { year: number; category: CategoryId; entries: Review[]; onClose: () => void }) {
  const save = useSaveRanking()
  const candidates = useMemo(() => {
    const list = latestPerItem(entries.filter((r) => r.item.category === category && r.experienced_at.startsWith(String(year)))).sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || Number(b.loved) - Number(a.loved),
    )
    const cutoff = list[14]?.rating ?? null
    return list.filter((r, i) => i < 15 || (cutoff != null && r.rating === cutoff && i < 20)).map((r) => r.item)
  }, [entries, category, year])

  const [ranked, setRanked] = useState<Item[]>(() => (candidates[0] ? [candidates[0]] : []))
  // índice do próximo candidato depois do que está sendo comparado agora
  const [next, setNext] = useState(2)
  const [step, setStep] = useState<Step>(() => (candidates[1] ? { kind: 'compare', candidate: candidates[1], lo: 0, hi: 1 } : { kind: 'done' }))
  const [comparisons, setComparisons] = useState(0)
  const [visibility, setVisibility] = useState<Visibility>('publico')

  const advance = (list: Item[], idx: number) => {
    const top = list.slice(0, 10)
    setRanked(top)
    // pula repetidos (proteção: um item nunca entra duas vezes)
    while (candidates[idx] && top.some((t) => t.id === candidates[idx].id)) idx++
    const cand = candidates[idx]
    setNext(idx + 1)
    setStep(cand ? { kind: 'compare', candidate: cand, lo: 0, hi: Math.min(top.length, 10) } : { kind: 'done' })
  }

  const answer = (candidateWins: boolean) => {
    if (step.kind !== 'compare') return
    setComparisons((n) => n + 1)
    const mid = Math.floor((step.lo + step.hi) / 2)
    const lo = candidateWins ? step.lo : mid + 1
    const hi = candidateWins ? mid : step.hi
    if (lo >= hi) {
      // achou o lugar; se cair depois do 10º, fica de fora
      const list = lo >= 10 ? ranked : [...ranked.slice(0, lo), step.candidate, ...ranked.slice(lo)]
      advance(list, next)
    } else setStep({ ...step, lo, hi })
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= ranked.length) return
    const copy = [...ranked]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    setRanked(copy)
  }

  const rival = step.kind === 'compare' ? ranked[Math.floor((step.lo + step.hi) / 2)] : null
  const left = candidates.length - next + (step.kind === 'compare' ? 1 : 0)

  return (
    <Sheet open onClose={onClose} title={`Top 10 de ${CATEGORY_PLURAL[category]} · ${year}`}>
      {step.kind === 'compare' && rival ? (
        <div className="duel">
          <p className="duel__q">Qual foi melhor?</p>
          <div className="duel__options">
            {[
              { item: step.candidate, wins: true },
              { item: rival, wins: false },
            ].map(({ item, wins }) => (
              <button key={item.id} type="button" className="duel__option tap" onClick={() => answer(wins)}>
                <span className="duel__cover">
                  <Cover item={item} fill radius={14} />
                </span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>
          <p className="profile-section__hint" style={{ textAlign: 'center' }}>
            {comparisons} {comparisons === 1 ? 'comparação' : 'comparações'} · faltam {left} {left === 1 ? 'item' : 'itens'}
          </p>
          <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => advance(ranked, candidates.length)}>
            Parar aqui e ajustar na mão
          </button>
        </div>
      ) : (
        <div className="profile__edit">
          <p className="profile-section__hint">Ajuste a ordem se quiser e salve.</p>
          <ol className="top-list">
            {ranked.map((it, i) => (
              <li key={it.id} className="group__row top-list__row">
                <span className="top-list__pos">{i + 1}</span>
                <Cover item={it} size={40} radius={8} />
                <span className="top-list__title">{it.title}</span>
                <button type="button" className="fav-row__btn" aria-label={`Subir ${it.title}`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="fav-row__btn" aria-label={`Descer ${it.title}`} disabled={i === ranked.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          {save.error && <span role="alert" className="form-error">{(save.error as Error).message}</span>}
          <button
            type="button"
            className="btn btn--primary tap"
            disabled={save.isPending || !ranked.length}
            onClick={() => save.mutate({ year, category, itemIds: ranked.map((i) => i.id), visibility }, { onSuccess: onClose })}
          >
            Salvar Top {ranked.length}
          </button>
        </div>
      )}
    </Sheet>
  )
}

// ---------- Conquistas ----------

/**
 * Conquistas com moderação: os outros veem só as conquistadas; o dono vê também
 * o progresso das que faltam. Sem notificação, sem contador piscando.
 */
export function Achievements({ entries, isMe }: { entries: Review[]; isMe: boolean }) {
  const list = computeAchievements(entries)
  const done = list.filter((a) => a.unlocked)
  const [open, setOpen] = useState(false)
  if (!done.length && !isMe) return null
  const shown = isMe && open ? list : done
  return (
    <section className="profile-section" aria-labelledby="sec-badges">
      <div className="profile-section__head">
        <h2 id="sec-badges" className="profile-section__title">
          Conquistas {done.length > 0 && <span className="profile-section__hint">· {done.length} de {list.length}</span>}
        </h2>
        {isMe && (
          <button type="button" className="link-btn" onClick={() => setOpen((o) => !o)}>
            {open ? 'Só as minhas' : 'Ver todas'}
          </button>
        )}
      </div>
      {!shown.length && <p className="profile-section__hint">Nenhuma ainda. Toque em “Ver todas” para ver o que falta.</p>}
      <ul className="badges">
        {shown.map((a) => (
          <li key={a.id} className={`badge${a.unlocked ? '' : ' is-locked'}`} style={{ '--badge': a.color } as CSSProperties}>
            <span className="badge__mark" aria-hidden="true">
              {a.mark}
            </span>
            <span className="badge__text">
              <strong>{a.title}</strong>
              <span>{a.unlocked ? a.goal : `${a.progress} de ${a.target} · ${a.goal}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
