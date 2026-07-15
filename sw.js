/* Service worker do ritmoprod. (Painel Esteira)
 * - Navegacoes (HTML): network-first, cai para o cache quando offline.
 * - Estaticos same-origin (icones, manifest): stale-while-revalidate.
 * - Cross-origin (Google Apps Script, CDNs, fontes): nao intercepta -> rede normal.
 * Suba o CACHE_VERSION a cada release para invalidar o cache antigo.
 */
const CACHE_VERSION = 'ritmoprod-v1';
const CACHE = CACHE_VERSION;

// Paginas/rotas do app (ver vercel.json)
const APP_SHELL = [
  '/',
  '/app',
  '/operador',
  '/tv',
  '/simulacoes',
  '/programacao',
  '/pesos',
  '/formulas',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll falha inteiro se um item faltar; usamos best-effort por item.
      Promise.allSettled(APP_SHELL.map((u) => cache.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // So mexemos em requisicoes do proprio site. Dados do Apps Script,
  // CDNs e fontes seguem direto para a rede sem interferencia.
  if (url.origin !== self.location.origin) return;

  // Navegacao (troca de pagina / abertura do app): network-first.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/') )
        )
    );
    return;
  }

  // Estaticos same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
