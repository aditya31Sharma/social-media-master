import { loadIntro } from './album-v2-media.js';
const directory = new URL('../assets/album-v2/', import.meta.url);

// Only bundled preview photos are upgraded. Uploaded photos and their cutouts
// remain the user's exact edited assets, including after product reordering.
export async function prepareExportMedia(models, intro, introEnabled) {
  const owned = [];
  let fullIntro = null;
  const dispose = () => { owned.forEach(image => image.close()); fullIntro?.dispose(); };
  try {
    const results = await Promise.allSettled(models.map(async model => {
      const photos = [];
      for (const photo of model.photos) {
        if (!photo.preview) { photos.push(photo); continue; }
        const response = await fetch(new URL(photo.file, directory));
        if (!response.ok) throw new Error(`Could not load ${model.productName}: ${photo.label}.`);
        const image = await createImageBitmap(await response.blob()); owned.push(image);
        photos.push({ ...photo, image, preview: false });
      }
      return { ...model, photos, image: photos[0].image };
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    if (introEnabled && intro?.preview) fullIntro = await loadIntro();
    return { models: results.map(result => result.value), intro: fullIntro || intro, dispose };
  } catch (error) { dispose(); throw error; }
}
