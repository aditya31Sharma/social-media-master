import { place } from './frame.js';
import { clampCrop } from '../stories/crop.js';
export const defaultIntroCrop = () => ({ scale: 1, cx: 0, cy: 0 });
export function introPlacement(video, crop = defaultIntroCrop(), width = 1080, height = 1920) {
  const iw = video.videoWidth || video.width, ih = video.videoHeight || video.height;
  const adjust = clampCrop(iw, ih, width, height, crop);
  return { ...place(iw, ih, width, height, adjust), adjust };
}
export function drawIntro(ctx, video, crop, width, height) {
  const { ox, oy, dw, dh } = introPlacement(video, crop, width, height);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  ctx.drawImage(video, ox, oy, dw, dh); ctx.restore();
}
