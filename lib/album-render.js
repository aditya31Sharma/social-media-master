import { albumScene, hasIntro, introOpacity, shutterTimes } from './album-motion.js';

export function labelMetrics(ctx, label) {
  ctx.font = `${label.italic ? 'italic ' : ''}${label.weight} ${label.size}px "${label.font}", sans-serif`;
  const lines = label.text.split('\n');
  const widths = lines.map(line => [...line].reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + Math.max(0, [...line].length - 1) * label.spacing);
  return { lines, widths, width: Math.max(1, ...widths), height: Math.max(1, lines.length * label.size * label.lineHeight) };
}
export function labelRect(ctx, label) {
  const m = labelMetrics(ctx, label);
  return { x: label.x * 1080 - m.width / 2, y: label.y * 1920 - m.height / 2, w: m.width, h: m.height };
}
export function paintLabel(ctx, label, opacity = 1) {
  if (!label.enabled || !label.text) return;
  ctx.save();
  const m = labelMetrics(ctx, label);
  ctx.globalAlpha = opacity; ctx.fillStyle = label.color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  m.lines.forEach((line, row) => {
    let x = label.x * 1080 - (label.align === 'left' ? m.width : label.align === 'right' ? 2 * m.widths[row] - m.width : m.widths[row]) / 2;
    const y = label.y * 1920 + (row - (m.lines.length - 1) / 2) * label.size * label.lineHeight;
    for (const ch of line) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + label.spacing; }
  });
  ctx.restore();
}
function figure(ctx, asset, pose) {
  if (!asset?.image || pose.alpha <= 0) return;
  const image = asset.image, crop = asset.crop || { x: 0, y: 0, w: image.width, h: image.height };
  const scale = Math.min(756 / crop.w, 1382 / crop.h) * pose.scale * (asset.scale ?? 1);
  const w = crop.w * scale, h = crop.h * scale;
  const x = pose.x * 1080 - w / 2, y = pose.y * 1920 - h / 2;
  ctx.save();
  if (pose.band !== undefined) {
    ctx.beginPath(); ctx.rect(0, y + pose.band * h / 3, 1080, h / 3 + .5); ctx.clip();
  }
  ctx.globalAlpha = pose.alpha;
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
  ctx.restore();
}
function productCard(ctx, asset, amount, garment) {
  if (!asset || amount <= 0) return;
  ctx.save(); ctx.globalAlpha = amount;
  ctx.translate((1 - amount) * 260, 0);
  if (garment) ctx.drawImage(garment, 590, 400, 450, 675);
  else if (asset.detailMode === 'photo' && asset.front) {
    const image = asset.front, crop = asset.frontCrop || { x: 0, y: 0, w: image.width, h: image.height };
    const scale = Math.min(410 / crop.w, 610 / crop.h);
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 815 - crop.w * scale / 2, 750 - crop.h * scale / 2, crop.w * scale, crop.h * scale);
  }
  ctx.fillStyle = '#171717'; ctx.font = '600 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const lines = []; let line = '';
  for (const word of (asset.productName || '').split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > 410) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((text, i) => ctx.fillText(text, 815, 1120 + i * 47, 410));
  ctx.restore();
}
const surfaces = new WeakMap();
function drawScene(canvas, state, time, edit, garment) {
  const ctx = canvas.getContext('2d'), scene = albumScene(time, hasIntro(state), state.duration);
  ctx.save(); ctx.setTransform(canvas.width / 1080, 0, 0, canvas.height / 1920, 0, 0);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1080, 1920);
  if (scene.intro || edit) {
    if (state.coverEnabled && state.cover) {
      ctx.save(); ctx.globalAlpha = edit ? 1 : introOpacity(time, .25);
      const image = state.cover.image, size = Math.min(image.width, image.height);
      ctx.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 230, 620, 620, 620);
      ctx.restore();
    }
    for (const label of state.labels) paintLabel(ctx, label, edit ? 1 : introOpacity(time, { creator: .85, album: 1.25, heading: 1.8 }[label.id]));
  } else {
    for (const pose of scene.models) figure(ctx, state.models[pose.index], pose);
    if (scene.detail) productCard(ctx, state.models[scene.detail.index], scene.detail.amount, garment);
  }
  ctx.restore();
}
export function drawAlbum(canvas, state, time, { edit = false, products = null } = {}) {
  let frame = surfaces.get(canvas);
  if (!frame || frame.width !== canvas.width || frame.height !== canvas.height) {
    frame = new OffscreenCanvas(canvas.width, canvas.height); surfaces.set(canvas, frame);
  }
  const times = edit ? [time] : shutterTimes(time);
  const scene = times.map(sample => albumScene(sample, hasIntro(state), state.duration)).find(scene => scene.detail?.amount > 0) || {};
  const asset = scene.detail && state.models[scene.detail.index];
  const garment = !edit && asset?.detailMode !== 'photo' && scene.detail?.amount > 0 ? products?.render(asset, scene.detail.turn) : null;
  const ctx = canvas.getContext('2d');
  // Accumulate complete shutter frames, including the white canvas, to avoid
  // dark ghost outlines or opacity changes when several figures overlap.
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  times.forEach((sample, i) => {
    drawScene(frame, state, sample, edit, garment);
    ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(frame, 0, 0);
  });
  ctx.restore(); return canvas;
}

export function cropToAlpha(image) {
  const scale = Math.min(1, 256 / Math.max(image.width, image.height));
  const cv = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  const ctx = cv.getContext('2d'); ctx.drawImage(image, 0, 0, cv.width, cv.height);
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    if (data[(y * cv.width + x) * 4 + 3] < 16) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x0 > x1 || y0 > y1) throw new Error('This image is fully transparent.');
  return { x: x0 / scale, y: y0 / scale, w: Math.min(image.width - x0 / scale, (x1 - x0 + 1) / scale), h: Math.min(image.height - y0 / scale, (y1 - y0 + 1) / scale) };
}
