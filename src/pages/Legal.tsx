import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '../components/ui/Brand'
import { PageHeader } from '../components/ui/PageHeader'
import { metricsEnabled, setMetricsEnabled } from '../lib/telemetry'

/**
 * Páginas públicas (abrem sem login): exigidas pelo Google para publicar o login
 * e úteis para a LGPD. Mudou algo no tratamento de dados? Atualize aqui e a data.
 */

/** E-mail de contato para privacidade e pedidos de exclusão. */
export const CONTACT_EMAIL = 'contato@mmisc.com.br'
const UPDATED = new Date(2026, 10, 7).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })

import { LEGAL_PATHS, type LegalDoc } from './legalPaths'
import { currentLang, locale, t } from '../lib/i18n'
export { LEGAL_PATHS, type LegalDoc }

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

const DOCS: Record<LegalDoc, { title: ReactNode; subtitle?: string; body: ReactNode }> = {
  sobre: {
    title: <Wordmark className="legal__wordmark" />,
    subtitle: t('Nota para tudo'),
    body: (
      <>
        <p>
          {t('O MMisc é um app para dar nota e escrever reviews de tudo o que você vive: álbuns, filmes, séries, jogos, livros, bares, banheiros públicos e cidades. Você mantém um diário do que viu, ouviu e visitou, guarda o que quer ver depois e acompanha o que seus amigos estão achando.')}
        </p>
        <h2>{t('O que dá para fazer')}</h2>
        <ul>
          <li>{t('Registrar uma nota de 0,5 a 5, com texto, fotos e data.')}</li>
          <li>{t('Buscar itens em catálogos públicos (filmes, séries, jogos, livros, músicas, lugares e cidades).')}</li>
          <li>{t('Montar uma lista de “quero ver” e marcar os streamings que você assina.')}</li>
          <li>{t('Convidar amigos, ver o feed deles, curtir e comentar.')}</li>
        </ul>
        <h2>{t('Como entrar')}</h2>
        <p>
          {t('Sem senha: com um código enviado para o seu e-mail ou com a sua conta do Google. Usando o mesmo e-mail nos dois, você entra sempre na mesma conta.')}
        </p>
        <p>
          <Link to="/">{t('Entrar no MMisc')}</Link>
        </p>
      </>
    ),
  },

  privacidade: {
    title: t('Privacidade'),
    subtitle: t('Atualizada em {UPDATED}', { UPDATED }),
    body: (
      <>
        <p>
          {t('Esta política explica quais dados o MMisc (www.mmisc.com.br) coleta, para que usa e como você pode pedir acesso, correção ou exclusão, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Dúvidas: {email}.', { email: <Mail /> })}
        </p>

        <h2>{t('Dados que coletamos')}</h2>
        <ul>
          <li>
            {t('{rotulo} seu e-mail. Se você entrar com o Google, recebemos também nome, e-mail e foto de perfil da sua conta Google (escopos {escopos}). Não acessamos Gmail, contatos, agenda nem qualquer outro dado do Google.', {
              rotulo: <strong>{t('Conta:')}</strong>,
              escopos: <><code>openid</code>, <code>email</code>, <code>profile</code></>,
            })}
          </li>
          <li>
            {t('{rotulo} nome de exibição, @ de usuário e foto, que você pode mudar quando quiser.', { rotulo: <strong>{t('Perfil:')}</strong> })}
          </li>
          <li>
            {t('{rotulo} notas, textos, fotos, datas, onde e com quem viu, curtidas, comentários, lista de “quero ver” e streamings que você assina.', { rotulo: <strong>{t('O que você publica:')}</strong> })}
          </li>
          <li>
            {t('{rotulo} ficam visíveis só para você.', { rotulo: <strong>{t('Notas privadas:')}</strong> })}
          </li>
          <li>
            {t('{rotulo} com quem você é amigo e os convites que criou ou aceitou.', { rotulo: <strong>{t('Amizades e convites:')}</strong> })}
          </li>
        </ul>

        <h2>{t('Para que usamos')}</h2>
        <ul>
          <li>{t('Fazer você entrar na sua conta e mantê-la segura.')}</li>
          <li>{t('Mostrar seu diário, suas reviews e o que seus amigos publicam.')}</li>
          <li>{t('Enviar o código de acesso por e-mail e avisos do próprio app.')}</li>
        </ul>
        <p>{t('Não vendemos seus dados, não mostramos anúncios e não usamos seus dados para publicidade.')}</p>

        <h2>{t('Quem vê o quê')}</h2>
        <p>
          {t('Cada review tem uma visibilidade: só você, seus amigos ou público. Nome, @ e foto do perfil ficam visíveis para quem tem conta no MMisc.')}
        </p>

        <h2>{t('Perfil público')}</h2>
        <p>
          {t('Todo perfil com @ tem um link público (por exemplo, mmisc.com.br/@seunome) que abre sem login. Ele vem ligado e pode ser desligado a qualquer momento em Perfil → Editar → Perfil público. Quem abre o link vê nome, @, foto, capa, bio, links e apenas o que você marcou como Público: reviews, favoritos e Top 10. Nunca aparecem a lista de amigos, metas, quero ver, notas privadas, com quem você viu algo, fotos das reviews ou qualquer coisa marcada para amigos ou só para você. A prévia do link em apps como o WhatsApp usa o mesmo conteúdo público.')}
        </p>

        <h2>{t('Serviços que usamos')}</h2>
        <ul>
          <li>{t('Supabase (banco de dados, login e arquivos), em servidores em São Paulo.')}</li>
          <li>{t('Vercel (hospedagem do site).')}</li>
          <li>{t('Resend (envio dos e-mails de acesso).')}</li>
          <li>{t('Google (login com Google, se você escolher).')}</li>
          <li>
            {t('Catálogos públicos como TMDB, MusicBrainz, IGDB, Open Library, OpenStreetMap e IBGE: recebem só o termo buscado, nunca seus dados pessoais. Dados de onde assistir: JustWatch.')}
          </li>
        </ul>

        <h2>{t('Dados do Google')}</h2>
        <p>
          {t('O uso que o MMisc faz das informações recebidas das APIs do Google segue a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de uso limitado. Usamos nome, e-mail e foto só para criar e identificar sua conta.')}
        </p>

        <h2>{t('Erros e métricas de uso')}</h2>
        <p>
          {t('Para consertar problemas e saber se o app está funcionando bem, o MMisc registra no próprio banco de dados (no Supabase, em São Paulo, sem nenhuma outra empresa de análise):')}
        </p>
        <ul>
          <li>
            {t('{rotulo} a mensagem técnica do erro, a tela onde aconteceu, a versão do app e o navegador.', { rotulo: <strong>{t('Erros:')}</strong> })}
          </li>
          <li>
            {t('{rotulo} alguns eventos sem conteúdo, como abrir o app (uma vez por dia), abrir, salvar ou cancelar um registro (com o tempo que levou e a categoria) e uma busca sem resultado (só a categoria, nunca o que você digitou).', { rotulo: <strong>{t('Uso:')}</strong> })}
          </li>
        </ul>
        <p>
          {t('Nunca entram aí o texto das suas reviews, notas, fotos, e-mail ou localização. Esses dados não são vistos por outros usuários e são apagados depois de 180 dias. Você pode desligar as métricas de uso neste aparelho; os avisos de erro continuam, porque são o que nos deixa corrigir falhas.')}
        </p>
        <MetricsToggle />

        <h2>{t('Por quanto tempo guardamos')}</h2>
        <p>
          {t('Enquanto sua conta existir. Quando você pede a exclusão, apagamos a conta e tudo o que está ligado a ela. Erros e métricas de uso: 180 dias.')}
        </p>

        <h2>{t('Seus direitos')}</h2>
        <p>
          {t('Você pode pedir acesso, correção, cópia ou exclusão dos seus dados e revogar o login com o Google a qualquer momento. Veja {como} ou escreva para {email}.', {
            como: <Link to="/excluir-dados">{t('como excluir seus dados')}</Link>,
            email: <Mail />,
          })}
        </p>
      </>
    ),
  },

  termos: {
    title: t('Termos de uso'),
    subtitle: t('Atualizados em {UPDATED}', { UPDATED }),
    body: (
      <>
        <p>{t('Ao usar o MMisc você concorda com estes termos. Se não concordar, não use o app.')}</p>
        <h2>{t('Sua conta')}</h2>
        <p>
          {t('A conta é pessoal. Você é responsável pelo que publica e por manter o acesso ao seu e-mail ou à sua conta Google.')}
        </p>
        <h2>{t('O que você publica')}</h2>
        <p>
          {t('O conteúdo continua sendo seu. Você nos autoriza a guardá-lo e exibi-lo conforme a visibilidade que escolher. Não publique nada ilegal, ofensivo, que viole direitos de outras pessoas ou dados pessoais de terceiros.')}
        </p>
        <h2>{t('Moderação')}</h2>
        <p>{t('Podemos remover conteúdo ou suspender contas que desrespeitem estes termos.')}</p>
        <h2>{t('O serviço')}</h2>
        <p>
          {t('O MMisc é um projeto pessoal, oferecido como está, de graça. Ele pode mudar, ficar fora do ar ou ser encerrado; nesse caso, avisaremos com antecedência para você poder pedir uma cópia dos seus dados.')}
        </p>
        <h2>{t('Contato')}</h2>
        <p>
          <Mail />
        </p>
      </>
    ),
  },

  'excluir-dados': {
    title: t('Excluir seus dados'),
    body: (
      <>
        <h2>{t('Excluir a conta do MMisc')}</h2>
        <p>
          {t('Envie um e-mail para {email} a partir do e-mail da sua conta, com o assunto “Excluir minha conta”. Em até 15 dias apagamos a conta e tudo o que está ligado a ela: perfil, reviews, fotos, notas privadas, listas, curtidas, comentários, amizades e convites. Respondemos confirmando a exclusão.', { email: <Mail /> })}
        </p>
        <p>{t('Em breve será possível fazer isso direto em Perfil, sem precisar escrever.')}</p>

        <h2>{t('Desconectar o Google')}</h2>
        <p>
          {t('Para tirar o acesso do MMisc à sua conta Google, abra {link}, escolha MMisc e remova o acesso. Isso não apaga sua conta do MMisc: para isso, siga o passo acima.', {
            link: (
              <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
                myaccount.google.com/connections
              </a>
            ),
          })}
        </p>
      </>
    ),
  },
}

export default function Legal({ doc }: { doc: LegalDoc }) {
  const d = DOCS[doc]
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <PageHeader title={d.title} subtitle={d.subtitle} />
      <article className="legal">
        {currentLang() !== 'pt' && doc !== 'sobre' && (
          <p className="legal__translation" role="note">
            {t('Esta tradução existe para facilitar a leitura. Em caso de dúvida ou conflito, vale a versão em português.')}
          </p>
        )}
        {d.body}
        <nav className="legal__nav" aria-label={t('Páginas do MMisc')}>
          <Link to="/">{t('Entrar')}</Link>
          {doc !== 'sobre' && <Link to="/sobre">{t('Sobre')}</Link>}
          {doc !== 'privacidade' && <Link to="/privacidade">{t('Privacidade')}</Link>}
          {doc !== 'termos' && <Link to="/termos">{t('Termos')}</Link>}
          {doc !== 'excluir-dados' && <Link to="/excluir-dados">{t('Excluir dados')}</Link>}
        </nav>
      </article>
    </div>
  )
}

/** Fase 0: liga/desliga as métricas de uso neste aparelho (fica no localStorage). */
function MetricsToggle() {
  const [on, setOn] = useState(metricsEnabled)
  const flip = () => {
    setMetricsEnabled(!on)
    setOn(!on)
  }
  return (
    <p>
      <button type="button" className="btn btn--plain tap" aria-pressed={!on} onClick={flip}>
        {on ? t('Desligar métricas de uso neste aparelho') : t('Métricas desligadas neste aparelho · religar')}
      </button>
    </p>
  )
}
