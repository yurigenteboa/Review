"""
Gera todos os PNGs da marca MMISC a partir dos vetores em public/brand/.

Rodar na raiz do projeto:
    pip install cairosvg pillow
    python scripts/marca/gerar_marca.py

Fontes (editar estes, nunca os PNGs):
    public/brand/logo-arte.svg     logo completo, sem fundo (detalhes vazados: só sobre preto)
    public/brand/simbolo.svg       símbolo (cartas em leque + disco), com fundo; = public/favicon.svg
    public/brand/simbolo-liso.svg  símbolo sem o disco, para 16 px
    public/brand/letreiro.svg      só o letreiro "MMisc", em uma cor (currentColor)

Saída:
    public/icons/icon-192.png, icon-512.png        ícone do app (logo completo, cantos arredondados)
    public/icons/icon-512-maskable.png             Android (sangra até a borda; logo no círculo seguro de 80%)
    public/icons/apple-touch-icon.png              iPhone (180, sangra; o iOS arredonda)
    public/favicon.ico                             16 (liso), 32 e 48 (com disco)
    public/splash/splash-WxH-{light,dark}.png      telas de abertura do iPhone (as 10 do index.html)
    public/brand/og.png                            prévia de link (1200x630)
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
BRAND = PUB / "brand"

PRETO = "#050505"
CLARO = "#F2F2F7"  # --bg do tema claro
ESCURO = "#000000"  # --bg do tema escuro
CREME = "#F4E8D0"

SPLASHES = [(1320, 2868), (1206, 2622), (1290, 2796), (1179, 2556), (1284, 2778),
            (1170, 2532), (1125, 2436), (1242, 2688), (828, 1792), (750, 1334)]


def _parts(svg_path: Path) -> tuple[str, str]:
    """Devolve (viewBox, conteúdo interno) de um SVG simples."""
    txt = svg_path.read_text(encoding="utf-8")
    vb = re.search(r'viewBox="([^"]+)"', txt).group(1)
    inner = re.sub(r"^.*?<svg[^>]*>", "", txt, flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
    inner = re.sub(r"<!--.*?-->", "", inner, flags=re.S)
    return vb, inner


ART_VB, ART = _parts(BRAND / "logo-arte.svg")
ART_W, ART_H = map(float, ART_VB.split()[2:])
ART_RATIO = ART_W / ART_H


def art_at(x: float, y: float, w: float) -> str:
    """Logo completo encaixado com largura w a partir de (x, y)."""
    h = w / ART_RATIO
    return f'<svg x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" viewBox="{ART_VB}">{ART}</svg>'


def art_centered(cx: float, cy: float, w: float) -> str:
    return art_at(cx - w / 2, cy - (w / ART_RATIO) / 2, w)


def png(svg: str, w: int, h: int) -> Image.Image:
    data = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=w, output_height=h)
    return Image.open(io.BytesIO(data)).convert("RGBA")


def svg_doc(w: int, h: int, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{body}</svg>'


def app_icon(size: int, *, rounded: bool, art_frac: float) -> Image.Image:
    s = 1024
    rx = f' rx="{s * 0.225:.0f}"' if rounded else ""
    body = f'<rect width="{s}" height="{s}"{rx} fill="{PRETO}"/>' + art_centered(s / 2, s / 2 + 6, s * art_frac)
    return png(svg_doc(s, s, body), size, size)


def save(img: Image.Image, path: Path, *, flat: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if flat:  # sem transparência: PNG menor
        bg = Image.new("RGB", img.size, img.getpixel((0, 0))[:3])
        bg.paste(img, mask=img.split()[3])
        img = bg
    img.save(path, optimize=True)
    print("ok", path.relative_to(ROOT))


def main() -> None:
    # Ícones do app: logo completo (lê bem a partir de ~60 px)
    save(app_icon(512, rounded=True, art_frac=0.80), PUB / "icons/icon-512.png")
    save(app_icon(192, rounded=True, art_frac=0.80), PUB / "icons/icon-192.png")
    save(app_icon(180, rounded=False, art_frac=0.80), PUB / "icons/apple-touch-icon.png", flat=True)
    # maskable: o Android pode cortar em círculo; o logo cabe no círculo seguro (80% do lado)
    save(app_icon(512, rounded=False, art_frac=0.64), PUB / "icons/icon-512-maskable.png", flat=True)

    # favicon.ico: 16 px sem o disco (vira um ponto), 32 e 48 com o disco
    liso = png((BRAND / "simbolo-liso.svg").read_text(encoding="utf-8"), 16, 16)
    sim32 = png((BRAND / "simbolo.svg").read_text(encoding="utf-8"), 32, 32)
    sim48 = png((BRAND / "simbolo.svg").read_text(encoding="utf-8"), 48, 48)
    sim48.save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[liso, sim32])
    print("ok public/favicon.ico")

    # Telas de abertura: escuro = logo direto no preto; claro = logo no azulejo preto
    for w, h in SPLASHES:
        dark = svg_doc(w, h, f'<rect width="{w}" height="{h}" fill="{ESCURO}"/>' + art_centered(w / 2, h / 2, w * 0.58))
        save(png(dark, w, h), PUB / f"splash/splash-{w}x{h}-dark.png", flat=True)
        t = w * 0.46
        tile = (f'<rect x="{(w - t) / 2:.1f}" y="{(h - t) / 2:.1f}" width="{t:.1f}" height="{t:.1f}" rx="{t * 0.225:.1f}" fill="{PRETO}"/>'
                + art_centered(w / 2, h / 2 + t * 0.006, t * 0.80))
        light = svg_doc(w, h, f'<rect width="{w}" height="{h}" fill="{CLARO}"/>' + tile)
        save(png(light, w, h), PUB / f"splash/splash-{w}x{h}-light.png", flat=True)

    # Prévia de link (WhatsApp, Instagram, X…): 1200x630, logo no preto
    W, H = 1200, 630
    og = svg_doc(W, H, f'<rect width="{W}" height="{H}" fill="{PRETO}"/>' + art_centered(W / 2, H / 2, 720))
    save(png(og, W, H), BRAND / "og.png", flat=True)


if __name__ == "__main__":
    main()
