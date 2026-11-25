/* =========================================================
   Studio Rebeca Cristina — Service Worker (app instalável / offline)
   Ao mudar arquivos do site, aumente a versão abaixo para
   que o app instalado receba a atualização na hora.
   ========================================================= */
const VERSION = 'rc-v1';
const CACHE = `studio-rebeca-${VERSION}`;

// Arquivos essenciais (salvos na instalação)
const CORE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './favicon.svg',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
];

// Fotos (salvas na instalação se existirem; se alguma faltar, não quebra nada)
const PHOTOS = [
    './img/hero.jpg', './img/rebeca.jpg', './img/studio.jpg',
    './img/galeria-01.jpg', './img/galeria-02.jpg', './img/galeria-03.jpg',
    './img/galeria-04.jpg', './img/galeria-05.jpg', './img/galeria-06.jpg',
    './img/galeria-07.jpg', './img/galeria-08.jpg', './img/galeria-09.jpg',
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE);
        await Promise.all(PHOTOS.map(url => cache.add(url).catch(() => {})));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('studio-rebeca-') && k !== CACHE).map(k => caches.delete(k)));
        if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Páginas: busca na internet primeiro (sempre a versão mais nova); sem internet, usa a cópia salva
    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const preload = await event.preloadResponse;
                const res = preload || await fetch(req);
                const cache = await caches.open(CACHE);
                cache.put('./index.html', res.clone());
                return res;
            } catch {
                return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
            }
        })());
        return;
    }

    // Fontes do Google: usa a cópia salva e atualiza em segundo plano
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(req));
        return;
    }

    // Outros sites (mapa, WhatsApp, Instagram): não interfere
    if (url.origin !== self.location.origin) return;

    // Fotos e ícones: cópia salva primeiro (mais rápido)
    if (req.destination === 'image') {
        event.respondWith(cacheFirst(req));
        return;
    }

    // CSS, JS e o resto: internet primeiro, cópia salva quando estiver offline
    event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
    const cache = await caches.open(CACHE);
    try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
    } catch {
        return (await cache.match(req)) || Response.error();
    }
}

async function cacheFirst(req) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
    } catch {
        return Response.error();
    }
}

async function staleWhileRevalidate(req) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const update = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
    }).catch(() => hit);
    return hit || update;
}
