#!/usr/bin/env python3
"""Injeta as tags PWA (manifest, icones, theme-color) e o registro do
service worker nas paginas HTML. Idempotente via marcador pwa:ritmoprod."""
import os, sys

MARKER = "pwa:ritmoprod"

HEAD_BLOCK = """
<!-- pwa:ritmoprod -->
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0A0A0B">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ritmoprod.">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<!-- /pwa:ritmoprod -->
"""

SW_BLOCK = """
<!-- pwa:ritmoprod-sw -->
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
</script>
<!-- /pwa:ritmoprod-sw -->
"""

FILES = [
    "index.html", "app.html", "esteira_operador.html", "esteira_tv.html",
    "simulacoes.html", "programacao.html", "pesos.html", "formulas.html",
    "curva_abc.html",
]


def inject(path):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    if MARKER in html:
        print("ja tem", path)
        return
    # apos o PRIMEIRO <head> (o real; extras ficam em JS embutido depois)
    i = html.find("<head>")
    if i == -1:
        i = html.find("<head")
        i = html.find(">", i) + 1 if i != -1 else -1
    else:
        i += len("<head>")
    if i == -1:
        print("SEM <head>", path); return
    html = html[:i] + HEAD_BLOCK + html[i:]
    # antes da ULTIMA </body> (o fechamento estrutural real)
    j = html.rfind("</body>")
    if j == -1:
        print("SEM </body>", path); return
    html = html[:j] + SW_BLOCK + html[j:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("injetado", path)


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name in FILES:
        p = os.path.join(root, name)
        if os.path.exists(p):
            inject(p)
        else:
            print("faltando", name)
