/* Service worker do RITMOPROD_HORA_A_HORA_EMBALAGEM (app /embalagem/).
 * Escopo restrito a /embalagem/ — não interfere no app da raiz.
 * - Navegacoes: network-first, cai para o cache quando offline.
 * - Estaticos same-origin do app: stale-while-revalidate.
 * - Cross-origin (Apps Script JSONP, CDNs xlsx/Chart.js, fontes): nao intercepta.
 * Suba o CACHE_VERSION a cada release para invalidar o cache antigo.
 */
const CACHE_VERSION = 'embalagem-v1';
const CACHE = CACHE_VERSION;

const APP_SHELL = [
  '/embalagem/',
  '/embalagem/index.html',
  '/embalagem/manifest.webmanifest',
  '/embalagem/vendor/chart.umd.min.js',
  '/embalagem/vendor/xlsx.full.min.js',
  '/embalagem/patrimar-logo.png',
  '/embalagem/icons/icon-192.png',
  '/embalagem/icons/icon-512.png',
  '/embalagem/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(APP_SHELL.map((u) => cache.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith('embalagem-')).map((k) => caches.delete(k))
      ))
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

  // Só requisições do próprio site E dentro do escopo do app. JSONP do Apps
  // Script, CDNs e fontes seguem direto para a rede sem interferência.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/embalagem')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/embalagem/'))
        )
    );
    return;
  }

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
