import type { CategoryId } from '../../lib/categories'
import type { CatalogResult } from '../../lib/queries'
import { Cover } from './ReviewCard'

/** Crédito obrigatório de cada fonte. */
export const SOURCE_CREDIT: Record<CategoryId, string> = {
  album: 'Dados: MusicBrainz · capas: Cover Art Archive',
  filme: 'Dados e pôsteres: TMDB. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.',
  serie: 'Dados e pôsteres: TMDB. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.',
  jogo: 'Dados e capas: IGDB',
  livro: 'Dados e capas: Open Library',
  bar: 'Lugares: Overture Maps e © colaboradores do OpenStreetMap',
  banheiro: 'Lugares: © colaboradores do OpenStreetMap',
  cidade: 'Cidades: IBGE e © colaboradores do OpenStreetMap',
  drink: '',
  prato: '',
  restaurante: 'Lugares: Overture Maps e © colaboradores do OpenStreetMap',
  cafe: 'Lugares: Overture Maps e © colaboradores do OpenStreetMap',
}

interface Props {
  category: CategoryId
  results: CatalogResult[] | undefined
  loading: boolean
  missingKey?: string
  error?: string | null
  onPick: (r: CatalogResult) => void
  /** esconde resultados que já existem no catálogo do MMISC */
  hide?: Set<string>
  limit?: number
  /** título da lista (padrão "Na internet"); ex.: "Você está em algum destes?" com a localização */
  label?: string
}

/** Lista "Na internet": resultados das APIs externas, prontos para virar item. */
export function CatalogResults({ category, results, loading, missingKey, error, onPick, hide, limit = 12, label = 'Na internet' }: Props) {
  const list = (results ?? []).filter((r) => !hide?.has(`${r.source}:${r.external_id}`)).slice(0, limit)

  return (
    <section aria-label="Resultados na internet" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="field-label" style={{ margin: '4px 4px 0' }}>
        {label}
      </span>
      <div className="group">
        {loading && <div className="group__row" style={{ color: 'var(--text-3)' }}>Buscando…</div>}
        {missingKey && (
          <div className="group__row" style={{ color: 'var(--text-3)', fontSize: 14 }}>
            A busca dessa categoria ainda não foi ligada (falta a chave {missingKey} no Supabase).
          </div>
        )}
        {error && !missingKey && (
          <div className="group__row" style={{ color: 'var(--text-3)', fontSize: 14 }}>
            A fonte não respondeu agora. Tente de novo em instantes.
          </div>
        )}
        {!loading && !missingKey && !error && results && list.length === 0 && (
          <div className="group__row" style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Nada encontrado. Você pode criar manualmente.
          </div>
        )}
        {list.map((r) => (
          <button
            key={`${r.source}:${r.external_id}`}
            type="button"
            className="group__row tap"
            onClick={() => onPick(r)}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
          >
            <Cover item={{ title: r.title, category: r.category, image_url: r.image_url }} size={44} radius={category === 'album' ? 8 : 10} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <strong style={{ fontWeight: 600, fontSize: 16 }}>{r.title}</strong>
              {r.subtitle && (
                <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.subtitle}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      <span className="field-hint">{SOURCE_CREDIT[category]}</span>
    </section>
  )
}

/** Botão "Perto de mim" para bares e banheiros. */
export function NearMeButton({
  active,
  status,
  onRequest,
  onClear,
}: {
  active: boolean
  status: 'idle' | 'loading' | 'denied' | 'error'
  onRequest: () => void
  onClear: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="chip tap"
        aria-pressed={active}
        onClick={active ? onClear : onRequest}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
        {status === 'loading' ? 'Localizando…' : active ? 'Perto de mim ✓' : 'Perto de mim'}
      </button>
      {status === 'denied' && <span className="field-hint" style={{ margin: 0 }}>Permita a localização nas configurações do navegador.</span>}
      {status === 'error' && <span className="field-hint" style={{ margin: 0 }}>Não deu para pegar sua localização.</span>}
    </div>
  )
}
