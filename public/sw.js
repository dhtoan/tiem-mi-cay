const CACHE='tiem-mi-cay-v3';
const CORE=['/','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(xs=>Promise.all(xs.filter(x=>x!==CACHE&&x.startsWith('tiem-mi-cay-')).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const y=x.clone();caches.open(CACHE).then(c=>c.put('/',y));return x}).catch(()=>caches.match('/')));return;}
  e.respondWith(caches.match(r).then(x=>x||fetch(r).then(y=>{if(y.ok){const z=y.clone();caches.open(CACHE).then(c=>c.put(r,z))}return y})));
});
