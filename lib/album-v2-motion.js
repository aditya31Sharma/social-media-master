export const INTRO_DURATION = 3;
export const GALLERY_DURATION = 40;
export const OUTRO_DURATION = 2.5;
export const PRODUCT_ORDER = [1, 2, 3, 4, 0];
export const PRODUCT_DURATION = 8;
export const STACK = Object.freeze({ y: .44, z: -1.5 });
export const GLASS = Object.freeze({ x: 20 / 390, y: .4 - 20 / (390 * 16 / 9), w: 350 / 390, h: .6, radius: 32 / 390 });
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
      glass: 1 - ease(t / .3), turn: (PRODUCT_DURATION - 1.55 + t) * Math.PI * 2 / 10,
      split: 1, press: 0, scale: 1 - .95 * ease((t - .3) / 1.2),
      opacity: 1 - ease((t - 1.5) / .4), logo: ease((t - 1.9) / .3) };
  }
  const q = Math.min(GALLERY_DURATION - .000001, Math.max(0, time - introDuration) * GALLERY_DURATION / duration);
  const index = Math.floor(q / PRODUCT_DURATION), local = q - index * PRODUCT_DURATION, last = index === 4;
  return {
    intro: false, index, local,
    zoom: ease(local / .55) * (last ? 1 : 1 - ease((local - 6.9) / .45)),
    glass: ease((local - 1.55) / .3) * (last ? 1 : 1 - ease((local - 6.6) / .3)),
    swipe: last ? 0 : ease((local - 7.35) / .65),
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
    if (order === -1) return { visible: true, x: 0, y: 0, z: -8, rotateX: 0, rotateZ: 0,
      scale: (14.6 / (1.5 / Math.tan(Math.PI / 9))) * (.05 + .95 * scene.zoom), opacity: 1 };
    const progress = (scene.local - (1.88 + (4 - order) * .16)) / .36;
    if (progress <= 0) return { visible: false };
    const p = ease(progress);
    return { visible: true, x: 0, y: -5 * (1 - p) + STACK.y * order * p,
      z: .9 * (1 - p) + STACK.z * order * p, rotateX: -.95 * (1 - p), rotateZ: 0, scale: 1, opacity: 1 };
  }
  const count = 5;
  const rank = (order - scene.index + count) % count;
  const p = scene.swipe;
  if (rank > 0) {
    const at = rank - p;
    return { visible: true, x: 0, y: STACK.y * at, z: STACK.z * at, rotateX: 0, rotateZ: 0, opacity: 1 };
  }
  // Recycle only once the upward exit is fully outside the viewport.
  const exit = ease(p / .7), rear = ease((p - .7) / .3);
  return { visible: p < .7 || rear >= 1, x: 0,
    y: 6 * exit * (1 - rear) + STACK.y * 4 * rear, z: STACK.z * 4 * rear,
    rotateX: -.65 * exit * (1 - rear), rotateZ: -.08 * exit * (1 - rear),
    scale: 1 - .16 * exit * (1 - rear), opacity: 1 };
}
export const PHOTO_STARTS = [0, 2.25, 3.6, 4.95];
export function photoScene(scene) {
  if (scene.intro) return { from: 0, to: 0, progress: 0 };
  if (scene.outro) return { from: 3, to: 3, progress: 0 };
  for (let to = 3; to >= 1; to--) {
    if (scene.local >= PHOTO_STARTS[to]) return { from: to - 1, to, progress: ease((scene.local - PHOTO_STARTS[to]) / .45) };
  }
  return { from: 0, to: 0, progress: 0 };
}
export function shutterTimes(time) {
  return Array.from({ length: 5 }, (_, i) => Math.max(0, time - i * .032 / 4));
}
