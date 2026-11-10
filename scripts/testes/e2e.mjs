// Teste de fumaça + teste de contraste num build de produção com Supabase falso
// (nada vai para o banco de verdade: os testes respondem tudo).
//   npm run test:e2e
// Na primeira vez no PC: npx playwright install chromium
// Faz sozinho: build em pasta temporária → vite preview na porta 4173 → e2e/fumaca.cjs → e2e/contraste.cjs.
import { spawn, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const OUT = path.join(os.tmpdir(), 'mmisc-dist-testes')
const win = process.platform === 'win32'
// o vite direto pelo Node (sem npx): assim parar o servidor no fim fecha mesmo o vite
const VITE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', 'node_modules', 'vite', 'bin', 'vite.js')
// variáveis do processo vencem o .env.local: o build de teste nunca usa a chave real
const env = { ...process.env, VITE_SUPABASE_URL: 'https://dgvrkmqenkwfeytgaouv.supabase.co', VITE_SUPABASE_ANON_KEY: 'fake' }

console.log('› build de teste…')
const b = spawnSync(process.execPath, [VITE, 'build', '--outDir', OUT, '--emptyOutDir', '--logLevel', 'warn'], { stdio: 'inherit', env })
if (b.status !== 0) process.exit(b.status ?? 1)

console.log(`› servindo em ${BASE}…`)
const server = spawn(process.execPath, [VITE, 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { env, stdio: 'ignore' })
const stop = () => {
  if (win && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}
// se a porta já estiver ocupada (outro servidor esquecido), o vite sai na hora: avisa em vez de testar o servidor errado
let serverDown = false
server.on('exit', () => (serverDown = true))

async function waitUp() {
  const ocupada = `o vite preview não subiu. A porta ${PORT} está ocupada por outro servidor?`
  for (let i = 0; i < 60; i++) {
    if (serverDown) throw new Error(ocupada)
    let ok = false
    try {
      ok = (await fetch(BASE)).ok
    } catch {
      /* ainda subindo */
    }
    if (ok) {
      // se a porta era de outro servidor, o nosso já terá saído neste meio tempo
      await new Promise((r) => setTimeout(r, 300))
      if (serverDown) throw new Error(ocupada)
      return true
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

let code = 0
try {
  if (!(await waitUp())) throw new Error(`o vite preview não respondeu em ${BASE}`)
  for (const test of ['e2e/fumaca.cjs', 'e2e/contraste.cjs']) {
    console.log(`\n› ${test}`)
    const r = spawnSync(process.execPath, [test, BASE], { stdio: 'inherit', env })
    if (r.status !== 0) code = 1
  }
} catch (e) {
  console.error(String(e))
  code = 1
} finally {
  stop()
}
process.exit(code)
