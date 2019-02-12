// This is the "Offline copy of pages" service worker

// eslint-disable-next-line no-restricted-globals
self.addEventListener('install', event => {
  const offlinePage = new Request('/offline');
  event.waitUntil(
    fetch(offlinePage).then(response =>
      caches.open('kutt-offline-v1').then(cache => cache.put(offlinePage, response))
    )
  );
});

// eslint-disable-next-line no-restricted-globals
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.open('kutt-offline-v1').then(cache => cache.match('/offline'))
    )
  );
});
