/* 上理日历 · Service Worker
   应用外壳缓存优先，live-events 更新文件网络优先。 */
'use strict';

var CACHE = 'usst-cal-v2';

var SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/calendar-data.js',
  './js/logic.js',
  './js/live-events.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 更新文件：网络优先，失败时退回缓存（保证离线可用且更新能生效）
  if (/\/js\/live-events\.(js|json)(\?|$)/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var clone = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, clone); });
          return res;
        })
        .catch(function () { return caches.match(req); })
    );
    return;
  }

  // 应用外壳：缓存优先
  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var clone = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, clone); });
        return res;
      });
    })
  );
});
