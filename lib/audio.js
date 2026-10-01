/* The sound of the cuts.

   One short effect, played once per photograph change. There are four corners
   cutting on their own staggered schedules, so across a clip that is a hundred
   or so hits - too many to schedule as separate audio clips and far too many
   to leave to playback timing. They are mixed down ONCE into a single track
   the length of the reel, then encoded as one stream.

   Mixing into a flat buffer rather than scheduling voices also means the
   result is identical every time the same reel is built, which a real-time
   graph would not guarantee. */

const CHANNELS = 2;
const RATE = 48000;

/* Decoded through an OfflineAudioContext because it does not need a device,
   and works with the tab in the background. */
export async function decodeSfx(arrayBuffer) {
  const ctx = new OfflineAudioContext(CHANNELS, RATE, RATE);
  return ctx.decodeAudioData(arrayBuffer);
}

export async function loadSfx(url) {
  try {
    /* `cache: 'reload'` because the effect keeps the same filename when it is
       replaced, and a browser holding the previous one will happily play that
       instead - which looks exactly like the new file never shipped. It is
       70KB; re-reading it costs nothing. */
    const res = await fetch(url, { cache: 'reload' });
    if (!res.ok) return null;
    return await decodeSfx(await res.arrayBuffer());
  } catch {
    return null;                        // no sound is a valid outcome
  }
}

/* `hits` is every moment a photograph changes, in seconds.

   Two things have to be handled or this turns to mush. Four corners can land
   on the same frame, and stacking four copies of one sample just clips - so
   hits within a millisecond count as one. And the cuts start about 90ms apart
   while the effect runs 440ms, so five copies would overlap at the top of the
   clip: each copy is therefore cut off where the NEXT one begins, with a short
   fade so the truncation is not a click of its own. At the end, where the cuts
   are over a second apart, the effect plays out in full. */
const FADE_MS = 7;

/* Where the sample is loudest, in frames. A swoosh builds before it hits, so
   starting it ON the cut puts the quiet run-up over the cut and the hit after
   it - and at 90ms spacing the hit is truncated away entirely. Lining the PEAK
   up with the cut is what makes it land. */
function peakOffset(sfx) {
  const ch = sfx.getChannelData(0);
  let best = 0, at = 0;
  /* Coarse, in 2ms blocks: the exact sample does not matter, the moment does. */
  const step = Math.max(1, Math.round(sfx.sampleRate * 0.002));
  for (let i = 0; i < ch.length; i += step) {
    const v = Math.abs(ch[i]);
    if (v > best) { best = v; at = i; }
  }
  return at;
}

/* The bed under everything. Laid down first so the cuts sit on top of it, and
   faded at both ends so a clip that loops does not click. */
function layMusic(out, frames, music, gain, startSec = 0) {
  if (!music || gain <= 0) return;
  const ratio = music.sampleRate / RATE;
  const srcLen = music.length;
  const from = Math.max(0, Math.round(startSec * music.sampleRate));
  const fade = Math.round(RATE * 0.35);
  for (let c = 0; c < CHANNELS; c++) {
    const o = out[c];
    const src = music.getChannelData(Math.min(c, music.numberOfChannels - 1));
    for (let i = 0; i < frames; i++) {
      /* Reads from the chosen point, and wraps rather than running out if the
         track is shorter than the clip. */
      const si = (from + Math.round(i * ratio)) % srcLen;
      const env = Math.min(1, i / fade, (frames - i) / fade);
      o[i] += src[si] * gain * env;
    }
  }
}

/* A coarse min/max envelope for drawing the track, which is all a waveform
   needs - the full buffer is millions of samples and the canvas is 900 wide. */
export function waveform(buf, buckets = 900) {
  const ch = buf.getChannelData(0);
  const per = Math.max(1, Math.floor(ch.length / buckets));
  const out = new Float32Array(buckets);
  for (let b = 0; b < buckets; b++) {
    let peak = 0;
    const at = b * per, end = Math.min(ch.length, at + per);
    /* Stepped, not every sample: the difference is invisible at this size. */
    for (let i = at; i < end; i += 8) { const v = Math.abs(ch[i]); if (v > peak) peak = v; }
    out[b] = peak;
  }
  return out;
}

export function mixTrack(sfx, hits, duration, { gain = 0.15, music = null, musicGain = 1.0, musicStart = 0 } = {}) {
  const frames = Math.ceil(duration * RATE);
  const out = Array.from({ length: CHANNELS }, () => new Float32Array(frames));
  layMusic(out, frames, music, musicGain, musicStart);
  const hasSfx = sfx && hits.length && gain > 0;
  if (!hasSfx) {
    if (!music) return { out, frames, rate: RATE, channels: CHANNELS };
    return normalise({ out, frames, rate: RATE, channels: CHANNELS });
  }

  const src = Array.from({ length: CHANNELS }, (_, c) =>
    sfx.getChannelData(Math.min(c, sfx.numberOfChannels - 1)));
  const srcLen = sfx.length;

  /* One ordered, de-duplicated timeline, so "the next hit" is meaningful
     across all four corners rather than within one. */
  const times = [...new Set(hits.map(t => Math.round(t * 1000)))]
    .sort((a, b) => a - b).map(ms => ms / 1000);

  const fade = Math.max(1, Math.round((FADE_MS / 1000) * RATE));
  /* The sample runs at its own rate; the track runs at RATE. */
  const ratio = sfx.sampleRate / RATE;
  const lead = Math.round(peakOffset(sfx) / ratio);

  for (let k = 0; k < times.length; k++) {
    const hit = Math.round(times[k] * RATE);
    /* Started early enough that its loudest moment lands on the cut. */
    const at = hit - lead;
    const next = k + 1 < times.length ? Math.round(times[k + 1] * RATE) - lead : frames;
    const room = Math.max(1, next - at);
    const n = Math.min(Math.round(srcLen / ratio), frames - Math.max(0, at), room);
    const fadeFrom = Math.max(0, n - fade);
    for (let i = 0; i < n; i++) {
      const dst = at + i;
      if (dst < 0 || dst >= frames) continue;
      const si = Math.round(i * ratio);
      if (si >= srcLen) break;
      const env = i < fadeFrom ? 1 : 1 - (i - fadeFrom) / fade;
      for (let c = 0; c < CHANNELS; c++) out[c][dst] += src[c][si] * gain * env;
    }
  }

  return normalise({ out, frames, rate: RATE, channels: CHANNELS });
}

/* Overlapping tails and a music bed can push past full scale together, so the
   finished track is brought back under it rather than left to clip sample by
   sample. */
function normalise(track) {
  let peak = 0;
  for (const ch of track.out) for (let i = 0; i < track.frames; i++) { const v = Math.abs(ch[i]); if (v > peak) peak = v; }
  if (peak > 0.99) {
    const k = 0.99 / peak;
    for (const ch of track.out) for (let i = 0; i < track.frames; i++) ch[i] *= k;
  }
  return track;
}

export async function audioSupported() {
  if (typeof AudioEncoder === 'undefined') return false;
  try {
    const r = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2', sampleRate: RATE, numberOfChannels: CHANNELS, bitrate: 128000,
    });
    return !!r.supported;
  } catch { return false; }
}

/* Handed to the muxer in chunks, the same way the video is. */
export async function encodeAudio(track, addChunk) {
  const encoder = new AudioEncoder({ output: (chunk, meta) => addChunk(chunk, meta), error: e => { throw e; } });
  encoder.configure({ codec: 'mp4a.40.2', sampleRate: track.rate, numberOfChannels: track.channels, bitrate: 128000 });

  /* AAC works in 1024-sample frames; feeding it a chunk at a time keeps the
     interleave buffer small. */
  const STEP = 1024 * 16;
  for (let at = 0; at < track.frames; at += STEP) {
    const n = Math.min(STEP, track.frames - at);
    const inter = new Float32Array(n * track.channels);
    for (let c = 0; c < track.channels; c++) {
      const ch = track.out[c];
      for (let i = 0; i < n; i++) inter[i * track.channels + c] = ch[at + i];
    }
    encoder.encode(new AudioData({
      format: 'f32', sampleRate: track.rate, numberOfFrames: n,
      numberOfChannels: track.channels, timestamp: Math.round((at / track.rate) * 1e6), data: inter,
    }));
    if (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();
}
