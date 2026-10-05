import { splitTitle } from './shopify.js';
const mix = (a, b, p) => a + (b - a) * p;
export const PERSON_ZOOM = 1.3;
export const GARMENT = Object.freeze({ x: 394, y: 410, size: 720 });

export function personPose({ image, crop }, amount) {
  const original = Math.max(1080 / image.width, 1920 / image.height);
  const height = crop.h * original * PERSON_ZOOM, width = crop.w * original * PERSON_ZOOM;
  return {
    x: mix((1080 - image.width * original) / 2 + crop.x * original, 142 - width / 2, amount),
    y: mix((1920 - image.height * original) / 2 + crop.y * original, 100, amount),
    width: mix(crop.w * original, width, amount), height: mix(crop.h * original, height, amount),
  };
}
function textLines(ctx, text, size, weight, tracking) {
  let lines;
  do {
    ctx.font = `${weight} ${size}px Geist, sans-serif`; ctx.letterSpacing = `${size * tracking}px`; lines = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > 480) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 3 || size <= 26) return { lines, size };
    size -= 2;
  } while (true);
}
export function paintDetailGrid(ctx) {
  ctx.save(); ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= 1080; x += 120) { ctx.moveTo(x, 0); ctx.lineTo(x, 1920); }
  for (let y = 0; y <= 1920; y += 120) { ctx.moveTo(0, y); ctx.lineTo(1080, y); }
  ctx.stroke(); ctx.restore();
}
export function paintProductDetail(ctx, garment, person, asset, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.globalAlpha = 1; ctx.fillRect(0, 0, 1080, 1920);
  paintDetailGrid(ctx);
  // Garment is deliberately painted first: the moving person occludes its sleeves.
  ctx.globalAlpha = amount;
  if (garment) ctx.drawImage(garment, GARMENT.x + (1 - amount) * 120, GARMENT.y, GARMENT.size, GARMENT.size);
  const pose = personPose(person, amount), { image, crop } = person;
  ctx.globalAlpha = 1;
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, pose.x, pose.y, pose.width, pose.height);
  ctx.globalAlpha = amount; ctx.fillStyle = '#171717'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const [name, subtitle] = splitTitle(asset.productName, asset.type);
  let y = GARMENT.y + GARMENT.size + 70;
  for (const [text, size, weight, tracking] of [[name, 52, 400, -.03], [subtitle, 34, 100, -.02]]) {
    const block = textLines(ctx, text, size, weight, tracking);
    for (const line of block.lines) { ctx.fillText(line, 754, y, 480); y += block.size * 1.15; }
    y += 14;
  }
  ctx.restore();
}
