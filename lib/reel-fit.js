// Aditya's fit settings, supplied in six screenshots on 2026-10-04.
const PRESETS = {
  'polo sweatshirt': [1.03, -9, 0],
  'oversized hoodie': [1.05, -4, 0],
  'oversized sweatshirt': [1.02, -9, 0],
  'baby tee': [1.07, -5, 0],
  'henley waffle tee': [0.97, -12, 0],
  'oversized tee': [0.91, -9, 180],
  'acid wash tee': [0.91, -9, 180],
};

export function fitForTop(type) {
  const [topScale, topY, topTurn] = PRESETS[String(type || '').trim().toLowerCase()] || [1, 0, 0];
  return { topScale, topY, topX: 0, topZ: 0, topTurn };
}
