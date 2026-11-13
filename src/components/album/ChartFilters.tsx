import { useMemo, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { decadeLabel, useGenreIndex, type ChartFilter } from '../../lib/albuns'
import { formatNumber, t, tp } from '../../lib/i18n'

const DECADES = [2010, 2000, 1990, 1980, 1970, 1960, 1950]

/** Período (todos os tempos, décadas, antes de 1950) e, dentro da década, o ano. */
export function PeriodPicker({ value, onChange }: { value: ChartFilter; onChange: (f: ChartFilter) => void }) {
  const dec = typeof value.period === 'number' ? value.period : null
  const years = dec ? Array.from({ length: 10 }, (_, i) => dec + i).filter((y) => y <= 2017) : []
  return (
    <div className="alb-filters">
      <div className="chips no-scrollbar" role="group" aria-label={t('Período')}>
        <button type="button" className="chip tap" aria-pressed={value.period === 'tudo'} onClick={() => onChange({ ...value, period: 'tudo', year: null })}>
          {t('Todos os tempos')}
        </button>
        {DECADES.map((d) => (
          <button key={d} type="button" className="chip tap" aria-pressed={dec === d} onClick={() => onChange({ ...value, period: d, year: null })}>
            {decadeLabel(d)}
          </button>
        ))}
        <button type="button" className="chip tap" aria-pressed={value.period === 'antes'} onClick={() => onChange({ ...value, period: 'antes', year: null })}>
          {decadeLabel(1940)}
        </button>
      </div>
      {dec != null && (
        <div className="chips no-scrollbar" role="group" aria-label={t('Ano')}>
          <button type="button" className="chip tap" aria-pressed={!value.year} onClick={() => onChange({ ...value, year: null })}>
            {t('Década toda')}
          </button>
          {years.map((y) => (
            <button key={y} type="button" className="chip tap" aria-pressed={value.year === y} onClick={() => onChange({ ...value, year: y })}>
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Botão "Gênero: X" que abre a lista de gêneros com busca, e a opção de contar os secundários. */
export function GenrePicker({ value, onChange, fixed = false }: { value: ChartFilter; onChange: (f: ChartFilter) => void; fixed?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="alb-genre-pick">
      {!fixed && (
        <button type="button" className="chip tap" aria-pressed={Boolean(value.genre)} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {value.genre ? t('Gênero: {g}', { g: value.genre }) : t('Todos os gêneros')} ▾
        </button>
      )}
      {!fixed && value.genre && (
        <button type="button" className="chip tap" aria-label={t('Tirar o filtro de gênero')} onClick={() => onChange({ ...value, genre: null })}>
          ✕
        </button>
      )}
      {value.genre && (
        <button type="button" className="chip tap" aria-pressed={Boolean(value.withSec)} onClick={() => onChange({ ...value, withSec: !value.withSec })}>
          {t('Contar como secundário')}
        </button>
      )}
      {open && (
        <GenreSheet
          onClose={() => setOpen(false)}
          onPick={(g) => {
            onChange({ ...value, genre: g })
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function GenreSheet({ onClose, onPick }: { onClose: () => void; onPick: (g: string) => void }) {
  const idx = useGenreIndex()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const all = idx.data?.generos ?? []
    const n = q.trim().toLowerCase()
    return (n ? all.filter((g) => g.g.toLowerCase().includes(n)) : all).slice(0, 80)
  }, [idx.data, q])
  return (
    <Sheet open onClose={onClose} title={t('Escolher gênero')}>
      <label style={{ display: 'block' }}>
        <span className="visually-hidden">{t('Buscar gênero')}</span>
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Buscar gênero (ex.: MPB, Shoegaze)')} />
      </label>
      {idx.isLoading && <p className="field-hint">{t('Carregando…')}</p>}
      <div className="group" style={{ marginTop: 12 }}>
        {list.map((g) => (
          <button key={g.g} type="button" className="group__row tap alb-sheet-row" onClick={() => onPick(g.g)}>
            <strong>{g.g}</strong>
            <span>{tp(g.n, '{n} álbum', '{n} álbuns')}</span>
          </button>
        ))}
        {!idx.isLoading && list.length === 0 && <div className="group__row" style={{ color: 'var(--text-3)' }}>{t('Nenhum gênero com esse nome')}</div>}
      </div>
      {idx.data && !q && (
        <p className="field-hint">{t('Mostrando os 80 maiores de {n}. Digite para achar os outros.', { n: formatNumber(idx.data.generos.length) })}</p>
      )}
    </Sheet>
  )
}
