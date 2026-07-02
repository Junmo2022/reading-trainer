// sw.js
const CACHE = 'reading-trainer-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/base.css', './css/child.css', './css/parent.css',
  './js/db.js', './js/store.js', './js/skills.js', './js/scheduler.js',
  './js/diagnoser.js', './js/rewards.js', './js/updater.js', './js/charts.js',
  './js/router.js', './js/child-ui.js', './js/parent-ui.js', './js/app.js',
  './data/question-bank/manifest.json', './data/question-bank/chinese-g34-v1.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
