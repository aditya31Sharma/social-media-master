export const ALBUM_DURATION = 45;
export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const mix = (a, b, p) => a + (b - a) * p;
const model = (index, values = {}) => ({ index, x: .5, y: .53, scale: 1, alpha: 1, ...values });
const stacked = (front = 0) => [0, 1, 2, 3, 4].filter(i => i !== front).reverse().concat(front);
const horizontal = i => .1 + i * .2;
const vertical = i => .13 + i * .185;
export function hasIntro(state) {
  return state.introEnabled !== false && !!(state.coverEnabled && state.cover || state.labels.some(label => label.enabled && label.text.trim()));
}
export function introOpacity(t, start) { return ease((t - start) / .55) * (1 - ease((t - 2.55) / .45)); }

// All five products get an identical zoom, reading hold, return and full-view pause.
export const DETAIL_STARTS = [7, 14, 20.8, 27.6, 39.3];
function productDetail(index, elapsed) {
  const amount = ease(elapsed / .8) * (1 - ease((elapsed - 3.5) / 1));
  return { models: [model(index, { x: mix(.5, .19, amount), y: mix(.53, .68, amount), scale: mix(1, 1.5, amount) })], detail: { index, amount } };
}

// One timeline drives preview and export. Optional intro occupies the first three seconds.
export function albumScene(time, intro = false, duration = ALBUM_DURATION) {
  const t = clamp(time, 0, duration);
  if (intro && t < 3) return { intro: true, time: t, models: [] };
  const q = (t - (intro ? 3 : 0)) * ALBUM_DURATION / (duration - (intro ? 3 : 0));
  for (let i = 0; i < DETAIL_STARTS.length; i++) {
    if (q >= DETAIL_STARTS[i] && q < DETAIL_STARTS[i] + 4.5) return productDetail(i, q - DETAIL_STARTS[i]);
  }
  if (q < 1.4) return { models: stacked().map(i => model(i)) };
  if (q < 5) {
    const p = ease((q - 1.4) / 1.6);
    return { models: stacked().map(i => model(i, { x: mix(.5, horizontal(i), p), scale: mix(1, .28, p) })) };
  }
  if (q < 6.2) {
    const p = ease((q - 5) / 1.2), zoom = mix(1, 1 / .28, p);
    return { models: stacked().map(i => model(i, { x: (horizontal(i) - mix(.5, .1, p)) * zoom + .5, scale: .28 * zoom, alpha: i === 0 ? 1 : 1 - ease((p - .65) / .35) })) };
  }
  if (q < 12) return { models: [model(0)] };
  if (q < 13) {
    const p = ease(q - 12), trailX = -Math.sin(p * Math.PI) * .025;
    return { models: [model(0, { x: .5 - p * 1.25, trailX }), model(1, { x: .5 + (1 - p) * 1.25, trailX })] };
  }
  if (q < 19) return { models: [model(1)] };
  if (q < 19.8) {
    const models = [];
    for (let band = 0; band < 3; band++) {
      const p = ease((q - 19 - band * .08) / .6), direction = band === 1 ? -1 : 1;
      const trailX = -direction * Math.sin(p * Math.PI) * .045;
      models.push(model(1, { x: .5 + direction * p * 1.25, band, trailX }));
      models.push(model(2, { x: .5 - direction * (1 - p) * 1.25, band, trailX }));
    }
    return { models };
  }
  if (q < 25.8) return { models: [model(2)] };
  if (q < 26.6) {
    const p = ease((q - 25.8) / .8), trailY = -Math.sin(p * Math.PI) * .055;
    return { models: [model(2, { y: .53 + p * 1.4, trailY }), model(3, { y: .53 - (1 - p) * 1.4, trailY })] };
  }
  if (q < 32.6) return { models: [model(3)] };
  if (q < 33.2) {
    const p = ease((q - 32.6) / .6);
    return { models: stacked(3).map(i => model(i, { alpha: i === 3 ? 1 : p })) };
  }
  if (q < 37) {
    const p = ease((q - 33.2) / 1.5);
    return { models: stacked(3).map(i => model(i, { y: mix(.53, vertical(i), p), scale: mix(1, .22, p) })) };
  }
  if (q < 38.3) {
    const p = ease((q - 37) / 1.3), zoom = mix(1, 1 / .22, p);
    return { models: [0, 1, 2, 3, 4].map(i => model(i, { y: (vertical(i) - mix(.53, .87, p)) * zoom + .53, scale: .22 * zoom, alpha: i === 4 ? 1 : 1 - ease((p - .6) / .4) })) };
  }
  return { models: [model(4)] };
}
