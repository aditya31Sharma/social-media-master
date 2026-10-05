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

// Coordinates are in the 1080 x 1920 composition, shared by preview and export.
export function endingLayout(crops, { gap = -20, gaps = Array(crops.length - 1).fill(gap), x = 50, y = 50 } = {}) {
  const spacing = gaps.reduce((sum, value) => sum + value, 0);
  const ratios = crops.map(crop => crop.w / crop.h);
  const height = Math.min(1100, (1000 - spacing) / ratios.reduce((sum, ratio) => sum + ratio, 0));
  const widths = ratios.map(ratio => ratio * height), width = widths.reduce((sum, value) => sum + value, 0) + spacing;
  const centerX = 1080 * x / 100, centerY = 1920 * y / 100;
  // Header occupies 230px; the globe footer occupies 130px. Center their union.
  const top = centerY - (height + 360) / 2, modelTop = top + 230;
  let left = centerX - width / 2;
  const models = widths.map((width, index) => { const rect = { x: left, y: modelTop, width, height }; left += width + (gaps[index] || 0); return rect; });
  return { models, x: centerX, becomeY: top + 30, logoY: top + 120, globeY: modelTop + height + 100,
    bounds: { x: centerX - Math.max(width, 585) / 2, y: top, width: Math.max(width, 585), height: height + 360 } };
}
export function lineupLayout(crops, options) { return endingLayout(crops, options).models; }

export async function loadLineupArtwork(assets) {
  const models = await Promise.all(assets.map((asset, index) => asset.people?.[index % 2 ? 'woman' : 'man'] || load(asset.lineup[index % 2 ? 'woman' : 'man'])));
  const layout = options => endingLayout(models.map(model => model.crop), options);
  return { models, layout, paint(ctx, time, options) {
    const { models: positions } = layout(options);
    models.forEach(({ image, crop }, index) => {
      const rect = positions[index], entrance = lineupEntrance(time, index);
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
