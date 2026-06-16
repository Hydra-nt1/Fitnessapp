const CACHE = 'fittracker-v20';
const FILES = ['./', './index.html', './css/style.css', './js/db.js', './js/app.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
