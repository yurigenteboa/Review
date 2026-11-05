// Dados FALSOS só para a Fase 1 (casca do app).
// Na Fase 2 tudo isso é substituído por consultas ao Supabase.
import type { CategoryId } from './categories'

export interface Item {
  id: string
  category: CategoryId
  title: string
  subtitle: string
  /** Duas cores da capa provisória (até termos imagens reais das APIs) */
  colors: [string, string]
  glyph: string
}

export interface Review {
  id: string
  itemId: string
  author: string
  initials: string
  avatarColor: string
  rating: number
  text: string
  time: string
  likes: number
}

export const ITEMS: Item[] = [
  { id: 'clube', category: 'album', title: 'Clube da Esquina', subtitle: 'Milton Nascimento & Lô Borges · 1972', colors: ['#4B2380', '#C07CF0'], glyph: 'CE' },
  { id: 'bacurau', category: 'filme', title: 'Bacurau', subtitle: 'Kleber Mendonça Filho · 2019', colors: ['#7A140C', '#FF6B4A'], glyph: 'B' },
  { id: 'saturno', category: 'bar', title: 'Bar Saturno', subtitle: 'Pinheiros, São Paulo (exemplo)', colors: ['#A34C00', '#FFB340'], glyph: 'BS' },
  { id: 'praca', category: 'banheiro', title: 'Banheiro da Praça Central', subtitle: 'Centro, São Paulo (exemplo)', colors: ['#063F8A', '#5AC8FA'], glyph: 'WC' },
  { id: 'hollow', category: 'jogo', title: 'Hollow Knight', subtitle: 'Team Cherry · 2017', colors: ['#163F22', '#5FCB7E'], glyph: 'HK' },
  { id: 'paraty', category: 'cidade', title: 'Paraty', subtitle: 'Rio de Janeiro', colors: ['#0A5A54', '#4FD1C5'], glyph: 'P' },
]

export const REVIEWS: Review[] = [
  { id: 'r1', itemId: 'clube', author: 'Ana', initials: 'AN', avatarColor: '#AF52DE', rating: 5, time: 'há 2 h', likes: 4,
    text: 'Ouvi inteiro no ônibus e passei do ponto. Não tem uma faixa sobrando.' },
  { id: 'r2', itemId: 'praca', author: 'Léo', initials: 'LE', avatarColor: '#0A84FF', rating: 2, time: 'há 5 h', likes: 11,
    text: 'Tinha papel, mas a fechadura é decorativa. Segurei a porta com o pé o tempo todo.' },
  { id: 'r3', itemId: 'saturno', author: 'Bia', initials: 'BI', avatarColor: '#FF9500', rating: 4.5, time: 'ontem', likes: 6,
    text: 'Chope gelado de verdade, e o bolinho de mandioca justifica a fila.' },
  { id: 'r4', itemId: 'bacurau', author: 'Você', initials: 'YS', avatarColor: '#1C1C1E', rating: 4.5, time: 'há 2 dias', likes: 3,
    text: 'Revi depois de anos e continua estranho do jeito certo.' },
  { id: 'r5', itemId: 'hollow', author: 'Caio', initials: 'CA', avatarColor: '#34C759', rating: 5, time: 'há 3 dias', likes: 2,
    text: 'Morri 40 vezes no mesmo chefe e voltei feliz em todas.' },
  { id: 'r6', itemId: 'paraty', author: 'Você', initials: 'YS', avatarColor: '#1C1C1E', rating: 4, time: 'há 1 semana', likes: 5,
    text: 'Centro histórico lindo. Vá de tênis: as pedras não perdoam.' },
]

export const itemById = (id: string) => ITEMS.find((i) => i.id === id)!
