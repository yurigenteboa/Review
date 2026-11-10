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
// variáveis do processo vencem o .env.local: o build de teste nunca usa a chave real
const env = { ...process.env, VITE_SUPABASE_URL: 'https://dgvrkmqenkwfeytgaouv.supabase.co', VITE_SUPABASE_ANON_KEY: 'fake' }

console.log('› build de teste…')
const b = spawnSync('npx', ['vite', 'build', '--outDir', OUT, '--emptyOutDir', '--logLevel', 'warn'], { stdio: 'inherit', env, shell: win })
if (b.status !== 0) process.exit(b.status ?? 1)

console.log(`› servindo em ${BASE}…`)
const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { env, shell: win, stdio: 'ignore' })
const stop = () => {
  if (win && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return true
    } catch {
      /* ainda subindo */
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
