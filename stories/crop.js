import { place } from '../lib/frame.js';

export function clampCrop(nw, nh, fw, fh, adjust) {
  const scale = Math.max(1, Math.min(5, adjust.scale));
  const { dw, dh } = place(nw, nh, fw, fh, { scale });
  const maxX = Math.max(0, (dw / fw - 1) / 2), maxY = Math.max(0, (dh / fh - 1) / 2);
  return { scale, cx: Math.max(-maxX, Math.min(maxX, adjust.cx)), cy: Math.max(-maxY, Math.min(maxY, adjust.cy)) };
}
