import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryById, catColor, childCategories, PLACE_SEARCH, type CategoryId } from '../../lib/categories'
import { track } from '../../lib/telemetry'
import { DID_VERB, localDay, useEntryNote } from '../../lib/diary'
import { displayName } from '../../lib/format'
import { useDebounced, useNearMe } from '../../lib/hooks'
import { useCatalogSearch, useCreateReview, useItem, useItemReviews, useMyPlaceRanks, useSearchItems, type CatalogResult, type OrderInput } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { useFriends } from '../../lib/social'
import { WATCHED_WHERE_LABEL, type Review, type Visibility, type WatchedWhere } from '../../lib/types'
import { CategoryChips } from '../ui/Chips'
import { Sheet } from '../ui/Sheet'
import { CatalogResults, NearMeButton } from './CatalogResults'
import { Avatar, Cover } from './ReviewCard'
import { CriterionInput, RatingInput } from './RatingInput'
import { haptic } from '../../lib/haptics'
import { OrderPicker } from './OrderPicker'
import { CompareRating, type CompareResult } from './CompareRating'

import { locale, t, tp } from '../../lib/i18n'
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
  { id: 'privado', label: t('Privado'), hint: t('Só você vê. Bom para o diário pessoal.') },
  { id: 'amigos', label: t('Amigos'), hint: t('Você e seus amigos no MMisc.') },
  { id: 'publico', label: t('Público'), hint: t('Qualquer pessoa com conta no MMisc.') },
]

const PLACEHOLDER: Record<CategoryId, string> = {
  album: t('Ex.: Clube da Esquina'),
  filme: t('Ex.: Bacurau'),
  serie: t('Ex.: Succession'),
  jogo: t('Ex.: Hollow Knight'),
  livro: t('Ex.: Torto Arado'),
  bar: t('Ex.: Bar do bairro'),
  banheiro: t('Ex.: Banheiro da rodoviária'),
  cidade: t('Ex.: Paraty'),
  drink: t('Ex.: Negroni'),
  prato: t('Ex.: Coxinha'),
  restaurante: t('Ex.: Mocotó'),
  cafe: t('Ex.: Café Girondino'),
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
// ---------- M2 · Rascunho automático ----------
// O "+" sem nada escolhido guarda o que foi digitado; se o app fechar ou a pessoa sair,
// o próximo "+" continua de onde parou (fotos não entram: são arquivos do aparelho).
const DRAFT_KEY = 'mmisc.composeDraft'
const DRAFT_MAX_AGE = 3 * 24 * 60 * 60 * 1000

interface Draft {
  savedAt: number
  category: CategoryId
  title: string
  subtitle: string
  itemId?: string
  external?: CatalogResult
  rating: number
  body: string
  visibility: Visibility
  day: string
  loved: boolean
  where: WatchedWhere | null
  companions: string[]
  note: string
}

const readDraft = (): Draft | null => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    return d && Date.now() - d.savedAt < DRAFT_MAX_AGE ? d : null
  } catch {
    return null
  }
}
const writeDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* modo privado: segue sem rascunho */
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
  // Fase 0: tempo de registro (abrir o "+" até salvar) e desistência. O App remonta a cada abertura.
  const [openedAt] = useState(() => ({ current: Date.now() }))
  const saved = useRef(false)
  const close = () => {
    if (!saved.current) track('compose_cancel', { ms: Date.now() - openedAt.current, editou: Boolean(edit) })
    saved.current = true // conta uma vez só, mesmo se Esc e o botão fecharem juntos
    onClose()
  }
  // "+" puro (sem item, edição ou pré-preenchimento) usa e guarda rascunho
  const blank = !edit && !start.itemId && !start.external && !start.title && !start.category && !start.prefill && !start.loved
  const [draft, setDraft] = useState<Draft | null>(() => (blank ? readDraft() : null))
  // O App remonta este componente a cada abertura (prop `key`), então o estado já nasce limpo.
  const [category, setCategory] = useState<CategoryId>(edit?.item.category ?? start.category ?? start.external?.category ?? draft?.category ?? 'album')
  const [title, setTitle] = useState(edit?.item.title ?? start.title ?? start.external?.title ?? draft?.title ?? '')
  const [subtitle, setSubtitle] = useState(draft?.subtitle ?? '')
  const [itemId, setItemId] = useState<string | undefined>(edit?.item.id ?? start.itemId ?? draft?.itemId)
  const [external, setExternal] = useState<CatalogResult | undefined>(start.external ?? draft?.external)
  const [rating, setRating] = useState(edit?.rating ?? draft?.rating ?? 0)
  const [criteria, setCriteria] = useState<Record<string, number>>(edit?.criteria_scores ?? {})
  const [body, setBody] = useState(edit?.body ?? draft?.body ?? '')
  const [visibility, setVisibility] = useState<Visibility>(edit?.visibility ?? draft?.visibility ?? 'amigos')
  const [photos, setPhotos] = useState<File[]>([])
  const [day, setDay] = useState(edit?.experienced_at ?? start.prefill?.experiencedAt ?? draft?.day ?? localDay())
  const [loved, setLoved] = useState(edit?.loved ?? start.loved ?? draft?.loved ?? false)
  const [rewatch, setRewatch] = useState<boolean | null>(edit ? edit.rewatch : null)
  const [spoiler, setSpoiler] = useState(edit?.spoiler ?? false)
  const [where, setWhere] = useState<WatchedWhere | null>(edit?.watched_where ?? start.prefill?.watchedWhere ?? draft?.where ?? null)
  const [companions, setCompanions] = useState<string[]>(
    edit?.companions?.map((c) => c.user.id) ?? start.prefill?.companions ?? draft?.companions ?? [],
  )
  const [note, setNote] = useState(draft?.note ?? '')
  const [noteTouched, setNoteTouched] = useState(Boolean(draft?.note))
  const [details, setDetails] = useState(() => Boolean(edit) || readDetailsPref())
  const create = useCreateReview()
  const { near, status, request, clear } = useNearMe()
  const friends = useFriends()
  const savedNote = useEntryNote(edit?.id)

  // edição: a nota privada chega depois (tabela só do dono); até a pessoa mexer, vale a salva
  const noteValue = noteTouched ? note : (savedNote.data ?? '')

  const picked = Boolean(itemId || external)
  const term = useDebounced(picked ? '' : title.trim(), 400)
  const placeCat = PLACE_SEARCH.includes(category)
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

  // Guarda o rascunho (só no "+" puro), meio segundo depois de parar de mexer
  useEffect(() => {
    if (!blank) return
    const t = setTimeout(() => {
      const hasContent = title.trim() || rating > 0 || body.trim() || note.trim()
      writeDraft(
        hasContent
          ? { savedAt: Date.now(), category, title, subtitle, itemId, external, rating, body, visibility, day, loved, where, companions, note }
          : null,
      )
    }, 500)
    return () => clearTimeout(t)
  }, [blank, category, title, subtitle, itemId, external, rating, body, visibility, day, loved, where, companions, note])

  const discardDraft = () => {
    writeDraft(null)
    setDraft(null)
    setTitle('')
    setSubtitle('')
    setItemId(undefined)
    setExternal(undefined)
    setRating(0)
    setBody('')
    setNote('')
    setLoved(false)
    setWhere(null)
    setCompanions([])
    setDay(localDay())
  }

  // Bar e banheiro: se a localização já foi liberada antes, já mostra "Perto de você" sem pedir de novo
  useEffect(() => {
    if (!placeCat || near || picked || !navigator.permissions) return
    let alive = true
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => alive && p.state === 'granted' && request())
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [placeCat]) // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length) setPhotos((p) => [...p, ...files].slice(0, MAX_PHOTOS))
  }

  const unpick = () => {
    setItemId(undefined)
    setExternal(undefined)
    setOrders([])
    setCompare(null)
    setCompareKey((k) => k + 1)
  }

  // Fase 1: o que pode morar no item (bar -> drink, prato, banheiro) e o que foi pedido
  const orderKinds = childCategories(category)
  const [orders, setOrders] = useState<OrderInput[]>([])
  // Fase 2: bar, restaurante e café levam nota por comparação
  const comparing = categoryById(category).ratingMode === 'comparacao'
  const placeRanks = useMyPlaceRanks(category, comparing ? userId : null)
  const [compare, setCompare] = useState<CompareResult | null>(null)
  const [compareKey, setCompareKey] = useState(0)

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
        orders,
        rank: comparing && compare ? { bucket: compare.bucket, pos: compare.pos } : null,
      })
      haptic('success')
      saved.current = true
      track('compose_saved', {
        ms: Date.now() - openedAt.current,
        categoria: category,
        editou: Boolean(res.edited),
        detalhes: details,
        nota: rating > 0,
        fotos: photos.length,
        pedidos: orders.length,
      })
      if (blank) writeDraft(null)
      const n = orders.length
      onDone(
        res.edited
          ? n ? tp(n, 'Entrada atualizada com {n} pedido', 'Entrada atualizada com {n} pedidos') : t('Entrada atualizada')
          : n ? tp(n, 'Registrado no seu diário com {n} pedido', 'Registrado no seu diário com {n} pedidos') : t('Registrado no seu diário'),
      )
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
    <Sheet open={open} onClose={close} title={edit ? t('Editar entrada') : t('Registrar')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {draft && (
          <div className="draft-note" role="status">
            <span>{t('Rascunho de {v} restaurado', { v: new Date(draft.savedAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) })}</span>
            <button type="button" className="link-btn" onClick={discardDraft}>
              {t('Descartar')}
            </button>
          </div>
        )}
        {!edit && !start.itemId && (
          <CategoryChips
            value={category}
            withAll={false}
            onChange={(v) => {
              if (v === 'all') return
              setCategory(v)
              unpick()
              setCriteria({})
              setRating(0)
            }}
          />
        )}

        {chosen ? (
          <div className="group">
            <div className="group__row">
              <Cover item={chosen} size={56} radius={12} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <strong style={{ fontWeight: 650, fontSize: '1.0625rem' }}>{chosen.title}</strong>
                {chosen.subtitle && <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{chosen.subtitle}</span>}
              </span>
              {!edit && !start.itemId && (
                <button type="button" className="btn btn--plain tap" style={{ minHeight: 44, padding: '0 14px', fontSize: '0.875rem' }} onClick={unpick}>
                  {t('Trocar')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span className="field-label">{t('O que você quer registrar?')}</span>
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
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{it.subtitle ? `${it.subtitle} · ` : ''}{t('já no MMisc')}</span>
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
                label={placeCat && near && term.length < 2 ? t('Você está em algum destes?') : undefined}
                onPick={(r) => {
                  setExternal(r)
                  setTitle(r.title)
                }}
              />
            )}

            {title.trim() && (
              <label style={{ display: 'block' }}>
                <span className="field-label">{t('Não achou? Detalhe para o cadastro manual (opcional)')}</span>
                <input
                  className="field"
                  value={subtitle}
                  placeholder={placeCat ? t('Bairro, cidade') : t('Artista, diretor, ano…')}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </label>
            )}
          </div>
        )}

        {/* ---------- registro rápido: nota, dia, ♥ e revi ---------- */}
        {comparing ? (
          <CompareRating
            key={`${category}-${compareKey}`}
            category={category}
            itemId={itemId}
            ranks={placeRanks.data ?? []}
            value={compare}
            onChange={(v) => {
              setCompare(v)
              setRating(v?.rating ?? 0)
            }}
          />
        ) : (
          <RatingInput value={rating} onChange={setRating} />
        )}
        {rating > 0 && (
          <button
            type="button"
            className="link-btn"
            style={{ alignSelf: 'center', marginTop: -10, minHeight: 36, fontSize: '0.875rem' }}
            onClick={() => {
              setRating(0)
              setCompare(null)
              setCompareKey((k) => k + 1)
            }}
          >
            {t('Registrar sem nota')}
          </button>
        )}

        {/* Fase 1: num lugar, o que foi pedido vira entradas filhas desta (drinks, pratos, banheiro) */}
        {orderKinds.length > 0 && (chosen || title.trim()) && (
          <OrderPicker parentId={itemId} kinds={orderKinds} value={orders} onChange={setOrders} />
        )}

        <div className="compose-quick">
          <div className="segmented" role="radiogroup" aria-label={t('Quando')} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <button type="button" role="radio" aria-checked={day === today} onClick={() => setDay(today)}>
              {t('Hoje')}
            </button>
            <button type="button" role="radio" aria-checked={day === yesterday} onClick={() => setDay(yesterday)}>
              {t('Ontem')}
            </button>
            <label className="segmented__date" data-checked={day !== today && day !== yesterday}>
              <span>{day !== today && day !== yesterday ? new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'numeric', year: 'numeric' }) : t('Outro dia')}</span>
              <input
                type="date"
                aria-label={t('Escolher outro dia')}
                value={day}
                max={today}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="toggle-chip tap" aria-pressed={loved} onClick={() => {
                haptic()
                setLoved((v) => !v)
              }}>
              <span aria-hidden="true">{loved ? '♥' : '♡'}</span> {t('Curti')}
            </button>
            <button type="button" className="toggle-chip tap" aria-pressed={isRewatch} onClick={() => setRewatch(!isRewatch)}>
              <span aria-hidden="true">↻</span> {category === 'album' ? t('Reouvi') : screen ? t('Revi') : t('De novo')}
            </button>
            {placeCat && photos.length < MAX_PHOTOS && (
              // Bar e banheiro: câmera direto, sem passar por "Mais detalhes"
              <label className="toggle-chip tap" style={{ cursor: 'pointer' }}>
                <span aria-hidden="true">📷</span> {photos.length ? t('Foto ({length})', { length: photos.length }) : t('Foto')}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    addPhotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <span className="field-label">{t('Quem pode ver')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('Quem pode ver')}>
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
          <span>{t('Mais detalhes')}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)', fontWeight: 500 }}>{t('texto, nota privada, com quem, fotos')}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: details ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {details && (
          <div id="compose-details" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {screen && (
              <div>
                <span className="field-label">{t('Onde viu')}</span>
                <div className="segmented" role="radiogroup" aria-label={t('Onde viu')} style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
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
                <span className="field-label">{screen ? t('Viu com quem?') : t('Com quem?')}</span>
                <div className="chips no-scrollbar" role="group" aria-label={t('Amigos que estavam junto')} style={{ margin: 0, padding: 0 }}>
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
                <span className="field-hint">{t('Eles recebem um aviso para registrar a própria entrada em 1 toque.')}</span>
              </div>
            )}

            <label style={{ display: 'block' }}>
              <span className="field-label">{t('Sua review')}</span>
              <textarea
                className="field"
                rows={4}
                value={body}
                maxLength={5000}
                placeholder={t('Conte como foi…')}
                onChange={(e) => setBody(e.target.value)}
                style={{ height: 'auto', padding: '12px 14px', resize: 'none', lineHeight: 1.4 }}
              />
              <span className="field-hint">{t('Para esconder só um trecho, escreva entre barras duplas: ||o final||')}</span>
            </label>
            {body.trim() && (
              <button type="button" className="toggle-chip tap" aria-pressed={spoiler} onClick={() => setSpoiler((v) => !v)} style={{ alignSelf: 'flex-start' }}>
                <span aria-hidden="true">⚠</span> {t('Contém spoiler (borra o texto todo)')}
              </button>
            )}

            <label style={{ display: 'block' }}>
              <span className="field-label">
                <span aria-hidden="true">🔒 </span>{t('Nota privada')}
              </span>
              <textarea
                className="field"
                rows={3}
                value={noteValue}
                maxLength={5000}
                placeholder={t('Cenas, frases, por que deu essa nota…')}
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteTouched(true)
                }}
                style={{ height: 'auto', padding: '12px 14px', resize: 'none', lineHeight: 1.4 }}
              />
              <span className="field-hint">{t('Só você vê, mesmo que a review seja pública.')}</span>
            </label>

            <div>
              <span className="field-label">{t('Critérios (opcional)')}</span>
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
                {edit ? t('Adicionar fotos') : t('Fotos')} ({photos.length}/{MAX_PHOTOS})
              </span>
              <div className="photo-strip no-scrollbar">
                {previews.map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    aria-label={t('Remover foto {v}', { v: i + 1 })}
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
                    <span className="visually-hidden">{t('Adicionar fotos')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        addPhotos(e.target.files)
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
          <p role="alert" style={{ margin: 0, color: 'var(--cat-filme-ink)', fontSize: '0.875rem' }}>
            {t('Não deu para salvar: {message}', { message: (create.error as Error).message })}
          </p>
        )}

        <button type="button" className="btn btn--primary tap" disabled={!ready} onClick={submit} style={{ opacity: ready ? 1 : 0.45 }}>
          {create.isPending ? t('Salvando…') : edit ? t('Salvar alterações') : rating > 0 ? t('{verb} · registrar', { verb }) : t('{verb} · registrar sem nota', { verb })}
        </button>
      </div>
    </Sheet>
  )
}
