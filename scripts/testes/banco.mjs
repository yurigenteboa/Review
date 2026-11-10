// Roda todas as baterias de RLS/regras do banco (supabase/tests/*.mjs, PGlite com todas as migrações).
//   npm run test:banco
// Falha (código 1) se alguma bateria falhar. Algumas baterias antigas só escrevem "✗ …" e
// "N falha(s)" sem mudar o código de saída, então o resultado é conferido pelo texto também.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve('supabase/tests')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'harness.mjs').sort()
let bad = 0
for (const f of files) {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const lines = out.trim().split('\n')
  const failedLines = lines.filter((l) => l.startsWith('✗'))
  const countedFail = /([1-9]\d*) falha/.test(out)
  const ok = r.status === 0 && failedLines.length === 0 && !countedFail
  console.log(`${ok ? '✓' : '✗'} ${f} · ${lines[lines.length - 1] ?? ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  if (!ok) {
    bad++
    console.log((failedLines.length ? failedLines : lines.slice(-15)).map((l) => '    ' + l).join('\n'))
  }
}
console.log(bad ? `\n${bad} bateria(s) com falha` : `\nBanco: ${files.length} baterias ok`)
process.exit(bad ? 1 : 0)
