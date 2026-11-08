import { requestCompose } from './composeBus'
import { prefersReducedMotion } from './appearance'

/**
 * Controle de videogame no estilo Console (Gamepad API do navegador; carregado só nesse estilo).
 *   direcional ou alavanca esquerda  → anda pelo que dá para tocar (baixo/direita = próximo)
 *   A (botão de baixo)               → toca no item em foco
 *   B (botão da direita)             → fecha a janela aberta ou volta
 *   Start / Options / Menu           → nova review
 * Segurar o direcional repete o movimento. Ao usar o controle, a tag <html> ganha
 * data-controle="on" e o foco fica sempre visível (estilos.css); tocar na tela tira.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const BTN = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const
const FIRST_REPEAT = 380
const REPEAT = 110

let running = false
let frame = 0
let pressed: boolean[] = []
let heldDir = 0
let nextRepeat = 0

function visible(el: HTMLElement) {
  if (el.closest('[inert], [aria-hidden="true"]')) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

/** O que dá para focar: dentro da janela aberta (se houver) ou na página. */
function focusables(): HTMLElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
  const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)
}

function markPad(on: boolean) {
  if (on) document.documentElement.setAttribute('data-controle', 'on')
  else document.documentElement.removeAttribute('data-controle')
}

function move(dir: 1 | -1) {
  const list = focusables()
  if (!list.length) return
  const i = list.indexOf(document.activeElement as HTMLElement)
  const next = list[i === -1 ? (dir === 1 ? 0 : list.length - 1) : (i + dir + list.length) % list.length]
  markPad(true)
  next.focus({ preventScroll: true })
  next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

function back() {
  const open = document.querySelector('[role="dialog"][aria-modal="true"]')
  if (open) {
    ;(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return
  }
  const state = window.history.state as { idx?: number } | null
  if (state?.idx && state.idx > 0) window.history.back()
}

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  const pad = Array.from(navigator.getGamepads?.() ?? []).find((g) => g?.connected)
  if (!pad) return
  const down = (i: number) => Boolean(pad.buttons[i]?.pressed)
  const just = (i: number) => down(i) && !pressed[i]

  // direção: botões do direcional ou alavanca esquerda (zona morta de 0,5)
  const ax = pad.axes[0] ?? 0
  const ay = pad.axes[1] ?? 0
  const dir = down(BTN.DOWN) || down(BTN.RIGHT) || ay > 0.5 || ax > 0.5 ? 1 : down(BTN.UP) || down(BTN.LEFT) || ay < -0.5 || ax < -0.5 ? -1 : 0
  if (dir !== heldDir) {
    heldDir = dir
    if (dir) {
      move(dir as 1 | -1)
      nextRepeat = now + FIRST_REPEAT
    }
  } else if (dir && now >= nextRepeat) {
    move(dir as 1 | -1)
    nextRepeat = now + REPEAT
  }

  if (just(BTN.A)) {
    const el = document.activeElement as HTMLElement | null
    if (el && el !== document.body) el.click()
  }
  if (just(BTN.B)) back()
  if (just(BTN.START)) requestCompose({})

  pressed = pad.buttons.map((b) => b.pressed)
}

function onConnect() {
  if (!frame) frame = requestAnimationFrame(tick)
}
function onPointer() {
  markPad(false)
}

export function startGamepad() {
  if (running || typeof navigator.getGamepads !== 'function') return
  running = true
  window.addEventListener('gamepadconnected', onConnect)
  window.addEventListener('pointerdown', onPointer, { passive: true })
  // o navegador só mostra o controle depois do primeiro botão apertado; se já estiver lá, começa já
  if (Array.from(navigator.getGamepads()).some((g) => g?.connected)) onConnect()
}

export function stopGamepad() {
  if (!running) return
  running = false
  window.removeEventListener('gamepadconnected', onConnect)
  window.removeEventListener('pointerdown', onPointer)
  cancelAnimationFrame(frame)
  frame = 0
  markPad(false)
}
