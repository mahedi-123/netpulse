// Minimal service worker for NetPulse Mobile.
//
// Its only job is to make the app shell load instantly and survive the PC being
// off. It deliberately does NOT cache anything measurement-related:
//   - /api/*        must always be live (stale diagnostics are worse than none)
//   - NDT7 workers  must be fresh; a stale worker would silently skew results
//   - M-Lab traffic is the measurement itself and must never be intercepted
//
// Bump CACHE_NAME on release to evict the old shell.
const CACHE_NAME = "netpulse-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Individual failures shouldn't abort the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApi = url.pathname.startsWith("/api");
  const isWorker = url.pathname.includes("ndt7-");

  // Anything live or measurement-critical bypasses the cache entirely.
  if (!isSameOrigin || isApi || isWorker) return;

  // Network-first for the shell: fresh when online, cached when the PC is off.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
