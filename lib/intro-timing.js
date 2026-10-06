export function clipRange(duration, range = {}) {
  const total = Math.max(.04, Number(duration) || .04), minimum = Math.min(.1, total);
  const start = Math.max(0, Math.min(total - minimum, Number(range.start) || 0));
  const end = Math.max(start + minimum, Math.min(total, Number.isFinite(range.end) ? range.end : Math.min(total, start + 3.5)));
  return { start, end };
}
export function introHold(state) {
  if (!state.intro || state.intro.kind === 'image') return Math.max(.5, Math.min(30, state.introStillDuration || 3.5));
  const { start, end } = clipRange(state.intro.duration, state.introRange);
  return end - start;
}
export function introSourceTime(localTime, duration, range) {
  const { start, end } = clipRange(duration, range);
  return Math.max(start, Math.min(end - Math.min(1 / 30, (end - start) / 2), start + Math.max(0, localTime)));
}
