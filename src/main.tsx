import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Inter servida pelo próprio app (sem Google Fonts): igual em iPhone, Mac, Windows e Android
import '@fontsource-variable/inter/wght.css'
import './index.css'
import './components/ui/ui.css'
import App from './App.tsx'
import { countVisit, listenInstallPrompt } from './lib/install'
import { installGlobalErrorHandlers } from './lib/telemetry'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
// Layout de desktop das telas ricas: depois do App, para vir por último na cascata
import './styles/desktop-pages.css'

// Quando sai uma versão nova na Vercel, o app troca sozinho em vez de
// mostrar a versão antiga guardada em cache. Também confere a cada hora.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
  },
})

// Fase 0: erros fora do React (e promessas sem catch) vão para client_errors
installGlobalErrorHandlers()

// M4: guarda o aviso de "pode instalar" do Android e conta os dias de uso
listenInstallPrompt()
countVisit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
