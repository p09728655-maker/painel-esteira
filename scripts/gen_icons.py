#!/usr/bin/env python3
"""Gera os icones PWA do painel (ritmoprod.) sem dependencias externas.

Desenha barras laranja de alturas crescentes (ritmo de producao) sobre um
fundo escuro arredondado. Usa supersampling 4x para bordas suaves.
"""
import struct, zlib, os

ACCENT = (0xFF, 0x5C, 0x1F)   # laranja
BG_TOP = (0x22, 0x22, 0x26)   # surface2
BG_BOT = (0x0A, 0x0A, 0x0B)   # bg
WHITE  = (0xFA, 0xFA, 0xFA)

SS = 4  # supersampling


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rounded_rect_alpha(x, y, w, h, r, px, py):
    """Retorna 1.0 se (px,py) esta dentro do retangulo arredondado."""
    if px < x or px > x + w or py < y or py > y + h:
        return False
    # cantos
    cx = None
    cy = None
    if px < x + r and py < y + r:
        cx, cy = x + r, y + r
    elif px > x + w - r and py < y + r:
        cx, cy = x + w - r, y + r
    elif px < x + r and py > y + h - r:
        cx, cy = x + r, y + h - r
    elif px > x + w - r and py > y + h - r:
        cx, cy = x + w - r, y + h - r
    if cx is not None:
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return True


def render(size, maskable=False):
    S = size * SS
    # margem: maskable ocupa quase toda a area (zona segura); "any" tem borda
    margin = 0 if maskable else int(S * 0.08)
    radius = int(S * (0.20 if maskable else 0.22))

    px = bytearray(4 * S * S)

    def setpx(i, j, rgb, a=255):
        o = (j * S + i) * 4
        px[o] = rgb[0]; px[o+1] = rgb[1]; px[o+2] = rgb[2]; px[o+3] = a

    # fundo arredondado com gradiente vertical
    rx, ry = margin, margin
    rw, rh = S - 2*margin, S - 2*margin
    for j in range(S):
        t = j / (S - 1)
        col = lerp(BG_TOP, BG_BOT, t)
        for i in range(S):
            if rounded_rect_alpha(rx, ry, rw, rh, radius, i + 0.5, j + 0.5):
                setpx(i, j, col, 255)

    # barras estilo equalizer / ritmo
    n = 4
    heights = [0.34, 0.55, 0.78, 1.0]
    area_x = rx + rw * 0.20
    area_w = rw * 0.60
    area_bottom = ry + rh * 0.78
    area_top_max = ry + rh * 0.24
    max_h = area_bottom - area_top_max
    gap = area_w * 0.10
    bw = (area_w - gap * (n - 1)) / n
    br = bw * 0.32
    for k in range(n):
        bx = area_x + k * (bw + gap)
        bh = max_h * heights[k]
        by = area_bottom - bh
        for j in range(int(by), int(area_bottom) + 1):
            for i in range(int(bx), int(bx + bw) + 1):
                if rounded_rect_alpha(bx, by, bw, bh, br, i + 0.5, j + 0.5):
                    setpx(i, j, ACCENT, 255)

    # ponto final (a "." do ritmoprod.) no canto inferior direito da area
    dot_r = bw * 0.40
    dot_cx = area_x + area_w + gap * 1.2
    dot_cy = area_bottom
    if dot_cx + dot_r < rx + rw:
        for j in range(int(dot_cy - dot_r), int(dot_cy + dot_r) + 1):
            for i in range(int(dot_cx - dot_r), int(dot_cx + dot_r) + 1):
                if (i + 0.5 - dot_cx) ** 2 + (j + 0.5 - dot_cy) ** 2 <= dot_r * dot_r:
                    setpx(i, j, WHITE, 255)

    # downscale SSxSS -> media (box filter)
    out = bytearray(4 * size * size)
    for oy in range(size):
        for ox in range(size):
            r = g = b = a = 0
            for dy in range(SS):
                for dx in range(SS):
                    o = ((oy*SS+dy) * S + (ox*SS+dx)) * 4
                    r += px[o]; g += px[o+1]; b += px[o+2]; a += px[o+3]
            cnt = SS * SS
            oo = (oy * size + ox) * 4
            out[oo]   = r // cnt
            out[oo+1] = g // cnt
            out[oo+2] = b // cnt
            out[oo+3] = a // cnt
    return out, size


def write_png(path, rgba, size):
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filtro None
        raw += rgba[y*size*4:(y+1)*size*4]
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))
    print("gerado", path, size)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    icons = os.path.join(root, "icons")
    os.makedirs(icons, exist_ok=True)
    for sz in (192, 512):
        data, s = render(sz, maskable=False)
        write_png(os.path.join(icons, f"icon-{sz}.png"), data, s)
    for sz in (192, 512):
        data, s = render(sz, maskable=True)
        write_png(os.path.join(icons, f"icon-maskable-{sz}.png"), data, s)
    data, s = render(180, maskable=True)
    write_png(os.path.join(icons, "apple-touch-icon.png"), data, s)
    data, s = render(32, maskable=False)
    write_png(os.path.join(icons, "favicon-32.png"), data, s)
