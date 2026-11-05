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

export interface Category {
  id: CategoryId
  label: string
  /** Critérios avaliados de 1 a 5 além da nota geral */
  criteria: string[]
}

export const CATEGORIES: Category[] = [
  { id: 'album', label: 'Álbum', criteria: ['Produção', 'Letras', 'Coesão'] },
  { id: 'filme', label: 'Filme', criteria: ['Roteiro', 'Fotografia', 'Atuação'] },
  { id: 'serie', label: 'Série', criteria: ['Roteiro', 'Elenco', 'Final'] },
  { id: 'jogo', label: 'Jogo', criteria: ['Jogabilidade', 'Visual', 'História'] },
  { id: 'livro', label: 'Livro', criteria: ['Escrita', 'Ritmo', 'Final'] },
  { id: 'bar', label: 'Bar', criteria: ['Bebida', 'Comida', 'Ambiente', 'Preço'] },
  { id: 'banheiro', label: 'Banheiro', criteria: ['Limpeza', 'Papel', 'Cheiro', 'Acessível'] },
  { id: 'cidade', label: 'Cidade', criteria: ['Andar a pé', 'Comida', 'Custo'] },
]

export const categoryById = (id: CategoryId): Category =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]

/** Cor e tinta vêm dos tokens CSS (--cat-<id> e --cat-<id>-ink) */
export const catColor = (id: CategoryId) => `var(--cat-${id})`
export const catInk = (id: CategoryId) => `var(--cat-${id}-ink)`

/** Formata nota no padrão brasileiro: 4.5 -> "4,5" */
export const formatRating = (n: number) => n.toFixed(1).replace('.', ',')
