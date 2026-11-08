import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CatalogResults, NearMeButton } from '../components/review/CatalogResults'
import type { ComposeStart } from '../components/review/ComposeSheet'
import { Cover } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { SearchIcon } from '../components/ui/Icons'
import { PageHeader } from '../components/ui/PageHeader'
import { categoryById, PLACE_SEARCH, type CategoryId } from '../lib/categories'
import { useDebounced, useNearMe } from '../lib/hooks'
import { useFinePointer } from '../lib/breakpoints'
import { useCatalogSearch, useOpenCatalogItem, useSearchItems } from '../lib/queries'
import { track } from '../lib/telemetry'

export default function Buscar({ onCompose }: { onCompose: (s: ComposeStart) => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const term = useDebounced(q.trim(), 400)
  const { near, status, request, clear } = useNearMe()
  const placeCat = cat !== 'all' && PLACE_SEARCH.includes(cat)
  // Com mouse/teclado, o cursor já entra no campo (no celular não: abriria o teclado sozinho)
  const finePointer = useFinePointer()

  const local = useSearchItems(term, cat)
  const external = useCatalogSearch(cat, term, placeCat ? near : null)
  const open = useOpenCatalogItem()

  const known = useMemo(
    () => new Set((local.data ?? []).filter((i) => i.external_id).map((i) => `${i.source}:${i.external_id}`)),
    [local.data],
  )

  const showExternal: boolean = term.length >= 2 || (placeCat && Boolean(near))

  // Fase 0: busca que não achou nada (só a categoria e o tamanho do termo; o texto não sai do aparelho)
  const nothingFound =
    term.length >= 2 && local.isSuccess && external.isSuccess &&
    (local.data ?? []).length === 0 && (external.data?.results ?? []).length === 0
  useEffect(() => {
    if (nothingFound) track('search_empty', { categoria: cat, letras: term.length })
  }, [nothingFound]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page page--wide">
      <PageHeader
        title="Buscar"
        trailing={
          <Link to="/mapa" className="btn btn--plain tap" style={{ minHeight: 44, padding: '0 16px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            Mapa
          </Link>
        }
      >
        <label className="search-field">
          <span style={{ color: 'var(--text-3)', display: 'flex' }}>
            <SearchIcon size={18} />
          </span>
          <span className="visually-hidden">Buscar</span>
          <input
            id="busca-campo"
            type="search"
            autoFocus={finePointer}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={cat === 'all' ? 'Álbuns, filmes, bares, banheiros…' : `Buscar ${categoryById(cat).label.toLowerCase()}…`}
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <CategoryChips value={cat} onChange={setCat} />
        </div>
        {placeCat && (
          <div style={{ marginTop: 10 }}>
            <NearMeButton active={Boolean(near)} status={status} onRequest={request} onClear={clear} />
          </div>
        )}
      </PageHeader>

      <div className="page__body search-results">
        {(local.data?.length ?? 0) > 0 && (
          <section aria-label="Já no MMisc" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="field-label" style={{ margin: '4px 4px 0' }}>
              {term ? 'Já no MMisc' : 'Adicionados recentemente'}
            </span>
            <div className="group">
              {local.data!.slice(0, term ? 10 : 15).map((i) => (
                <Link key={i.id} to={`/item/${i.id}`} className="group__row tap" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Cover item={i} size={44} radius={10} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <strong style={{ fontWeight: 600, fontSize: 16 }}>{i.title}</strong>
                    <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {categoryById(i.category).label}
                      {i.parent_title ? ` · no ${i.parent_title}` : ''}
                      {i.subtitle ? ` · ${i.subtitle}` : ''}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {showExternal && cat !== 'all' && (
          <CatalogResults
            category={cat}
            results={external.data?.results}
            loading={external.isFetching}
            missingKey={external.data?.missingKey}
            error={external.error ? String(external.error) : external.data?.error}
            hide={known}
            onPick={async (r) => {
              const id = await open.mutateAsync(r)
              navigate(`/item/${id}`)
            }}
          />
        )}

        {cat === 'all' && term.length >= 2 && (
          <p style={{ margin: '0 4px', fontSize: 14, color: 'var(--text-3)' }}>
            Escolha uma categoria acima para buscar também na internet (filmes, álbuns, jogos, livros, lugares).
          </p>
        )}

        {term.length >= 2 && (
          <button
            type="button"
            className="btn btn--plain tap"
            onClick={() => onCompose({ title: term, category: cat === 'all' ? undefined : cat })}
          >
            Não achou? Criar “{term}” manualmente
          </button>
        )}

        {open.isPending && <span role="status" className="field-hint">Abrindo…</span>}
        {open.error && (
          <span role="alert" style={{ color: 'var(--cat-filme-ink)', fontSize: 14 }}>
            Não deu para abrir: {(open.error as Error).message}
          </span>
        )}
      </div>
    </div>
  )
}
