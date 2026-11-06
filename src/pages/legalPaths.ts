// Endereços das páginas públicas (Sobre, Privacidade…). Ficam fora de Legal.tsx para
// o App saber as rotas sem baixar o texto das páginas no primeiro carregamento.
export type LegalDoc = 'sobre' | 'privacidade' | 'termos' | 'excluir-dados'
export const LEGAL_PATHS: Record<LegalDoc, string> = {
  sobre: '/sobre',
  privacidade: '/privacidade',
  termos: '/termos',
  'excluir-dados': '/excluir-dados',
}
