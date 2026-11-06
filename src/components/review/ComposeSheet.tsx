import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryById, catColor, type CategoryId } from '../../lib/categories'
import { useDebounced, useNearMe } from '../../lib/hooks'
import { useCatalogSearch, useCreateReview, useItem, useSearchItems, type CatalogResult } from '../../lib/queries'
import type { Visibility } from '../../lib/types'
import { CategoryChips } from '../ui/Chips'
import { Sheet } from '../ui/Sheet'
import { CatalogResults, NearMeButton } from './CatalogResults'
import { Cover } from './ReviewCard'
import { CriterionInput, RatingInput } from './RatingInput'

export interface ComposeStart {
  category?: CategoryId
  title?: string
  itemId?: string
  external?: CatalogResult
}

interface Props {
  open: boolean
  start: ComposeStart
  onClose: () => void
  onDone: (msg: string) => void
}

const VIS: { id: Visibility; label: string; hint: string }[] = [
  { id: 'privado', label: 'Privado', hint: 'Só você vê. Bom para o diário pessoal.' },
  { id: 'amigos', label: 'Amigos', hint: 'Você e quem você aceitou como seguidor.' },
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

const MAX_PHOTOS = 4

export function ComposeSheet({ open, start, onClose, onDone }: Props) {
  const navigate = useNavigate()
  // O App remonta este componente a cada abertura (prop `key`), então o estado já nasce limpo.
  const [category, setCategory] = useState<CategoryId>(start.category ?? start.external?.category ?? 'album')
  const [title, setTitle] = useState(start.title ?? start.external?.title ?? '')
  const [subtitle, setSubtitle] = useState('')
  const [itemId, setItemId] = useState<string | undefined>(start.itemId)
  const [external, setExternal] = useState<CatalogResult | undefined>(start.external)
  const [rating, setRating] = useState(0)
  const [criteria, setCriteria] = useState<Record<string, number>>({})
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('amigos')
  const [photos, setPhotos] = useState<File[]>([])
  const create = useCreateReview()
  const { near, status, request, clear } = useNearMe()

  const picked = Boolean(itemId || external)
  const term = useDebounced(picked ? '' : title.trim(), 400)
  const placeCat = category === 'bar' || category === 'banheiro'
  const local = useSearchItems(term, category)
  const remote = useCatalogSearch(picked ? 'all' : category, term, placeCat ? near : null)
  const pickedItem = useItem(itemId)

  const known = useMemo(
    () => new Set((local.data ?? []).filter((i) => i.external_id).map((i) => `${i.source}:${i.external_id}`)),
    [local.data],
  )
  const localMatches = term.length >= 2 ? (local.data ?? []).slice(0, 3) : []
  const showRemote = !picked && (term.length >= 2 || (placeCat && Boolean(near)))

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const ready = title.trim().length > 0 && rating > 0 && !create.isPending
  const cat = categoryById(category)

  const unpick = () => {
    setItemId(undefined)
    setExternal(undefined)
  }

  const submit = async () => {
    if (!ready) return
    try {
      const res = await create.mutateAsync({
        category,
        itemId,
        external,
        title,
        subtitle,
        rating,
        body,
        criteria: Object.fromEntries(Object.entries(criteria).filter(([, v]) => v > 0)),
        visibility,
        photos,
      })
      onDone('Review publicada')
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

  return (
    <Sheet open={open} onClose={onClose} title="Nova review">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {chosen ? (
          <div className="group">
            <div className="group__row">
              <Cover item={chosen} size={56} radius={12} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <strong style={{ fontWeight: 650, fontSize: 17 }}>{chosen.title}</strong>
                {chosen.subtitle && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{chosen.subtitle}</span>}
              </span>
              <button type="button" className="btn btn--plain tap" style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }} onClick={unpick}>
                Trocar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span className="field-label">O que você está avaliando?</span>
              <input
                className="field"
                value={title}
                placeholder={PLACEHOLDER[category]}
                onChange={(e) => setTitle(e.target.value)}
              />
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

        <RatingInput value={rating} onChange={setRating} />

        <div className="group" style={{ padding: '0 0' }}>
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
        </label>

        <div>
          <span className="field-label">Fotos ({photos.length}/{MAX_PHOTOS})</span>
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

        {create.error && (
          <p role="alert" style={{ margin: 0, color: 'var(--cat-filme-ink)', fontSize: 14 }}>
            Não deu para publicar: {(create.error as Error).message}
          </p>
        )}

        <button type="button" className="btn btn--primary tap" disabled={!ready} onClick={submit} style={{ opacity: ready ? 1 : 0.45 }}>
          {create.isPending ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </Sheet>
  )
}
