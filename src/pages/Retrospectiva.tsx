import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../components/profile/profile.css'
import { Cover } from '../components/review/ReviewCard'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../lib/auth'
import { catColor, categoryById, formatRating } from '../lib/categories'
import { displayName } from '../lib/format'
import { useProfileFull } from '../lib/profile'
import { useRankings } from '../lib/profileData'
import { CATEGORY_PLURAL, tasteLabels } from '../lib/profileStats'
import { useUserReviews } from '../lib/queries'
import { computeRetro, MONTHS_LONG, type RetroData } from '../lib/retro'
import { ErrorState, LoadingCards } from './states'

const thisYear = new Date().getFullYear()
const fmtDay = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS_LONG[m - 1]}`
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
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Meu ${year} no MMISC` })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareError('Não deu para gerar a imagem. Tente de novo.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={`Seu ${year}`} subtitle={year === thisYear ? 'Até agora' : 'Retrospectiva'}>
        {years.length > 1 && (
          <div className="chips no-scrollbar" role="group" aria-label="Ano">
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
          <p className="empty-note">Nada registrado em {year}.</p>
        ) : (
          <>
            <section className="retro__hero">
              <p className="retro__big">{r.entries}</p>
              <p>
                {r.entries === 1 ? 'registro' : 'registros'} de {r.items} {r.items === 1 ? 'coisa' : 'coisas'} em {r.days} {r.days === 1 ? 'dia' : 'dias'}
                {r.average != null && ` · nota média ${formatRating(r.average)}`}
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
              <h2 className="profile-section__title">Por categoria</h2>
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
                  <span className="profile-section__hint">Mês mais ativo</span>
                  <strong>{MONTHS_LONG[r.topMonth.month]}</strong>
                  <span className="profile-section__hint">{r.topMonth.entries} registros</span>
                </div>
              )}
              {r.longestStreak && r.longestStreak.days > 1 && (
                <div className="profile-section">
                  <span className="profile-section__hint">Maior sequência</span>
                  <strong>{r.longestStreak.days} dias seguidos</strong>
                  <span className="profile-section__hint">
                    {fmtDay(r.longestStreak.start)} a {fmtDay(r.longestStreak.end)}
                  </span>
                </div>
              )}
              {r.loved > 0 && (
                <div className="profile-section">
                  <span className="profile-section__hint">Curtiu de verdade</span>
                  <strong>{r.loved} ♥</strong>
                </div>
              )}
              {r.rewatches > 0 && (
                <div className="profile-section">
                  <span className="profile-section__hint">Reviu</span>
                  <strong>
                    {r.rewatches} {r.rewatches === 1 ? 'vez' : 'vezes'}
                  </strong>
                </div>
              )}
            </section>

            {r.best.length > 0 && (
              <section className="profile-section">
                <h2 className="profile-section__title">Notas mais altas do ano</h2>
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
                <h2 className="profile-section__title">Seus Top 3</h2>
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
              {sharing ? 'Gerando imagem…' : 'Compartilhar nos Stories'}
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
  const ink = v('--retro-ink', 'white')
  g.addColorStop(0, v('--retro-from', 'purple'))
  g.addColorStop(0.5, v('--accent', 'blue'))
  g.addColorStop(1, v('--retro-to', 'orange'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // véu escuro para o texto branco ter contraste em qualquer ponto do degradê
  ctx.globalAlpha = 0.28
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  const font = (w: number, s: number) => `${w} ${s}px -apple-system, "SF Pro Display", "Inter", system-ui, sans-serif`
  ctx.fillStyle = ink
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(700, 44)
  ctx.fillText('MMISC', 90, 150)
  ctx.font = font(500, 40)
  ctx.globalAlpha = 0.85
  ctx.fillText(name, 90, 210)
  ctx.globalAlpha = 1

  ctx.font = font(800, 220)
  ctx.fillText(String(r.year), 80, 470)
  ctx.font = font(800, 150)
  ctx.fillText(String(r.entries), 90, 680)
  ctx.font = font(500, 46)
  ctx.fillText(`registros · ${r.items} coisas · ${r.days} dias`, 90, 750)
  if (r.average != null) ctx.fillText(`nota média ${formatRating(r.average)}`, 90, 815)

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
    ctx.fillText(`Mês mais ativo: ${MONTHS_LONG[r.topMonth.month]}`, 90, y)
    y += 64
  }
  if (r.longestStreak && r.longestStreak.days > 1) {
    ctx.fillText(`Maior sequência: ${r.longestStreak.days} dias seguidos`, 90, y)
    y += 64
  }
  if (r.best[0]) {
    const t = r.best[0].item.title
    ctx.fillText(`Nota mais alta: ${t.length > 28 ? `${t.slice(0, 27)}…` : t}`, 90, y)
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
