import { createElement, Fragment, type ReactNode } from 'react'

/**
 * Idiomas do MMisc.
 *
 * Como funciona:
 * - O texto em português É a chave: `t('Buscar')`. Em português nada é carregado; nos outros
 *   idiomas, `src/locales/<idioma>.json` traz { "Buscar": "Search", … }. Chave que faltar
 *   aparece em português (nunca quebra a tela). `npm run i18n` confere se falta alguma.
 * - Variáveis entre chaves: `t('Foto de {nome}', { nome })`. Se algum valor for um elemento
 *   (ex.: <strong>), `t` devolve um pedaço de JSX em vez de texto.
 * - Plural: `tp(n, '{n} amigo', '{n} amigos')` escolhe a forma certa de cada idioma.
 * - Mesma palavra, sentidos diferentes: prefixo de contexto `t('bebida::Café')`. Em português
 *   o prefixo some ("Café"); nos dicionários a chave inteira permite "Coffee" × "Café".
 * - O dicionário é carregado ANTES do app (main.tsx), então `t()` funciona até em constantes
 *   no topo dos arquivos. Por isso trocar de idioma recarrega a página.
 * - A escolha mora em Aparência (`idioma`: 'auto' ou um idioma) e vai para a conta junto com o
 *   resto da aparência. 'auto' = idioma do aparelho; idioma que não temos cai em português.
 */

export type Lang = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'fi'
export type LangChoice = 'auto' | Lang

export const LANGS: { id: Lang; native: string; locale: string }[] = [
  { id: 'pt', native: 'Português (Brasil)', locale: 'pt-BR' },
  { id: 'en', native: 'English', locale: 'en-US' },
  { id: 'es', native: 'Español', locale: 'es-ES' },
  { id: 'fr', native: 'Français', locale: 'fr-FR' },
  { id: 'de', native: 'Deutsch', locale: 'de-DE' },
  { id: 'fi', native: 'Suomi', locale: 'fi-FI' },
]

const LOADERS: Record<Exclude<Lang, 'pt'>, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import('../locales/en.json'),
  es: () => import('../locales/es.json'),
  fr: () => import('../locales/fr.json'),
  de: () => import('../locales/de.json'),
  fi: () => import('../locales/fi.json'),
}

const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.id === x)

let lang: Lang = 'pt'
let dict: Record<string, string> = {}
let plural = new Intl.PluralRules('pt-BR')

/** Idioma do aparelho que o MMisc tem (ou português). */
export function deviceLang(): Lang {
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []
  for (const p of prefs) {
    const base = (p ?? '').toLowerCase().split('-')[0]
    if (isLang(base)) return base
  }
  return 'pt'
}

/** Escolha guardada no aparelho (mesma chave da Aparência). */
export function storedChoice(): LangChoice {
  try {
    const raw = localStorage.getItem('mmisc.aparencia')
    const v = raw ? (JSON.parse(raw) as { idioma?: unknown }).idioma : undefined
    return isLang(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export const resolveLang = (choice: LangChoice): Lang => (isLang(choice) ? choice : deviceLang())

/** Chamado uma vez no main.tsx, antes de carregar o app. Nunca falha: sem dicionário, fica em português. */
export async function initI18n(): Promise<void> {
  const want = resolveLang(storedChoice())
  if (want !== 'pt') {
    try {
      dict = (await LOADERS[want]()).default
      lang = want
    } catch {
      dict = {}
      lang = 'pt'
    }
  }
  plural = new Intl.PluralRules(locale())
  if (typeof document !== 'undefined') document.documentElement.lang = locale()
}

export const currentLang = (): Lang => lang
/** Código para Intl e toLocaleDateString: 'pt-BR', 'en-US'… */
export const locale = (): string => LANGS.find((l) => l.id === lang)?.locale ?? 'pt-BR'

type Prim = string | number | null | undefined

/** 'bebida::Café' -> 'Café' (o prefixo só serve para separar sentidos nos dicionários) */
const bare = (key: string) => key.replace(/^[\p{L}_ -]+::/u, '')

function fill(template: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/\{(\w+)\}/)
  const rich = Object.values(vars).some((v) => v !== null && typeof v === 'object')
  if (!rich) {
    return parts.map((p, i) => (i % 2 ? (vars[p] == null || typeof vars[p] === 'boolean' ? '' : String(vars[p])) : p)).join('')
  }
  return createElement(
    Fragment,
    null,
    ...parts.map((p, i) => (i % 2 ? createElement(Fragment, { key: i }, vars[p] ?? null) : p)),
  )
}

/** Traduz um texto da interface (a chave é o texto em português). */
export function t(key: string, vars?: Record<string, Prim>): string
export function t(key: string, vars: Record<string, ReactNode>): ReactNode
export function t(key: string, vars?: Record<string, ReactNode>): ReactNode {
  const template = dict[key] ?? bare(key)
  if (!vars) return template
  return fill(template, vars)
}

/** Plural: `tp(3, '{n} amigo', '{n} amigos')`. {n} já vem formatado no padrão do idioma. */
export function tp(n: number, one: string, other: string, vars?: Record<string, Prim>): string
export function tp(n: number, one: string, other: string, vars: Record<string, ReactNode>): ReactNode
export function tp(n: number, one: string, other: string, vars?: Record<string, ReactNode>): ReactNode {
  // Português do Brasil: só 1 é singular ("0 registros"), como o app sempre escreveu
  const isOne = lang === 'pt' ? n === 1 : plural.select(n) === 'one'
  const key = isOne ? one : other
  return fill(dict[key] ?? bare(key), { n: formatNumber(n), ...vars })
}

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale(), opts).format(n)
