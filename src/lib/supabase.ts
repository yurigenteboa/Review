import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando o .env.local (ou as variáveis da Vercel) estão preenchidos */
export const supabaseReady = Boolean(url && key)

if (!supabaseReady) {
  console.warn(
    '[MMISC] Supabase não configurado: crie o arquivo .env.local a partir do .env.example.',
  )
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const PHOTO_BUCKET = 'review-photos'
