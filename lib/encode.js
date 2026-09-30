/* Making the file.

   An mp4 is a sequence of encoded frames, so frames do get produced - but
   nothing is played back and nothing is kept. Each frame is drawn, handed to
   the hardware encoder, and closed immediately; at no point does more than a
   handful exist. That is what lets a phone make a 900-frame clip without
   running out of memory, and why the whole thing finishes faster than the
   clip's own running time rather than taking fifteen seconds to "record".

   H.264 in mp4, because that is what Instagram takes. */

const MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/+esm';

/* Level has to cover the frame size: 4.2 carries 1080x1920 and 1440x2560, 5.2
   is needed for 2160x3840. High profile for the larger two, since nothing
   consuming these is old enough to care. */
function codecFor(width, height) {
  const px = width * height;
  if (px > 2228224) return 'avc1.640034';   // High 5.2
  return 'avc1.4D002A';                      // Main 4.2
}

/* Generous, because the encode is local and the upload re-encodes anyway.
   Under-running the bitrate on a garment turning against white is what gives
   you banding in the exact place the eye is looking. */
const bitrateFor = (w, h, fps) => Math.round(w * h * fps * 0.11);

export async function supported(width, height) {
  if (typeof VideoEncoder === 'undefined') return { ok: false, why: 'This browser has no video encoder.' };
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: codecFor(width, height), width, height,
      bitrate: bitrateFor(width, height, 60), framerate: 60,
    });
    return r.supported ? { ok: true } : { ok: false, why: `${width}x${height} is beyond this browser's encoder.` };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

/* `draw(i)` paints frame i and returns the canvas to encode. It is called
   exactly FRAMES times, in order. */
export async function encodeToMp4({ width, height, fps, frames, draw, onProgress }) {
  const { Muxer, ArrayBufferTarget } = await import(MUXER);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',        // the moov goes first, so it plays on a phone
  });

  let failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { failure = e; },
  });
  encoder.configure({
    codec: codecFor(width, height), width, height,
    bitrate: bitrateFor(width, height, fps), framerate: fps,
    latencyMode: 'quality',
  });

  const usPerFrame = 1e6 / fps;
  for (let i = 0; i < frames; i++) {
    if (failure) break;
    const canvas = await draw(i);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * usPerFrame), duration: Math.round(usPerFrame) });
    /* A keyframe every second keeps the file seekable without spending much:
       Instagram scrubs these. */
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();

    /* Backpressure. Without it the queue grows faster than the hardware
       drains it and the tab is holding hundreds of frames again. */
    if (encoder.encodeQueueSize > 6) {
      await new Promise(r => setTimeout(r, 0));
      while (encoder.encodeQueueSize > 3) await new Promise(r => setTimeout(r, 4));
    } else if ((i & 15) === 0) {
      await new Promise(r => setTimeout(r, 0));   // let the page breathe
    }
    onProgress?.((i + 1) / frames);
  }

  if (failure) { try { encoder.close(); } catch { /* already closed */ } throw failure; }
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
