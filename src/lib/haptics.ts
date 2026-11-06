/**
 * Vibração leve de confirmação (M2).
 * - Android/Chrome: `navigator.vibrate`.
 * - iPhone (iOS 18+): o Safari não tem vibrate, mas dá um "toque" ao mudar um
 *   interruptor nativo (`<input type="checkbox" switch>`). Um interruptor escondido
 *   é clicado por baixo dos panos. Só funciona dentro de um gesto da pessoa (toque/clique).
 * - Sem suporte (ou quem pede menos movimento): não faz nada.
 */
let iosSwitch: HTMLLabelElement | null = null

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9px;top:-9px'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosSwitch = label
  }
  iosSwitch.click()
}

const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)

export function haptic(kind: 'tick' | 'success' = 'tick') {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(kind === 'success' ? [12, 40, 18] : 8)
    return
  }
  if (isIOS) iosTick()
}
