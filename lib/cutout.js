/* Cutting the backgrounds out, locally.

   The desktop tool this grew out of ran BiRefNet through onnxruntime-node. The
   browser equivalent is ISNet through onnxruntime-web, which @imgly wraps; it
   is the same kind of matting model, running on the same runtime, with no key
   and no upload. That is what keeps the whole thing hostable as static files.

   Two details earn their keep. The matte is fetched separately from the photo,
   so a small image can be segmented quickly and the resulting matte applied to
   the full-resolution original - the matte is soft-edged anyway, the photo is
   not. And every matte is cached in IndexedDB against its image URL, so
   rebuilding a carousel after a copy tweak costs nothing. */

import { sized } from './shopify.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const MASK_W = 1400;             // the model works at 1024 internally regardless
const DB = 'sms-mattes';

let mod = null;
let warming = null;

async function load() {
  if (!mod) mod = await import(CDN);
  return mod;
}

/* ~88MB of weights. Held back until the user has actually committed to
   something, so an idle page costs nobody their mobile data. */
export function warm(onProgress) {
  if (warming) return warming;
  warming = (async () => {
    const m = await load();
    await m.preload({
      progress: (key, cur, total) => {
        if (key.startsWith('fetch')) onProgress?.(Math.round((cur / total) * 100));
      },
    });
    onProgress?.(100);
  })();
  return warming;
}

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('mattes');
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

async function cached(key) {
  try {
    const db = await open();
    return await new Promise(res => {
      const rq = db.transaction('mattes').objectStore('mattes').get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}

async function store(key, blob) {
  try {
    const db = await open();
    db.transaction('mattes', 'readwrite').objectStore('mattes').put(blob, key);
  } catch { /* a full or blocked store is not worth failing a render over */ }
}

/* A white-on-transparent matte at MASK_W. Its alpha channel is what the
   renderer composites with. */
export async function matteFor(url) {
  const key = `${url.split('?')[0]}@${MASK_W}`;
  const hit = await cached(key);
  if (hit) return createImageBitmap(hit);

  await warm().catch(() => { /* loading the module alone is still enough */ });
  const m = await load();
  const src = await (await fetch(sized(url, MASK_W), { mode: 'cors' })).blob();
  const matte = await m.alphamask(src, { output: { format: 'image/png' } });
  store(key, matte);
  return createImageBitmap(matte);
}
