import { editorAssetURL } from './editor-performance.js';
import { mixAlbumMusic } from './album-v2-audio.js';
const directory = new URL('../assets/album-v2/', import.meta.url);
export async function v2Defaults() {
  const response = await fetch(new URL('products.json', directory));
  if (!response.ok) throw new Error('Could not load the gallery products.');
  return response.json();
}
export async function loadShoot(product, { preview = false } = {}) {
  const descriptors = product.photos || [{ file: product.shoot, label: 'Shoot' }];
  const results = await Promise.allSettled(descriptors.map(async photo => {
    const response = await fetch(editorAssetURL(new URL(photo.file, directory), preview));
    if (!response.ok) throw new Error(`Could not load ${product.title}: ${photo.label}.`);
    return { ...photo, preview, image: await createImageBitmap(await response.blob()) };
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) { results.forEach(result => { if (result.status === 'fulfilled') result.value.image.close(); }); throw failure.reason; }
  const photos = results.map(result => result.value);
  return { ...product, productName: product.title, detailMode: '3d', image: photos[0].image, photos };
}
export async function loadIntro(file = null, { preview = false } = {}) {
  let source = file;
  if (!source) {
    const response = await fetch(editorAssetURL(new URL('intro-winter.mp4', directory), preview));
    if (!response.ok) throw new Error('Could not load the intro video.');
    source = await response.blob();
  }
  // A complete local blob supports seeking even on hosts without HTTP range support.
  const url = URL.createObjectURL(source);
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Intro video loading timed out.')), 20000);
      video.onloadeddata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('This video format could not be opened.')); };
      video.src = url;
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 120) throw new Error('Choose an intro video under two minutes.');
    const audio = null;
    let desired = 0, pending = null;
    async function drain() {
      while (Math.abs(video.currentTime - desired) > .012) {
        const target = desired;
        await new Promise((resolve, reject) => {
          const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', error); };
          const done = () => { cleanup(); resolve(); }, error = () => { cleanup(); reject(new Error('Could not seek the intro video.')); };
          const timer = setTimeout(error, 10000);
          video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', error, { once: true }); video.currentTime = target;
        });
        if (desired === target && Math.abs(video.currentTime - target) > .012) throw new Error('This intro video could not seek to the requested frame.');
      }
    }
    return { kind: 'video', video, audio, preview: preview && !file, duration: video.duration, name: file?.name || 'intro-winter.mp4',
      seek(time) {
        desired = Math.max(0, Math.min(video.duration - .04, Math.floor(time * 30) / 30));
        if (!pending) pending = drain().finally(() => { pending = null; });
        return pending;
      },
      dispose() { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); },
    };
  } catch (error) { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); throw error; }
}
// Source videos are always silent; only the selected song reaches the soundtrack.
export function galleryAudio(intro, music, duration, options = {}) {
  return mixAlbumMusic(music, duration, options);
}
