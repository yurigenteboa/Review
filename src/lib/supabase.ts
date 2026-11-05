import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando o .env.local está preenchido */
export const supabaseReady = Boolean(url && key)

if (!supabaseReady) {
  console.warn(
    '[Review] Supabase não configurado: crie o arquivo .env.local a partir do .env.example.',
  )
}

// Na Fase 1 o app ainda roda com dados falsos; o cliente já fica pronto para a Fase 2.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key')
