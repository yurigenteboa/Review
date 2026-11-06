// Página do filme 2.0 (F1). Usada pela rota /item/:id quando o item é um filme do TMDB.
// Ordem da tela: topo → ações → amigos → notas → onde assistir → sinopse → trailer
//                → elenco/equipe → gêneros → reviews → parecidos.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../components/movie/movie.css'
import { SOURCE_CREDIT } from '../components/review/CatalogResults'
import type { ComposeStart } from '../components/review/ComposeSheet'
import { Avatar, ReviewCard } from '../components/review/ReviewCard'
import { Glass } from '../components/ui/Glass'
import { Stars } from '../components/ui/Stars'
import { useAuth } from '../lib/auth'
import { formatRating } from '../lib/categories'
import { displayName, initials } from '../lib/format'
import {
  certificationLabel,
  formatRuntime,
  tmdbImg,
  useMovieDetails,
  type MovieDetails,
  type MovieProvider,
  type MovieSimilar,
} from '../lib/movie'
import { useDeleteReview, useItemReviews, useOpenCatalogItem, type CatalogResult } from '../lib/queries'
import { useFriends } from '../lib/social'
import type { Item, Review } from '../lib/types'
import { LoadingCards } from './states'

interface Props {
  item: Item
  onCompose: (s: ComposeStart) => void
}

export default function Filme({ item, onCompose }: Props) {
  const { userId } = useAuth()
  const movie = useMovieDetails(item)
  const reviews = useItemReviews(item.id)
  const friends = useFriends()
  const d = movie.data?.details

  const friendIds = useMemo(
    () => new Set((friends.data ?? []).filter((f) => f.status === 'aceita').map((f) => f.id)),
    [friends.data],
  )
  const list = reviews.data ?? []
  const mine = list.find((r) => r.user_id === userId)
  const fromFriends = list.filter((r) => friendIds.has(r.user_id))
  const others = list.filter((r) => r.user_id !== userId && !friendIds.has(r.user_id))

  const openCompose = () => onCompose({ category: 'filme', title: item.title, itemId: item.id })

  return (
    <div className="page">
      <Hero item={item} d={d} />

      <ActionBar item={item} d={d} mine={mine} onCompose={openCompose} />

      {movie.data?.missingKey && (
        <p className="notice">A ficha completa ainda não foi ligada (falta a chave {movie.data.missingKey} no Supabase).</p>
      )}
      {(movie.error || movie.data?.error) && !d && (
        <p className="notice" role="alert">Não deu para carregar a ficha do TMDB agora. As reviews continuam abaixo.</p>
      )}

      <FriendsBlock friendsReviews={fromFriends} mine={mine} />
      <RatingsBlock reviews={list} mine={mine} loading={reviews.isLoading} />

      {movie.isLoading && !d && (
        <div className="movie-section">
          <LoadingCards count={2} />
        </div>
      )}

      {d && (
        <>
          <WhereToWatch providers={d.providers} />
          <Synopsis text={d.overview} />
          {d.trailer && <Trailer trailer={d.trailer} />}
          <CastAndCrew d={d} />
          {d.genres.length > 0 && (
            <section className="movie-section" aria-labelledby="sec-generos">
              <h2 id="sec-generos">Gêneros</h2>
              <div className="genres">
                {d.genres.map((g) => (
                  <span key={g} className="genre">
                    {g}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ReviewsBlock mine={mine} fromFriends={fromFriends} others={others} loading={reviews.isLoading} onCompose={openCompose} />

      {d && d.recommendations.length > 0 && <SimilarRow list={d.recommendations} />}

      <p className="credit" style={{ margin: '28px var(--gutter) 0' }}>
        {SOURCE_CREDIT.filme}
      </p>
    </div>
  )
}

// ---------- Topo ----------

function Hero({ item, d }: { item: Item; d: MovieDetails | undefined }) {
  const navigate = useNavigate()
  const backdrop = tmdbImg(d?.backdrop, 'w1280')
  const poster = tmdbImg(d?.poster, 'w342') ?? item.image_url
  const runtime = formatRuntime(d?.runtime ?? null)
  const year = d?.year ?? item.year
  const directors = d?.directors ?? []

  return (
    <>
      <div className="movie-hero">
        {backdrop ? (
          <img src={backdrop} alt="" aria-hidden="true" />
        ) : (
          poster && <img src={poster} alt="" aria-hidden="true" className="movie-hero__blur" />
        )}
        <button
          type="button"
          className="glass glass--pill tap"
          aria-label="Voltar"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          style={{ position: 'absolute', top: 'calc(var(--safe-top) + 12px)', left: 16, zIndex: 2, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}
        >
          <BackChevron />
        </button>
      </div>

      <div className="movie-head">
        {poster ? (
          <img className="movie-poster" src={poster} alt={`Pôster de ${item.title}`} />
        ) : (
          <div className="movie-poster" aria-hidden="true" />
        )}
        <div style={{ minWidth: 0, paddingBottom: 2 }}>
          <h1 className="movie-title">{d?.title ?? item.title}</h1>
          {d?.original_title && <p className="movie-original">{d.original_title}</p>}
          <div className="movie-meta">
            {year && <strong>{year}</strong>}
            {runtime && (
              <>
                <span aria-hidden="true">·</span>
                <span>{runtime}</span>
              </>
            )}
            {d?.certification_br && (
              <span className="cls-badge" data-c={d.certification_br} role="img" aria-label={certificationLabel(d.certification_br)} title={certificationLabel(d.certification_br)}>
                {d.certification_br}
              </span>
            )}
          </div>
          {directors.length > 0 && (
            <div className="movie-meta" style={{ marginTop: 4 }}>
              <span>
                Direção de <strong>{directors.join(', ')}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
      {d?.tagline && <p className="movie-tagline">“{d.tagline}”</p>}
    </>
  )
}

// ---------- Barra de ações ----------

function ActionBar({ item, d, mine, onCompose }: { item: Item; d: MovieDetails | undefined; mine: Review | undefined; onCompose: () => void }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  // detecta quando a barra "gruda" no topo, para mostrar o botão de voltar dentro dela
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function share() {
    const url = window.location.href
    const title = d?.title ?? item.title
    const text = mine ? `Dei ${formatRating(mine.rating)} para ${title} no MMISC` : `${title} no MMISC`
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // a pessoa fechou a folha de compartilhar: nada a fazer
    }
  }

  return (
    <>
      <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
      <Glass variant="bar" className="movie-actions" style={stuck ? undefined : { background: 'transparent', borderBottomColor: 'transparent', WebkitBackdropFilter: 'none', backdropFilter: 'none' }}>
        {stuck && (
          <button type="button" className="icon-btn tap" aria-label="Voltar" style={{ width: 44, height: 44, borderRadius: 22, flex: 'none' }} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <BackChevron />
          </button>
        )}
        <button type="button" className="btn btn--primary tap" onClick={onCompose}>
          {mine ? (
            <>
              <Stars value={mine.rating} size={15} />
              <span>Você deu {formatRating(mine.rating)}</span>
            </>
          ) : (
            <>
              <EyeIcon />
              <span>Vi · avaliar</span>
            </>
          )}
        </button>
        <button type="button" className="btn btn--plain tap" onClick={share} aria-label={copied ? 'Link copiado' : 'Compartilhar'}>
          <ShareIcon />
          <span aria-live="polite">{copied ? 'Copiado' : ''}</span>
        </button>
      </Glass>
    </>
  )
}

// ---------- Amigos ----------

/** Diferença arredondada para meia estrela: 1 -> "1 estrela", 0,5 -> "meia estrela" */
function starsDiff(n: number): string {
  const v = Math.round(Math.abs(n) * 2) / 2
  if (v === 0.5) return 'meia estrela'
  return `${formatRating(v).replace(',0', '')} ${v >= 2 ? 'estrelas' : 'estrela'}`
}

function FriendsBlock({ friendsReviews, mine }: { friendsReviews: Review[]; mine: Review | undefined }) {
  const rated = friendsReviews.filter((r) => r.rating > 0)
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0

  let comparison: string | null = null
  if (mine && rated.length) {
    const diff = mine.rating - avg
    if (Math.abs(diff) < 0.25) comparison = 'Você deu praticamente a mesma nota que a média dos seus amigos.'
    else comparison = `Você deu ${starsDiff(diff)} a ${diff > 0 ? 'mais' : 'menos'} que a média dos seus amigos.`
  }

  return (
    <section className="movie-section" aria-labelledby="sec-amigos">
      <h2 id="sec-amigos">Seus amigos</h2>
      <div className="movie-card">
        {friendsReviews.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-callout)', color: 'var(--text-3)' }}>
            Nenhum amigo registrou este filme ainda. {mine ? 'Você foi o primeiro do grupo.' : 'Seja o primeiro do grupo.'}
          </p>
        ) : (
          <>
            <div className="friend-row no-scrollbar">
              {friendsReviews.map((r) => (
                <Link key={r.id} to={`/u/${r.user_id}`} className="friend-chip tap" aria-label={`${displayName(r.author)}: ${formatRating(r.rating)}`}>
                  <Avatar profile={r.author} size={48} />
                  <span className="friend-chip__name">{displayName(r.author)}</span>
                  <span className="friend-chip__rate">★ {formatRating(r.rating)}</span>
                </Link>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
              <span className="score-big__value">{formatRating(avg)}</span>
              <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--text-3)' }}>
                média de {rated.length} {rated.length === 1 ? 'amigo' : 'amigos'}
              </span>
            </div>
            {comparison && <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-callout)', color: 'var(--text-2)' }}>{comparison}</p>}
          </>
        )}
      </div>
    </section>
  )
}

// ---------- Notas no MMISC + histograma ----------

const BINS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

function RatingsBlock({ reviews, mine, loading }: { reviews: Review[]; mine: Review | undefined; loading: boolean }) {
  const rated = reviews.filter((r) => r.rating > 0)
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0
  const counts = BINS.map((b) => rated.filter((r) => Math.round(r.rating * 2) / 2 === b).length)
  const max = Math.max(1, ...counts)
  const mineBin = mine ? Math.round(mine.rating * 2) / 2 : null

  return (
    <section className="movie-section" aria-labelledby="sec-notas">
      <h2 id="sec-notas">Notas no MMISC</h2>
      <div className="movie-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="score-big__value">{rated.length ? formatRating(avg) : '–'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Stars value={avg} size={18} />
            <span style={{ fontSize: 'var(--fs-footnote)', color: 'var(--text-3)' }}>
              {loading ? 'Carregando…' : rated.length === 0 ? 'Ninguém deu nota ainda' : rated.length === 1 ? '1 nota' : `${rated.length} notas`}
            </span>
          </div>
        </div>
        {rated.length > 0 && (
          <>
            <div className="histo" role="img" aria-label={BINS.map((b, i) => `${formatRating(b)}: ${counts[i]}`).join('; ')}>
              {BINS.map((b, i) => (
                <div
                  key={b}
                  className="histo__bar"
                  data-filled={counts[i] > 0}
                  data-mine={mineBin === b}
                  style={{ height: `${Math.max(4, (counts[i] / max) * 100)}%` }}
                  title={`${formatRating(b)} ★ · ${counts[i]}`}
                />
              ))}
            </div>
            <div className="histo__axis" aria-hidden="true">
              <span>½ ★</span>
              <span>5 ★</span>
            </div>
            {mineBin !== null && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', marginRight: 6, verticalAlign: -1 }} />
                sua nota
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ---------- Onde assistir ----------

function ProviderGroup({ label, list }: { label: string; list: MovieProvider[] }) {
  if (!list.length) return null
  return (
    <div className="providers__group">
      <span className="providers__label">{label}</span>
      <ul className="providers__logos" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((p) => (
          <li key={p.id}>
            {p.logo ? <img src={tmdbImg(p.logo, 'w92')!} alt={p.name} title={p.name} loading="lazy" /> : <span className="genre">{p.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function WhereToWatch({ providers }: { providers: MovieDetails['providers'] }) {
  const empty = !providers || (!providers.flatrate.length && !providers.rent.length && !providers.buy.length)
  return (
    <section className="movie-section" aria-labelledby="sec-onde">
      <h2 id="sec-onde">Onde assistir no Brasil</h2>
      <div className="movie-card">
        {empty ? (
          <p style={{ margin: 0, fontSize: 'var(--fs-callout)', color: 'var(--text-3)' }}>Não está em streaming, aluguel ou venda no Brasil agora.</p>
        ) : (
          <div className="providers">
            <ProviderGroup label="Streaming" list={providers!.flatrate} />
            <ProviderGroup label="Alugar" list={providers!.rent} />
            <ProviderGroup label="Comprar" list={providers!.buy} />
          </div>
        )}
        <p className="credit">
          Dados: JustWatch
          {providers?.link && (
            <>
              {' · '}
              <a href={providers.link} target="_blank" rel="noopener noreferrer">
                ver opções
              </a>
            </>
          )}
        </p>
      </div>
    </section>
  )
}

// ---------- Sinopse ----------

function Synopsis({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  const long = text.length > 260
  return (
    <section className="movie-section" aria-labelledby="sec-sinopse">
      <h2 id="sec-sinopse">Sinopse</h2>
      <p className="synopsis" data-clamp={long && !open} id="synopsis-text">
        {text}
      </p>
      {long && (
        <button type="button" className="link-btn" aria-expanded={open} aria-controls="synopsis-text" onClick={() => setOpen((o) => !o)}>
          {open ? 'Ler menos' : 'Ler mais'}
        </button>
      )}
    </section>
  )
}

// ---------- Trailer ----------

function Trailer({ trailer }: { trailer: { key: string; name: string } }) {
  return (
    <section className="movie-section" aria-labelledby="sec-trailer">
      <h2 id="sec-trailer">Trailer</h2>
      <a
        className="trailer tap"
        href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Assistir trailer no YouTube: ${trailer.name}`}
      >
        <img src={`https://i.ytimg.com/vi/${encodeURIComponent(trailer.key)}/hqdefault.jpg`} alt="" loading="lazy" />
        <span className="trailer__play" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="trailer__name">{trailer.name}</span>
      </a>
    </section>
  )
}

// ---------- Elenco e equipe ----------

function CastAndCrew({ d }: { d: MovieDetails }) {
  if (!d.cast.length && !d.crew.length) return null
  // agrupa a equipe por função: "Roteiro — Fulano, Beltrana"
  const crew = new Map<string, string[]>()
  for (const c of d.crew) crew.set(c.role, [...(crew.get(c.role) ?? []), c.name])
  return (
    <section className="movie-section" aria-labelledby="sec-elenco">
      <h2 id="sec-elenco">Elenco e equipe</h2>
      {d.cast.length > 0 && (
        <ul className="cast-row no-scrollbar" style={{ listStyle: 'none' }}>
          {d.cast.map((p) => (
            <li key={`${p.id}-${p.role}`} className="cast-card">
              {p.photo ? (
                <img src={tmdbImg(p.photo, 'w185')!} alt="" loading="lazy" />
              ) : (
                <span className="cast-card__ph" aria-hidden="true">
                  {initials(p.name)}
                </span>
              )}
              <strong>{p.name}</strong>
              {p.role && <span>{p.role}</span>}
            </li>
          ))}
        </ul>
      )}
      {crew.size > 0 && (
        <div className="group crew-list">
          {[...crew.entries()].map(([role, names]) => (
            <div key={role} className="group__row">
              <span>{role}</span>
              <span>{names.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------- Reviews (amigos primeiro) ----------

function ReviewsBlock({
  mine,
  fromFriends,
  others,
  loading,
  onCompose,
}: {
  mine: Review | undefined
  fromFriends: Review[]
  others: Review[]
  loading: boolean
  onCompose: () => void
}) {
  const del = useDeleteReview()
  const withText = (l: Review[]) => l.filter((r) => r.body || r.photos.length)
  const friendsText = withText(fromFriends)
  const othersText = withText(others)
  const empty = !mine && friendsText.length === 0 && othersText.length === 0

  return (
    <section className="movie-section" aria-labelledby="sec-reviews">
      <h2 id="sec-reviews">Reviews</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <LoadingCards count={1} />}
        {mine && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="providers__label">A sua</span>
            <ReviewCard review={mine} showItem={false} />
            <button
              type="button"
              className="tap"
              disabled={del.isPending}
              onClick={() => {
                if (window.confirm('Apagar a sua review? Isso não pode ser desfeito.')) del.mutate(mine)
              }}
              style={{ alignSelf: 'flex-end', border: 'none', background: 'none', color: 'var(--cat-filme-ink)', fontSize: 14, fontWeight: 600, minHeight: 44 }}
            >
              Apagar minha review
            </button>
          </div>
        )}
        {friendsText.length > 0 && <span className="providers__label">Dos seus amigos</span>}
        {friendsText.map((r) => (
          <ReviewCard key={r.id} review={r} showItem={false} />
        ))}
        {othersText.length > 0 && <span className="providers__label">De outras pessoas</span>}
        {othersText.map((r) => (
          <ReviewCard key={r.id} review={r} showItem={false} />
        ))}
        {!loading && empty && (
          <div className="movie-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-3)' }}>Ninguém escreveu sobre este filme ainda.</span>
            <button type="button" className="btn btn--plain tap" onClick={onCompose}>
              Escrever a primeira
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- Parecidos ----------

function toCatalog(m: MovieSimilar): CatalogResult {
  return {
    source: 'tmdb-movie',
    external_id: String(m.id),
    category: 'filme',
    title: m.title,
    subtitle: [m.year, m.original_title && m.original_title !== m.title ? m.original_title : null].filter(Boolean).join(' · ') || null,
    image_url: tmdbImg(m.poster, 'w342'),
    year: m.year,
    lat: null,
    lng: null,
    metadata: { overview: m.overview, original_title: m.original_title },
  }
}

function SimilarRow({ list }: { list: MovieSimilar[] }) {
  const navigate = useNavigate()
  const open = useOpenCatalogItem()
  const [busy, setBusy] = useState<number | null>(null)

  async function go(m: MovieSimilar) {
    setBusy(m.id)
    try {
      const id = await open.mutateAsync(toCatalog(m))
      navigate(`/item/${id}`)
      window.scrollTo({ top: 0 })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="movie-section" aria-labelledby="sec-parecidos">
      <h2 id="sec-parecidos">Parecidos</h2>
      <div className="similar-row no-scrollbar">
        {list.map((m) => (
          <button key={m.id} type="button" className="similar-card tap" aria-busy={busy === m.id} disabled={busy !== null} onClick={() => go(m)}>
            <img src={tmdbImg(m.poster, 'w185')!} alt="" loading="lazy" />
            <strong>{m.title}</strong>
            {m.year && <span>{m.year}</span>}
          </button>
        ))}
      </div>
      {open.error && (
        <p className="credit" role="alert">
          Não deu para abrir esse filme agora.
        </p>
      )}
    </section>
  )
}

// ---------- Ícones locais ----------

function BackChevron() {
  return (
    <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2L2 10l8 8" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
