// sw.js - Service Worker for 阅读训练营 PWA
const CACHE = 'reading-trainer-v3';

const ESSENTIAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/child.css',
  './css/parent.css',
  './js/db.js',
  './js/store.js',
  './js/skills.js',
  './js/scheduler.js',
  './js/diagnoser.js',
  './js/rewards.js',
  './js/updater.js',
  './js/charts.js',
  './js/router.js',
  './js/child-ui.js',
  './js/parent-ui.js',
  './js/app.js',
];

const LAZY_ASSETS = [
  './data/question-bank/manifest.json',
  './data/question-bank/chinese-g34-v2.json',
];

// 容错安装：逐个缓存核心资源，单个失败不中断
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      await Promise.allSettled(
        ESSENTIAL_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'no-cache' }))
            .catch(err => console.warn('[SW] 缓存失败:', url, err.message))
        )
      );
      // 题库较大，单独缓存，失败也不影响核心功能
      await Promise.allSettled(
        LAZY_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'no-cache' }))
            .catch(err => console.warn('[SW] 题库缓存失败:', url, err.message))
        )
      );
      return self.skipWaiting();
    })
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// fetch handler
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // 导航请求：网络优先，失败回退到缓存的 index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() =>
          caches.match('./index.html')
            .then(r => r || caches.match('./'))
        )
    );
    return;
  }

  // 其他 GET 请求：缓存优先，回退到网络
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => {
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
