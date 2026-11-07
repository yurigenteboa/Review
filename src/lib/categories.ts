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
  { id: 'album', label: 'Álbum', criteria: ['Produção', 'Letras', 'Coesão'], group: 'cultura' },
  { id: 'filme', label: 'Filme', criteria: ['Roteiro', 'Fotografia', 'Atuação'], group: 'cultura' },
  { id: 'serie', label: 'Série', criteria: ['Roteiro', 'Elenco', 'Final'], group: 'cultura' },
  { id: 'jogo', label: 'Jogo', criteria: ['Jogabilidade', 'Visual', 'História'], group: 'cultura' },
  { id: 'livro', label: 'Livro', criteria: ['Escrita', 'Ritmo', 'Final'], group: 'cultura' },
  { id: 'bar', label: 'Bar', criteria: ['Bebida', 'Comida', 'Ambiente', 'Preço'], group: 'lugar', ratingMode: 'comparacao' },
  { id: 'restaurante', label: 'Restaurante', criteria: ['Comida', 'Atendimento', 'Ambiente', 'Preço'], group: 'lugar', ratingMode: 'comparacao' },
  { id: 'cafe', label: 'Café', criteria: ['Café', 'Comida', 'Ambiente', 'Preço'], group: 'lugar', ratingMode: 'comparacao' },
  { id: 'banheiro', label: 'Banheiro', criteria: ['Limpeza', 'Papel', 'Cheiro', 'Acessível'], group: 'lugar', livesIn: PLACES_WITH_INSIDE },
  { id: 'cidade', label: 'Cidade', criteria: ['Andar a pé', 'Comida', 'Custo'], group: 'lugar' },
  { id: 'drink', label: 'Drink', criteria: ['Sabor', 'Equilíbrio', 'Preço'], group: 'consumo', livesIn: PLACES_WITH_INSIDE },
  { id: 'prato', label: 'Prato', criteria: ['Sabor', 'Porção', 'Preço'], group: 'consumo', livesIn: PLACES_WITH_INSIDE },
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

/** Formata nota no padrão brasileiro: 4.5 -> "4,5" */
export const formatRating = (n: number) => n.toFixed(1).replace('.', ',')
