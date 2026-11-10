import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Stars } from '../components/ui/Stars'
import { CategoryTag } from '../components/review/ReviewCard'
import {
  ACCENTS,
  STYLES,
  TEXT_STEPS,
  THEME_SWATCHES,
  resetAppearance,
  setAppearance,
  useAppearance,
  useResolvedAppearance,
  type Appearance,
  type ThemeChoice,
} from '../lib/appearance'
import { useEffect } from 'react'
import { LANGS, deviceLang, t, type LangChoice } from '../lib/i18n'
import '../components/ui/aparencia.css'

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'auto', label: t('Automático') },
  { id: 'claro', label: t('Claro') },
  { id: 'medio', label: t('Médio') },
  { id: 'escuro', label: t('Escuro') },
  { id: 'preto', label: t('Preto puro') },
]
const THEME_NAME = { claro: t('claro'), medio: t('médio'), escuro: t('escuro'), preto: t('preto puro') } as const

/**
 * Idioma do app. Os nomes ficam sempre no próprio idioma ("Deutsch", "Suomi"), para quem não
 * entende o idioma atual achar o seu. Escolher recarrega a página (lib/i18n.tsx).
 */
function LanguagePicker({ value }: { value: LangChoice }) {
  const device = LANGS.find((l) => l.id === deviceLang())?.native ?? ''
  const options: { id: LangChoice; label: string; hint?: string; lang?: string }[] = [
    { id: 'auto', label: t('Automático'), hint: t('Idioma do aparelho: {idioma}', { idioma: device }) },
    ...LANGS.map((l) => ({ id: l.id, label: l.native, lang: l.locale })),
  ]
  return (
    <section className="ap-section" aria-labelledby="ap-idioma" id="idioma">
      <h2 id="ap-idioma" className="ap-section__title">
        {t('Idioma')} <span aria-hidden="true">· Language</span>
      </h2>
      <div className="group ap-langs" role="radiogroup" aria-labelledby="ap-idioma">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            className="group__row ap-lang tap"
            onClick={() => value !== o.id && setAppearance({ idioma: o.id })}
          >
            <span className="ap-lang__text">
              <span lang={o.lang}>{o.label}</span>
              {o.hint && <span className="ap-lang__hint">{o.hint}</span>}
            </span>
            <span className="ap-lang__check" aria-hidden="true">
              {value === o.id ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
      <span className="field-hint">{t('O app recarrega para trocar. Nomes de filmes, álbuns e lugares continuam como vêm do catálogo.')}</span>
    </section>
  )
}

/** Controle segmentado ligado a uma escolha de Aparência. */
function Choice<K extends keyof Appearance>({
  k,
  label,
  options,
  hint,
}: {
  k: K
  label: string
  options: { id: Appearance[K]; label: string }[]
  hint?: string
}) {
  const a = useAppearance()
  const id = `ap-${String(k)}`
  return (
    <div className="ap-row">
      <span className="ap-row__label" id={id}>
        {label}
      </span>
      <div
        className="segmented"
        role="radiogroup"
        aria-labelledby={id}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={a[k] === o.id}
            onClick={() => setAppearance({ [k]: o.id } as Partial<Appearance>)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

/** Prévia: um cartão de review e botões com as escolhas valendo. */
function Preview() {
  return (
    <section className="ap-preview" aria-label={t('Prévia')}>
      <div className="chips" aria-hidden="true">
        <span className="chip" aria-pressed="true">
          {t('Tudo')}
        </span>
        <span className="chip">{t('Álbum')}</span>
        <span className="chip">{t('Bar')}</span>
      </div>
      <article className="review-card">
        <div className="review-card__head">
          <span className="cover ap-preview__cover" aria-hidden="true">
            CE
          </span>
          <span className="review-card__info">
            <span className="review-card__title">Clube da Esquina</span>
            <span className="review-card__sub">Milton Nascimento e Lô Borges · 1972</span>
            <CategoryTag category="album" />
            <Stars value={4.5} size={16} />
          </span>
        </div>
        <p className="review-card__text">
          {t('Exemplo de review: ouvi inteiro no ônibus voltando de BH. “Cais” continua sendo a música mais bonita do disco.')}
        </p>
      </article>
      <div className="ap-preview__buttons">
        <span className="btn btn--primary">{t('Registrar')}</span>
        <span className="btn btn--plain">{t('Quero ouvir')}</span>
      </div>
    </section>
  )
}

export default function Aparencia({ standalone = false }: { standalone?: boolean }) {
  const a = useAppearance()
  const now = useResolvedAppearance()
  const navigate = useNavigate()
  const location = useLocation()
  // /aparencia#idioma (menu e login) já abre na seção de idioma
  useEffect(() => {
    if (location.hash === '#idioma') document.getElementById('idioma')?.scrollIntoView({ block: 'start' })
  }, [location.hash])
  const step = a.texto === 'auto' ? TEXT_STEPS.findIndex((s) => s >= now.escala - 0.001) : a.texto
  const percent = Math.round((a.texto === 'auto' ? now.escala : TEXT_STEPS[a.texto]) * 100)

  return (
    <div className="page" style={standalone ? { minHeight: '100dvh', background: 'var(--bg)' } : undefined}>
      <PageHeader
        title={t('Aparência')}
        subtitle={standalone || !a.sincronizar ? t('Vale para este aparelho') : t('Vale para todos os seus aparelhos')}
        trailing={
          <button
            type="button"
            className="btn btn--plain tap ap-back"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(standalone ? '/' : '/perfil'))}
          >
            {t('Pronto')}
          </button>
        }
      />
      <div className="page__body ap">
        <Preview />

        {/* ---------- Idioma ---------- */}
        <LanguagePicker value={a.idioma} />

        {/* ---------- Estilo ---------- */}
        <section className="ap-section" aria-labelledby="ap-estilo">
          <h2 id="ap-estilo" className="ap-section__title">
            {t('Estilo')}
          </h2>
          <div className="ap-styles" role="radiogroup" aria-labelledby="ap-estilo">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={a.estilo === s.id}
                className="ap-style tap"
                onClick={() => setAppearance({ estilo: s.id })}
              >
                <span className={`ap-style__art ap-style__art--${s.id}`} aria-hidden="true">
                  <span className="ap-style__bar" />
                  <span className="ap-style__card">
                    <span />
                    <span />
                  </span>
                  <span className="ap-style__btn" />
                </span>
                <span className="ap-style__name">{s.label}</span>
              </button>
            ))}
          </div>
          <span className="field-hint">{STYLES.find((s) => s.id === a.estilo)?.hint}</span>
        </section>

        {/* ---------- Tema ---------- */}
        <section className="ap-section" aria-labelledby="ap-tema">
          <h2 id="ap-tema" className="ap-section__title">
            {t('Tema')}
          </h2>
          <div className="ap-themes" role="radiogroup" aria-labelledby="ap-tema">
            {THEMES.map((th) => {
              const sw = th.id === 'auto' ? null : THEME_SWATCHES[th.id]
              return (
                <button
                  key={th.id}
                  type="button"
                  role="radio"
                  aria-checked={a.tema === th.id}
                  className="ap-theme tap"
                  onClick={() => setAppearance({ tema: th.id })}
                >
                  <span
                    className="ap-theme__swatch"
                    aria-hidden="true"
                    style={
                      sw
                        ? { background: sw.bg }
                        : { background: `linear-gradient(135deg, ${THEME_SWATCHES.claro.bg} 50%, ${THEME_SWATCHES.escuro.bg} 50%)` }
                    }
                  >
                    {sw && (
                      <span className="ap-theme__card" style={{ background: sw.card }}>
                        <span style={{ background: sw.ink }} />
                        <span style={{ background: sw.ink, opacity: 0.45 }} />
                      </span>
                    )}
                  </span>
                  <span className="ap-theme__name">{th.label}</span>
                </button>
              )
            })}
          </div>
          {a.tema === 'auto' && <span className="field-hint">{t('Segue o aparelho. Agora: {v}.', { v: THEME_NAME[now.tema] })}</span>}
        </section>

        {/* ---------- Texto ---------- */}
        <section className="ap-section" aria-labelledby="ap-texto">
          <h2 id="ap-texto" className="ap-section__title">
            {t('Tamanho do texto')}
          </h2>
          <div className="group">
            <label className="group__row ap-switch-row">
              <span>{t('Seguir o aparelho')}</span>
              <input
                type="checkbox"
                role="switch"
                className="ap-switch"
                checked={a.texto === 'auto'}
                onChange={(e) => setAppearance({ texto: e.target.checked ? 'auto' : Math.max(0, step) })}
              />
            </label>
            <div className="group__row ap-slider-row">
              <span aria-hidden="true" className="ap-a ap-a--small">
                A
              </span>
              <input
                type="range"
                className="ap-range"
                min={0}
                max={TEXT_STEPS.length - 1}
                step={1}
                value={Math.max(0, step)}
                aria-label={t('Tamanho do texto')}
                aria-valuetext={`${percent}%`}
                onChange={(e) => setAppearance({ texto: Number(e.target.value) })}
              />
              <span aria-hidden="true" className="ap-a ap-a--big">
                A
              </span>
              <output className="ap-percent">{percent}%</output>
            </div>
          </div>
          <span className="field-hint">
            {a.texto === 'auto'
              ? t('Usa o tamanho de texto dos ajustes do celular (no iPhone: Ajustes › Tela e Brilho › Tamanho do Texto).')
              : t('Mexer no controle desliga o “seguir o aparelho”.')}
          </span>
        </section>

        {/* ---------- Destaque ---------- */}
        <section className="ap-section" aria-labelledby="ap-destaque">
          <h2 id="ap-destaque" className="ap-section__title">
            {t('Cor de destaque')}
          </h2>
          <div className="ap-accents" role="radiogroup" aria-labelledby="ap-destaque">
            {ACCENTS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={a.destaque === c.id}
                aria-label={c.label}
                className="ap-accent tap"
                onClick={() => setAppearance({ destaque: c.id })}
              >
                <span
                  className="ap-accent__dot"
                  aria-hidden="true"
                  style={{ background: c.id === 'marca' ? `linear-gradient(135deg, ${c.light} 50%, ${c.dark} 50%)` : c.light }}
                />
                <span className="ap-accent__name">{c.label}</span>
              </button>
            ))}
          </div>
          <span className="field-hint">{t('O app ajusta o tom sozinho quando a cor vira texto, para continuar legível.')}</span>
        </section>

        {/* ---------- Leitura e conforto ---------- */}
        <section className="ap-section" aria-labelledby="ap-conforto">
          <h2 id="ap-conforto" className="ap-section__title">
            {t('Leitura e conforto')}
          </h2>
          <Choice
            k="contraste"
            label={t('Contraste')}
            options={[
              { id: 'auto', label: t('Automático') },
              { id: 'normal', label: t('Normal') },
              { id: 'alto', label: t('Alto') },
            ]}
            hint={a.contraste === 'auto' ? t('Segue o aparelho. Agora: {v}.', { v: now.contraste === 'alto' ? t('alto') : t('normal') }) : undefined}
          />
          <Choice
            k="fonte"
            label={t('Fonte')}
            options={[
              { id: 'inter', label: 'Inter' },
              { id: 'sistema', label: t('Do sistema') },
              { id: 'atkinson', label: 'Atkinson' },
            ]}
            hint={a.fonte === 'atkinson' ? t('Atkinson Hyperlegible: feita para quem tem baixa visão (letras que não se confundem).') : undefined}
          />
          <Choice
            k="transp"
            label={t('Transparência')}
            options={[
              { id: 'auto', label: t('Automático') },
              { id: 'vidro', label: t('Vidro') },
              { id: 'solido', label: t('Sólido') },
            ]}
          />
          <Choice
            k="movimento"
            label={t('Movimento')}
            options={[
              { id: 'auto', label: t('Automático') },
              { id: 'completo', label: t('Completo') },
              { id: 'reduzido', label: t('Reduzido') },
            ]}
            hint={a.movimento === 'reduzido' || now.movimento === 'reduzido' ? t('Sem deslizar nem saltar: as telas só esmaecem.') : undefined}
          />
          <div className="group">
            <label className="group__row ap-switch-row">
              <span>{t('Vibração ao tocar')}</span>
              <input
                type="checkbox"
                role="switch"
                className="ap-switch"
                checked={a.vibracao}
                onChange={(e) => setAppearance({ vibracao: e.target.checked })}
              />
            </label>
          </div>
        </section>

        {/* ---------- Do seu jeito ---------- */}
        <section className="ap-section" aria-labelledby="ap-jeito">
          <h2 id="ap-jeito" className="ap-section__title">
            {t('Do seu jeito')}
          </h2>
          <Choice
            k="densidade"
            label={t('Densidade')}
            options={[
              { id: 'confortavel', label: t('Confortável') },
              { id: 'compacta', label: t('Compacta') },
            ]}
          />
          <Choice
            k="nota"
            label={t('Formato da nota')}
            options={[
              { id: 'estrelas', label: t('Estrelas') },
              { id: 'numero', label: t('Número') },
              { id: 'ambos', label: t('Os dois') },
            ]}
          />
          <Choice
            k="categorias"
            label={t('Cores das categorias')}
            options={[
              { id: 'coloridas', label: t('Coloridas') },
              { id: 'discretas', label: t('Discretas') },
            ]}
          />
        </section>

        {/* ---------- A4: conta ---------- */}
        {!standalone && (
          <section className="ap-section" aria-labelledby="ap-aparelhos">
            <h2 id="ap-aparelhos" className="ap-section__title">
              {t('Seus aparelhos')}
            </h2>
            <div className="group">
              <label className="group__row ap-switch-row">
                <span>{t('Usar em todos os meus aparelhos')}</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="ap-switch"
                  checked={a.sincronizar}
                  onChange={(e) => setAppearance({ sincronizar: e.target.checked })}
                />
              </label>
            </div>
            <span className="field-hint">
              {a.sincronizar
                ? t('Celular e computador ficam iguais (vale a última mudança). O tamanho do texto continua sendo de cada aparelho. Sua cor de destaque aparece no seu perfil para quem visita.')
                : t('As escolhas valem só neste aparelho.')}
            </span>
          </section>
        )}

        <button type="button" className="btn btn--plain tap" onClick={() => resetAppearance()}>
          {t('Voltar ao padrão')}
        </button>
        <p className="field-hint ap-foot">
          {t('“Voltar ao padrão” não mexe no tamanho do texto.')}
        </p>
      </div>
    </div>
  )
}
