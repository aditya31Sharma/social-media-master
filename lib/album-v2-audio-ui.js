import { waveform } from './audio.js';
import { musicRange, cacheMusicMix } from './album-v2-audio.js';
const control = (key, label, max, step, value) => `<label class="v2-audio-value"><span>${label}</span><input type="range" data-music-range="${key}" aria-label="${label}" min="0" max="${max}" step="${step}" value="${value}"><input class="input" type="text" inputmode="decimal" data-music-value="${key}" aria-label="${label}, exact value" value="${value}"></label>`;
export function musicControls() {
  return `<fieldset class="v2-audio" data-music-editor disabled><legend>Music editor</legend><p class="note">The song plays from the first frame. All source video audio is muted.</p><div class="trim"><canvas data-music-wave width="900" height="64" aria-label="Song waveform. Drag to move the selected section."></canvas><div class="trim__win" data-music-window></div><div class="v2-audio-playhead" data-music-playhead hidden></div></div><output class="note" data-music-selection></output>${control('start','Start (seconds)',100,.01,0)}${control('end','End (seconds)',100,.01,0)}<div class="v2-audio-actions"><button class="btn" type="button" data-music-fit>Match reel length</button><button class="btn" type="button" data-music-preview>Preview</button></div><label class="v2-audio-loop"><input type="checkbox" data-music-loop checked>Loop selected section to fill reel</label>${control('gain','Music volume %',100,1,75)}${control('fadeIn','Fade in (seconds)',10,.05,.2)}${control('fadeOut','Fade out (seconds)',10,.05,.2)}</fieldset>`;
}
export function wireMusicEditor(root, { state, duration, beforePlay, changed, report }) {
  const $ = selector => root.querySelector(selector), settings = { start: 0, end: null, fadeIn: .2, fadeOut: .2, loop: true };
  const cachedMix = cacheMusicMix(), wave = $('[data-music-wave]'), selection = $('[data-music-window]'), playhead = $('[data-music-playhead]');
  let context, source, buffer, bufferMix, playFrame = 0, generation = 0, started = 0, offset = 0, active = false;
  const mix = (length = duration()) => cachedMix(state.music, length, { ...settings, gain: state.gain });
  function sync() {
    $('[data-music-editor]').disabled = !state.music;
    $('[data-v2-remove-music]').disabled = !state.music;
    const range = musicRange(state.music, duration(), settings), total = state.music?.duration || 0;
    for (const key of ['start', 'end', 'gain', 'fadeIn', 'fadeOut']) {
      const value = key === 'gain' ? state.gain * 100 : key in range ? range[key] : settings[key];
      const slider = $(`[data-music-range="${key}"]`), exact = $(`[data-music-value="${key}"]`);
      if (key === 'start' || key === 'end') slider.max = total;
      slider.value = value; exact.value = +value.toFixed(2);
    }
    $('[data-music-loop]').checked = settings.loop;
    selection.style.left = `${total ? range.start / total * 100 : 0}%`;
    selection.style.width = `${total ? range.length / total * 100 : 0}%`;
    $('[data-music-selection]').textContent = total ? `${range.start.toFixed(2)}s to ${range.end.toFixed(2)}s · ${range.length.toFixed(2)}s selected · ${duration().toFixed(2)}s reel${range.length < duration() ? settings.loop ? ' · Loops to fill' : ' · Silence after selection' : ''}` : 'Add gallery music to choose a section.';
  }
  function stop() {
    generation++; active = false; cancelAnimationFrame(playFrame);
    if (source) { source.onended = null; source.stop(); source.disconnect(); source = null; }
    playhead.hidden = true; $('[data-music-preview]').textContent = 'Preview';
  }
  function clock() { return active ? offset + context.currentTime - started : null; }
  async function play(at = 0, audition = false) {
    stop(); if (!state.music) return;
    const token = generation, track = mix(); context ||= new AudioContext(); await context.resume();
    if (token !== generation) return;
    if (bufferMix !== track) {
      buffer = context.createBuffer(track.channels, track.frames, track.rate);
      track.out.forEach((data, channel) => buffer.copyToChannel(data, channel)); bufferMix = track;
    }
    source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
    offset = Math.max(0, Math.min(at, buffer.duration)); started = context.currentTime; active = true;
    source.onended = () => { if (token === generation) stop(); };
    source.start(started, offset);
    if (audition) $('[data-music-preview]').textContent = 'Stop';
    const tick = () => {
      if (!active) return;
      const range = musicRange(state.music, duration(), settings), elapsed = clock();
      playhead.hidden = !settings.loop && elapsed >= range.length;
      playhead.style.left = `${(range.start + elapsed % range.length) / state.music.duration * 100}%`;
      playFrame = requestAnimationFrame(tick);
    }; tick();
  }
  function apply(key, value) {
    if (!Number.isFinite(value)) { sync(); return; }
    stop(); changed();
    const range = musicRange(state.music, duration(), settings), total = state.music?.duration || 0;
    if (key === 'start') { settings.start = Math.max(0, Math.min(value, range.end - .05)); settings.end = range.end; }
    else if (key === 'end') settings.end = Math.min(total, Math.max(range.start + .05, value));
    else if (key === 'gain') state.gain = Math.max(0, Math.min(100, value)) / 100;
    else settings[key] = Math.max(0, Math.min(10, value));
    sync();
  }
  root.querySelectorAll('[data-music-range]').forEach(input => input.addEventListener('input', () => apply(input.dataset.musicRange, +input.value)));
  root.querySelectorAll('[data-music-value]').forEach(input => {
    input.addEventListener('change', () => apply(input.dataset.musicValue, input.value.trim() === '' ? NaN : +input.value));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); input.blur(); } });
  });
  $('[data-music-loop]').addEventListener('change', event => { stop(); changed(); settings.loop = event.target.checked; sync(); });
  $('[data-music-fit]').addEventListener('click', () => { stop(); changed(); settings.start = Math.min(settings.start, Math.max(0, state.music.duration - duration())); settings.end = null; sync(); });
  $('[data-music-preview]').addEventListener('click', async () => {
    if (active) { beforePlay(); stop(); return; }
    beforePlay(); try { await play(0, true); } catch (error) { stop(); report(error.message); }
  });
  let drag;
  wave.addEventListener('pointerdown', event => {
    if (!state.music || event.button !== 0 || wave.closest('.album-controls').disabled) return;
    stop(); changed(); const range = musicRange(state.music, duration(), settings), rect = wave.getBoundingClientRect();
    const point = (event.clientX - rect.left) / rect.width * state.music.duration;
    drag = { offset: point >= range.start && point <= range.end ? point - range.start : range.length / 2, length: range.length };
    wave.setPointerCapture(event.pointerId); move(event);
  });
  function move(event) {
    if (!drag) return; const rect = wave.getBoundingClientRect(), total = state.music.duration;
    settings.start = Math.max(0, Math.min(total - drag.length, (event.clientX - rect.left) / rect.width * total - drag.offset));
    settings.end = settings.start + drag.length; sync();
  }
  wave.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) wave.addEventListener(type, () => { drag = null; });
  function reset() {
    stop(); settings.start = 0; settings.end = null; buffer = null; bufferMix = null; cachedMix(null, 0);
    const ctx = wave.getContext('2d'); ctx.clearRect(0, 0, wave.width, wave.height);
    if (state.music) {
      const peaks = waveform(state.music, wave.width), maximum = Math.max(.01, ...peaks);
      ctx.fillStyle = getComputedStyle(root).getPropertyValue('--ink-2').trim() || '#888';
      peaks.forEach((peak, x) => { const height = Math.max(1, peak / maximum * 54); ctx.fillRect(x, (64 - height) / 2, 1, height); });
    }
    sync();
  }
  sync(); return { sync, reset, mix, play, stop, clock };
}
