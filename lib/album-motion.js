export const ALBUM_DURATION = 15;
export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const mix = (a, b, p) => a + (b - a) * p;
const model = (index, values = {}) => ({ index, x: .5, y: .53, scale: 1, alpha: 1, ...values });
export function hasIntro(state) {
  return !!(state.coverEnabled && state.cover || state.labels.some(label => label.enabled && label.text.trim()));
}
export function introOpacity(t, start) { return ease((t - start) / .55) * (1 - ease((t - 2.55) / .45)); }

// Positions are fractions of the frame; time is deterministic for both preview and export.
export function albumScene(time, intro = true) {
  const t = clamp(time, 0, ALBUM_DURATION);
  if (intro && t < 3) return { intro: true, time: t, models: [] };
  const q = intro ? t - 3 : t * .8;
  if (q < .5) return { models: [model(0, { alpha: ease(q / .35), scale: mix(.92, 1, ease(q / .5)) })] };
  if (q < 1.2) {
    const p = ease((q - .5) / .7);
    return { models: [4, 3, 2, 1, 0].map(i => model(i, { x: .5 + i * .018 * p, y: .53 - i * .014 * p, scale: 1 - i * .035 * p, alpha: i ? p : 1 })) };
  }
  if (q < 2.5) {
    const p = ease((q - 1.2) / 1.3);
    return { models: [4, 3, 2, 1, 0].map(i => model(i, { x: mix(.5 + i * .018, .1 + i * .2, p), y: mix(.53 - i * .014, .53, p), scale: mix(1 - i * .035, .28, p) })) };
  }
  if (q < 3.6) {
    const p = ease((q - 2.5) / 1.1), zoom = mix(1, 1 / .28, p);
    return { models: [0, 2, 3, 4, 1].map(i => model(i, { x: (.1 + i * .2 - mix(.5, .3, p)) * zoom + .5, scale: .28 * zoom, alpha: i === 1 ? 1 : 1 - ease((p - .65) / .35) })) };
  }
  if (q < 4.1) return { models: [model(1)] };
  if (q < 4.7) {
    const models = [];
    for (let band = 0; band < 3; band++) {
      const p = ease((q - 4.1 - band * .065) / .4), direction = band === 1 ? -1 : 1;
      const trailX = -direction * Math.sin(p * Math.PI) * .045;
      models.push(model(1, { x: .5 + direction * p * 1.25, band, trailX }));
      models.push(model(2, { x: .5 - direction * (1 - p) * 1.25, band, trailX }));
    }
    return { models };
  }
  if (q < 5.6) return { models: [model(2)] };
  if (q < 6.2) {
    const p = ease((q - 5.6) / .6), trailY = -Math.sin(p * Math.PI) * .055;
    return { models: [model(2, { y: .53 + p * 1.4, trailY }), model(3, { y: .53 - (1 - p) * 1.4, trailY })] };
  }
  if (q < 7) return { models: [model(3)] };
  if (q < 7.7) {
    const p = ease((q - 7) / .7);
    return { models: [4, 2, 1, 0, 3].map((i, order) => model(i, { x: .5, y: .53 - (4 - order) * .018 * p, scale: 1 - (4 - order) * .035 * p, alpha: i === 3 ? 1 : p })) };
  }
  if (q < 9.4) {
    const p = ease((q - 7.7) / 1.7);
    return { models: [4, 2, 1, 0, 3].map((i, order) => model(i, { y: mix(.53 - (4 - order) * .018, .13 + i * .185, p), scale: mix(1 - (4 - order) * .035, .22, p) })) };
  }
  if (q < 11) {
    const p = ease((q - 9.4) / 1.6), zoom = mix(1, 1 / .22, p);
    return { models: [0, 1, 2, 3, 4].map(i => model(i, { y: (.13 + i * .185 - mix(.53, .87, p)) * zoom + .53, scale: .22 * zoom, alpha: i === 4 ? 1 : 1 - ease((p - .6) / .4) })) };
  }
  return { models: [model(4)] };
}
