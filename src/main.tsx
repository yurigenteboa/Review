import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Inter servida pelo próprio app (sem Google Fonts): igual em iPhone, Mac, Windows e Android
import '@fontsource-variable/inter/wght.css'
import './index.css'
import './components/ui/ui.css'
// Estilos inteiros (Acrílico, Anos 90…): ~2 KB; vêm junto para não piscar ao abrir
import './styles/estilos.css'
import { initI18n } from './lib/i18n'

// Quando sai uma versão nova na Vercel, o app troca sozinho em vez de
// mostrar a versão antiga guardada em cache. Também confere a cada hora.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
  },
})

// Idiomas: o dicionário (en, es, fr, de, fi) precisa estar carregado ANTES de qualquer outro
// arquivo do app rodar, porque muitos textos ficam em constantes no topo dos arquivos.
// Por isso o resto do app só é importado depois. Em português não há nada para baixar.
void initI18n().then(async () => {
  const [{ default: App }, install, appearance, telemetry, { ErrorBoundary }] = await Promise.all([
    import('./App.tsx'),
    import('./lib/install'),
    import('./lib/appearance'),
    import('./lib/telemetry'),
    import('./components/ui/ErrorBoundary'),
  ])
  // Layout de desktop das telas ricas: depois do App, para vir por último na cascata
  await import('./styles/desktop-pages.css')

  // Fase 0: erros fora do React (e promessas sem catch) vão para client_errors
  telemetry.installGlobalErrorHandlers()

  // Aparência escolhida pela pessoa (tema, texto, contraste…): o index.html já aplicou antes da
  // pintura; aqui passa a acompanhar o aparelho quando algo está em "automático"
  appearance.initAppearance()

  // M4: guarda o aviso de "pode instalar" do Android e conta os dias de uso
  install.listenInstallPrompt()
  install.countVisit()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary scope="app">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
})
