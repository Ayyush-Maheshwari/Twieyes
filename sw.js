// Offline shell. Bump VERSION whenever the video, songs or fonts are replaced.
const VERSION = 'v11';
const CACHE = `twieyes-${VERSION}`;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'songs.json', 'songs.js', 'manifest.webmanifest',
  'assets/poster.jpg', 'assets/poster-soft.jpg', 'assets/loop.mp4', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png', 'assets/favicon-32.png', 'assets/favicon-48.png', 'favicon.ico',
  'fonts/instrument-serif-latin-400-normal.woff2', 'fonts/instrument-serif-latin-400-italic.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Safari only plays cached video if the worker answers Range requests itself.
async function rangeResponse(request, cached) {
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  const start = m && m[1] ? +m[1] : 0;
  const end = m && m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  const isMedia = /\.(mp4|m4a|woff2|jpg|png)$/.test(url.pathname);

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (isMedia && hit) return req.headers.has('range') ? rangeResponse(req, hit) : hit;       // media never changes under one name
    try {                                                                                         // everything else: fresh when online
      const res = await fetch(req);
      if (res.ok && !req.headers.has('range')) cache.put(req, res.clone());
      return res;
    } catch {
      if (hit) return hit;
      throw new Error('offline');
    }
  })());
});
