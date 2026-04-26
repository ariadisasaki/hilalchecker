const CACHE_NAME = "hilal-v1.3.5";

const BASE_PATH = "/";

const ASSETS = [
  BASE_PATH,
  BASE_PATH + "index.html",
  BASE_PATH + "manifest.json",
  BASE_PATH + "assets/icon-192.png",
  BASE_PATH + "assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // langsung aktif tanpa nunggu
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // hapus cache lama
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );

      // PENTING: ambil kontrol semua halaman
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // hanya handle request dalam scope kita
  if (url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
            return response;
          })
        );
      })
    );
  }
});
