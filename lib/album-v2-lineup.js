import { lineupEntrance } from './album-v2-motion.js';
import { cropToAlpha } from './album-render.js';
const directory = new URL('../assets/album-v2/', import.meta.url);
const images = new Map();

// Transparent artwork is shared across preview rebuilds and the full-size export.
function load(file) {
  if (!images.has(file)) {
    const pending = (async () => {
      const response = await fetch(new URL(file, directory));
      if (!response.ok) throw new Error('Could not load the lineup model.');
      const image = await createImageBitmap(await response.blob());
      return { image, crop: cropToAlpha(image) };
    })().catch(error => { images.delete(file); throw error; });
    images.set(file, pending);
  }
  return images.get(file);
}

export function lineupLayout(crops) {
  const ratios = crops.map(crop => crop.w / crop.h), overlap = .035;
  const height = Math.min(1100, 1000 / (ratios.reduce((sum, value) => sum + value, 0) - overlap * (crops.length - 1)));
  const widths = ratios.map(ratio => ratio * height), gap = -overlap * height;
  let x = (1080 - widths.reduce((sum, value) => sum + value, 0) - gap * (widths.length - 1)) / 2;
  return widths.map(width => { const rect = { x, y: 960 - height / 2, width, height }; x += width + gap; return rect; });
}

export async function loadLineupArtwork(assets) {
  const models = await Promise.all(assets.map((asset, index) => asset.people?.[index % 2 ? 'woman' : 'man'] || load(asset.lineup[index % 2 ? 'woman' : 'man'])));
  const layout = lineupLayout(models.map(model => model.crop));
  return { models, paint(ctx, time) {
    models.forEach(({ image, crop }, index) => {
      const rect = layout[index], entrance = lineupEntrance(time, index);
      ctx.save(); ctx.globalAlpha *= entrance;
      ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, rect.x, rect.y, rect.width, rect.height);
      ctx.restore();
    });
  } };
}

export async function cutoutPerson(image) {
  const { matteForBlob } = await import('./cutout.js');
  const canvas = new OffscreenCanvas(image.width, image.height), ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const matte = await matteForBlob(await canvas.convertToBlob({ type: 'image/png' }));
  ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(matte, 0, 0, canvas.width, canvas.height); matte.close();
  const cutout = await createImageBitmap(canvas);
  return { image: cutout, crop: cropToAlpha(cutout) };
}
