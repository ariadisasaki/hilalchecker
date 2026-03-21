const CACHE_NAME = "hilal-app-v1";

const urlsToCache = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/assets/icon-192.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=>{
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", e=>{
  e.respondWith(
    caches.match(e.request).then(res=>{
      return res || fetch(e.request);
    })
  );
});
