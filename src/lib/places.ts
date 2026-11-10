// Fase 2d · ficha dos lugares (bar, restaurante, café, banheiro) e sugestões de edição.
// A ficha mora em items.metadata.ficha; bairro/cidade é items.subtitle (campo "area").
// Quem pode decidir e o que vale está no banco (place_suggestions, can_curate_item, decide_suggestion).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Item, Profile } from './types'

import { t } from './i18n'
export type FichaField = 'area' | 'endereco' | 'horario' | 'faixa_preco' | 'atributos' | 'link'

export interface Ficha {
  endereco?: string
  horario?: string
  faixa_preco?: 1 | 2 | 3 | 4
  atributos?: string[]
  link?: string
}

export const FIELD_LABEL: Record<FichaField, string> = {
  area: t('Bairro e cidade'),
  endereco: t('Endereço'),
  horario: t('Horário'),
  faixa_preco: t('Faixa de preço'),
  atributos: t('Características'),
  link: t('Site ou Instagram'),
}

/** Mesma lista do banco (valid_suggestion_value). */
export const ATTRIBUTES: { id: string; label: string }[] = [
  { id: 'musica_ao_vivo', label: t('Música ao vivo') },
  { id: 'mesa_na_calcada', label: t('Mesa na calçada') },
  { id: 'pet_friendly', label: t('Aceita pet') },
  { id: 'bom_para_date', label: t('Bom para date') },
  { id: 'bom_para_grupo', label: t('Bom para grupo') },
  { id: 'bom_para_trabalhar', label: t('Dá para trabalhar') },
  { id: 'wifi', label: t('Wi-fi') },
  { id: 'tomada', label: t('Tomada') },
  { id: 'acessivel', label: t('Acessível') },
  { id: 'aceita_reserva', label: t('Aceita reserva') },
  { id: 'vegetariano', label: t('Opções vegetarianas') },
  { id: 'abre_tarde', label: t('Abre até tarde') },
]
export const attrLabel = (id: string) => ATTRIBUTES.find((a) => a.id === id)?.label ?? id
export const priceLabel = (n: number) => '$'.repeat(n)

export const fichaOf = (item: Item): Ficha => ((item.metadata as { ficha?: Ficha } | null | undefined)?.ficha ?? {})

export type SuggestionValue = string | number | string[]

export interface Suggestion {
  id: string
  item_id: string
  user_id: string
  field: FichaField
  value: SuggestionValue
  note: string | null
  status: 'pendente' | 'aprovada' | 'recusada'
  created_at: string
  author: Pick<Profile, 'id' | 'username' | 'display_name'>
}

/** Como o valor aparece na tela. */
export function showValue(field: FichaField, v: SuggestionValue): string {
  if (field === 'faixa_preco') return priceLabel(Number(v))
  if (field === 'atributos') return (v as string[]).map(attrLabel).join(', ') || 'nenhuma'
  return String(v)
}

export function useSuggestions(itemId: string | undefined) {
  return useQuery({
    queryKey: ['suggestions', itemId],
    enabled: Boolean(itemId),
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await supabase
        .from('place_suggestions')
        .select('id, item_id, user_id, field, value, note, status, created_at, author:profiles!place_suggestions_user_id_fkey ( id, username, display_name )')
        .eq('item_id', itemId!)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Suggestion[]
    },
  })
}

/** Você pode decidir sobre este lugar? (criou, tem 3+ registros nele, ou é admin) */
export function useCanCurate(itemId: string | undefined) {
  return useQuery({
    queryKey: ['can-curate', itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_curate_item', { p_item: itemId! })
      if (error) throw error
      return Boolean(data)
    },
  })
}

export function useSuggest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: { itemId: string; field: FichaField; value: SuggestionValue; note?: string }) => {
      const { data, error } = await supabase
        .from('place_suggestions')
        .insert({ item_id: s.itemId, field: s.field, value: s.value, note: s.note?.trim() || null })
        .select('status')
        .single()
      if (error) throw error
      return data.status as Suggestion['status']
    },
    onSuccess: (_s, v) => {
      qc.invalidateQueries({ queryKey: ['suggestions', v.itemId] })
      qc.invalidateQueries({ queryKey: ['item', v.itemId] })
    },
  })
}

export function useDecideSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: { id: string; itemId: string; approve: boolean }) => {
      const { error } = await supabase.rpc('decide_suggestion', { p_id: d.id, p_approve: d.approve })
      if (error) throw error
    },
    onSuccess: (_r, d) => {
      qc.invalidateQueries({ queryKey: ['suggestions', d.itemId] })
      qc.invalidateQueries({ queryKey: ['item', d.itemId] })
    },
  })
}
