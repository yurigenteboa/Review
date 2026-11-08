// Fase 0 (M5): aviso de erros e métricas de uso.
// Tudo vai para duas tabelas do próprio Supabase (client_errors, app_events), que o app só
// consegue INSERIR; o dono lê pelo SQL Editor nas views do schema `metricas`.
// Nada de conteúdo das reviews, texto digitado, e-mail ou localização é enviado.

import { supabase, supabaseReady } from './supabase'

/** Versão publicada (commit da Vercel ou "local"), definida no vite.config. */
export const RELEASE: string = import.meta.env.VITE_APP_RELEASE ?? 'local'

const METRICS_OFF_KEY = 'mmisc.metricsOff'
const MAX_ERRORS_PER_LOAD = 15

type ErrorKind = 'error' | 'promise' | 'react' | 'query' | 'mutation'
export type EventName = 'app_open' | 'compose_open' | 'compose_saved' | 'compose_cancel' | 'search_empty'
type EventProps = Record<string, string | number | boolean | null>

const cut = (s: string | undefined | null, n: number) => (s ? s.slice(0, n) : null)
const isDev = import.meta.env.DEV

// ---------- Preferência: métricas desligadas neste aparelho ----------

export function metricsEnabled(): boolean {
  try {
    return localStorage.getItem(METRICS_OFF_KEY) !== '1'
  } catch {
    return true
  }
}

export function setMetricsEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(METRICS_OFF_KEY)
    else localStorage.setItem(METRICS_OFF_KEY, '1')
  } catch {
    /* modo privado: fica valendo só nesta visita */
  }
  if (!on) {
    queue.length = 0
    storeQueue()
  }
}

// ---------- Erros ----------

const seen = new Set<string>()
let sent = 0

/** Manda um erro para o banco (uma vez por mensagem a cada carregamento, até 15). Nunca lança. */
export function reportError(kind: ErrorKind, error: unknown) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : safeString(error))
  const message = cut(err.message || err.name || 'Erro sem mensagem', 500) ?? 'Erro sem mensagem'
  if (ignorable(message)) return
  const sig = `${kind}|${message}|${(err.stack ?? '').split('\n')[1] ?? ''}`
  if (seen.has(sig) || sent >= MAX_ERRORS_PER_LOAD) return
  seen.add(sig)
  sent++
  if (isDev) console.warn('[MMisc erro]', kind, err)
  if (!supabaseReady || isDev) return
  void supabase
    .from('client_errors')
    .insert({
      kind,
      message,
      stack: cut(err.stack, 4000),
      path: cut(location.pathname, 300),
      release: cut(RELEASE, 40),
      user_agent: cut(navigator.userAgent, 300),
    })
    .then(
      () => undefined,
      () => undefined,
    )
}

/** Ruído conhecido que não é bug nosso (rede caiu, extensões, ResizeObserver). */
function ignorable(message: string) {
  return (
    /ResizeObserver loop/i.test(message) ||
    /^Script error\.?$/i.test(message) ||
    /Failed to fetch|NetworkError|Load failed|network request failed/i.test(message) ||
    /AbortError|The user aborted/i.test(message)
  )
}

function safeString(v: unknown) {
  try {
    return JSON.stringify(v).slice(0, 500)
  } catch {
    return String(v)
  }
}

/** Erros que escapam de tudo (fora do React e promessas sem catch). Chamado uma vez no main.tsx. */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => {
    // erro ao carregar <img>/<script> não tem e.error; ignoramos
    if (e.error || e.message) reportError('error', e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => reportError('promise', e.reason))
  // Telas carregadas sob demanda: depois de um deploy, o arquivo antigo some e o import falha.
  // Recarregar uma vez resolve (pega a versão nova); se falhar de novo, o erro segue normal.
  window.addEventListener('vite:preloadError', (e) => {
    try {
      if (sessionStorage.getItem('mmisc.reloadedForChunk')) return
      sessionStorage.setItem('mmisc.reloadedForChunk', '1')
    } catch {
      return
    }
    e.preventDefault()
    location.reload()
  })
}

// ---------- Eventos de uso ----------

const SESSION_KEY = 'mmisc.sessionId'
function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'semsessao0'
  }
}

interface QueuedEvent {
  name: EventName
  props: EventProps
  created_at: string
}
// A fila também fica no aparelho: se o app recarregar antes do envio (troca de versão depois
// de um deploy, fechar a aba), os eventos saem na próxima abertura em vez de se perderem.
const QUEUE_KEY = 'mmisc.eventQueue'
const queue: QueuedEvent[] = readStoredQueue()
let timer: ReturnType<typeof setTimeout> | null = null

function readStoredQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as QueuedEvent[]).slice(-50) : []
  } catch {
    return []
  }
}

function storeQueue() {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-50)))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* sem storage: fica só na memória */
  }
}

/** Registra um evento de uso. Vai em lote a cada 10 s ou quando o app sai de cena. */
export function track(name: EventName, props: EventProps = {}) {
  if (!metricsEnabled()) return
  queue.push({ name, props, created_at: new Date().toISOString() })
  storeQueue()
  if (isDev) console.info('[MMisc evento]', name, props)
  if (!timer) timer = setTimeout(flush, 10_000)
}

async function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!queue.length || !supabaseReady || isDev) {
    queue.length = 0
    storeQueue()
    return
  }
  const { data } = await supabase.auth.getSession()
  // sem login ainda: a fila espera (fica guardada) até a próxima tentativa
  if (!data.session) return
  const batch = queue.splice(0, queue.length)
  const sid = sessionId()
  // A cópia guardada só é atualizada depois da resposta: se a página fechar no meio do envio,
  // o lote sai de novo na próxima abertura (melhor um evento repetido que um perdido).
  const { error } = await supabase
    .from('app_events')
    .insert(batch.map((e) => ({ ...e, session_id: sid, release: cut(RELEASE, 40) })))
  // falhou (sem rede): devolve à fila, sem passar de 50
  if (error && queue.length < 50) queue.unshift(...batch.slice(0, 50 - queue.length))
  storeQueue()
}

// Sobrou fila de uma visita anterior: tenta mandar logo depois que o app abrir
if (typeof window !== 'undefined' && queue.length) timer = setTimeout(flush, 3_000)

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

/** "Abriu o app" conta uma vez por dia por aparelho (base de pessoas ativas e retenção). */
export function trackAppOpen() {
  const today = new Date().toLocaleDateString('sv-SE')
  try {
    if (localStorage.getItem('mmisc.lastOpen') === today) return
    localStorage.setItem('mmisc.lastOpen', today)
  } catch {
    /* sem storage: conta mesmo assim */
  }
  track('app_open', { standalone: matchMedia('(display-mode: standalone)').matches })
}
