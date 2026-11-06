import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryById, catColor, type CategoryId } from '../../lib/categories'
import { DID_VERB, localDay, useEntryNote } from '../../lib/diary'
import { displayName } from '../../lib/format'
import { useDebounced, useNearMe } from '../../lib/hooks'
import { useCatalogSearch, useCreateReview, useItem, useItemReviews, useSearchItems, type CatalogResult } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { useFriends } from '../../lib/social'
import { WATCHED_WHERE_LABEL, type Review, type Visibility, type WatchedWhere } from '../../lib/types'
import { CategoryChips } from '../ui/Chips'
import { Sheet } from '../ui/Sheet'
import { CatalogResults, NearMeButton } from './CatalogResults'
import { Avatar, Cover } from './ReviewCard'
import { CriterionInput, RatingInput } from './RatingInput'

export interface ComposeStart {
  category?: CategoryId
  title?: string
  itemId?: string
  external?: CatalogResult
  /** editar uma entrada do diário que já existe */
  edit?: Review
  /** vindo de "vi com você": data, lugar e quem marcou */
  prefill?: { experiencedAt?: string; watchedWhere?: WatchedWhere | null; companions?: string[] }
  /** abrir com ♥ ligado (toque no ♥ antes de registrar) */
  loved?: boolean
}

interface Props {
  open: boolean
  start: ComposeStart
  onClose: () => void
  onDone: (msg: string) => void
}

const VIS: { id: Visibility; label: string; hint: string }[] = [
  { id: 'privado', label: 'Privado', hint: 'Só você vê. Bom para o diário pessoal.' },
  { id: 'amigos', label: 'Amigos', hint: 'Você e seus amigos no MMISC.' },
  { id: 'publico', label: 'Público', hint: 'Qualquer pessoa com conta no MMISC.' },
]

const PLACEHOLDER: Record<CategoryId, string> = {
  album: 'Ex.: Clube da Esquina',
  filme: 'Ex.: Bacurau',
  serie: 'Ex.: Succession',
  jogo: 'Ex.: Hollow Knight',
  livro: 'Ex.: Torto Arado',
  bar: 'Ex.: Bar do bairro',
  banheiro: 'Ex.: Banheiro da rodoviária',
  cidade: 'Ex.: Paraty',
}

const WHERE_OPTIONS = Object.keys(WATCHED_WHERE_LABEL) as WatchedWhere[]
const MAX_PHOTOS = 4
const DETAILS_KEY = 'mmisc.composeDetails'

const readDetailsPref = () => {
  try {
    return localStorage.getItem(DETAILS_KEY) === '1'
  } catch {
    return false
  }
}
const saveDetailsPref = (open: boolean) => {
  try {
    localStorage.setItem(DETAILS_KEY, open ? '1' : '0')
  } catch {
    /* modo privado: segue sem lembrar */
  }
}

export function ComposeSheet({ open, start, onClose, onDone }: Props) {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const edit = start.edit
  // O App remonta este componente a cada abertura (prop `key`), então o estado já nasce limpo.
  const [category, setCategory] = useState<CategoryId>(edit?.item.category ?? start.category ?? start.external?.category ?? 'album')
  const [title, setTitle] = useState(edit?.item.title ?? start.title ?? start.external?.title ?? '')
  const [subtitle, setSubtitle] = useState('')
  const [itemId, setItemId] = useState<string | undefined>(edit?.item.id ?? start.itemId)
  const [external, setExternal] = useState<CatalogResult | undefined>(start.external)
  const [rating, setRating] = useState(edit?.rating ?? 0)
  const [criteria, setCriteria] = useState<Record<string, number>>(edit?.criteria_scores ?? {})
  const [body, setBody] = useState(edit?.body ?? '')
  const [visibility, setVisibility] = useState<Visibility>(edit?.visibility ?? 'amigos')
  const [photos, setPhotos] = useState<File[]>([])
  const [day, setDay] = useState(edit?.experienced_at ?? start.prefill?.experiencedAt ?? localDay())
  const [loved, setLoved] = useState(edit?.loved ?? start.loved ?? false)
  const [rewatch, setRewatch] = useState<boolean | null>(edit ? edit.rewatch : null)
  const [spoiler, setSpoiler] = useState(edit?.spoiler ?? false)
  const [where, setWhere] = useState<WatchedWhere | null>(edit?.watched_where ?? start.prefill?.watchedWhere ?? null)
  const [companions, setCompanions] = useState<string[]>(
    edit?.companions?.map((c) => c.user.id) ?? start.prefill?.companions ?? [],
  )
  const [note, setNote] = useState('')
  const [noteTouched, setNoteTouched] = useState(false)
  const [details, setDetails] = useState(() => Boolean(edit) || readDetailsPref())
  const create = useCreateReview()
  const { near, status, request, clear } = useNearMe()
  const friends = useFriends()
  const savedNote = useEntryNote(edit?.id)

  // edição: a nota privada chega depois (tabela só do dono); até a pessoa mexer, vale a salva
  const noteValue = noteTouched ? note : (savedNote.data ?? '')

  const picked = Boolean(itemId || external)
  const term = useDebounced(picked ? '' : title.trim(), 400)
  const placeCat = category === 'bar' || category === 'banheiro'
  const screen = category === 'filme' || category === 'serie'
  const local = useSearchItems(term, category)
  const remote = useCatalogSearch(picked ? 'all' : category, term, placeCat ? near : null)
  const pickedItem = useItem(itemId)
  const pastEntries = useItemReviews(edit ? undefined : itemId)

  // já registrou esse item antes? então "revi" já vem ligado
  const hadBefore = (pastEntries.data ?? []).some((r) => r.user_id === userId)
  const isRewatch = rewatch ?? hadBefore

  const known = useMemo(
    () => new Set((local.data ?? []).filter((i) => i.external_id).map((i) => `${i.source}:${i.external_id}`)),
    [local.data],
  )
  const localMatches = term.length >= 2 ? (local.data ?? []).slice(0, 3) : []
  const showRemote = !picked && (term.length >= 2 || (placeCat && Boolean(near)))

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const acceptedFriends = (friends.data ?? []).filter((f) => f.status === 'aceita')
  const ready = title.trim().length > 0 && !create.isPending
  const cat = categoryById(category)
  const verb = DID_VERB[category]

  const unpick = () => {
    setItemId(undefined)
    setExternal(undefined)
  }

  const toggleDetails = () => {
    setDetails((d) => {
      saveDetailsPref(!d)
      return !d
    })
  }

  const submit = async () => {
    if (!ready) return
    try {
      const res = await create.mutateAsync({
        reviewId: edit?.id,
        category,
        itemId,
        external,
        title,
        subtitle,
        rating: rating > 0 ? rating : null,
        body,
        criteria: Object.fromEntries(Object.entries(criteria).filter(([, v]) => v > 0)),
        visibility,
        photos,
        experiencedAt: day,
        rewatch: isRewatch,
        loved,
        spoiler,
        watchedWhere: screen ? where : null,
        note: noteValue,
        companions,
      })
      onDone(res.edited ? 'Entrada atualizada' : 'Registrado no seu diário')
      onClose()
      navigate(`/item/${res.itemId}`)
    } catch {
      /* a mensagem aparece no formulário */
    }
  }

  const chosen = external
    ? { title: external.title, subtitle: external.subtitle, image_url: external.image_url, category: external.category }
    : pickedItem.data
      ? pickedItem.data
      : itemId
        ? { title, subtitle: null, image_url: null, category }
        : null

  const today = localDay()
  const yesterday = localDay(-1)

  return (
    <Sheet open={open} onClose={onClose} title={edit ? 'Editar entrada' : 'Registrar'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!edit && !start.itemId && (
          <CategoryChips
            value={category}
            withAll={false}
            onChange={(v) => {
              if (v === 'all') return
              setCategory(v)
              unpick()
              setCriteria({})
            }}
          />
        )}

        {chosen ? (
          <div className="group">
            <div className="group__row">
              <Cover item={chosen} size={56} radius={12} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <strong style={{ fontWeight: 650, fontSize: 17 }}>{chosen.title}</strong>
                {chosen.subtitle && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{chosen.subtitle}</span>}
              </span>
              {!edit && !start.itemId && (
                <button type="button" className="btn btn--plain tap" style={{ minHeight: 44, padding: '0 14px', fontSize: 14 }} onClick={unpick}>
                  Trocar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span className="field-label">O que você quer registrar?</span>
              <input className="field" value={title} placeholder={PLACEHOLDER[category]} onChange={(e) => setTitle(e.target.value)} />
            </label>

            {placeCat && <NearMeButton active={Boolean(near)} status={status} onRequest={request} onClear={clear} />}

            {localMatches.length > 0 && (
              <div className="group">
                {localMatches.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="group__row tap"
                    style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
                    onClick={() => {
                      setItemId(it.id)
                      setTitle(it.title)
                    }}
                  >
                    <Cover item={it} size={44} radius={10} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <strong style={{ fontWeight: 600 }}>{it.title}</strong>
                      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{it.subtitle ? `${it.subtitle} · ` : ''}já no MMISC</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showRemote && (
              <CatalogResults
                category={category}
                results={remote.data?.results}
                loading={remote.isFetching}
                missingKey={remote.data?.missingKey}
                error={remote.error ? String(remote.error) : remote.data?.error}
                hide={known}
                limit={6}
                onPick={(r) => {
                  setExternal(r)
                  setTitle(r.title)
                }}
              />
            )}

            {title.trim() && (
              <label style={{ display: 'block' }}>
                <span className="field-label">Não achou? Detalhe para o cadastro manual (opcional)</span>
                <input
                  className="field"
                  value={subtitle}
                  placeholder={placeCat ? 'Bairro, cidade' : 'Artista, diretor, ano…'}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </label>
            )}
          </div>
        )}

        {/* ---------- registro rápido: nota, dia, ♥ e revi ---------- */}
        <RatingInput value={rating} onChange={setRating} />
        {rating > 0 && (
          <button type="button" className="link-btn" style={{ alignSelf: 'center', marginTop: -10, minHeight: 36, fontSize: 14 }} onClick={() => setRating(0)}>
            Registrar sem nota
          </button>
        )}

        <div className="compose-quick">
          <div className="segmented" role="radiogroup" aria-label="Quando" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <button type="button" role="radio" aria-checked={day === today} onClick={() => setDay(today)}>
              Hoje
            </button>
            <button type="button" role="radio" aria-checked={day === yesterday} onClick={() => setDay(yesterday)}>
              Ontem
            </button>
            <label className="segmented__date" data-checked={day !== today && day !== yesterday}>
              <span>{day !== today && day !== yesterday ? day.split('-').reverse().join('/') : 'Outro dia'}</span>
              <input
                type="date"
                aria-label="Escolher outro dia"
                value={day}
                max={today}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="toggle-chip tap" aria-pressed={loved} onClick={() => setLoved((v) => !v)}>
              <span aria-hidden="true">{loved ? '♥' : '♡'}</span> Curti
            </button>
            <button type="button" className="toggle-chip tap" aria-pressed={isRewatch} onClick={() => setRewatch(!isRewatch)}>
              <span aria-hidden="true">↻</span> {category === 'album' ? 'Reouvi' : screen ? 'Revi' : 'De novo'}
            </button>
          </div>
        </div>

        <div>
          <span className="field-label">Quem pode ver</span>
          <div className="segmented" role="radiogroup" aria-label="Quem pode ver">
            {VIS.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={visibility === v.id} onClick={() => setVisibility(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <span className="field-hint">{VIS.find((v) => v.id === visibility)!.hint}</span>
        </div>

        {/* ---------- mais detalhes (recolhido) ---------- */}
        <button type="button" className="details-toggle tap" aria-expanded={details} aria-controls="compose-details" onClick={toggleDetails}>
          <span>Mais detalhes</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>texto, nota privada, com quem, fotos</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: details ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {details && (
          <div id="compose-details" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {screen && (
              <div>
                <span className="field-label">Onde viu</span>
                <div className="segmented" role="radiogroup" aria-label="Onde viu" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  {WHERE_OPTIONS.map((w) => (
                    <button key={w} type="button" role="radio" aria-checked={where === w} onClick={() => setWhere(where === w ? null : w)}>
                      {WATCHED_WHERE_LABEL[w]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {acceptedFriends.length > 0 && (
              <div>
                <span className="field-label">{screen ? 'Viu com quem?' : 'Com quem?'}</span>
                <div className="chips no-scrollbar" role="group" aria-label="Amigos que estavam junto" style={{ margin: 0, padding: 0 }}>
                  {acceptedFriends.map((f) => {
                    const on = companions.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className="chip tap"
                        aria-pressed={on}
                        onClick={() => setCompanions((c) => (on ? c.filter((x) => x !== f.id) : [...c, f.id]))}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, paddingLeft: 6 }}
                      >
                        <Avatar profile={f} size={28} />
                        {displayName(f)}
                      </button>
                    )
                  })}
                </div>
                <span className="field-hint">Eles recebem um aviso para registrar a própria entrada em 1 toque.</span>
              </div>
            )}

            <label style={{ display: 'block' }}>
              <span className="field-label">Sua review</span>
              <textarea
                className="field"
                rows={4}
                value={body}
                maxLength={5000}
                placeholder="Conte como foi…"
                onChange={(e) => setBody(e.target.value)}
                style={{ height: 'auto', padding: '12px 14px', resize: 'none', lineHeight: 1.4 }}
              />
              <span className="field-hint">Para esconder só um trecho, escreva entre barras duplas: ||o final||</span>
            </label>
            {body.trim() && (
              <button type="button" className="toggle-chip tap" aria-pressed={spoiler} onClick={() => setSpoiler((v) => !v)} style={{ alignSelf: 'flex-start' }}>
                <span aria-hidden="true">⚠</span> Contém spoiler (borra o texto todo)
              </button>
            )}

            <label style={{ display: 'block' }}>
              <span className="field-label">
                <span aria-hidden="true">🔒 </span>Nota privada
              </span>
              <textarea
                className="field"
                rows={3}
                value={noteValue}
                maxLength={5000}
                placeholder="Cenas, frases, por que deu essa nota…"
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteTouched(true)
                }}
                style={{ height: 'auto', padding: '12px 14px', resize: 'none', lineHeight: 1.4 }}
              />
              <span className="field-hint">Só você vê, mesmo que a review seja pública.</span>
            </label>

            <div>
              <span className="field-label">Critérios (opcional)</span>
              <div className="group">
                {cat.criteria.map((c) => (
                  <CriterionInput
                    key={c}
                    label={c}
                    value={criteria[c] ?? 0}
                    color={catColor(category)}
                    onChange={(v) => setCriteria((prev) => ({ ...prev, [c]: v }))}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="field-label">
                {edit ? 'Adicionar fotos' : 'Fotos'} ({photos.length}/{MAX_PHOTOS})
              </span>
              <div className="photo-strip no-scrollbar">
                {previews.map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    aria-label={`Remover foto ${i + 1}`}
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    style={{ padding: 0, border: 'none', background: 'none', position: 'relative' }}
                  >
                    <img src={u} alt="" />
                    <span className="photo-remove" aria-hidden="true">×</span>
                  </button>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="photo-add tap">
                    <span aria-hidden="true">+</span>
                    <span className="visually-hidden">Adicionar fotos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        setPhotos((p) => [...p, ...files].slice(0, MAX_PHOTOS))
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {create.error && (
          <p role="alert" style={{ margin: 0, color: 'var(--cat-filme-ink)', fontSize: 14 }}>
            Não deu para salvar: {(create.error as Error).message}
          </p>
        )}

        <button type="button" className="btn btn--primary tap" disabled={!ready} onClick={submit} style={{ opacity: ready ? 1 : 0.45 }}>
          {create.isPending ? 'Salvando…' : edit ? 'Salvar alterações' : rating > 0 ? `${verb} · registrar` : `${verb} · registrar sem nota`}
        </button>
      </div>
    </Sheet>
  )
}
