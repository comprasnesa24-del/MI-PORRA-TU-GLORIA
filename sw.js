const CACHE_NAME='mi-porra-tu-gloria-v1';
const FILES_TO_CACHE=['/','/index.html','/style.css','/assets/hero-porra-gloria.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES_TO_CACHE)))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
