import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { displayName } from '../../lib/format'
import {
  ATTRIBUTES,
  attrLabel,
  FIELD_LABEL,
  fichaOf,
  priceLabel,
  showValue,
  useCanCurate,
  useDecideSuggestion,
  useSuggest,
  useSuggestions,
  type FichaField,
  type SuggestionValue,
} from '../../lib/places'
import type { Item } from '../../lib/types'
import { Sheet } from '../ui/Sheet'

/**
 * Fase 2d · "Sobre o lugar": ficha (endereço, horário, preço, características, link),
 * "Sugerir edição" e as sugestões pendentes. Quem pode decidir (criou o lugar, tem 3+ registros
 * nele ou é admin) vê Aprovar/Recusar; a sugestão dessas pessoas já entra direto.
 */
export function PlaceInfo({ item }: { item: Item }) {
  const { userId } = useAuth()
  const ficha = fichaOf(item)
  const pending = useSuggestions(item.id)
  const canCurate = useCanCurate(item.id)
  const decide = useDecideSuggestion()
  const [editing, setEditing] = useState<FichaField | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const rows: { field: FichaField; value: string | null }[] = [
    { field: 'area', value: item.subtitle },
    { field: 'endereco', value: ficha.endereco ?? null },
    { field: 'horario', value: ficha.horario ?? null },
    { field: 'faixa_preco', value: ficha.faixa_preco ? priceLabel(ficha.faixa_preco) : null },
    { field: 'atributos', value: ficha.atributos?.length ? ficha.atributos.map(attrLabel).join(' · ') : null },
    { field: 'link', value: ficha.link ?? null },
  ]
  const list = pending.data ?? []

  return (
    <section aria-labelledby="sobre-lugar">
      <h2 id="sobre-lugar" style={{ margin: '24px 20px 10px', fontSize: 22, letterSpacing: -0.4 }}>Sobre o lugar</h2>
      <div className="page__body" style={{ paddingTop: 0 }}>
        <div className="group">
          {rows.map((r) => (
            <button key={r.field} type="button" className="group__row tap ficha__row" onClick={() => setEditing(r.field)}>
              <span className="ficha__label">{FIELD_LABEL[r.field]}</span>
              {r.value ? (
                r.field === 'link' ? (
                  <a className="ficha__value" href={r.value} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {r.value.replace(/^https:\/\/(www\.)?/, '')}
                  </a>
                ) : (
                  <span className="ficha__value">{r.value}</span>
                )
              ) : (
                <span className="ficha__value ficha__value--empty">Adicionar</span>
              )}
              <span className="ficha__edit" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="field-hint" style={{ margin: '0 4px' }}>
          {canCurate.data
            ? 'Você pode editar direto: suas mudanças entram na hora.'
            : 'Toque para sugerir uma mudança. Quem tem 3+ registros aqui aprova.'}
        </p>
        {toast && <p role="status" className="field-hint" style={{ margin: '0 4px', color: 'var(--text)' }}>{toast}</p>}

        {list.length > 0 && (
          <div className="group" aria-label="Sugestões esperando aprovação">
            {list.map((s) => (
              <div key={s.id} className="group__row ficha__sug">
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <strong style={{ fontWeight: 600 }}>
                    {FIELD_LABEL[s.field]}: {showValue(s.field, s.value)}
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    sugerido por {s.user_id === userId ? 'você' : displayName(s.author)}
                    {s.note ? ` · “${s.note}”` : ''}
                  </span>
                </span>
                {canCurate.data && s.user_id !== userId ? (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn--primary tap ficha__btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: s.id, itemId: item.id, approve: true })}>
                      Aprovar
                    </button>
                    <button type="button" className="btn btn--plain tap ficha__btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: s.id, itemId: item.id, approve: false })}>
                      Recusar
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>esperando</span>
                )}
              </div>
            ))}
          </div>
        )}
        {decide.error && <p role="alert" className="field-hint" style={{ color: 'var(--cat-filme-ink)' }}>{(decide.error as Error).message}</p>}
      </div>

      {editing && (
        <SuggestSheet
          item={item}
          field={editing}
          direct={Boolean(canCurate.data)}
          onClose={() => setEditing(null)}
          onDone={(applied) => {
            setEditing(null)
            setToast(applied ? 'Ficha atualizada.' : 'Sugestão enviada. Quem tem 3+ registros aqui vai aprovar.')
          }}
        />
      )}
    </section>
  )
}

function SuggestSheet({
  item,
  field,
  direct,
  onClose,
  onDone,
}: {
  item: Item
  field: FichaField
  direct: boolean
  onClose: () => void
  onDone: (applied: boolean) => void
}) {
  const ficha = fichaOf(item)
  const suggest = useSuggest()
  const [text, setText] = useState(
    field === 'area' ? item.subtitle ?? '' : field === 'endereco' ? ficha.endereco ?? '' : field === 'horario' ? ficha.horario ?? '' : field === 'link' ? ficha.link ?? 'https://' : '',
  )
  const [price, setPrice] = useState<number>(ficha.faixa_preco ?? 0)
  const [attrs, setAttrs] = useState<string[]>(ficha.atributos ?? [])
  const [note, setNote] = useState('')

  const value: SuggestionValue | null =
    field === 'faixa_preco' ? (price || null) : field === 'atributos' ? attrs : text.trim() ? text.trim() : null
  const invalid =
    value == null ||
    (field === 'link' && !/^https:\/\/\S{3,200}$/.test(text.trim())) ||
    ((field === 'area') && text.trim().length < 2) ||
    ((field === 'endereco' || field === 'horario') && text.trim().length < 3)

  const submit = async () => {
    if (invalid || value == null) return
    try {
      const status = await suggest.mutateAsync({ itemId: item.id, field, value, note })
      onDone(status === 'aprovada')
    } catch {
      /* mensagem abaixo */
    }
  }

  return (
    <Sheet open onClose={onClose} title={direct ? `Editar: ${FIELD_LABEL[field].toLowerCase()}` : `Sugerir: ${FIELD_LABEL[field].toLowerCase()}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(field === 'area' || field === 'endereco' || field === 'link') && (
          <label>
            <span className="field-label">{FIELD_LABEL[field]}</span>
            <input
              className="field"
              value={text}
              inputMode={field === 'link' ? 'url' : undefined}
              placeholder={field === 'area' ? 'Ex.: Pinheiros, São Paulo' : field === 'endereco' ? 'Ex.: Av. São João, 677' : 'https://instagram.com/…'}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        )}
        {field === 'horario' && (
          <label>
            <span className="field-label">Horário</span>
            <textarea className="field" rows={3} value={text} placeholder="Ex.: Ter a sáb, 17h–1h · Dom, 12h–18h" onChange={(e) => setText(e.target.value)} />
          </label>
        )}
        {field === 'faixa_preco' && (
          <div className="segmented" role="radiogroup" aria-label="Faixa de preço" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={price === n} aria-label={['Barato', 'Médio', 'Caro', 'Muito caro'][n - 1]} onClick={() => setPrice(n)}>
                {priceLabel(n)}
              </button>
            ))}
          </div>
        )}
        {field === 'atributos' && (
          <div className="chips" style={{ flexWrap: 'wrap' }} role="group" aria-label="Características">
            {ATTRIBUTES.map((a) => (
              <button
                key={a.id}
                type="button"
                className="chip tap"
                aria-pressed={attrs.includes(a.id)}
                onClick={() => setAttrs((cur) => (cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]))}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {!direct && (
          <label>
            <span className="field-label">Comentário (opcional)</span>
            <input className="field" value={note} maxLength={280} placeholder="Ex.: mudou de endereço em outubro" onChange={(e) => setNote(e.target.value)} />
          </label>
        )}
        {suggest.error && (
          <p role="alert" className="field-hint" style={{ color: 'var(--cat-filme-ink)' }}>
            Não deu para enviar: {(suggest.error as Error).message}
          </p>
        )}
        <button type="button" className="btn btn--primary tap" disabled={invalid || suggest.isPending} onClick={submit}>
          {suggest.isPending ? 'Enviando…' : direct ? 'Salvar' : 'Enviar sugestão'}
        </button>
      </div>
    </Sheet>
  )
}
