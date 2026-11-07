import { useSyncExternalStore } from 'react'
import { isStandalone } from './auth'

/**
 * M4 · Convite para instalar.
 * Android/Chrome/Edge avisam que o app pode ser instalado com o evento `beforeinstallprompt`;
 * ele chega uma vez, cedo, então é guardado aqui (main.tsx chama `listenInstallPrompt`).
 * O iPhone não tem esse evento: lá o app mostra o passo a passo do Safari.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function listenInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // nada de mini-barra do Chrome: o convite é o do app
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => deferred !== null,
    () => false,
  )
}

/** Abre a janela nativa de instalação (Android/desktop). Devolve true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  emit()
  await ev.prompt()
  const { outcome } = await ev.userChoice
  return outcome === 'accepted'
}

export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'other'

/** Onde a pessoa está: decide qual convite mostrar. */
export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) {
    // dentro do Instagram, WhatsApp, Chrome do iPhone… não dá para instalar: precisa abrir no Safari
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line\/|WhatsApp|GSA/.test(ua)
    return safari ? 'ios-safari' : 'ios-other'
  }
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

const DISMISS_KEY = 'mmisc.installDismissedAt'
const VISITS_KEY = 'mmisc.visits'
const QUIET_DAYS = 14

/** Conta visitas (uma por dia de uso) para não pedir instalação na primeira abertura. */
export function countVisit() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = JSON.parse(localStorage.getItem(VISITS_KEY) ?? '{"n":0,"last":""}') as { n: number; last: string }
    if (raw.last !== today) localStorage.setItem(VISITS_KEY, JSON.stringify({ n: raw.n + 1, last: today }))
  } catch {
    /* modo privado */
  }
}

/** Mostrar o convite? Só no celular, fora do app instalado, a partir da 2ª visita e fora do "agora não". */
export function shouldOfferInstall(): boolean {
  if (isStandalone()) return false
  if (!window.matchMedia('(pointer: coarse)').matches) return false
  try {
    const visits = (JSON.parse(localStorage.getItem(VISITS_KEY) ?? '{"n":0}') as { n: number }).n
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (visits < 2) return false
    return Date.now() - dismissed > QUIET_DAYS * 86_400_000
  } catch {
    return false
  }
}

export function dismissInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* modo privado */
  }
}
