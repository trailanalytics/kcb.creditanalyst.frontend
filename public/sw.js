/* Credit Analyst service worker.
 *
 * Static build assets (hashed file names under /assets/, icons, fonts) are cached on first use and served from the cache.
 * Page loads go to the network; when the network is down the offline page is shown. Pages themselves are never stored, so nothing
 * from a signed-in session stays readable after logging out, and API calls are never intercepted (no data offline).
 */
const CACHE = 'ca-static-v1'
const OFFLINE_PAGE = '/offline.html'
const PRECACHE = ['/img/KCB.logo.png', OFFLINE_PAGE]
const STATIC = /\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|ico|webp)(\?.*)?$/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (STATIC.test(url.pathname) && !url.pathname.endsWith('/sw.js')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone()
                caches.open(CACHE).then((cache) => cache.put(request, copy))
              }
              return response
            })
            .catch(() => new Response('Asset unavailable offline.', { status: 503 })),
      ),
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_PAGE).then(
          (page) =>
            page ||
            new Response('<h1>You are offline</h1><p>Please check your internet connection.</p>', {
              headers: { 'Content-Type': 'text/html' },
            }),
        ),
      ),
    )
  }
})
