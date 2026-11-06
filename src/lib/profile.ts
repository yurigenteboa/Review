// Perfil completo (com bio) e edição. A policy "perfis: dono edita" já cobre a bio:
// nada muda no banco nesta etapa.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Profile } from './types'

export interface ProfileFull extends Profile {
  /** até 280 caracteres (check no banco) */
  bio: string | null
}

export function useProfileFull(id: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-full', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as ProfileFull
    },
  })
}

export const BIO_MAX = 280

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; display_name: string; username: string; bio: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: p.display_name.trim() || null,
          username: p.username.trim().toLowerCase() || null,
          bio: p.bio.trim().slice(0, BIO_MAX) || null,
        })
        .eq('id', p.id)
      if (error) {
        if (error.code === '23505') throw new Error('Esse @ já está em uso.')
        if (error.code === '23514') throw new Error('O @ precisa ter de 3 a 24 letras minúsculas, números, ponto ou _.')
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}
