import { formatNumber, t } from './i18n'
// Categorias iniciais. Na Fase 2 elas passam a vir da tabela `categories` do Supabase;
// este arquivo continua servindo de fallback e de referência para os critérios.

export type CategoryId =
  | 'album'
  | 'filme'
  | 'serie'
  | 'jogo'
  | 'livro'
  | 'bar'
  | 'banheiro'
  | 'cidade'
  | 'drink'
  | 'prato'
  | 'restaurante'
  | 'cafe'

/** Grupo da categoria (igual à coluna categories.grupo do banco). */
export type CategoryGroup = 'cultura' | 'lugar' | 'consumo' | 'evento'

export interface Category {
  id: CategoryId
  label: string
  /** Critérios avaliados de 1 a 5 além da nota geral */
  criteria: string[]
  group: CategoryGroup
  /** Categorias "pai" onde esta pode morar (drink mora em bar). Igual a categories.mora_em. */
  livesIn?: CategoryId[]
  /** Fase 2: lugares levam nota por comparação (gostei/ok/não gostei + melhor ou pior que). Igual a categories.modo_nota. */
  ratingMode?: 'estrelas' | 'comparacao'
}

/** Lugares que têm coisas dentro (drink, prato, banheiro). */
const PLACES_WITH_INSIDE: CategoryId[] = ['bar', 'restaurante', 'cafe']

/** Lugares buscados no OpenStreetMap (com "perto de você"). */
export const PLACE_SEARCH: CategoryId[] = ['bar', 'restaurante', 'cafe', 'banheiro']

export const CATEGORIES: Category[] = [
  { id: 'album', label: t('Álbum'), criteria: [t('Produção'), t('Letras'), t('Coesão')], group: 'cultura' },
  { id: 'filme', label: t('Filme'), criteria: [t('Roteiro'), t('Fotografia'), t('Atuação')], group: 'cultura' },
  { id: 'serie', label: t('Série'), criteria: [t('Roteiro'), t('Elenco'), t('Final')], group: 'cultura' },
  { id: 'jogo', label: t('Jogo'), criteria: [t('Jogabilidade'), t('Visual'), t('História')], group: 'cultura' },
  { id: 'livro', label: t('Livro'), criteria: [t('Escrita'), t('Ritmo'), t('Final')], group: 'cultura' },
  { id: 'bar', label: t('Bar'), criteria: [t('Bebida'), t('Comida'), t('Ambiente'), t('Preço')], group: 'lugar', ratingMode: 'comparacao' },
  { id: 'restaurante', label: t('Restaurante'), criteria: [t('Comida'), t('Atendimento'), t('Ambiente'), t('Preço')], group: 'lugar', ratingMode: 'comparacao' },
  { id: 'cafe', label: t('Café'), criteria: [t('bebida::Café'), t('Comida'), t('Ambiente'), t('Preço')], group: 'lugar', ratingMode: 'comparacao' },
  { id: 'banheiro', label: t('Banheiro'), criteria: [t('Limpeza'), t('Papel'), t('Cheiro'), t('Acessível')], group: 'lugar', livesIn: PLACES_WITH_INSIDE },
  { id: 'cidade', label: t('Cidade'), criteria: [t('Andar a pé'), t('Comida'), t('Custo')], group: 'lugar' },
  { id: 'drink', label: t('Drink'), criteria: [t('Sabor'), t('Equilíbrio'), t('Preço')], group: 'consumo', livesIn: PLACES_WITH_INSIDE },
  { id: 'prato', label: t('Prato'), criteria: [t('Sabor'), t('Porção'), t('Preço')], group: 'consumo', livesIn: PLACES_WITH_INSIDE },
]

/**
 * Categorias que aparecem nos filtros e no "+" sozinhas. Drink e prato ficam de fora:
 * são registrados DENTRO de um lugar ("o que você pediu?"), não soltos.
 */
export const TOP_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.group !== 'consumo')

/** O que pode morar dentro de um item desta categoria (bar -> drink, prato, banheiro). */
export const childCategories = (id: CategoryId): Category[] =>
  CATEGORIES.filter((c) => c.livesIn?.includes(id))
    // o que se pede (drink, prato) vem antes do resto (banheiro): a primeira opção é a padrão
    .sort((a, b) => Number(a.group !== 'consumo') - Number(b.group !== 'consumo'))

export const categoryById = (id: CategoryId): Category =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]

/** Cor e tinta vêm dos tokens CSS (--cat-<id> e --cat-<id>-ink) */
export const catColor = (id: CategoryId) => `var(--cat-${id})`
export const catInk = (id: CategoryId) => `var(--cat-${id}-ink)`

/** Formata nota no padrão do idioma: 4.5 -> "4,5" (pt, es, fr, de, fi) ou "4.5" (en) */
export const formatRating = (n: number) => formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** categorias com nota por comparação e ranking próprio (bar, restaurante, café) */
export const RANKED_CATEGORIES = CATEGORIES.filter((c) => c.ratingMode === 'comparacao')
