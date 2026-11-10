// Confere as traduções: `npm run i18n`
// - Junta todos os textos de t('...') e tp(n, '...', '...') em src/ (o texto em português é a chave).
// - Para cada src/locales/<idioma>.json, lista o que FALTA, o que SOBROU (chave que o código não usa
//   mais) e tradução que perdeu uma variável {assim}.
// - `--escrever-faltando` grava as chaves que faltam em scripts/i18n/faltando.json para traduzir.
// Sai com erro (1) se faltar alguma coisa: rode antes de cada entrega.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const SRC = path.join(root, 'src')
const LOCALES = path.join(SRC, 'locales')

const files = []
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(f)) files.push(p)
  }
}
walk(SRC)

const STR = String.raw`'((?:[^'\\]|\\.)*)'`
const reT = new RegExp(String.raw`\bt\(\s*` + STR, 'g')
const reTp = new RegExp(String.raw`\btp\(\s*[^,]+?,\s*` + STR + String.raw`\s*,\s*` + STR, 'g')
const unescape = (s) => s.replace(/\\(.)/g, '$1')

const keys = new Map() // chave -> primeiro arquivo
for (const f of files) {
  if (f.endsWith(path.join('lib', 'i18n.tsx'))) continue
  const text = fs.readFileSync(f, 'utf8')
  const rel = path.relative(root, f)
  for (const m of text.matchAll(reT)) if (!keys.has(unescape(m[1]))) keys.set(unescape(m[1]), rel)
  for (const m of text.matchAll(reTp)) {
    for (const k of [m[1], m[2]]) if (!keys.has(unescape(k))) keys.set(unescape(k), rel)
  }
}

const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
let problems = 0
const missingAll = {}
for (const f of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json')).sort()) {
  const lang = f.replace('.json', '')
  const dict = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'))
  const missing = [...keys.keys()].filter((k) => !(k in dict))
  const extra = Object.keys(dict).filter((k) => !keys.has(k))
  const badVars = Object.entries(dict).filter(([k, v]) => keys.has(k) && vars(k) !== vars(v))
  problems += missing.length + badVars.length
  console.log(`${lang}: ${keys.size - missing.length}/${keys.size} traduzidos` + (extra.length ? ` · ${extra.length} sobrando` : '') + (badVars.length ? ` · ${badVars.length} com variável errada` : ''))
  for (const k of missing.slice(0, 15)) console.log(`   falta: ${JSON.stringify(k)}  (${keys.get(k)})`)
  if (missing.length > 15) console.log(`   … e mais ${missing.length - 15}`)
  for (const [k, v] of badVars.slice(0, 10)) console.log(`   variável: ${JSON.stringify(k)} -> ${JSON.stringify(v)}`)
  if (missing.length) missingAll[lang] = missing
}
if (process.argv.includes('--escrever-faltando')) {
  fs.writeFileSync(path.join(root, 'scripts', 'i18n', 'faltando.json'), JSON.stringify(missingAll, null, 2))
}
if (process.argv.includes('--chaves')) {
  fs.writeFileSync(process.argv[process.argv.indexOf('--chaves') + 1], JSON.stringify([...keys.keys()], null, 1))
}
process.exit(problems ? 1 : 0)
