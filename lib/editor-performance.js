import { EDITOR_PREVIEWS } from './editor-preview-assets.js';
const previews = new Map(Object.entries(EDITOR_PREVIEWS).map(([source, preview]) => [new URL(source, import.meta.url).href, new URL(preview, import.meta.url).href]));

// Original URLs are used for every export and for unrecognised uploaded assets.
export function editorAssetURL(source, preview = false) {
  const url = new URL(source, import.meta.url).href;
  return preview ? previews.get(url) || source : source;
}

// Keep input handling cheap and coalesce pointer/slider bursts into the latest frame.
export function schedulePaint(paint, onError, request = requestAnimationFrame) {
  let queued = false, running = false, dirty = false;
  const schedule = () => {
    dirty = true;
    if (queued || running) return;
    queued = true;
    request(async () => {
      queued = false; dirty = false; running = true;
      try { await paint(); } catch (error) { onError(error); }
      finally { running = false; if (dirty) schedule(); }
    });
  };
  return schedule;
}

// Preview keeps both ends of the shutter; exports keep all five samples.
export function editorShutterTimes(times, preview) {
  return preview && times.length > 2 ? [times[0], times.at(-1)] : times;
}
