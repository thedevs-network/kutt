// This is the "Offline copy of pages" service worker

// eslint-disable-next-line no-restricted-globals
self.addEventListener('install', event => {
  const indexPage = new Request('index.html');
  event.waitUntil(
    fetch(indexPage).then(response =>
      caches.open('kutt-offline').then(cache => cache.put(indexPage, response))
    )
  );
});

// eslint-disable-next-line no-restricted-globals
self.addEventListener('fetch', event => {
  const updateCache = request =>
    caches
      .open('kutt-offline')
      .then(cache => fetch(request).then(response => cache.put(request, response)));

  event.waitUntil(updateCache(event.request));

  event.respondWith(
    fetch(event.request).catch(() =>
      // Check to see if you have it in the cache
      // Return response
      // If not in the cache, then return error page
      caches.open('kutt-offline').then(cache =>
        cache.match(event.request).then(matching => {
          const report =
            !matching || matching.status === 404 ? Promise.reject(new Error('no-match')) : matching;
          return report;
        })
      )
    )
  );
});
