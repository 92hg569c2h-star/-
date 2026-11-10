// Service Worker：アプリ本体をキャッシュして、電波の弱い帰り道でも起動できるようにする
// ファイルを更新したら VERSION を上げてください。
const VERSION = 'nightscape-v1.4.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/store.js', './js/db.js', './js/ui.js', './js/icons.js', './js/colors.js',
  './js/image.js', './js/letters.js', './js/samples.js', './js/sky.js', './js/journey.js', './js/wallpaper.js', './js/titles.js',
  './js/views/tonight.js', './js/views/diary.js', './js/views/entry.js', './js/views/collection.js',
  './js/views/settings.js', './js/views/capture.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// ネットワーク優先（失敗したらキャッシュ）。更新がすぐ反映され、オフラインでも動く
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
