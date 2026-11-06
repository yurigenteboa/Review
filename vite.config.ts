import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      // A versão nova assume na hora, sem esperar todas as abas fecharem.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Guarda para offline só a Inter do alfabeto latino (português); os outros
        // alfabetos (cirílico, grego, vietnamita) baixam sob demanda, se aparecerem.
        globPatterns: ['**/*.{js,css,html}', 'assets/inter-latin-*.woff2'],
      },
      manifest: {
        name: 'MMISC',
        short_name: 'MMISC',
        description: 'MMISC: nota para tudo. Álbuns, filmes, jogos, bares, banheiros e cidades.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Sem trava: tablet deitado e janela do app no desktop também valem
        orientation: 'any',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
