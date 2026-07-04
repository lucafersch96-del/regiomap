// RegioMap Service Worker
// Cached wird nur die App-Huelle (HTML/CSS/JS/Icons), NICHT die Supabase-Daten -
// die sollen immer frisch aus dem Netz kommen. Faellt das Netz aus, greift
// zumindest die App-Huelle aus dem Cache (kein weisser Bildschirm offline).

var CACHE_NAME = "regiomap-shell-v1";
var APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  // Supabase / Formspree / Nominatim / OSRM / Kartenkacheln: immer aus dem Netz,
  // nie aus dem Cache bedienen - das sind Live-Daten.
  var istLiveDaten = url.indexOf("supabase.co") > -1
    || url.indexOf("formspree.io") > -1
    || url.indexOf("nominatim.openstreetmap.org") > -1
    || url.indexOf("router.project-osrm.org") > -1
    || url.indexOf("tile.openstreetmap.org") > -1;

  if (istLiveDaten || event.request.method !== "GET") {
    return; // Browser macht einen normalen Netzwerk-Request
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
