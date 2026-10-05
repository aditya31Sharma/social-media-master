import { splitTitle } from './shopify.js';
const mix = (a, b, p) => a + (b - a) * p;
export const GARMENT = Object.freeze({ x: 210, y: 320, size: 900 });

export function personPose({ image, crop }, amount) {
  const original = Math.max(1080 / image.width, 1920 / image.height);
  const height = Math.min(1650, 560 * crop.h / crop.w), width = height * crop.w / crop.h;
  return {
    x: mix((1080 - image.width * original) / 2 + crop.x * original, 280 - width / 2, amount),
    y: mix((1920 - image.height * original) / 2 + crop.y * original, 960 - height / 2, amount),
    width: mix(crop.w * original, width, amount), height: mix(crop.h * original, height, amount),
  };
}
function textLines(ctx, text, size, weight) {
  let lines;
  do {
    ctx.font = `${weight} ${size}px Geist, sans-serif`; lines = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > 480) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 3 || size <= 26) return { lines, size };
    size -= 2;
  } while (true);
}
export function paintProductDetail(ctx, garment, person, asset, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.min(1, amount * 3); ctx.fillRect(0, 0, 1080, 1920);
  // Garment is deliberately painted first: the moving person occludes its sleeves.
  ctx.globalAlpha = amount;
  if (garment) ctx.drawImage(garment, GARMENT.x + (1 - amount) * 120, GARMENT.y, GARMENT.size, GARMENT.size);
  const pose = personPose(person, amount), { image, crop } = person;
  ctx.globalAlpha = 1;
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, pose.x, pose.y, pose.width, pose.height);
  ctx.globalAlpha = amount; ctx.fillStyle = '#171717'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const [name, subtitle] = splitTitle(asset.productName, asset.type);
  let y = 1270;
  for (const [text, size, weight] of [[name, 52, 600], [subtitle, 34, 400]]) {
    const block = textLines(ctx, text, size, weight);
    for (const line of block.lines) { ctx.fillText(line, 770, y, 480); y += block.size * 1.15; }
    y += 14;
  }
  ctx.restore();
}
