"""
MMISC · Fase 2e · transforma lugares do Overture Maps (GeoParquet) no CSV da tabela `place_catalog`.

Passo 1 (no PC, PowerShell), baixa só a região de São Paulo (~1–3 min, algumas dezenas de MB):
    pip install overturemaps
    overturemaps download --bbox=-46.90,-23.80,-46.30,-23.35 -f geoparquet --type=place -o dados\\lugares-sp.parquet

Passo 2 (este script; o Claude roda por você):
    pip install pyarrow
    python scripts/catalogo/overture_para_csv.py dados/lugares-sp.parquet dados/place_catalog.csv

Passo 3: no Supabase, Table Editor > place_catalog > Insert > Import data from CSV.

Fica só o que é bar, restaurante ou café (padaria e sorveteria contam como café), aberto,
com nome e confiança >= 0,4. A coluna `name_norm` é calculada pelo banco (não vai no CSV).
Licença dos dados: CDLA Permissive 2.0 (Overture) + ODbL (parte que vem do OpenStreetMap):
o app mostra "Overture Maps e © colaboradores do OpenStreetMap" na busca.
"""
import csv
import struct
import sys

import pyarrow.parquet as pq

CAFE = {
    'cafe', 'coffee_shop', 'coffee_roastery', 'bakery', 'patisserie_cake_shop', 'tea_room', 'bubble_tea',
    'juice_bar', 'smoothie_juice_bar', 'ice_cream_shop', 'frozen_yoghurt_shop', 'dessert_shop', 'acai_bowls',
    'cafeteria', 'donuts', 'creperie', 'gelato_shop', 'cupcake_shop', 'frozen_yogurt_shop', 'donut_shop',
    'bubble_tea_shop', 'bagel_shop', 'pie_shop', 'milk_bar', 'shaved_ice_shop', 'pancake_house',
}
# de comer/beber, mas não é lugar para registrar (loja, fábrica, genérico demais)
SKIP = {'candy_store', 'chocolatier', 'delicatessen', 'winery', 'distillery', 'food_and_drink', 'airport_lounge',
        'internet_cafe', 'food_truck_stand'}
RESTAURANT_WORDS = ('restaurant', 'steakhouse', 'pizza', 'burger', 'diner', 'bistro', 'buffet', 'brasserie',
                    'churrascaria', 'food_court', 'fast_food', 'sushi', 'snack', 'grill', 'salad', 'oyster',
                    'noodle', 'ramen', 'taco', 'barbecue', 'bbq', 'poke', 'hot_dog', 'sandwich', 'empanada', 'pastelaria')
BAR = {
    'bar', 'pub', 'cocktail_bar', 'wine_bar', 'beer_bar', 'sports_bar', 'lounge', 'night_club', 'brewery',
    'gastropub', 'hookah_bar', 'karaoke', 'dance_club', 'beer_garden', 'irish_pub', 'dive_bar', 'tiki_bar',
    'whiskey_bar', 'piano_bar', 'gay_bar', 'cigar_bar', 'speakeasy', 'brewpub', 'beer_hall', 'tavern',
    'botequim', 'boteco', 'jazz_and_blues', 'music_venue',
}


def kind_of(cat: str | None) -> str | None:
    if not cat:
        return None
    c = cat.lower()
    if c in SKIP:
        return None
    if c in CAFE or c.startswith('coffee') or c.endswith('_cafe'):
        return 'cafe'
    if any(w in c for w in RESTAURANT_WORDS):
        return 'restaurante'
    if c in BAR or c.endswith('_bar') or c.endswith('_pub'):
        return 'bar'
    return None


def point_from_wkb(b: bytes | None) -> tuple[float, float] | None:
    """Ponto WKB (little/big endian, com ou sem SRID) -> (lng, lat)."""
    if not b or len(b) < 21:
        return None
    le = b[0] == 1
    fmt = '<' if le else '>'
    gtype = struct.unpack(fmt + 'I', b[1:5])[0]
    off = 5
    if gtype & 0x20000000:  # EWKB com SRID
        off += 4
    if (gtype & 0xFF) != 1:
        return None
    x, y = struct.unpack(fmt + 'dd', b[off:off + 16])
    return x, y


def get(row: dict, *path):
    v = row
    for p in path:
        if v is None:
            return None
        if isinstance(p, int):
            v = v[p] if isinstance(v, list) and len(v) > p else None
        else:
            v = v.get(p) if isinstance(v, dict) else None
    return v


def main(src: str, dst: str) -> None:
    cols = [c for c in ('id', 'geometry', 'confidence', 'addresses', 'names', 'operating_status', 'taxonomy', 'categories', 'basic_category', 'bbox') if c in pq.ParquetFile(src).schema_arrow.names]
    rows = pq.read_table(src, columns=cols).to_pylist()
    kept, seen = 0, set()
    skipped = {'sem tipo': 0, 'fechado': 0, 'não é de comer/beber': 0, 'sem nome': 0, 'confiança baixa': 0, 'sem posição': 0}
    with open(dst, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['id', 'source', 'name', 'kind', 'raw_category', 'lat', 'lng', 'address', 'area', 'confidence'])
        for r in rows:
            # formato novo (2026): taxonomy.primary + hierarchy; antigo: categories.primary
            tax = r.get('taxonomy')
            if tax:
                if not tax.get('hierarchy') or tax['hierarchy'][0] != 'food_and_drink':
                    skipped['sem tipo'] += 1
                    continue
                cat = tax.get('primary')
            else:
                cat = get(r, 'categories', 'primary') or r.get('basic_category')
            kind = kind_of(cat)
            if not kind:
                skipped['não é de comer/beber' if tax else 'sem tipo'] += 1
                continue
            status = r.get('operating_status')
            if status and status != 'open':
                skipped['fechado'] += 1
                continue
            name = (get(r, 'names', 'primary') or '').strip()
            if not name or len(name) > 200:
                skipped['sem nome'] += 1
                continue
            conf = r.get('confidence')
            if conf is not None and conf < 0.4:
                skipped['confiança baixa'] += 1
                continue
            pt = point_from_wkb(r.get('geometry'))
            if not pt and r.get('bbox'):
                bb = r['bbox']
                pt = ((bb['xmin'] + bb['xmax']) / 2, (bb['ymin'] + bb['ymax']) / 2)
            if not pt:
                skipped['sem posição'] += 1
                continue
            pid = r['id']
            if pid in seen:
                continue
            seen.add(pid)
            address = get(r, 'addresses', 0, 'freeform')
            area = get(r, 'addresses', 0, 'locality')
            w.writerow([pid, 'overture', name, kind, cat, round(pt[1], 6), round(pt[0], 6),
                        address or '', area or '', '' if conf is None else round(conf, 3)])
            kept += 1
    print(f'{kept} lugares no CSV ({dst}). De fora: {skipped}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('uso: python overture_para_csv.py ENTRADA.parquet SAIDA.csv')
    main(sys.argv[1], sys.argv[2])
