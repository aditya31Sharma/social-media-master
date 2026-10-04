export const GALLERY_DURATION = 23;
export const PRODUCT_ORDER = [1, 2, 3, 4, 0];
export const GLASS = Object.freeze({ x: .07, y: .09, w: .86, h: .82 });
export const clamp = n => Math.min(1, Math.max(0, n));
export const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
export function bagEase(progress) {
  // Match the site's cubic-bezier(.32,.72,0,1), solving time before reading Y.
  const t = clamp(progress); let lo = 0, hi = 1;
  const curve = (u, a, b) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;
  for (let i = 0; i < 20; i++) { const u = (lo + hi) / 2; if (curve(u, .32, 0) < t) lo = u; else hi = u; }
  return t === 0 || t === 1 ? t : curve((lo + hi) / 2, .72, 1);
}
export function galleryScene(time, introDuration = 0, duration = GALLERY_DURATION) {
  if (time < introDuration) return { intro: true, time: Math.max(0, time) };
  const q = Math.min(GALLERY_DURATION - .000001, Math.max(0, time - introDuration) * GALLERY_DURATION / duration);
  const index = Math.floor(q / 4.6), local = q - index * 4.6, last = index === 4;
  const zoom = ease((local - .3) / .55) * (last ? 1 : 1 - ease((local - 3.6) / .4));
  const glass = ease((local - .85) / .3) * (last ? 1 : 1 - ease((local - 3.35) / .25));
  return {
    intro: false, index, local, zoom, glass,
    swipe: last ? 0 : ease((local - 4) / .6),
    turn: Math.max(0, local - .85) * Math.PI * 2 / 2.4,
    click: ease((local - 1.65) / .25), press: Math.sin(clamp((local - 1.9) / .2) * Math.PI),
    split: bagEase((local - 2.1) / .5), cursor: ease((local - 1.5) / .15) * (1 - ease((local - 2.5) / .2)),
  };
}
export function galleryCardPose(order, scene) {
  const offset = order - scene.index;
  if (offset < 0) return { visible: false };
  const shift = offset ? scene.swipe : 0;
  return {
    visible: true, x: offset === 0 ? -.25 * scene.swipe : 0,
    y: .28 * (offset - shift) - (offset === 0 ? 4.5 * scene.swipe : 0),
    z: -.75 * (offset - shift) + (offset === 0 ? 1.6 * scene.swipe : 0),
    rotateX: offset === 0 ? -.12 * (1 - scene.zoom) + 1.3 * scene.swipe : -.12,
    rotateZ: offset === 0 ? -.09 * scene.swipe : 0,
    opacity: offset === 0 ? 1 - ease((scene.swipe - .7) / .3) : 1,
  };
}
