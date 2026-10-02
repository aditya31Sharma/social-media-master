import { place } from '../lib/frame.js';
import { clampCrop } from './crop.js';
import { drawProgress } from './progress.js';

export async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export async function loadAssets() {
  const [more, share] = await Promise.all(['more', 'share'].map(name => loadImage(`assets/${name}.svg`)));
  await Promise.all([document.fonts.load('400 42px StoryRoboto'), document.fonts.load('700 42px StoryRoboto')]);
  return { more, share };
}

export function photoFrame(height, ratio = 'portrait') {
  return { x: 0, y: 0, w: 1080, h: ratio === 'landscape' ? 607.5 : 1920 };
}

export function drawStory(canvas, state, assets) {
  const ctx = canvas.getContext('2d'), h = canvas.height;
  ctx.clearRect(0, 0, 1080, h);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, h);
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, h - 230);
  if (state.photo) {
    const f = photoFrame(h, state.ratio);
    const crop = clampCrop(state.photo.width, state.photo.height, f.w, f.h, state.adjust);
    const p = place(state.photo.width, state.photo.height, f.w, f.h, crop);
    ctx.save(); ctx.beginPath(); ctx.rect(f.x, f.y, f.w, f.h); ctx.clip();
    ctx.drawImage(state.photo, f.x + p.ox, f.y + p.oy, p.dw, p.dh); ctx.restore();
  }
  const header = ctx.createLinearGradient(0, 0, 0, 289);
  header.addColorStop(0, 'rgba(0,0,0,.2)'); header.addColorStop(.425, 'rgba(0,0,0,.1)'); header.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = header; ctx.fillRect(0, 0, 1080, 289);
  ctx.save(); ctx.beginPath(); ctx.arc(84, 104, 48, 0, Math.PI * 2); ctx.clip();
  if (state.avatar) ctx.drawImage(state.avatar, 36, 56, 96, 96);
  ctx.restore();
  if (!assets) return;
  ctx.drawImage(assets.more, 976, 69);
  drawProgress(ctx, state.progress);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  let size = 42;
  ctx.font = `700 ${size}px StoryRoboto`;
  while (ctx.measureText(state.username).width > 605 && size > 28) ctx.font = `700 ${--size}px StoryRoboto`;
  ctx.fillText(state.username, 168, 120);
  const timeX = 168 + ctx.measureText(state.username).width + 28;
  ctx.font = '400 42px StoryRoboto'; ctx.fillText(`${state.time} ${state.unit}`, timeX, 120);
  const footer = ctx.createLinearGradient(0, h - 26, 0, h - 324);
  footer.addColorStop(0, 'rgba(0,0,0,.2)'); footer.addColorStop(.35729, 'rgba(0,0,0,.1)'); footer.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = footer; ctx.fillRect(0, h - 324, 1080, 298);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(25.5, h - 192.5, 885, 142, 71); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText('Send message', 75, h - 104);
  ctx.drawImage(assets.share, 960.5, h - 173);
}
