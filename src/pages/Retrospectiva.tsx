import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../components/profile/profile.css'
import { Cover } from '../components/review/ReviewCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../lib/auth'
import { drawWordmark } from '../lib/brand'
import { catColor, categoryById, formatRating } from '../lib/categories'
import { displayName } from '../lib/format'
import { useProfileFull } from '../lib/profile'
import { useRankings } from '../lib/profileData'
import { CATEGORY_PLURAL, tasteLabels } from '../lib/profileStats'
import { useUserReviews } from '../lib/queries'
import { computeRetro, MONTHS_LONG, type RetroData } from '../lib/retro'
import { ErrorState, LoadingCards } from './states'

import { locale, t, tp } from '../lib/i18n'
const thisYear = new Date().getFullYear()
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
}

/** Retrospectiva do ano (/retrospectiva?ano=2026): só do próprio diário. */
export default function Retrospectiva() {
  const { userId } = useAuth()
  const [params, setParams] = useSearchParams()
  const year = Number(params.get('ano')) || thisYear
  const reviews = useUserReviews(userId)
  const profile = useProfileFull(userId)
  const ranks = useRankings(userId, year)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  if (reviews.error) return <div className="page"><ErrorState error={reviews.error} /></div>
  if (!reviews.data || !profile.data) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>

  const all = reviews.data
  const r = computeRetro(all, year)
  const labels = tasteLabels(all.filter((x) => x.experienced_at.startsWith(String(year))))
  const name = displayName(profile.data)
  const years = [...new Set(all.map((x) => Number(x.experienced_at.slice(0, 4))))].sort((a, b) => b - a).slice(0, 4)
  const top = (ranks.data ?? []).filter((x) => x.position <= 3)

  const share = async () => {
    setSharing(true)
    setShareError(null)
    try {
      const blob = await drawStory(r, name, labels)
      const file = new File([blob], `mmisc-${year}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('Meu {year} no MMisc', { year }) })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareError(t('Não deu para gerar a imagem. Tente de novo.'))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={t('Seu {year}', { year })} subtitle={year === thisYear ? t('Até agora') : t('Retrospectiva')}>
        {years.length > 1 && (
          <div className="chips no-scrollbar" role="group" aria-label={t('Ano')}>
            {years.map((y) => (
              <button key={y} type="button" className="chip tap" aria-pressed={y === year} onClick={() => setParams({ ano: String(y) }, { replace: true })}>
                {y}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="page__body retro">
        {r.entries === 0 ? (
          <p className="empty-note">{t('Nada registrado em {year}.', { year })}</p>
        ) : (
          <>
            <section className="retro__hero">
              <p className="retro__big">{r.entries}</p>
              <p>
                {t('{registros} de {coisas} em {dias}', {
                  registros: tp(r.entries, 'registro', 'registros'),
                  coisas: tp(r.items, '{n} coisa', '{n} coisas'),
                  dias: tp(r.days, '{n} dia', '{n} dias'),
                })}
                {r.average != null && t(' · nota média {nota}', { nota: formatRating(r.average) })}
              </p>
              {labels.length > 0 && (
                <ul className="taste-labels retro__labels">
                  {labels.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="profile-section">
              <h2 className="profile-section__title">{t('Por categoria')}</h2>
              <ul className="retro__cats">
                {r.byCategory.map((c) => (
                  <li key={c.category}>
                    <span className="retro__cat-name">{categoryById(c.category).label}</span>
                    <span className="retro__bar">
                      <span style={{ width: `${(c.entries / r.byCategory[0].entries) * 100}%`, background: catColor(c.category) }} />
                    </span>
                    <span className="retro__cat-n">{c.items}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="retro__facts">
              {r.topMonth && (
                <div className="profile-section">
                  <span className="profile-section__hint">{t('Mês mais ativo')}</span>
                  <strong>{MONTHS_LONG[r.topMonth.month]}</strong>
                  <span className="profile-section__hint">{tp(r.topMonth.entries, '{n} registro', '{n} registros')}</span>
                </div>
              )}
              {r.longestStreak && r.longestStreak.days > 1 && (
                <div className="profile-section">
                  <span className="profile-section__hint">{t('Maior sequência')}</span>
                  <strong>{tp(r.longestStreak.days, '{n} dia seguido', '{n} dias seguidos')}</strong>
                  <span className="profile-section__hint">
                    {fmtDay(r.longestStreak.start)} a {fmtDay(r.longestStreak.end)}
                  </span>
                </div>
              )}
              {r.loved > 0 && (
                <div className="profile-section">
                  <span className="profile-section__hint">{t('Curtiu de verdade')}</span>
                  <strong>{r.loved} ♥</strong>
                </div>
              )}
              {r.rewatches > 0 && (
                <div className="profile-section">
                  <span className="profile-section__hint">{t('Reviu')}</span>
                  <strong>
                    {r.rewatches} {r.rewatches === 1 ? 'vez' : 'vezes'}
                  </strong>
                </div>
              )}
            </section>

            {r.best.length > 0 && (
              <section className="profile-section">
                <h2 className="profile-section__title">{t('Notas mais altas do ano')}</h2>
                <div className="best-row">
                  {r.best.slice(0, 4).map((b) => (
                    <Link key={b.id} to={`/item/${b.item.id}`} className="best-row__item tap">
                      <span className="best-row__cover">
                        <Cover item={b.item} fill radius={12} />
                      </span>
                      <span className="best-row__title">{b.item.title}</span>
                      <span className="best-row__note">{formatRating(b.rating ?? 0)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {top.length > 0 && (
              <section className="profile-section">
                <h2 className="profile-section__title">{t('Seus Top 3')}</h2>
                {[...new Set(top.map((t) => t.category))].map((c) => (
                  <p key={c} className="retro__top">
                    <strong>{CATEGORY_PLURAL[c]}:</strong>{' '}
                    {top
                      .filter((t) => t.category === c)
                      .map((t) => `${t.position}. ${t.item.title}`)
                      .join(' · ')}
                  </p>
                ))}
              </section>
            )}

            <button type="button" className="btn btn--primary tap" disabled={sharing} onClick={share}>
              {sharing ? t('Gerando imagem…') : t('Compartilhar nos Stories')}
            </button>
            {shareError && (
              <p role="alert" className="form-error">
                {shareError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Imagem 1080×1920 para Stories, desenhada no aparelho (canvas).
 * Cores vêm dos tokens (--retro-*, --accent, --cat-*); sem capas (imagens de outros sites
 * podem bloquear o canvas), só texto e barras.
 */
async function drawStory(r: RetroData, name: string, labels: string[]): Promise<Blob> {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  await document.fonts?.ready

  const g = ctx.createLinearGradient(0, 0, W, H)
  const ink = v('--retro-ink', '#F4E8D0')
  g.addColorStop(0.3, v('--retro-from', '#050505'))
  g.addColorStop(1, v('--retro-to', '#5C1013'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // véu escuro para o texto branco ter contraste em qualquer ponto do degradê
  ctx.globalAlpha = 0.28
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  const font = (w: number, s: number) => `${w} ${s}px "Inter Variable", "Inter", -apple-system, system-ui, sans-serif`
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'
  drawWordmark(ctx, 84, 82, 84) // letreiro "MMisc" na cor do texto (--retro-ink)
  ctx.font = font(500, 40)
  ctx.globalAlpha = 0.85
  ctx.fillText(name, 90, 210)
  ctx.globalAlpha = 1

  ctx.font = font(800, 220)
  ctx.fillText(String(r.year), 80, 470)
  ctx.font = font(800, 150)
  ctx.fillText(String(r.entries), 90, 680)
  ctx.font = font(500, 46)
  ctx.fillText(`${tp(r.entries, 'registro', 'registros')} · ${tp(r.items, '{n} coisa', '{n} coisas')} · ${tp(r.days, '{n} dia', '{n} dias')}`, 90, 750)
  if (r.average != null) ctx.fillText(t('nota média {nota}', { nota: formatRating(r.average) }), 90, 815)

  // barras por categoria
  let y = 930
  const max = r.byCategory[0]?.entries ?? 1
  for (const c of r.byCategory.slice(0, 6)) {
    ctx.font = font(600, 40)
    ctx.fillStyle = ink
    ctx.fillText(categoryById(c.category).label, 90, y + 34)
    ctx.globalAlpha = 0.22
    ctx.fillStyle = ink
    ctx.fillRect(360, y, 560, 44)
    ctx.globalAlpha = 1
    ctx.fillStyle = v(`--cat-${c.category}`, ink)
    ctx.fillRect(360, y, Math.max(12, (c.entries / max) * 560), 44)
    ctx.fillStyle = ink
    ctx.font = font(700, 38)
    ctx.fillText(String(c.items), 940, y + 34)
    y += 78
  }

  y += 40
  ctx.font = font(500, 40)
  if (r.topMonth) {
    ctx.fillText(t('Mês mais ativo: {v}', { v: MONTHS_LONG[r.topMonth.month] }), 90, y)
    y += 64
  }
  if (r.longestStreak && r.longestStreak.days > 1) {
    ctx.fillText(t('Maior sequência: {dias}', { dias: tp(r.longestStreak.days, '{n} dia seguido', '{n} dias seguidos') }), 90, y)
    y += 64
  }
  if (r.best[0]) {
    const title = r.best[0].item.title
    ctx.fillText(t('Nota mais alta: {titulo}', { titulo: title.length > 28 ? `${title.slice(0, 27)}…` : title }), 90, y)
    y += 64
  }
  if (labels.length) {
    y += 20
    ctx.font = font(700, 40)
    for (const l of labels.slice(0, 3)) {
      ctx.fillText(`· ${l}`, 90, y)
      y += 60
    }
  }

  ctx.font = font(600, 36)
  ctx.globalAlpha = 0.85
  ctx.fillText('mmisc.com.br', 90, H - 110)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'))
}
