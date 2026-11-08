// Aparência · teste de contraste: abre o app em cada estilo × tema × contraste × cor de destaque e mede
// os pares de texto/fundo pelos tokens que valem de verdade na página (WCAG: 4,5:1 para texto).
// Roda como o teste de fumaça (build de produção + `vite preview`, ver e2e/fumaca.cjs):
//   node e2e/contraste.cjs            (ou: node e2e/contraste.cjs http://localhost:4173)
// Falha (código 1) se algum par ficar abaixo da meta.

const { chromium } = require('playwright')
const BASE = process.argv[2] || 'http://localhost:4173'

const ESTILOS = ['vidro', 'acrilico', 'anos90', 'console', 'portatil']
const TEMAS = ['claro', 'medio', 'escuro', 'preto']
const CONTRASTES = ['normal', 'alto']
const DESTAQUES = ['marca', 'vermelho', 'roxo', 'verde', 'azul', 'laranja', 'rosa']
const CATEGORIAS = ['album', 'filme', 'serie', 'jogo', 'livro', 'bar', 'banheiro', 'cidade', 'drink', 'prato', 'restaurante', 'cafe']

// [nome, texto, fundo, mínimo]
const PARES = [
  ['texto no fundo', '--text', '--bg', 4.5],
  ['texto no cartão', '--text', '--surface', 4.5],
  ['texto secundário no cartão', '--text-2', '--surface', 4.5],
  ['texto terciário no cartão', '--text-3', '--surface', 4.5],
  ['texto terciário no fundo', '--text-3', '--bg', 4.5],
  ['texto do botão de destaque', '--on-accent', '--accent', 4.5],
  ['destaque como texto no cartão', '--accent-ink', '--surface', 4.5],
  ['destaque como texto no fundo', '--accent-ink', '--bg', 4.5],
  ...CATEGORIAS.map((c) => [`categoria ${c} no cartão`, `--cat-${c}-ink`, '--surface', 4.5]),
]

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(BASE + '/sobre')
  await page.waitForTimeout(500)
  const falhas = []
  let total = 0
  for (const estilo of ESTILOS)
  for (const tema of TEMAS)
    for (const contraste of CONTRASTES)
      for (const destaque of DESTAQUES) {
        await page.evaluate((a) => localStorage.setItem('mmisc.aparencia', JSON.stringify(a)), { estilo, tema, contraste, destaque })
        await page.reload()
        await page.waitForTimeout(150)
        const medidas = await page.evaluate((pares) => {
          const cs = getComputedStyle(document.documentElement)
          // converte qualquer cor CSS para rgb pelo navegador
          const probe = document.createElement('span')
          document.body.appendChild(probe)
          const rgb = (v) => {
            probe.style.color = ''
            probe.style.color = cs.getPropertyValue(v).trim()
            return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number)
          }
          const lum = (c) => {
            const [r, g, b] = c.map((x) => {
              x /= 255
              return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const out = pares.map(([nome, fg, bg, min]) => {
            const a = lum(rgb(fg))
            const b = lum(rgb(bg))
            return [nome, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), min]
          })
          probe.remove()
          return out
        }, PARES)
        for (const [nome, r, min] of medidas) {
          total++
          if (r < min) falhas.push(`${estilo} · ${tema} · contraste ${contraste} · ${destaque}: ${nome} = ${r.toFixed(2)}:1 (meta ${min})`)
        }
      }
  await browser.close()
  const unicas = [...new Set(falhas.map((f) => f.replace(/ · (marca|vermelho|roxo|verde|azul|laranja|rosa):/, ' · *:')))]
  if (falhas.length) {
    console.log(`FALHOU: ${falhas.length} de ${total} medidas abaixo da meta`)
    // pares que não dependem do destaque aparecem uma vez só
    for (const f of falhas.filter((f) => /destaque|botão/.test(f))) console.log('  ' + f)
    for (const f of unicas.filter((f) => !/destaque|botão/.test(f))) console.log('  ' + f)
    process.exit(1)
  }
  console.log(`Contraste ok (${total} medidas: ${ESTILOS.length} estilos × ${TEMAS.length} temas × ${CONTRASTES.length} contrastes × ${DESTAQUES.length} destaques)`)
})()
