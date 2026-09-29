/* Cross-origin isolation on a static host.

   The matting model runs on WebAssembly, and WebAssembly only gets threads when
   the document is cross-origin isolated - which normally means sending COOP and
   COEP response headers. GitHub Pages does not let you set headers, so a service
   worker adds them to its own responses instead and the page reloads once under
   its control. Chrome then runs the model on every core rather than one.

   This is strictly an optimisation. Safari does not support COEP credentialless,
   so it stays un-isolated and the model falls back to a single thread, which is
   slower but correct. Nothing here is required for the tool to work, and
   ?nocoi on the URL turns it off entirely. */

if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', event => {
    const req = event.request;
    // A range/cache probe must be passed straight through or Safari errors.
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.status === 0) return res;             // opaque, nothing to rewrite
          const headers = new Headers(res.headers);
          // `credentialless` rather than `require-corp`: Shopify's CDN does not
          // send Cross-Origin-Resource-Policy, and require-corp would block
          // every product photo the tool exists to read.
          headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          });
        })
        .catch(err => {
          console.error('[coi]', err);
          return new Response('', { status: 502 });
        })
    );
  });
} else {
  // Captured now, synchronously: `document.currentScript` is null by the time
  // the async body below runs.
  const selfSrc = document.currentScript.src;

  (async () => {
    if (new URL(location).searchParams.has('nocoi')) return;
    if (window.crossOriginIsolated !== false) return;      // already isolated, or unsupported
    if (!window.isSecureContext || !navigator.serviceWorker) return;

    // One reload, ever. Without this guard a worker that cannot isolate the
    // page turns it into a refresh loop.
    if (sessionStorage.getItem('coi-tried')) return;

    try {
      const reg = await navigator.serviceWorker.register(selfSrc);
      if (reg && !navigator.serviceWorker.controller) {
        sessionStorage.setItem('coi-tried', '1');
        location.reload();
      }
    } catch (err) {
      console.warn('[coi] not enabled:', err.message);
    }
  })();
}
