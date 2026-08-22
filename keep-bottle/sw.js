// キープボトル管理 - Service Worker
// オフラインでも起動できるように、アプリの土台ファイルを保存(キャッシュ)します。
// データそのもの(お客様・ボトル情報)はキャッシュしません。データはSupabaseに保存されます。

const CACHE_VERSION = 'keep-bottle-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ページ本体(HTML)は「まずネットワーク、失敗したらキャッシュ」で常に最新を優先。
// それ以外(CSS/画像/フォント等)は「まずキャッシュ、なければネットワーク」で高速化。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isNavigation = req.mode === 'navigate' || (req.destination === 'document');

  if (isNavigation) {
    // cache:'no-store' … ブラウザやCDNのHTTPキャッシュを一切信用せず、
    // 常にネットワークから最新のHTMLを取りに行く（実機で修正が反映されにくい問題への対策）。
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
