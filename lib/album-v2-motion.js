export const INTRO_DURATION = 3;
export const GALLERY_DURATION = 23;
export const OUTRO_DURATION = 2.5;
export const PRODUCT_ORDER = [1, 2, 3, 4, 0];
export const GLASS = Object.freeze({ x: 0, y: .4, w: 1, h: .6 });
// Measured from the live mobile PDP: 348px row in a 390px viewport, 64px high.
export const BAG = Object.freeze({ x: 21 / 390, width: 348 / 390, height: 64 / 390, gap: 8 / 390 });
export const clamp = n => Math.min(1, Math.max(0, n));
export const ease = n => { n = clamp(n); return n * n * n * (n * (n * 6 - 15) + 10); };
export function bagEase(progress) {
  const t = clamp(progress); let lo = 0, hi = 1;
  const curve = (u, a, b) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;
  for (let i = 0; i < 20; i++) { const u = (lo + hi) / 2; if (curve(u, .32, 0) < t) lo = u; else hi = u; }
  return t === 0 || t === 1 ? t : curve((lo + hi) / 2, .72, 1);
}
export function galleryScene(time, introDuration = 0, duration = GALLERY_DURATION) {
  if (time < introDuration) {
    const t = Math.max(0, time);
    return { intro: true, index: -1, local: t, zoom: 1 - ease((t - 1.7) / .6), swipe: 0, glass: 0, labels: t >= .5, turn: 0, split: 0, press: 0 };
  }
  if (time >= introDuration + duration) {
    const t = time - introDuration - duration;
    return { outro: true, index: 4, local: t, zoom: 1, swipe: 0,
      glass: 1 - ease(t / .3), turn: (4.6 - 1.55) * Math.PI * 2 / 10,
      split: 1, press: 0, scale: 1 - .95 * ease((t - .3) / 1.2),
      opacity: 1 - ease((t - 1.5) / .4), logo: ease((t - 1.9) / .3) };
  }
  const q = Math.min(GALLERY_DURATION - .000001, Math.max(0, time - introDuration) * GALLERY_DURATION / duration);
  const index = Math.floor(q / 4.6), local = q - index * 4.6, last = index === 4;
  return {
    intro: false, index, local,
    zoom: ease(local / .55) * (last ? 1 : 1 - ease((local - 3.6) / .4)),
    glass: ease((local - 1.55) / .3) * (last ? 1 : 1 - ease((local - 3.3) / .3)),
    swipe: last ? 0 : ease((local - 4) / .6),
    turn: Math.max(0, local - 1.55) * Math.PI * 2 / 10,
    press: Math.sin(clamp((local - 2.25) / .2) * Math.PI),
    split: bagEase((local - 2.45) / .5),
  };
}
export function galleryCardPose(order, scene) {
  if (order === -1 && !scene.intro) return { visible: false };
  if (scene.outro) return order === 4
    ? { visible: true, x: 0, y: 0, z: 0, rotateX: 0, rotateZ: 0, scale: scene.scale, opacity: scene.opacity }
    : { visible: false };
  if (scene.intro) {
    if (order === -1) return { visible: true, x: 0, y: 0, z: -5, rotateX: 0, rotateZ: 0,
      scale: (11.6 / (1.5 / Math.tan(Math.PI / 9))) * (.05 + .95 * scene.zoom), opacity: 1 };
    const progress = (scene.local - (1.88 + (4 - order) * .16)) / .36;
    if (progress <= 0) return { visible: false };
    const p = ease(progress);
    return { visible: true, x: 0, y: -5 * (1 - p) + .22 * order * p,
      z: .9 * (1 - p) - .75 * order * p, rotateX: -.95 * (1 - p), rotateZ: 0, scale: 1, opacity: 1 };
  }
  const count = 5;
  const rank = (order - scene.index + count) % count;
  const p = scene.swipe;
  if (rank > 0) {
    const at = rank - p;
    return { visible: true, x: 0, y: .22 * at, z: -.75 * at, rotateX: 0, rotateZ: 0, opacity: 1 };
  }
  // The current card dips forward, retreats in depth, then settles at the rear.
  const arc = Math.sin(Math.PI * p), rear = ease((p - .3) / .7), at = (count - 1) * rear;
  return { visible: true, x: 0, y: -2.4 * arc + .22 * at, z: .85 * arc - .75 * at,
    rotateX: .8 * arc, rotateZ: 0, opacity: 1 };
}
