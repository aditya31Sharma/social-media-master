const DECODER_URL = 'https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/iife/heic-to.js';
const HEIC_NAME = /\.hei[cf]$/i;
const HEIC_TYPE = /^image\/hei(?:c|f)(?:-sequence)?$/i;
let decoderPromise;

export function isReviewPhoto(file) {
  return !!file && (file.type.startsWith('image/') || HEIC_NAME.test(file.name));
}

function isHeic(file) {
  return HEIC_NAME.test(file.name) || HEIC_TYPE.test(file.type);
}

function loadDecoder() {
  if (window.HeicTo) return Promise.resolve(window.HeicTo);
  if (!decoderPromise) {
    decoderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = DECODER_URL;
      script.onload = () => window.HeicTo
        ? resolve(window.HeicTo)
        : reject(new Error('HEIC decoder did not load.'));
      script.onerror = () => reject(new Error('HEIC decoder could not load. Check your connection and try again.'));
      document.head.append(script);
    }).catch(error => {
      decoderPromise = null;
      throw error;
    });
  }
  return decoderPromise;
}

export async function decodeReviewPhoto(file) {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    if (!isHeic(file)) throw error;
  }
  const convert = await loadDecoder();
  return convert({ blob: file, type: 'bitmap' });
}
