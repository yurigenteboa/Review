// Fase 0 · teste de fumaça: percorre os fluxos principais e falha se alguma tela quebrar.
// Roda contra um build de produção servido localmente, com o Supabase falso (respostas vazias):
//
//   VITE_SUPABASE_URL=https://dgvrkmqenkwfeytgaouv.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite build --outDir /tmp/dist-fumaca
//   npx vite preview --outDir /tmp/dist-fumaca --port 4173 &
//   node e2e/fumaca.cjs            (ou: node e2e/fumaca.cjs http://localhost:4173)
//
// Precisa do Playwright com Chromium (já vem no ambiente do Claude; no PC: npm i -D playwright && npx playwright install chromium).
// Não grava nada: toda chamada ao Supabase é respondida aqui mesmo.

const { chromium, devices } = require('playwright')

const BASE = process.argv[2] || 'http://localhost:4173'
const USER_ID = '11111111-1111-1111-1111-111111111111'
const results = []
const ok = (name) => results.push(['ok', name])
const fail = (name, why) => results.push(['FALHOU', `${name}: ${why}`])

function fakeSession() {
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({ sub: USER_ID, role: 'authenticated', exp: now + 3600 })).toString('base64url')
  return {
    access_token: `x.${payload}.y`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'r',
    user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'teste@mmisc.com.br', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' },
  }
}

/** Supabase falso: listas vazias, RPC vazia, objeto único "não encontrado", gravações aceitas. */
async function mockSupabase(page, sent) {
  await page.route('**/*.supabase.co/**', (route) => {
    const req = route.request()
    const url = req.url()
    const json = (status, body) => route.fulfill({ status, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
    if (url.includes('/auth/v1/user')) return json(200, fakeSession().user)
    if (url.includes('/auth/v1/')) return json(200, {})
    if (url.includes('/functions/v1/')) return json(200, { results: [] })
    if (url.includes('/storage/v1/')) return json(200, [])
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      if (/app_events|client_errors/.test(url)) sent.push(url.split('/rest/v1/')[1].split('?')[0])
      return json(url.includes('/rpc/') ? 200 : 201, url.includes('/rpc/') ? [] : null)
    }
    if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) return json(406, { code: 'PGRST116', message: 'not found' })
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' } })
    return json(200, [])
  })
}

async function newPage(browser, { logged, device, standalone }) {
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  const sent = []
  page.on('pageerror', (e) => errors.push(e.message))
  await mockSupabase(page, sent)
  await page.addInitScript(
    ([session, standalone]) => {
      if (session) localStorage.setItem('sb-dgvrkmqenkwfeytgaouv-auth-token', JSON.stringify(session))
      localStorage.setItem('mmisc.gettingStartedHidden', '1')
      if (standalone) Object.defineProperty(navigator, 'standalone', { get: () => true })
    },
    [logged ? fakeSession() : null, Boolean(standalone)],
  )
  return { ctx, page, errors, sent }
}

/** A tela abriu sem o aviso de "Algo deu errado" e sem erro de JavaScript. */
async function healthy(name, page, errors) {
  await page.waitForTimeout(700)
  // .crash = aviso do ErrorBoundary (tela quebrou de verdade)
  const crashed = await page.locator('.crash').count()
  if (crashed) return fail(name, 'a tela quebrou (aviso "Algo deu errado")')
  if (errors.length) return fail(name, `erro de JavaScript: ${errors.splice(0).join(' | ')}`)
  ok(name)
}

;(async () => {
  const browser = await chromium.launch()

  // 1. Sem login: tela de login e páginas públicas
  {
    const { ctx, page, errors } = await newPage(browser, { logged: false, device: 'iPhone 13' })
    await page.goto(BASE + '/')
    await page.waitForTimeout(800)
    if (await page.locator('input[type=email]').count()) ok('login: campo de e-mail aparece')
    else fail('login', 'campo de e-mail não apareceu')
    for (const path of ['/privacidade', '/termos', '/sobre', '/excluir-dados']) {
      await page.goto(BASE + path)
      await healthy(`página pública ${path}`, page, errors)
    }
    await page.goto(BASE + '/privacidade')
    const toggle = page.getByRole('button', { name: /métricas/i })
    await toggle.waitFor({ timeout: 3000 }).catch(() => {})
    if ((await toggle.count()) === 1) ok('privacidade: botão de métricas')
    else fail('privacidade', 'botão de métricas não encontrado')
    await ctx.close()
  }

  // 2. Logado no celular: abas, registro, item, gesto de voltar
  {
    const { ctx, page, errors, sent } = await newPage(browser, { logged: true, device: 'iPhone 13', standalone: true })
    await page.goto(BASE + '/')
    await healthy('início', page, errors)
    for (const [label, path] of [['Buscar', '/buscar'], ['Amigos', '/amigos'], ['Perfil', '/perfil'], ['Início', '/']]) {
      await page.getByRole('link', { name: label }).first().click()
      await page.waitForURL((u) => u.pathname === path)
      await healthy(`aba ${label}`, page, errors)
    }

    // Fase 2c: mapa abre pela busca sem quebrar (o fundo do mapa não carrega aqui, só os controles)
    await page.getByRole('link', { name: 'Buscar' }).first().click()
    await page.getByRole('link', { name: 'Mapa', exact: true }).click()
    await page.waitForURL((u) => u.pathname === '/mapa')
    await page.waitForTimeout(1500)
    await healthy('mapa', page, errors)
    await page.getByRole('link', { name: 'Início' }).first().click()
    await page.waitForTimeout(500)

    // registro: abre e cancela
    await page.getByRole('button', { name: /registrar|nova review/i }).first().click()
    await page.waitForTimeout(600)
    if (await page.getByRole('dialog').count()) ok('registro: janela abre')
    else fail('registro', 'janela não abriu')
    // Fase 1: num bar aparece "O que você pediu?" e o pedido entra na lista
    await page.getByRole('dialog').getByRole('button', { name: 'Bar', exact: true }).click()
    await page.getByRole('dialog').getByPlaceholder(/Ex\./).first().fill('Bar de teste')
    await page.waitForTimeout(300)
    const orderName = page.locator('.orders__field input')
    if (await orderName.count()) {
      await orderName.fill('Negroni')
      await orderName.press('Enter')
      const row = await page.locator('.orders__row').count()
      if (row === 1 && (await page.locator('.orders__row').first().innerText()).includes('Drink')) ok('fase 1: bar mostra "O que você pediu?" e o pedido entra como drink')
      else fail('fase 1', 'pedido não entrou como drink')
    } else fail('fase 1', '"O que você pediu?" não apareceu para bar')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await healthy('registro: fecha sem erro', page, errors)

    // tela de item (inexistente) e voltar arrastando da borda
    await page.goto(BASE + '/buscar')
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      history.pushState({ idx: (history.state?.idx ?? 0) + 1, usr: null, key: 'teste' }, '', '/item/00000000-0000-0000-0000-000000000000')
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
    })
    await page.waitForTimeout(800)
    await healthy('item inexistente', page, errors)
    if (await page.getByText('Esse item não existe mais').count()) ok('item inexistente: mensagem clara')
    else fail('item inexistente', 'sem a mensagem "Esse item não existe mais"')
    const cdp = await ctx.newCDPSession(page)
    const touch = (type, x, y) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    await touch('touchStart', 6, 400)
    for (let x = 20; x <= 220; x += 20) await touch('touchMove', x, 404)
    await touch('touchEnd', 220, 404)
    await page.waitForTimeout(900)
    const back = new URL(page.url()).pathname
    if (back === '/buscar') ok('arrastar da borda volta (app instalado no iPhone)')
    else fail('arrastar da borda', `ficou em ${back}`)

    // eventos de uso saem ao esconder o app
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(800)
    if (sent.includes('app_events')) ok('métricas: lote enviado ao sair')
    else fail('métricas', 'nenhum envio para app_events')
    await ctx.close()
  }

  // 3. Desktop: barra lateral e atalho N
  {
    const { ctx, page, errors } = await newPage(browser, { logged: true })
    await page.goto(BASE + '/')
    await healthy('desktop: início', page, errors)
    if (await page.locator('.sidebar, nav[aria-label]').count()) ok('desktop: navegação lateral')
    else fail('desktop', 'barra lateral não encontrada')
    await page.keyboard.press('n')
    await page.waitForTimeout(600)
    if (await page.getByRole('dialog').count()) ok('desktop: atalho N abre o registro')
    else fail('desktop', 'atalho N não abriu o registro')
    await ctx.close()
  }

  // 4. Aparência: abre sem login, troca o tema na hora e aguenta texto a 160% sem rolar para o lado
  {
    const { ctx, page, errors } = await newPage(browser, { logged: false, device: 'iPhone 13' })
    await page.goto(BASE + '/aparencia')
    await healthy('aparência (sem login)', page, errors)
    await page.getByRole('radio', { name: /^Médio/ }).click()
    await page.waitForTimeout(200)
    if ((await page.evaluate(() => document.documentElement.dataset.tema)) === 'medio') ok('aparência: tema muda na hora')
    else fail('aparência', 'o tema não mudou')
    await page.evaluate(() => localStorage.setItem('mmisc.aparencia', JSON.stringify({ texto: 5 })))
    for (const path of ['/', '/aparencia', '/sobre']) {
      await page.goto(BASE + path)
      await page.waitForTimeout(500)
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (wide <= 1) ok(`texto a 160% sem rolagem lateral: ${path}`)
      else fail(`texto a 160% em ${path}`, `${wide}px a mais na largura`)
    }
    await ctx.close()
  }

  await browser.close()
  for (const [s, n] of results) console.log(`${s === 'ok' ? '✓' : '✗'} ${n}`)
  const failed = results.filter(([s]) => s !== 'ok').length
  console.log(failed ? `\n${failed} falha(s)` : `\nTudo certo (${results.length} checagens)`)
  process.exit(failed ? 1 : 0)
})()
