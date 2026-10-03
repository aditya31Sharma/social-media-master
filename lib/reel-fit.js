// Aditya's fit settings, updated from the fit screenshots on 2026-10-04.
const PRESETS = {
  'polo sweatshirt': [1.03, -11, 0, 0, 1],
  'oversized hoodie': [1.05, -4, 0],
  'oversized sweatshirt': [1.03, -11, 0, 0, 2],
  'baby tee': [1.07, -5, 0],
  'henley waffle tee': [0.96, -12, 0, 1, 2],
  'oversized tee': [0.90, -9, 180, 0, 2],
  'acid wash tee': [0.90, -9, 180, 0, 2],
};

export function fitForTop(type) {
  const [topScale, topY, topTurn, topX = 0, topZ = 0] = PRESETS[String(type || '').trim().toLowerCase()] || [1, 0, 0];
  return { topScale, topY, topX, topZ, topTurn };
}
