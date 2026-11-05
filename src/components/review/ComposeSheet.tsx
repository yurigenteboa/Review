import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryById, catColor, type CategoryId } from '../../lib/categories'
import { useCreateReview, useSearchItems } from '../../lib/queries'
import type { Visibility } from '../../lib/types'
import { CategoryChips } from '../ui/Chips'
import { Sheet } from '../ui/Sheet'
import { Cover } from './ReviewCard'
import { CriterionInput, RatingInput } from './RatingInput'

export interface ComposeStart {
  category?: CategoryId
  title?: string
  itemId?: string
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
  { id: 'publico', label: 'Público', hint: 'Qualquer pessoa com conta no Review.' },
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
  const [category, setCategory] = useState<CategoryId>(start.category ?? 'album')
  const [title, setTitle] = useState(start.title ?? '')
  const [subtitle, setSubtitle] = useState('')
  const [itemId, setItemId] = useState<string | undefined>(start.itemId)
  const [rating, setRating] = useState(0)
  const [criteria, setCriteria] = useState<Record<string, number>>({})
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('amigos')
  const [photos, setPhotos] = useState<File[]>([])
  const create = useCreateReview()

  const suggestions = useSearchItems(itemId ? '' : title, category)
  const showSuggestions = !itemId && title.trim().length >= 2 && (suggestions.data?.length ?? 0) > 0

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const ready = title.trim().length > 0 && rating > 0 && !create.isPending
  const cat = categoryById(category)

  const submit = async () => {
    if (!ready) return
    try {
      const res = await create.mutateAsync({
        category,
        itemId,
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

  return (
    <Sheet open={open} onClose={onClose} title="Nova review">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CategoryChips
          value={category}
          withAll={false}
          onChange={(v) => {
            if (v === 'all') return
            setCategory(v)
            setItemId(undefined)
            setCriteria({})
          }}
        />

        <label style={{ display: 'block', position: 'relative' }}>
          <span className="field-label">O que você está avaliando?</span>
          <input
            className="field"
            value={title}
            placeholder={PLACEHOLDER[category]}
            onChange={(e) => {
              setTitle(e.target.value)
              setItemId(undefined)
            }}
          />
          {showSuggestions && (
            <div className="group" style={{ marginTop: 6 }}>
              {suggestions.data!.slice(0, 4).map((it) => (
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
                  <Cover item={it} size={36} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontWeight: 600 }}>{it.title}</strong>
                    {it.subtitle && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{it.subtitle}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          {itemId && <span className="field-hint">Item já cadastrado no Review.</span>}
        </label>

        {!itemId && title.trim() && (
          <label style={{ display: 'block' }}>
            <span className="field-label">Detalhe (opcional)</span>
            <input
              className="field"
              value={subtitle}
              placeholder={category === 'bar' || category === 'banheiro' ? 'Bairro, cidade' : 'Artista, diretor, ano…'}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </label>
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
