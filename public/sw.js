/* Service worker: מאפשר לאפליקציה לעבוד גם בלי חיבור לאינטרנט.
   - קבצי האפליקציה נשמרים במטמון בהתקנה ובשימוש.
   - ניווט: קודם הרשת, ואם אין חיבור, הגרסה השמורה.
   - קבצים עם גיבוב בשם (assets) ואייקונים: מהמטמון קודם.
   - בקשות לשרתים אחרים (Supabase) לא נוגעים בהן. */
const VERSION = 'pf-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/tower.svg', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

async function precache() {
  const cache = await caches.open(VERSION);
  await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
  try {
    const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
    const urls = new Set(html.match(/\/assets\/[^"'\s)]+/g) || []);
    for (const u of [...urls]) {
      if (!u.endsWith('.css')) continue;
      try {
        const css = await (await fetch(u)).text();
        (css.match(/url\(([^)]+)\)/g) || []).forEach((m) => {
          const raw = m.slice(4, -1).replace(/["']/g, '');
          if (raw.startsWith('data:')) return;
          urls.add(new URL(raw, new URL(u, self.location.origin)).pathname);
        });
      } catch {}
    }
    await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})));
  } catch {}
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error())
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
