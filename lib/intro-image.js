import { decodeReviewPhoto } from '../stories/heic.js';
export async function loadIntroImage(file) {
  const image = await decodeReviewPhoto(file);
  return { kind: 'image', video: image, preview: false, audio: null, duration: 0, name: file.name, seek: async () => {}, dispose: () => image.close?.() };
}
