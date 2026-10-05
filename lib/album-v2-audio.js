const bounded = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(+value) ? +value : fallback));
export function musicRange(music, duration, { start = 0, end = null } = {}) {
  const total = music?.duration || 0, minimum = Math.min(.05, total);
  start = bounded(start, 0, 0, Math.max(0, total - minimum));
  end = bounded(end === null ? start + duration : end, total, start + minimum, total);
  return { start, end, length: end - start };
}
export function mixAlbumMusic(music, duration, options = {}) {
  if (!music || !(duration > 0)) return null;
  const { start, length } = musicRange(music, duration, options);
  if (!length) return null;
  const rate = 48000, channels = 2, frames = Math.round(duration * rate);
  const gain = bounded(options.gain ?? 1, 1, 0, 1), loop = options.loop !== false;
  const audible = Math.min(duration, loop ? duration : length), last = Math.min(frames, Math.round(audible * rate)) - 1;
  const fadeIn = bounded(options.fadeIn ?? .2, .2, 0, audible) * rate;
  const fadeOut = bounded(options.fadeOut ?? .2, .2, 0, audible) * rate;
  const out = [new Float32Array(frames), new Float32Array(frames)];
  for (let c = 0; c < channels; c++) {
    const src = music.getChannelData(Math.min(c, music.numberOfChannels - 1));
    for (let i = 0; i <= last; i++) {
      const position = (start + (i / rate) % length) * music.sampleRate;
      const left = Math.min(src.length - 1, Math.floor(position)), right = Math.min(src.length - 1, left + 1);
      const envelope = Math.min(1, fadeIn ? i / fadeIn : 1, fadeOut ? (last - i) / fadeOut : 1);
      out[c][i] = (src[left] + (src[right] - src[left]) * (position - left)) * gain * envelope;
    }
  }
  return { out, frames, rate, channels };
}
export function cacheMusicMix() {
  let previousMusic, previousKey, previousMix;
  return (music, duration, options = {}) => {
    const key = JSON.stringify([duration, options.start, options.end, options.gain, options.fadeIn, options.fadeOut, options.loop]);
    if (music !== previousMusic || key !== previousKey) {
      previousMix = mixAlbumMusic(music, duration, options); previousMusic = music; previousKey = key;
    }
    return previousMix;
  };
}
