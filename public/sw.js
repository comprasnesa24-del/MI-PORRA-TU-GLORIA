const CACHE_NAME='mi-porra-tu-gloria-v21';
const FILES_TO_CACHE=['/','/index.html','/style.css','/src/main.js','/assets/hero-porra-gloria.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES_TO_CACHE)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

self.addEventListener('push',e=>{
  const fallback={title:'Nuevo mensaje en el chat',body:'Han escrito en una de tus porras.'};
  let data=fallback;
  try{data=e.data?e.data.json():fallback}catch(err){data=fallback}
  e.waitUntil(self.registration.showNotification(data.title||fallback.title,{
    body:data.body||fallback.body,
    icon:'/assets/icon-192.png',
    badge:'/assets/icon-192.png',
    tag:data.tag||'mi-porra-chat'
  }));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client)return client.focus()}
    if(clients.openWindow)return clients.openWindow('/');
  }));
});
