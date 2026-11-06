import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Inter servida pelo próprio app (sem Google Fonts): igual em iPhone, Mac, Windows e Android
import '@fontsource-variable/inter/wght.css'
import './index.css'
import './components/ui/ui.css'
import App from './App.tsx'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
