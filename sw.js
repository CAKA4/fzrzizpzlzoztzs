/* Forest Inventory plot card — offline service worker.
   © 2026 Silv-Econ Ltd. All rights reserved. Proprietary — no license granted.
   Caches the app shell + map libraries so the form (and map shell) open with no signal
   after the first online visit. Bump CACHE when you change index.html so devices update. */
const CACHE = "fi-plotcard-v185";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
// Map libraries (cross-origin). Cached so the Map view works offline after one online load.
// (Satellite imagery tiles are NOT cached here — those still need a connection.)
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://unpkg.com/shpjs@4.0.4/dist/shp.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).then(() => Promise.all(LIBS.map(u => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Map libraries from the CDNs: cache-first, and cache on first fetch (so the Map works offline).
  if (url.hostname === "cdnjs.cloudflare.com" || url.hostname === "unpkg.com") {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req)))
    );
    return;
  }

  // Beyond here, only our own same-origin GETs. Cross-origin (Apps Script POST, map tiles) passes through:
  // submissions fail fast offline so the app queues them; tiles simply need a connection.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Network-first for the page: fresh when online, cached copy when offline.
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Cache-first for everything else we own (icons, manifest).
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
