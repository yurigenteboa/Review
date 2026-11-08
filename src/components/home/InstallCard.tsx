import { useEffect, useState } from 'react'
import { dismissInstall, installPlatform, promptInstall, shouldOfferInstall, useCanPromptInstall } from '../../lib/install'

const ShareGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
)

/**
 * M4 · Convite para instalar o MMisc na tela de início (só no celular, a partir da 2ª visita,
 * fora do app instalado; "Agora não" esconde por 14 dias).
 * - Android: botão que abre a instalação nativa.
 * - iPhone no Safari: passo a passo (Compartilhar → Adicionar à Tela de Início).
 * - iPhone em outro navegador (Instagram, WhatsApp, Chrome): pede para abrir no Safari.
 */
export function InstallCard() {
  const canPrompt = useCanPromptInstall()
  const [show, setShow] = useState(false)
  const platform = installPlatform()

  useEffect(() => {
    setShow(shouldOfferInstall())
  }, [])

  if (!show) return null
  if (platform === 'android' && !canPrompt) return null // Chrome ainda não liberou (ou já instalado)
  if (platform === 'other') return null

  const close = () => {
    dismissInstall()
    setShow(false)
  }

  return (
    <section className="install-card" aria-label="Instalar o MMisc">
      <img src="/icons/icon-192.png" alt="" width={48} height={48} />
      <div className="install-card__text">
        <strong>Tenha o MMisc como app</strong>
        {platform === 'android' && <span>Abre em tela cheia, direto da tela de início, e fica mais rápido.</span>}
        {platform === 'ios-safari' && (
          <span>
            Toque em <ShareGlyph /> <b>Compartilhar</b> na barra do Safari e depois em <b>Adicionar à Tela de Início</b>.
          </span>
        )}
        {platform === 'ios-other' && (
          <span>
            Abra <b>mmisc.com.br</b> no <b>Safari</b> para instalar: no iPhone, só ele consegue colocar o app na tela de início.
          </span>
        )}
        <div className="install-card__actions">
          {platform === 'android' && (
            <button
              type="button"
              className="btn btn--primary tap"
              onClick={async () => {
                if (await promptInstall()) setShow(false)
              }}
            >
              Instalar
            </button>
          )}
          <button type="button" className="btn btn--plain tap" onClick={close}>
            Agora não
          </button>
        </div>
      </div>
    </section>
  )
}
