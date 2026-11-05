import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Sheet } from './components/ui/Sheet'
import { TabBar } from './components/ui/TabBar'
import Buscar from './pages/Buscar'
import Inicio from './pages/Inicio'
import Kit from './pages/Kit'
import Mapa from './pages/Mapa'
import Perfil from './pages/Perfil'

function Shell() {
  const location = useLocation()
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ maxWidth: 640, margin: '0 auto' }}
        >
          <Routes location={location}>
            <Route path="/" element={<Inicio />} />
            <Route path="/buscar" element={<Buscar />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/kit" element={<Kit />} />
            <Route path="*" element={<Inicio />} />
          </Routes>
        </motion.main>
      </AnimatePresence>

      <TabBar onCompose={() => setComposeOpen(true)} />

      <Sheet open={composeOpen} onClose={() => setComposeOpen(false)} title="Nova review">
        <p style={{ fontSize: 15, color: 'var(--text-2)', textAlign: 'center', margin: '8px 0 20px' }}>
          O formulário de review chega na Fase 2, junto com o login e o banco.
        </p>
        <button type="button" className="btn btn--plain tap" style={{ width: '100%' }} onClick={() => setComposeOpen(false)}>
          Fechar
        </button>
      </Sheet>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
