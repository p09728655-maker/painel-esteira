#!/usr/bin/env python3
"""Icones do app /embalagem (RITMOPROD_HORA_A_HORA_EMBALAGEM).

Reusa o desenho de gen_icons.py trocando o acento para o verde do app
(--ok #4CAF50) e gravando em embalagem/icons/ — distingue o icone do app
"ritmoprod." (laranja) na tela do celular.
"""
import os, sys

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import gen_icons as g

g.ACCENT = (0x4C, 0xAF, 0x50)  # verde (ok) do RitmoProd Embalagem

if __name__ == "__main__":
    root = os.path.dirname(here)
    icons = os.path.join(root, "embalagem", "icons")
    os.makedirs(icons, exist_ok=True)
    for sz in (192, 512):
        data, s = g.render(sz, maskable=False)
        g.write_png(os.path.join(icons, f"icon-{sz}.png"), data, s)
    for sz in (192, 512):
        data, s = g.render(sz, maskable=True)
        g.write_png(os.path.join(icons, f"icon-maskable-{sz}.png"), data, s)
    data, s = g.render(180, maskable=True)
    g.write_png(os.path.join(icons, "apple-touch-icon.png"), data, s)
    data, s = g.render(32, maskable=False)
    g.write_png(os.path.join(icons, "favicon-32.png"), data, s)
