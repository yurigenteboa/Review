"""Gera src/lib/socialIcons.ts a partir dos SVGs em scripts/marca/redes/.

Rede nova: salve o SVG oficial em scripts/marca/redes/<id>.svg, rode
`python scripts/marca/icones_redes.py` e cadastre o id em src/lib/socialLinks.ts.
Cores muito escuras (preto) viram currentColor para aparecer no tema escuro.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PASTA = ROOT / 'scripts' / 'marca' / 'redes'
SAIDA = ROOT / 'src' / 'lib' / 'socialIcons.ts'
IDS = {  # arquivo -> id usado no código
    'youtube-music': 'youtubemusic', 'apple-music': 'applemusic',
}
ESCURO = re.compile(r'#(000000|000|161614|0A0A08|202830)\b', re.I)

def limpar(s: str, uid: str) -> tuple[str, str]:
    s = re.sub(r'<\?xml.*?\?>|<!--.*?-->', '', s, flags=re.S)
    raiz = re.search(r'<svg([^>]*)>', s).group(1)
    vb = re.search(r'viewBox="([^"]+)"', raiz).group(1)
    fill = re.search(r'\sfill="([^"]+)"', raiz)
    dentro = s[s.index('>', s.index('<svg')) + 1 : s.rindex('</svg>')]
    dentro = re.sub(r'<title>.*?</title>', '', dentro)
    dentro = dentro.replace('<path fill="none" d="M0 0h192v192H0z"/>', '')
    dentro = re.sub(r'\s+', ' ', dentro).strip().replace('> <', '><')
    dentro = re.sub(r'\s*xml:space="preserve"', '', dentro)
    # ids de gradiente únicos por ícone (vários ícones na mesma página)
    for gid in re.findall(r'id="([^"]+)"', dentro):
        dentro = dentro.replace(f'id="{gid}"', f'id="mm-{uid}-{gid}"').replace(f'url(#{gid})', f'url(#mm-{uid}-{gid})')
    if fill:
        dentro = f'<g fill="{fill.group(1)}">{dentro}</g>'
    dentro = ESCURO.sub('currentColor', dentro)
    dentro = re.sub(r'(\d+\.\d{2})\d+', r'\1', dentro)
    return vb, dentro

linhas = [
    '// Gerado por scripts/marca/icones_redes.py a partir dos SVGs oficiais em scripts/marca/redes/.',
    '// Só para mostrar PARA ONDE um link do perfil leva. Cores escuras viraram currentColor (aparecem no tema escuro).',
    '// Não editar à mão: rode o script de novo.',
    'export const SOCIAL_ICON_SVG: Record<string, { vb: string; svg: string }> = {',
]
for f in sorted(PASTA.glob('*.svg')):
    uid = IDS.get(f.stem, f.stem)
    vb, svg = limpar(f.read_text(encoding='utf-8'), uid)
    linhas.append(f'  {uid}: {{ vb: {json.dumps(vb)}, svg: {json.dumps(svg, ensure_ascii=False)} }},')
linhas.append('}')
SAIDA.write_text('\n'.join(linhas) + '\n', encoding='utf-8')
print(f'{len(linhas) - 5} ícones em {SAIDA.relative_to(ROOT)}')
