export const ALBUM_DURATION = 20;
export const SHOWCASE_ORDER = [1, 2, 3, 4, 0];
export const DETAIL_STARTS = [2.1, 5.4, 8.7, 12, 16.5];
export const DETAIL_DURATION = 2.5;
export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const mix = (a, b, p) => a + (b - a) * p;
const model = (index, values = {}) => ({ index, x: .5, y: .53, scale: 1, alpha: 1, ...values });
const stacked = (front = 0) => [0, 1, 2, 3, 4].filter(i => i !== front).reverse().concat(front);
const horizontal = i => .1 + i * .2;
const vertical = i => .13 + SHOWCASE_ORDER.indexOf(i) * .185;
export function hasIntro(state) {
  return state.introEnabled !== false && !!(state.coverEnabled && state.cover || state.labels.some(label => label.enabled && label.text.trim()));
}
export function introOpacity(t, start) { return ease((t - start) / .55) * (1 - ease((t - 2.55) / .45)); }
function productDetail(index, elapsed) {
  const amount = ease(elapsed / .25) * (1 - ease((elapsed - 2.2) / .3));
  return { models: [model(index, { x: mix(.5, .19, amount), y: mix(.53, .68, amount), scale: mix(1, 1.5, amount) })], detail: { index, amount, turn: elapsed * Math.PI * 2 / 1.9 } };
}

// Preview, shutter samples and export all use this deterministic20-second sequence.
export function albumScene(time, intro = false, duration = ALBUM_DURATION) {
  const t = clamp(time, 0, duration);
  if (intro && t < 3) return { intro: true, time: t, models: [] };
  const q = (t - (intro ? 3 : 0)) * ALBUM_DURATION / (duration - (intro ? 3 : 0));
  for (let i = 0; i < DETAIL_STARTS.length; i++) {
    if (q >= DETAIL_STARTS[i] && q < DETAIL_STARTS[i] + DETAIL_DURATION) return productDetail(SHOWCASE_ORDER[i], q - DETAIL_STARTS[i]);
  }
  if (q < .5) return { models: stacked().map(i => model(i)) };
  if (q < 1.45) {
    const p = ease((q - .5) / .45);
    return { models: stacked().map(i => model(i, { x: mix(.5, horizontal(i), p), scale: mix(1, .28, p) })) };
  }
  if (q < 1.85) {
    const p = ease((q - 1.45) / .4), zoom = mix(1, 1 / .28, p);
    return { models: stacked(1).map(i => model(i, { x: (horizontal(i) - mix(.5, .3, p)) * zoom + .5, scale: .28 * zoom, alpha: i === 1 ? 1 : 1 - ease((p - .65) / .35) })) };
  }
  if (q < 4.75) return { models: [model(1)] };
  if (q < 5.15) {
    const models = [];
    for (let band = 0; band < 3; band++) {
      const p = ease((q - 4.75 - band * .045) / .3), direction = band === 1 ? -1 : 1;
      models.push(model(1, { x: .5 + direction * p * 1.25, band }));
      models.push(model(2, { x: .5 - direction * (1 - p) * 1.25, band }));
    }
    return { models };
  }
  if (q < 8.05) return { models: [model(2)] };
  if (q < 8.45) {
    const p = ease((q - 8.05) / .4);
    return { models: [model(2, { y: .53 + p * 1.4 }), model(3, { y: .53 - (1 - p) * 1.4 })] };
  }
  if (q < 11.35) return { models: [model(3)] };
  if (q < 11.75) {
    const p = ease((q - 11.35) / .4);
    return { models: [model(3, { x: .5 - p * 1.25 }), model(4, { x: .5 + (1 - p) * 1.25 })] };
  }
  if (q < 14.65) return { models: [model(4)] };
  if (q < 14.9) {
    const p = ease((q - 14.65) / .25);
    return { models: stacked(4).map(i => model(i, { alpha: i === 4 ? 1 : p })) };
  }
  if (q < 15.85) {
    const p = ease((q - 14.9) / .45);
    return { models: stacked(4).map(i => model(i, { y: mix(.53, vertical(i), p), scale: mix(1, .22, p) })) };
  }
  if (q < 16.25) {
    const p = ease((q - 15.85) / .4), zoom = mix(1, 1 / .22, p);
    return { models: stacked(0).map(i => model(i, { y: (vertical(i) - mix(.53, .87, p)) * zoom + .53, scale: .22 * zoom, alpha: i === 0 ? 1 : 1 - ease((p - .6) / .4) })) };
  }
  return { models: [model(0)] };
}

// A long shutter leaves a visible directional streak on pans, zooms and body slices.
export function shutterTimes(time) { return Array.from({ length: 9 }, (_, i) => Math.max(0, time - .085 * i / 8)); }
