import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'

/**
 * Páginas públicas (abrem sem login): exigidas pelo Google para publicar o login
 * e úteis para a LGPD. Mudou algo no tratamento de dados? Atualize aqui e a data.
 */

/** E-mail de contato para privacidade e pedidos de exclusão. */
export const CONTACT_EMAIL = 'contato@mmisc.com.br'
const UPDATED = '6 de novembro de 2026'

export type LegalDoc = 'sobre' | 'privacidade' | 'termos' | 'excluir-dados'
export const LEGAL_PATHS: Record<LegalDoc, string> = {
  sobre: '/sobre',
  privacidade: '/privacidade',
  termos: '/termos',
  'excluir-dados': '/excluir-dados',
}

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

const DOCS: Record<LegalDoc, { title: string; subtitle?: string; body: ReactNode }> = {
  sobre: {
    title: 'MMISC',
    subtitle: 'Nota para tudo',
    body: (
      <>
        <p>
          O MMISC é um app para dar nota e escrever reviews de tudo o que você vive: álbuns, filmes, séries, jogos, livros,
          bares, banheiros públicos e cidades. Você mantém um diário do que viu, ouviu e visitou, guarda o que quer ver
          depois e acompanha o que seus amigos estão achando.
        </p>
        <h2>O que dá para fazer</h2>
        <ul>
          <li>Registrar uma nota de 0,5 a 5, com texto, fotos e data.</li>
          <li>Buscar itens em catálogos públicos (filmes, séries, jogos, livros, músicas, lugares e cidades).</li>
          <li>Montar uma lista de “quero ver” e marcar os streamings que você assina.</li>
          <li>Convidar amigos, ver o feed deles, curtir e comentar.</li>
        </ul>
        <h2>Como entrar</h2>
        <p>
          Sem senha: com um código enviado para o seu e-mail ou com a sua conta do Google. Usando o mesmo e-mail nos dois,
          você entra sempre na mesma conta.
        </p>
        <p>
          <Link to="/">Entrar no MMISC</Link>
        </p>
      </>
    ),
  },

  privacidade: {
    title: 'Privacidade',
    subtitle: `Atualizada em ${UPDATED}`,
    body: (
      <>
        <p>
          Esta política explica quais dados o MMISC (www.mmisc.com.br) coleta, para que usa e como você pode pedir acesso,
          correção ou exclusão, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Dúvidas: <Mail />.
        </p>

        <h2>Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Conta:</strong> seu e-mail. Se você entrar com o Google, recebemos também nome, e-mail e foto de perfil
            da sua conta Google (escopos <code>openid</code>, <code>email</code> e <code>profile</code>). Não acessamos
            Gmail, contatos, agenda nem qualquer outro dado do Google.
          </li>
          <li>
            <strong>Perfil:</strong> nome de exibição, @ de usuário e foto, que você pode mudar quando quiser.
          </li>
          <li>
            <strong>O que você publica:</strong> notas, textos, fotos, datas, onde e com quem viu, curtidas, comentários,
            lista de “quero ver” e streamings que você assina.
          </li>
          <li>
            <strong>Notas privadas:</strong> ficam visíveis só para você.
          </li>
          <li>
            <strong>Amizades e convites:</strong> com quem você é amigo e os convites que criou ou aceitou.
          </li>
        </ul>

        <h2>Para que usamos</h2>
        <ul>
          <li>Fazer você entrar na sua conta e mantê-la segura.</li>
          <li>Mostrar seu diário, suas reviews e o que seus amigos publicam.</li>
          <li>Enviar o código de acesso por e-mail e avisos do próprio app.</li>
        </ul>
        <p>Não vendemos seus dados, não mostramos anúncios e não usamos seus dados para publicidade.</p>

        <h2>Quem vê o quê</h2>
        <p>
          Cada review tem uma visibilidade: só você, seus amigos ou público. Nome, @ e foto do perfil ficam visíveis para
          quem tem conta no MMISC.
        </p>

        <h2>Serviços que usamos</h2>
        <ul>
          <li>Supabase (banco de dados, login e arquivos), em servidores em São Paulo.</li>
          <li>Vercel (hospedagem do site).</li>
          <li>Resend (envio dos e-mails de acesso).</li>
          <li>Google (login com Google, se você escolher).</li>
          <li>
            Catálogos públicos como TMDB, MusicBrainz, IGDB, Open Library, OpenStreetMap e IBGE: recebem só o termo buscado,
            nunca seus dados pessoais. Dados de onde assistir: JustWatch.
          </li>
        </ul>

        <h2>Dados do Google</h2>
        <p>
          O uso que o MMISC faz das informações recebidas das APIs do Google segue a Política de Dados do Usuário dos
          Serviços de API do Google, incluindo os requisitos de uso limitado. Usamos nome, e-mail e foto só para criar e
          identificar sua conta.
        </p>

        <h2>Por quanto tempo guardamos</h2>
        <p>Enquanto sua conta existir. Quando você pede a exclusão, apagamos a conta e tudo o que está ligado a ela.</p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção, cópia ou exclusão dos seus dados e revogar o login com o Google a qualquer
          momento. Veja <Link to="/excluir-dados">como excluir seus dados</Link> ou escreva para <Mail />.
        </p>
      </>
    ),
  },

  termos: {
    title: 'Termos de uso',
    subtitle: `Atualizados em ${UPDATED}`,
    body: (
      <>
        <p>Ao usar o MMISC você concorda com estes termos. Se não concordar, não use o app.</p>
        <h2>Sua conta</h2>
        <p>
          A conta é pessoal. Você é responsável pelo que publica e por manter o acesso ao seu e-mail ou à sua conta Google.
        </p>
        <h2>O que você publica</h2>
        <p>
          O conteúdo continua sendo seu. Você nos autoriza a guardá-lo e exibi-lo conforme a visibilidade que escolher. Não
          publique nada ilegal, ofensivo, que viole direitos de outras pessoas ou dados pessoais de terceiros.
        </p>
        <h2>Moderação</h2>
        <p>Podemos remover conteúdo ou suspender contas que desrespeitem estes termos.</p>
        <h2>O serviço</h2>
        <p>
          O MMISC é um projeto pessoal, oferecido como está, de graça. Ele pode mudar, ficar fora do ar ou ser encerrado;
          nesse caso, avisaremos com antecedência para você poder pedir uma cópia dos seus dados.
        </p>
        <h2>Contato</h2>
        <p>
          <Mail />
        </p>
      </>
    ),
  },

  'excluir-dados': {
    title: 'Excluir seus dados',
    body: (
      <>
        <h2>Excluir a conta do MMISC</h2>
        <p>
          Envie um e-mail para <Mail /> a partir do e-mail da sua conta, com o assunto “Excluir minha conta”. Em até 15
          dias apagamos a conta e tudo o que está ligado a ela: perfil, reviews, fotos, notas privadas, listas, curtidas,
          comentários, amizades e convites. Respondemos confirmando a exclusão.
        </p>
        <p>Em breve será possível fazer isso direto em Perfil, sem precisar escrever.</p>

        <h2>Desconectar o Google</h2>
        <p>
          Para tirar o acesso do MMISC à sua conta Google, abra{' '}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
            myaccount.google.com/connections
          </a>
          , escolha MMISC e remova o acesso. Isso não apaga sua conta do MMISC: para isso, siga o passo acima.
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
        {d.body}
        <nav className="legal__nav" aria-label="Páginas do MMISC">
          <Link to="/">Entrar</Link>
          {doc !== 'sobre' && <Link to="/sobre">Sobre</Link>}
          {doc !== 'privacidade' && <Link to="/privacidade">Privacidade</Link>}
          {doc !== 'termos' && <Link to="/termos">Termos</Link>}
          {doc !== 'excluir-dados' && <Link to="/excluir-dados">Excluir dados</Link>}
        </nav>
      </article>
    </div>
  )
}
