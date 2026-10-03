/* Cross-origin isolation on a static host.

   The matting model runs on WebAssembly, and WebAssembly only gets threads when
   the document is cross-origin isolated - which normally means sending COOP and
   COEP response headers. GitHub Pages does not let you set headers, so a service
   worker adds them to its own responses instead and the page reloads once under
   its control. Chrome then runs the model on every core rather than one.

   The shared workspace now includes Google's Drive sign-in popup, so its
   document must remain non-isolated. The Reel lab keeps isolation. Background
   removal in the workspace uses the same single-thread path as Safari.
   ?nocoi on the URL skips worker registration. */

if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', event => {
    const req = event.request;
    // A range/cache probe must be passed straight through or Safari errors.
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
    // Story Creator uses Google's OAuth popup, which COOP same-origin would isolate.
    if (req.url.startsWith(new URL('stories/', self.registration.scope).href)) return;
    const workspace = req.mode === 'navigate' && !req.url.startsWith(new URL('lab/', self.registration.scope).href);

    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.status === 0) return res;             // opaque, nothing to rewrite
          const headers = new Headers(res.headers);
          // `credentialless` rather than `require-corp`: Shopify's CDN does not
          // send Cross-Origin-Resource-Policy, and require-corp would block
          // every product photo the tool exists to read.
          if (workspace) {
            headers.delete('Cross-Origin-Embedder-Policy');
            headers.delete('Cross-Origin-Opener-Policy');
          } else {
            headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
            headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          }
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
    if (!window.isSecureContext || !navigator.serviceWorker) return;
    // An older worker may have isolated this document. Reload only when its
    // replacement takes control, before the user starts editing.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.crossOriginIsolated) location.reload();
    });
    try {
      const reg = await navigator.serviceWorker.register(selfSrc);
      await reg.update();
    } catch (err) {
      console.warn('[coi] not enabled:', err.message);
    }
  })();
}
