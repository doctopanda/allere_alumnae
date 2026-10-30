/* ALLERE ALUMNAE · PWA shell cache.
 Los datos de salud agregados, archivos data/*, tiles y geometrías NO se cachean. */
const VERSION='allere-mobile-shell-v1';
const BASE=new URL('./',self.registration.scope);
const PRECACHE=['movil.html','movil.css','movil.js','manifest.webmanifest','assets/boobok/BOOBOK_avatar_128.png','assets/boobok/BOOBOK_ficha_vertical.webp'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('allere-mobile-shell-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.includes('/data/')||url.pathname.includes('/assets/geo')||url.pathname.endsWith('.geojson')||url.pathname.includes('/tiles/'))return;
 if(!PRECACHE.includes(url.href))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match(req)));return}
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});
