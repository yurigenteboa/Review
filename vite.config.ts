import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Fase 0: versão que vai junto de cada erro/evento (commit na Vercel, "local" no PC)
const release = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(release),
  },
  build: {
    // As bibliotecas (React, Supabase, motion…) num arquivo próprio: mudam pouco, então o
    // celular guarda esse arquivo em cache e, a cada deploy, só baixa de novo o código do app.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|@supabase|@tanstack|motion|motion-dom|motion-utils|framer-motion|tslib|iceberg-js)[\\/]/,
            },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
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
        // Fase 2c: o mapa (~275 KB comprimido) só baixa quando alguém abre a tela, não na instalação
        globIgnores: ['**/Mapa-*'],
      },
      manifest: {
        id: '/',
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
        // Android: segurar o ícone do app mostra estes atalhos (o iPhone não tem para apps da web)
        shortcuts: [
          { name: 'Nova review', short_name: 'Registrar', url: '/?novo=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Buscar', short_name: 'Buscar', url: '/buscar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
