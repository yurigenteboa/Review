import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * D4 · "Coisas do desktop", montado pelo App só quando há mouse/trackpad.
 * Funciona por cima de qualquer tela, sem precisar mexer nas telas dos outros chats:
 *  1. Setas nas fileiras que rolam para o lado (chips, elenco, parecidos, fotos…);
 *  2. Dica ao parar o mouse num botão que só tem ícone (usa o aria-label);
 *  3. Colar (Ctrl+V) ou arrastar fotos para a janela de registro.
 */
export function DesktopEnhancers() {
  return (
    <>
      <RowArrows />
      <HoverHints />
      <PhotoDropPaste />
    </>
  )
}

// ---------------------------------------------------------------------------
// 1. Setas nas fileiras horizontais
// ---------------------------------------------------------------------------

/** Sobe a partir do elemento até achar uma caixa que rola para o lado e está transbordando. */
function findRow(start: Element | null): HTMLElement | null {
  for (let el = start; el && el !== document.body; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue
    if (el.scrollWidth <= el.clientWidth + 4) continue
    const ox = getComputedStyle(el).overflowX
    if (ox === 'auto' || ox === 'scroll') return el
  }
  return null
}

interface RowState {
  el: HTMLElement
  rect: DOMRect
  canLeft: boolean
  canRight: boolean
}

function measure(el: HTMLElement): RowState {
  return {
    el,
    rect: el.getBoundingClientRect(),
    canLeft: el.scrollLeft > 4,
    canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
  }
}

function RowArrows() {
  const [row, setRow] = useState<RowState | null>(null)
  const arrowsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current: HTMLElement | null = null
    const update = () => setRow(current ? measure(current) : null)
    const onScroll = () => update()

    const setCurrent = (el: HTMLElement | null) => {
      if (el === current) return
      current?.removeEventListener('scroll', onScroll)
      current = el
      current?.addEventListener('scroll', onScroll, { passive: true })
      update()
    }

    let lastTarget: EventTarget | null = null
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.target === lastTarget) return
      lastTarget = e.target
      const target = e.target as Element | null
      if (target && arrowsRef.current?.contains(target)) return
      setCurrent(findRow(target))
    }
    const onLeaveWindow = () => setCurrent(null)
    const onPageScroll = () => update()

    document.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeaveWindow)
    window.addEventListener('scroll', onPageScroll, { passive: true, capture: true })
    window.addEventListener('resize', onPageScroll)
    return () => {
      setCurrent(null)
      document.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow)
      window.removeEventListener('scroll', onPageScroll, { capture: true })
      window.removeEventListener('resize', onPageScroll)
    }
  }, [])

  if (!row || (!row.canLeft && !row.canRight)) return null
  const { el, rect } = row
  const go = (dir: 1 | -1) => el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  // Fica no meio da altura da fileira, mas nunca menor que o botão
  const top = rect.top + rect.height / 2

  return createPortal(
    <div ref={arrowsRef} className="row-arrows" aria-hidden="true">
      {row.canLeft && (
        <button
          type="button"
          tabIndex={-1}
          className="row-arrow row-arrow--left"
          style={{ top, left: Math.max(4, rect.left - 6) }}
          onClick={() => go(-1)}
        >
          <Chevron dir="left" />
        </button>
      )}
      {row.canRight && (
        <button
          type="button"
          tabIndex={-1}
          className="row-arrow row-arrow--right"
          style={{ top, left: Math.min(window.innerWidth - 40, rect.right - 30) }}
          onClick={() => go(1)}
        >
          <Chevron dir="right" />
        </button>
      )}
    </div>,
    document.body,
  )
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

// ---------------------------------------------------------------------------
// 2. Dica ao passar o mouse em botões só com ícone
// ---------------------------------------------------------------------------

const HINT_DELAY = 450

function hintFor(el: HTMLElement): string | null {
  // Quem já tem title ganha a dica nativa do navegador; não duplicar
  if (el.hasAttribute('title')) return null
  const label = el.getAttribute('aria-label')
  if (!label) return null
  // Só quando não há texto visível (botões de ícone, avatar…)
  if ((el.innerText ?? '').trim().length > 0) return null
  return label
}

function HoverHints() {
  const [hint, setHint] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null)

  useEffect(() => {
    let timer: number | undefined
    let shownFor: HTMLElement | null = null
    const hide = () => {
      window.clearTimeout(timer)
      shownFor = null
      setHint(null)
    }
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = (e.target as Element | null)?.closest<HTMLElement>('button, a, [role="button"]')
      if (!el || el === shownFor) return
      hide()
      const text = hintFor(el)
      if (!text) return
      timer = window.setTimeout(() => {
        if (!el.isConnected) return
        const r = el.getBoundingClientRect()
        const below = r.top < 48
        shownFor = el
        setHint({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below })
      }, HINT_DELAY)
    }
    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget as Node | null
      if (shownFor && to && shownFor.contains(to)) return
      const from = (e.target as Element | null)?.closest('button, a, [role="button"]')
      if (from && to && from.contains(to)) return
      hide()
    }
    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', hide, true)
    window.addEventListener('scroll', hide, { capture: true, passive: true })
    return () => {
      hide()
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', hide, true)
      window.removeEventListener('scroll', hide, { capture: true })
    }
  }, [])

  if (!hint) return null
  return createPortal(
    <div
      role="tooltip"
      className={`hover-hint ${hint.below ? 'hover-hint--below' : ''}`}
      style={{ left: hint.x, top: hint.y }}
    >
      {hint.text}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// 3. Colar / arrastar fotos para a janela de registro
// ---------------------------------------------------------------------------

const PHOTO_INPUT = 'input[type="file"][accept^="image"]'

/** Janela aberta que aceita fotos (a de registro tem um campo de arquivo de imagem). */
function openPhotoDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
  const top = dialogs[dialogs.length - 1]
  if (!top) return null
  if (top.querySelector(PHOTO_INPUT) || top.querySelector('.details-toggle')) return top
  return null
}

function images(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
}

/** Entrega as fotos ao campo de arquivo da própria janela, como se a pessoa tivesse escolhido. */
function deliver(dialog: HTMLElement, files: File[], retry = true) {
  const input = dialog.querySelector<HTMLInputElement>(PHOTO_INPUT)
  if (!input) {
    // Fotos ficam em "Mais detalhes": abre e tenta de novo no próximo quadro
    const toggle = dialog.querySelector<HTMLButtonElement>('.details-toggle[aria-expanded="false"]')
    if (toggle && retry) {
      toggle.click()
      requestAnimationFrame(() => requestAnimationFrame(() => deliver(dialog, files, false)))
    }
    return
  }
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function PhotoDropPaste() {
  useEffect(() => {
    let over: HTMLElement | null = null
    const clear = () => {
      over?.classList.remove('is-dropping')
      over = null
    }
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onPaste = (e: ClipboardEvent) => {
      const dialog = openPhotoDialog()
      const files = images(e.clipboardData?.files)
      if (!dialog || files.length === 0) return
      e.preventDefault()
      deliver(dialog, files)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      const dialog = openPhotoDialog()
      if (!dialog) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      if (over !== dialog) {
        clear()
        over = dialog
        dialog.classList.add('is-dropping')
      }
    }
    const onDragLeave = (e: DragEvent) => {
      // Saiu da janela do navegador
      if (!e.relatedTarget) clear()
    }
    const onDrop = (e: DragEvent) => {
      const dialog = openPhotoDialog()
      clear()
      if (!dialog || !hasFiles(e)) return
      e.preventDefault()
      const files = images(e.dataTransfer?.files)
      if (files.length) deliver(dialog, files)
    }

    document.addEventListener('paste', onPaste)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      clear()
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [])
  return null
}
