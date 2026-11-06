// Perfil completo (com bio) e edição. A policy "perfis: dono edita" já cobre a bio:
// nada muda no banco nesta etapa.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { CategoryId } from './categories'
import type { ProfileLink } from './profileData'
import type { Profile } from './types'

export interface ProfileFull extends Profile {
  /** até 280 caracteres (check no banco) */
  bio: string | null
  /** 'auto' = mosaico das capas; 'foto' = cover_url */
  cover_mode: 'auto' | 'foto'
  cover_url: string | null
  links: ProfileLink[]
  /** categorias da vitrine de favoritos, em ordem */
  showcase: CategoryId[]
  /** perfil público em /@usuario (padrão: ligado) */
  is_public: boolean
}

export function useProfileFull(id: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-full', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, cover_mode, cover_url, links, showcase, is_public')
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
