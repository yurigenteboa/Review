import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RatingBars, YearHeatmap } from '../components/profile/ProfileCharts'
import { Achievements, LinksRow } from '../components/profile/ProfileSections'
import '../components/profile/profile.css'
import { Avatar, Cover } from '../components/review/ReviewCard'
import { SpoilerText } from '../components/review/SpoilerText'
import { Glass } from '../components/ui/Glass'
import { Stars } from '../components/ui/Stars'
import { useAuth } from '../lib/auth'
import { CATEGORIES, categoryById, formatRating, type CategoryId } from '../lib/categories'
import { formatDay } from '../lib/diary'
import { displayName } from '../lib/format'
import { CATEGORY_PLURAL, coverImages, latestPerItem, ratingHistogram, summary, tasteLabels } from '../lib/profileStats'
import { asReviews, parseHandle, usePublicProfile, type PublicProfileData } from '../lib/publicProfile'
import type { Item } from '../lib/types'
import { ErrorState, LoadingCards } from './states'

const thisYear = new Date().getFullYear()

const NOW_VERB: Record<CategoryId, string> = {
  album: 'ouvindo', filme: 'vendo', serie: 'vendo', jogo: 'jogando', livro: 'lendo', bar: 'indo ao', banheiro: 'usando', cidade: 'em',
}

/**
 * Perfil público: mmisc.com.br/@usuario. Abre sem login e mostra só o que é público
 * (o banco filtra). Logado, mostra um aviso com o link para a versão completa no app.
 */
export default function PublicProfile() {
  const location = useLocation()
  const handle = parseHandle(location.pathname)
  const { session, userId } = useAuth()
  const query = usePublicProfile(handle)
  const d = query.data

  useEffect(() => {
    if (d) document.title = `${displayName(d.profile)} (@${d.profile.username}) · MMISC`
    return () => {
      document.title = 'MMISC'
    }
  }, [d])

  if (query.isLoading) return <Shell><div className="page__body"><LoadingCards count={2} /></div></Shell>
  if (query.error) return <Shell><ErrorState error={query.error} /></Shell>
  if (!d)
    return (
      <Shell>
        <div className="public-missing">
          <h1>Perfil não encontrado</h1>
          <p>Esse @ não existe ou a pessoa deixou o perfil privado.</p>
          <Link to="/" className="btn btn--primary tap public-cta__btn">
            {session ? 'Voltar ao MMISC' : 'Conhecer o MMISC'}
          </Link>
        </div>
      </Shell>
    )

  const isMe = userId === d.profile.id
  return <PublicView data={d} loggedIn={Boolean(session)} isMe={isMe} />
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="page profile public-page">{children}</div>
}

function PublicView({ data: d, loggedIn, isMe }: { data: PublicProfileData; loggedIn: boolean; isMe: boolean }) {
  const p = d.profile
  const reviews = asReviews(d)
  const stats = summary(reviews, String(thisYear))
  const labels = tasteLabels(reviews)
  const covers = coverImages(reviews)
  const recent = reviews.filter((r) => r.rating != null || r.body).slice(0, 20)
  const first = displayName(p).split(' ')[0]

  // Vitrine: as categorias que a pessoa escolheu; se não escolheu, as que têm favorito.
  const favCats = CATEGORIES.map((c) => c.id).filter((c) => d.favorites.some((f) => f.category === c))
  const showcase = (p.showcase?.length ? p.showcase.filter((c) => favCats.includes(c)) : favCats)
  // Top 10: o ano atual; se não tiver, o anterior.
  const rankYear = d.rankings.some((r) => r.year === thisYear) ? thisYear : thisYear - 1
  const ranks = d.rankings.filter((r) => r.year === rankYear)
  const rankCats = CATEGORIES.map((c) => c.id).filter((c) => ranks.some((r) => r.category === c))

  const itemLink = (item: Item, children: ReactNode, className: string) =>
    loggedIn ? (
      <Link to={`/item/${item.id}`} className={`${className} tap`}>
        {children}
      </Link>
    ) : (
      <span className={className}>{children}</span>
    )

  return (
    <Shell>
      <div className="profile__cover" aria-hidden="true">
        {p.cover_mode === 'foto' && p.cover_url ? (
          <img className="profile__cover-photo" src={p.cover_url} alt="" />
        ) : covers.length >= 3 ? (
          <div className="profile__mosaic">
            {covers.slice(0, 6).map((src) => (
              <span key={src} style={{ backgroundImage: `url("${src.replace(/"/g, '%22')}")` }} />
            ))}
          </div>
        ) : null}
      </div>

      {loggedIn && (
        <Glass variant="pill" className="public-banner">
          <span>{isMe ? 'Assim seu perfil aparece para quem tem o link.' : 'Versão pública do perfil.'}</span>
          <Link to={isMe ? '/perfil' : `/u/${p.id}`}>{isMe ? 'Voltar' : 'Abrir no app'}</Link>
        </Glass>
      )}

      <Glass className="profile__card">
        <div className="profile__identity">
          <Avatar profile={p} size={76} />
          <div className="profile__names">
            <h1>{displayName(p)}</h1>
            <span>@{p.username}</span>
          </div>
        </div>
        {p.bio && <p className="profile__bio">{p.bio}</p>}
        <LinksRow links={p.links ?? []} />
        {d.now.length > 0 && (
          <div className="now-line">
            <p>
              <span className="now-line__dot" aria-hidden="true" />
              {d.now.map((n, i) => (
                <span key={n.category}>
                  {i > 0 && ' · '}
                  {NOW_VERB[n.category]} <strong>{n.item.title}</strong>
                </span>
              ))}
            </p>
          </div>
        )}
        {labels.length > 0 && (
          <ul className="taste-labels" aria-label="Rótulos de gosto">
            {labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <dl className="profile__stats">
          <div>
            <dt>em {thisYear}</dt>
            <dd>{stats.entriesThisYear}</dd>
          </div>
          <div>
            <dt>{stats.items === 1 ? 'item' : 'itens'}</dt>
            <dd>{stats.items}</dd>
          </div>
          <div>
            <dt>nota média</dt>
            <dd>{stats.average != null ? formatRating(stats.average) : '–'}</dd>
          </div>
        </dl>
      </Glass>

      <div className="profile__sections">
        {!loggedIn && (
          <section className="profile-section public-cta">
            <p>
              <strong>{first}</strong> usa o MMISC para dar nota para tudo: álbuns, filmes, bares, banheiros, cidades.
            </p>
            <Link to="/" className="btn btn--primary tap public-cta__btn">
              Entrar no MMISC
            </Link>
            <span className="profile-section__hint">Sem senha: com o Google ou um código por e-mail.</span>
          </section>
        )}

        {showcase.length > 0 && (
          <section className="profile-section" aria-labelledby="pub-favs">
            <h2 id="pub-favs" className="profile-section__title">Favoritos</h2>
            {showcase.map((c) => (
              <div key={c} className="fav-group">
                {showcase.length > 1 && <h3 className="fav-group__title">{categoryById(c).label}</h3>}
                <div className="fav-row">
                  {d.favorites
                    .filter((f) => f.category === c)
                    .map((f) => (
                      <div key={f.position} className="fav-row__item">
                        {itemLink(
                          f.item,
                          <>
                            <span className="fav-row__cover">
                              <Cover item={f.item} fill radius={12} />
                            </span>
                            <span className="fav-row__title">{f.item.title}</span>
                          </>,
                          'fav-row__link',
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {ranks.length > 0 && (
          <section className="profile-section" aria-labelledby="pub-top">
            <h2 id="pub-top" className="profile-section__title">Top 10 de {rankYear}</h2>
            {rankCats.map((c) => (
              <div key={c} className="fav-group">
                <h3 className="fav-group__title">{CATEGORY_PLURAL[c]}</h3>
                <ol className="top-list">
                  {ranks
                    .filter((r) => r.category === c)
                    .map((r) => (
                      <li key={r.item.id}>
                        {itemLink(
                          r.item,
                          <>
                            <span className="top-list__pos">{r.position}</span>
                            <Cover item={r.item} size={40} radius={8} />
                            <span className="top-list__title">{r.item.title}</span>
                          </>,
                          'group__row top-list__row',
                        )}
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </section>
        )}

        {reviews.length > 0 && (
          <>
            <section className="profile-section" aria-labelledby="pub-activity">
              <h2 id="pub-activity" className="profile-section__title">Atividade</h2>
              <YearHeatmap entries={reviews} color="var(--accent)" />
            </section>
            <section className="profile-section" aria-labelledby="pub-ratings">
              <h2 id="pub-ratings" className="profile-section__title">Notas</h2>
              <RatingBars bins={ratingHistogram(reviews)} color="var(--accent)" average={stats.average} />
            </section>
          </>
        )}

        <Achievements entries={reviews} isMe={false} />

        <section className="profile-section" aria-labelledby="pub-recent">
          <h2 id="pub-recent" className="profile-section__title">Recentes</h2>
          {recent.length === 0 ? (
            <p className="profile-section__hint">Nenhuma review pública ainda.</p>
          ) : (
            <ul className="public-reviews">
              {recent.map((r) => (
                <li key={r.id}>
                  <Cover item={r.item} size={48} radius={8} />
                  <div className="public-reviews__body">
                    <strong>{r.item.title}</strong>
                    <span className="public-reviews__meta">
                      {r.rating != null && <Stars value={r.rating} size={12} />}
                      {r.loved && <span className="best-row__loved" aria-label="curtiu">♥</span>}
                      <span>{formatDay(r.experienced_at)}</span>
                    </span>
                    {r.body && <SpoilerText text={r.body} whole={r.spoiler} className="public-reviews__text" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {latestPerItem(reviews).length > recent.length && (
            <p className="profile-section__hint" style={{ marginTop: 10 }}>
              Mostrando as 20 mais recentes.
            </p>
          )}
        </section>

        <nav className="legal__nav" aria-label="Páginas do MMISC" style={{ marginTop: 8 }}>
          <Link to="/sobre">Sobre</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
        </nav>
      </div>
    </Shell>
  )
}
