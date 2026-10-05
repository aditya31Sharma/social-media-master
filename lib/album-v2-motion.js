export const INTRO_DURATION = 3;
export const GALLERY_DURATION = 22;
export const OUTRO_DURATION = 4.5;
export const FIRST_STACK_HOLD = .5;
export const PRODUCT_ORDER = [1, 2, 3, 4, 0];
export const PRODUCT_DURATION = 4.4;
export const OVERVIEW_DISTANCE = 8.8;
export const STACK = Object.freeze({ y: .475, z: -1.5 });
export const clamp = n => Math.min(1, Math.max(0, n));
export const ease = n => { n = clamp(n); return n * n * n * (n * (n * 6 - 15) + 10); };
export function galleryScene(time, introDuration = 0, duration = GALLERY_DURATION) {
  if (time < introDuration) {
    const t = Math.max(0, time);
    return { intro: true, index: -1, local: t, zoom: 1 - ease((t - 1.7) / .6), swipe: 0, detail: 0, labels: t >= .5, turn: 0 };
  }
  if (time >= introDuration + FIRST_STACK_HOLD + duration) {
    const t = time - introDuration - FIRST_STACK_HOLD - duration;
    return { outro: true, index: 4, local: t, zoom: 1, swipe: 0,
      detail: 0, turn: 0, scale: 1 - .95 * ease(t / .9),
      opacity: 1 - ease(t / .5), lineup: 1 - ease((t - 2.9) / .5),
      logo: ease((t - 3.15) / .6) };
  }
  const q = Math.min(GALLERY_DURATION - .000001, Math.max(0, time - introDuration - FIRST_STACK_HOLD) * GALLERY_DURATION / duration);
  const index = Math.floor(q / PRODUCT_DURATION), local = q - index * PRODUCT_DURATION, last = index === 4;
  return {
    intro: false, index, local,
    zoom: ease(local / .35) * (last ? 1 : 1 - ease((local - 3.8) / .25)),
    detail: ease((local - 2.1) / .35) * (1 - ease((local - 3.5) / .3)),
    swipe: last ? 0 : ease((local - 4.05) / .35),
    turn: Math.max(0, local - 2.1) * duration / GALLERY_DURATION * Math.PI * 2 / 10,
  };
}
export function galleryCardPose(order, scene) {
  if (order === -1 && !scene.intro) return { visible: false };
  if (scene.outro) return order === 4
    ? { visible: true, x: 0, y: 0, z: 0, rotateX: 0, rotateZ: 0, scale: scene.scale, opacity: scene.opacity }
    : { visible: false };
  if (scene.intro) {
    if (order === -1) return { visible: true, x: 0, y: 0, z: -8, rotateX: 0, rotateZ: 0,
      scale: ((OVERVIEW_DISTANCE + 8) / (1.5 / Math.tan(Math.PI / 9))) * (.05 + .95 * scene.zoom), opacity: 1 };
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
    rotateX: -.95 * exit * (1 - rear), rotateZ: 0,
    scale: 1 - .16 * exit * (1 - rear), opacity: 1 };
}
export const PHOTO_STARTS = [0, .85, 1.6, 1.6];
export const frontPhotoIndex = index => index % 2 ? 3 : 2;
export function photoScene(scene) {
  if (scene.intro) return { from: 0, to: 0, progress: 0 };
  const front = frontPhotoIndex(scene.index);
  if (scene.outro) return { from: front, to: front, progress: 0 };
  if (scene.local >= 1.6) return { from: 1, to: front, progress: ease((scene.local - 1.6) / .3) };
  if (scene.local >= .85) return { from: 0, to: 1, progress: ease((scene.local - .85) / .25) };
  return { from: 0, to: 0, progress: 0 };
}
export const lineupEntrance = (time, index) => ease((time - .55 - index * .3) / .35);
export function shutterTimes(time) {
  return Array.from({ length: 5 }, (_, i) => Math.max(0, time - i * .032 / 4));
}
