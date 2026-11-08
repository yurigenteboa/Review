import { useSyncExternalStore } from 'react'

/**
 * Aparência (A1/A2 do plano "Aparência e acessibilidade").
 *
 * As escolhas da pessoa ficam no aparelho (localStorage `mmisc.aparencia`) e viram atributos
 * na tag <html>; o CSS reage a eles (tokens.css). "Automático" segue o aparelho e é resolvido
 * aqui, então o CSS só conhece valores concretos:
 *   data-tema        claro | medio | escuro | preto
 *   data-contraste   normal | alto
 *   data-transp      vidro | solido
 *   data-movimento   completo | reduzido
 *   data-densidade   confortavel | compacta
 *   data-categorias  coloridas | discretas
 *   data-fonte       inter | sistema | atkinson
 *   data-nota        estrelas | numero | ambos
 *   data-vibracao    on | off
 *   --escala-texto   0,85 a 1,6 (o tamanho base das letras; tudo em rem acompanha)
 *   --accent, --accent-ink, --on-accent, --accent-shadow (cor de destaque já com contraste conferido)
 *
 * O script no index.html faz o mesmo antes da primeira pintura (sem piscar). Ele lê
 * `mmisc.aparencia.css`, que este arquivo grava já calculado para os 4 temas.
 * Se mudar nomes de atributo ou de chave aqui, mude lá também.
 */

export type ThemeChoice = 'auto' | 'claro' | 'medio' | 'escuro' | 'preto'
export type Theme = Exclude<ThemeChoice, 'auto'>
export type AccentId = 'marca' | 'vermelho' | 'roxo' | 'verde' | 'azul' | 'laranja' | 'rosa'

export interface Appearance {
  tema: ThemeChoice
  /** índice em TEXT_STEPS, ou 'auto' (segue o tamanho de texto do aparelho) */
  texto: 'auto' | number
  contraste: 'auto' | 'normal' | 'alto'
  transp: 'auto' | 'vidro' | 'solido'
  movimento: 'auto' | 'completo' | 'reduzido'
  vibracao: boolean
  destaque: AccentId
  densidade: 'confortavel' | 'compacta'
  nota: 'estrelas' | 'numero' | 'ambos'
  categorias: 'coloridas' | 'discretas'
  fonte: 'inter' | 'sistema' | 'atkinson'
}

export const DEFAULT_APPEARANCE: Appearance = {
  tema: 'auto',
  texto: 'auto',
  contraste: 'auto',
  transp: 'auto',
  movimento: 'auto',
  vibracao: true,
  destaque: 'marca',
  densidade: 'confortavel',
  nota: 'estrelas',
  categorias: 'coloridas',
  fonte: 'inter',
}

/** Degraus do tamanho do texto (1 = padrão). */
export const TEXT_STEPS = [0.85, 1, 1.15, 1.3, 1.45, 1.6] as const

export const ACCENTS: { id: AccentId; label: string; light: string; dark: string }[] = [
  { id: 'marca', label: 'Marca', light: '#1A1714', dark: '#F4E8D0' },
  { id: 'vermelho', label: 'Vermelho', light: '#E8262A', dark: '#E8262A' },
  { id: 'roxo', label: 'Roxo', light: '#AB6EC3', dark: '#AB6EC3' },
  { id: 'verde', label: 'Verde', light: '#7FB95A', dark: '#7FB95A' },
  { id: 'azul', label: 'Azul', light: '#0A84FF', dark: '#0A84FF' },
  { id: 'laranja', label: 'Laranja', light: '#FF9500', dark: '#FF9500' },
  { id: 'rosa', label: 'Rosa', light: '#E0457B', dark: '#E0457B' },
]

/** Fundo e superfície de cada tema: os mesmos valores de tokens.css (usados no cálculo de contraste). */
const THEME_GROUND: Record<Theme, { bg: string; surface: string; dark: boolean }> = {
  claro: { bg: '#F2F2F7', surface: '#FFFFFF', dark: false },
  medio: { bg: '#1E2127', surface: '#2A2E36', dark: true },
  escuro: { bg: '#000000', surface: '#1C1C1E', dark: true },
  preto: { bg: '#000000', surface: '#0D0D0D', dark: true },
}

/** Amostras para os botões de tema na tela Aparência (fundo, cartão, texto). */
export const THEME_SWATCHES: Record<Theme, { bg: string; card: string; ink: string }> = {
  claro: { bg: THEME_GROUND.claro.bg, card: THEME_GROUND.claro.surface, ink: '#1C1C1E' },
  medio: { bg: THEME_GROUND.medio.bg, card: THEME_GROUND.medio.surface, ink: '#ECEDEF' },
  escuro: { bg: THEME_GROUND.escuro.bg, card: THEME_GROUND.escuro.surface, ink: '#FFFFFF' },
  preto: { bg: THEME_GROUND.preto.bg, card: THEME_GROUND.preto.surface, ink: '#FFFFFF' },
}

const KEY = 'mmisc.aparencia'
const CSS_KEY = 'mmisc.aparencia.css'
const ROOT_ATTRS = ['tema', 'contraste', 'transp', 'movimento', 'densidade', 'categorias', 'fonte', 'nota', 'vibracao'] as const

// ---------- contraste (WCAG) ----------
type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB
}
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const lum = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string): number {
  const x = lum(hex(a))
  const y = lum(hex(b))
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const mix = (c: RGB, t: RGB, p: number): RGB => c.map((v, i) => v + (t[i] - v) * p) as RGB

/**
 * Variáveis da cor de destaque para um tema: a cor do botão, a cor do texto sobre ele
 * (creme/branco ou quase preto, o que der mais contraste) e a versão "tinta", escurecida
 * ou clareada até 4,5:1 sobre o fundo e a superfície, para quando o destaque vira texto.
 */
export function accentVars(id: AccentId, theme: Theme): Record<string, string> {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0]
  const ground = THEME_GROUND[theme]
  const light = id === 'marca' ? '#F4E8D0' : '#FFFFFF'
  let base = ground.dark ? a.dark : a.light
  const onAccent = contrast(base, light) >= contrast(base, '#0B0B0B') ? light : '#0B0B0B'
  // nem claro nem escuro chega a 4,5:1 no botão (ex.: vermelho): ajusta o tom do botão até chegar
  const away: RGB = onAccent === '#0B0B0B' ? [255, 255, 255] : [0, 0, 0]
  for (let i = 0; i < 12 && contrast(base, onAccent) < 4.5; i++) base = toHex(mix(hex(base), away, 0.04))
  let ink = hex(base)
  const target: RGB = ground.dark ? [255, 255, 255] : [0, 0, 0]
  for (let i = 0; i < 24 && Math.min(contrast(toHex(ink), ground.surface), contrast(toHex(ink), ground.bg)) < 4.5; i++) {
    ink = mix(ink, target, 0.08)
  }
  const [r, g, b] = hex(base)
  return {
    '--accent': base,
    '--accent-ink': toHex(ink),
    '--on-accent': onAccent,
    '--accent-shadow': `rgba(${r}, ${g}, ${b}, ${ground.dark ? 0.22 : 0.28})`,
  }
}

// ---------- guardar e ler ----------
function read(): Appearance {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return { ...DEFAULT_APPEARANCE, ...parsed }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

let current: Appearance = typeof window === 'undefined' ? DEFAULT_APPEARANCE : read()
const listeners = new Set<() => void>()

function persist(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
    // pronto para o script do index.html: destaque já calculado em cada tema
    const css: Record<string, Record<string, string>> = {}
    ;(Object.keys(THEME_GROUND) as Theme[]).forEach((t) => (css[t] = accentVars(a.destaque, t)))
    localStorage.setItem(CSS_KEY, JSON.stringify(css))
  } catch {
    /* aba anônima ou armazenamento bloqueado: vale só nesta visita */
  }
}

// ---------- resolver "automático" ----------
const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches

export interface Resolved {
  tema: Theme
  contraste: 'normal' | 'alto'
  transp: 'vidro' | 'solido'
  movimento: 'completo' | 'reduzido'
  escala: number
}

/** Tamanho de texto do iPhone (Ajustes › Tela › Tamanho do Texto): a fonte do sistema do Safari acompanha. */
function deviceTextScale(): number {
  if (typeof CSS === 'undefined' || !CSS.supports('font', '-apple-system-body')) return 1
  const probe = document.createElement('span')
  probe.style.font = '-apple-system-body'
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.documentElement.appendChild(probe)
  const px = parseFloat(getComputedStyle(probe).fontSize)
  probe.remove()
  // 17 px é o tamanho padrão do iPhone; limita aos degraus que o layout aguenta
  return px > 0 ? Math.min(1.6, Math.max(0.85, px / 17)) : 1
}

export function resolve(a: Appearance = current): Resolved {
  return {
    tema: a.tema === 'auto' ? (mq('(prefers-color-scheme: dark)') ? 'escuro' : 'claro') : a.tema,
    contraste: a.contraste === 'auto' ? (mq('(prefers-contrast: more)') ? 'alto' : 'normal') : a.contraste,
    transp: a.transp === 'auto' ? (mq('(prefers-reduced-transparency: reduce)') ? 'solido' : 'vidro') : a.transp,
    movimento: a.movimento === 'auto' ? (mq('(prefers-reduced-motion: reduce)') ? 'reduzido' : 'completo') : a.movimento,
    escala: a.texto === 'auto' ? deviceTextScale() : TEXT_STEPS[a.texto] ?? 1,
  }
}

let resolved: Resolved | null = null

/** Põe as escolhas na tag <html> (e na cor da barra do navegador). */
export function applyAppearance(a: Appearance = current) {
  if (typeof document === 'undefined') return
  const r = resolve(a)
  resolved = r
  const root = document.documentElement
  const values: Record<(typeof ROOT_ATTRS)[number], string> = {
    tema: r.tema,
    contraste: r.contraste,
    transp: r.transp,
    movimento: r.movimento,
    densidade: a.densidade,
    categorias: a.categorias,
    fonte: a.fonte,
    nota: a.nota,
    vibracao: a.vibracao ? 'on' : 'off',
  }
  ROOT_ATTRS.forEach((k) => root.setAttribute(`data-${k}`, values[k]))
  root.style.setProperty('--escala-texto', String(r.escala))
  Object.entries(accentVars(a.destaque, r.tema)).forEach(([k, v]) => root.style.setProperty(k, v))
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_GROUND[r.tema].bg
  if (a.fonte === 'atkinson') void import('@fontsource/atkinson-hyperlegible/latin-400.css').then(() => import('@fontsource/atkinson-hyperlegible/latin-700.css'))
}

/** Muda uma ou mais escolhas, aplica na hora e guarda no aparelho. */
export function setAppearance(patch: Partial<Appearance>) {
  current = { ...current, ...patch }
  persist(current)
  applyAppearance(current)
  listeners.forEach((l) => l())
}

export function resetAppearance() {
  setAppearance(DEFAULT_APPEARANCE)
}

/** Chamado uma vez no main.tsx: aplica e acompanha o aparelho quando algo está em "automático". */
export function initAppearance() {
  applyAppearance(current)
  persist(current)
  const queries = [
    '(prefers-color-scheme: dark)',
    '(prefers-contrast: more)',
    '(prefers-reduced-transparency: reduce)',
    '(prefers-reduced-motion: reduce)',
  ]
  queries.forEach((q) =>
    window.matchMedia(q).addEventListener('change', () => {
      applyAppearance(current)
      listeners.forEach((l) => l())
    }),
  )
  // o tamanho de texto do iPhone pode mudar com o app aberto em segundo plano
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current.texto === 'auto') {
      applyAppearance(current)
      listeners.forEach((l) => l())
    }
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Escolhas atuais (re-renderiza quando mudam). */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_APPEARANCE)
}

/** O que está valendo agora, com o "automático" resolvido. */
export function useResolvedAppearance(): Resolved {
  return useSyncExternalStore(
    subscribe,
    () => resolved ?? (resolved = resolve(current)),
    () => ({ tema: 'claro', contraste: 'normal', transp: 'vidro', movimento: 'completo', escala: 1 }),
  )
}

/** Para código fora do React (gestos, vibração): lê o que está aplicado na tag <html>. */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-movimento') === 'reduzido'
}
export function vibrationEnabled(): boolean {
  if (typeof document === 'undefined') return true
  return document.documentElement.getAttribute('data-vibracao') !== 'off'
}
