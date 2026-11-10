import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { VisibilityPicker } from '../components/profile/ProfileSections'
import '../components/profile/profile.css'
import { Cover } from '../components/review/ReviewCard'
import { PageHeader } from '../components/ui/PageHeader'
import { runImport, matchFilms, type ImportResult } from '../lib/importLetterboxd'
import { buildExport, filmKey, readLetterboxdFiles, uniqueFilms, type FilmMatch, type LbExport } from '../lib/letterboxd'
import type { Visibility } from '../lib/types'

import { t, tp } from '../lib/i18n'
type Step =
  | { kind: 'arquivo' }
  | { kind: 'resumo'; exp: LbExport; files: Record<string, string> }
  | { kind: 'buscando'; exp: LbExport; done: number; total: number }
  | { kind: 'conferir'; exp: LbExport; matches: FilmMatch[] }
  | { kind: 'gravando'; label: string; done: number; total: number }
  | { kind: 'pronto'; result: ImportResult }

/** Importar do Letterboxd: arquivo → resumo → procurar no TMDB → conferir → gravar. */
export default function ImportLetterboxd() {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>({ kind: 'arquivo' })
  const [error, setError] = useState<string | null>(null)
  const [includeUndated, setIncludeUndated] = useState(true)
  const [includeWatchlist, setIncludeWatchlist] = useState(true)
  const [visibility, setVisibility] = useState<Visibility>('amigos')
  const cancel = useRef({ cancelled: false })

  const onFiles = async (list: FileList | null) => {
    setError(null)
    if (!list?.length) return
    try {
      const files = await readLetterboxdFiles([...list])
      const exp = buildExport(files, includeUndated)
      if (!exp.found.length) throw new Error(t('Não achei os arquivos do Letterboxd. Escolha o .zip do export (ou diary.csv, reviews.csv, watchlist.csv…).'))
      if (!exp.entries.length && !exp.watchlist.length) throw new Error(t('O arquivo não tem filmes para importar.'))
      setStep({ kind: 'resumo', exp, files })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const search = async (exp: LbExport) => {
    setError(null)
    cancel.current = { cancelled: false }
    const films = uniqueFilms(exp)
    setStep({ kind: 'buscando', exp, done: 0, total: films.length })
    try {
      const matches = await matchFilms(films, (done) => setStep({ kind: 'buscando', exp, done, total: films.length }), cancel.current)
      if (cancel.current.cancelled) return setStep({ kind: 'arquivo' })
      setStep({ kind: 'conferir', exp, matches })
    } catch (e) {
      setError((e as Error).message)
      setStep({ kind: 'arquivo' })
    }
  }

  const save = async (exp: LbExport, matches: FilmMatch[]) => {
    setError(null)
    setStep({ kind: 'gravando', label: t('Começando'), done: 0, total: 1 })
    try {
      const result = await runImport(exp, matches, visibility, includeWatchlist, (label, done, total) => setStep({ kind: 'gravando', label, done, total }))
      await qc.invalidateQueries()
      setStep({ kind: 'pronto', result })
    } catch (e) {
      setError(t('A importação parou: {v}. O que já foi gravado fica; rodar de novo não duplica.', { v: (e as Error).message.replace(/\.+$/, '') }))
      setStep({ kind: 'conferir', exp, matches })
    }
  }

  return (
    <div className="page">
      <PageHeader title={t('Importar do Letterboxd')} subtitle={t('Diário, notas, reviews, ♥ e watchlist')} />
      <div className="page__body import">
        {error && (
          <p role="alert" className="form-error import__error">
            {error}
          </p>
        )}

        {step.kind === 'arquivo' && (
          <>
            <section className="profile-section import__card">
              <h2 className="profile-section__title">{t('1. Baixe seus dados no Letterboxd')}</h2>
              <p className="profile-section__hint">
                {t('No site do Letterboxd: Settings → Import & Export → {botao}. Ele baixa um .zip. Não precisa abrir.', { botao: <strong>Export your data</strong> })}
              </p>
              <a className="link-btn" href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener noreferrer">
                {t('Abrir a página de export do Letterboxd')}
              </a>
            </section>
            <section className="profile-section import__card">
              <h2 className="profile-section__title">{t('2. Escolha o arquivo')}</h2>
              <label className="btn btn--primary tap import__file">
                {t('Escolher o .zip (ou os CSVs)')}
                <input type="file" accept=".zip,.csv,application/zip,text/csv" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              </label>
              <label className="import__check">
                <input type="checkbox" checked={includeUndated} onChange={(e) => setIncludeUndated(e.target.checked)} />
                <span>
                  {t('Incluir filmes que você marcou como vistos ou deu nota fora do diário')}
                  <span className="profile-section__hint"> {t('(entram com a data em que você marcou)')}</span>
                </span>
              </label>
              <label className="import__check">
                <input type="checkbox" checked={includeWatchlist} onChange={(e) => setIncludeWatchlist(e.target.checked)} />
                <span>{t('Trazer a watchlist para o “Quero ver”')}</span>
              </label>
              <VisibilityPicker value={visibility} onChange={setVisibility} />
              <p className="profile-section__hint">
                {t('Quem vê as entradas importadas. Dá para mudar uma a uma depois. Nada é publicado no feed dos seus amigos como novo: cada entrada fica na data em que você registrou no Letterboxd.')}
              </p>
            </section>
          </>
        )}

        {step.kind === 'resumo' && (
          <section className="profile-section import__card">
            <h2 className="profile-section__title">{t('Encontrei no seu export')}</h2>
            <dl className="profile__stats import__stats">
              <div>
                <dt>{t('entradas no diário')}</dt>
                <dd>{step.exp.entries.length}</dd>
              </div>
              <div>
                <dt>{t('filmes diferentes')}</dt>
                <dd>{uniqueFilms(step.exp).length}</dd>
              </div>
              <div>
                <dt>{t('na watchlist')}</dt>
                <dd>{step.exp.watchlist.length}</dd>
              </div>
            </dl>
            <p className="profile-section__hint">
              {t('Com review: {review} · com ♥: {curtidos} · revistos: {revistos}', { review: step.exp.entries.filter((e) => e.review).length, curtidos: step.exp.entries.filter((e) => e.loved).length, revistos: step.exp.entries.filter((e) => e.rewatch).length })}
              {step.exp.entries.some((e) => e.undated) && t(' · fora do diário: {n}', { n: step.exp.entries.filter((e) => e.undated).length })}
            </p>
            <p className="profile-section__hint">{t('Arquivos lidos: {v}.', { v: step.exp.found.join(', ') })}</p>
            <p className="profile-section__hint">
              {t('Agora procuro cada filme no TMDB. Leva cerca de {min} min para {n} filmes; deixe esta tela aberta.', {
                min: Math.max(1, Math.round(uniqueFilms(step.exp).length / 5 / 60)),
                n: uniqueFilms(step.exp).length,
              })}
            </p>
            <button type="button" className="btn btn--primary tap" onClick={() => search(step.exp)}>
              {t('Procurar os filmes')}
            </button>
            <button type="button" className="btn btn--plain tap" onClick={() => setStep({ kind: 'arquivo' })}>
              {t('Escolher outro arquivo')}
            </button>
          </section>
        )}

        {step.kind === 'buscando' && (
          <section className="profile-section import__card" aria-live="polite">
            <h2 className="profile-section__title">{t('Procurando no TMDB…')}</h2>
            <Progress done={step.done} total={step.total} />
            <p className="profile-section__hint">
              {t('{done} de {total} filmes. Não feche esta tela.', { done: step.done, total: step.total })}
            </p>
            <button type="button" className="btn btn--plain tap" onClick={() => (cancel.current.cancelled = true)}>
              {t('Cancelar')}
            </button>
          </section>
        )}

        {step.kind === 'conferir' && <Review exp={step.exp} matches={step.matches} includeWatchlist={includeWatchlist} onSave={(m) => save(step.exp, m)} />}

        {step.kind === 'gravando' && (
          <section className="profile-section import__card" aria-live="polite">
            <h2 className="profile-section__title">{step.label}…</h2>
            <Progress done={step.done} total={step.total} />
            <p className="profile-section__hint">{t('Não feche esta tela.')}</p>
          </section>
        )}

        {step.kind === 'pronto' && (
          <section className="profile-section import__card">
            <h2 className="profile-section__title">{t('Pronto!')}</h2>
            <ul className="import__done">
              <li>
                {tp(step.result.diaryAdded, '{n} entrada no diário', '{n} entradas no diário', { n: <strong>{step.result.diaryAdded}</strong> })}
              </li>
              {step.result.watchlistAdded > 0 && (
                <li>
                  {tp(step.result.watchlistAdded, '{n} filme no Quero ver', '{n} filmes no Quero ver', { n: <strong>{step.result.watchlistAdded}</strong> })}
                </li>
              )}
              {step.result.diarySkipped > 0 && <li>
                  {tp(step.result.diarySkipped, '{n} já estava no seu diário (não dupliquei)', '{n} já estavam no seu diário (não dupliquei)')}
                </li>}
              {step.result.filmsSkipped > 0 && <li>
                  {tp(step.result.filmsSkipped, '{n} filme ficou de fora (não achado ou você pulou)', '{n} filmes ficaram de fora (não achado ou você pulou)')}
                </li>}
            </ul>
            <Link to="/perfil?cat=filme" className="btn btn--primary tap public-cta__btn">
              {t('Ver no perfil')}
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="goal__bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Conferir: os duvidosos primeiro (escolher o certo ou pular), depois os não achados e os certos. */
function Review({ exp, matches: initial, includeWatchlist, onSave }: { exp: LbExport; matches: FilmMatch[]; includeWatchlist: boolean; onSave: (m: FilmMatch[]) => void }) {
  const [matches, setMatches] = useState(initial)
  const [showOk, setShowOk] = useState(false)
  const setChosen = (i: number, external: string | null) =>
    setMatches((ms) => ms.map((m, j) => (j === i ? { ...m, chosen: external ? (m.options.find((o) => o.external_id === external) ?? null) : null } : m)))

  const counts = { certo: 0, duvidoso: 0, nao_achado: 0 }
  for (const m of matches) counts[m.status]++
  const chosenKeys = new Set(matches.filter((m) => m.chosen).map((m) => filmKey(m.film)))
  const entries = exp.entries.filter((e) => chosenKeys.has(filmKey(e))).length
  const wl = includeWatchlist ? exp.watchlist.filter((w) => chosenKeys.has(filmKey(w))).length : 0

  const row = (m: FilmMatch, i: number) => (
    <li key={filmKey(m.film)} className="import__match">
      <p className="import__film">
        <strong>{m.film.name}</strong> {m.film.year ?? t('s/ ano')} <span className="profile-section__hint">{t('(no Letterboxd)')}</span>
      </p>
      <div className="import__options" role="radiogroup" aria-label={t('Qual filme é {name}?', { name: m.film.name })}>
        {m.options.map((o) => (
          <label key={o.external_id} className={`import__option tap${m.chosen?.external_id === o.external_id ? ' is-on' : ''}`}>
            <input type="radio" name={`m${i}`} checked={m.chosen?.external_id === o.external_id} onChange={() => setChosen(i, o.external_id)} />
            <Cover item={{ title: o.title, category: 'filme', image_url: o.image_url }} size={36} radius={6} />
            <span>
              {o.title} <span className="profile-section__hint">{o.year ?? ''}</span>
            </span>
          </label>
        ))}
        <label className={`import__option tap${!m.chosen ? ' is-on' : ''}`}>
          <input type="radio" name={`m${i}`} checked={!m.chosen} onChange={() => setChosen(i, null)} />
          <span>{t('Não importar este')}</span>
        </label>
      </div>
    </li>
  )

  return (
    <>
      <section className="profile-section import__card">
        <h2 className="profile-section__title">{t('Confira antes de gravar')}</h2>
        <dl className="profile__stats import__stats">
          <div>
            <dt>{t('certos')}</dt>
            <dd>{counts.certo}</dd>
          </div>
          <div>
            <dt>{t('com dúvida')}</dt>
            <dd>{counts.duvidoso}</dd>
          </div>
          <div>
            <dt>{t('não achados')}</dt>
            <dd>{counts.nao_achado}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn--primary tap" onClick={() => onSave(matches)} disabled={!entries && !wl}>
          {wl ? tp(entries, 'Importar {n} entrada e {quero} do Quero ver', 'Importar {n} entradas e {quero} do Quero ver', { quero: wl }) : tp(entries, 'Importar {n} entrada', 'Importar {n} entradas')}
        </button>
      </section>

      {counts.duvidoso > 0 && (
        <section className="profile-section">
          <h2 className="profile-section__title">{t('Com dúvida ({duvidoso})', { duvidoso: counts.duvidoso })}</h2>
          <p className="profile-section__hint">{t('Já deixei marcado o mais provável. Troque se estiver errado.')}</p>
          <ul className="import__list">{matches.map((m, i) => (m.status === 'duvidoso' ? row(m, i) : null))}</ul>
        </section>
      )}

      {counts.nao_achado > 0 && (
        <section className="profile-section">
          <h2 className="profile-section__title">{t('Não achados ({nao_achado})', { nao_achado: counts.nao_achado })}</h2>
          <p className="profile-section__hint">{t('Ficam de fora. Dá para registrar na mão depois pelo +.')}</p>
          <p className="import__names">
            {matches
              .filter((m) => m.status === 'nao_achado')
              .map((m) => `${m.film.name}${m.film.year ? ` (${m.film.year})` : ''}`)
              .join(' · ')}
          </p>
        </section>
      )}

      {counts.certo > 0 && (
        <section className="profile-section">
          <div className="profile-section__head">
            <h2 className="profile-section__title">{t('Certos ({n})', { n: counts.certo })}</h2>
            <button type="button" className="link-btn" onClick={() => setShowOk((s) => !s)}>
              {showOk ? t('Esconder') : t('Ver e trocar')}
            </button>
          </div>
          {showOk && <ul className="import__list">{matches.map((m, i) => (m.status === 'certo' ? row(m, i) : null))}</ul>}
        </section>
      )}
    </>
  )
}
