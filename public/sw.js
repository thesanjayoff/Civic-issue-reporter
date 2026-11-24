// Hand-written, intentionally small service worker (no Workbox bundle) —
// this app targets low-end phones on weak connections, so a few KB of SW
// code beats a heavier generated one. It only makes the app *shell* and
// static assets available offline; the offline report queue itself lives in
// IndexedDB and is driven by client JS (src/lib/offline), not by Background
// Sync, because Background Sync isn't supported on all browsers (notably
// Safari/iOS) and this needs to work everywhere.

const CACHE_VERSION = "ok-v1";
const APP_SHELL = ["/", "/en", "/ta", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/seed-media/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache/intercept writes — those go through the IndexedDB queue instead

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always network; offline handling is app-level for API calls

  if (isStaticAsset(url)) {
    // Cache-first: static assets are content-hashed by Next.js, safe to serve stale-forever.
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Navigation/page requests: network-first, falling back to the cached
  // shell so the capture flow still opens with no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_VERSION);
          return (await cache.match(request)) || (await cache.match("/en")) || Response.error();
        })
    );
  }
});
