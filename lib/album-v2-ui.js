import { v2Defaults, loadShoot, loadIntro, galleryAudio } from './album-v2-media.js';
import { PRODUCT_ORDER, GALLERY_DURATION, INTRO_DURATION, OUTRO_DURATION } from './album-v2-motion.js';
import { introLabels, introControls, wireIntroControls } from './album-v2-labels.js';
import { decodeReviewPhoto } from '../stories/heic.js';
import { decodeSfx, encodeAudio, audioSupported } from './audio.js';
import { encodeToMp4, supported } from './encode.js';
const upload = (key, label, accept) => `<label class="btn album-upload">${label}<input type="file" data-v2-upload="${key}" accept="${accept}"></label>`;
export function createAlbumV2UI({ onVideo, onStatus }) {
  const root = document.createElement('div'); root.id = 'albumV2Setup'; root.className = 'setup album-setup'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Album creator V2');
  root.innerHTML = `<header class="setup__head"><button type="button" class="round" data-v2-close aria-label="Close album creator V2"><svg viewBox="0 0 24 24"><use href="#i-left"/></svg></button><span class="setup__title"><strong>Album creator V2</strong><em>Winter intro · Shoot gallery · 3D product cards</em></span></header>
    <div class="album-body"><section class="album-preview"><canvas width="360" height="640" tabindex="0" aria-label="Album creator V2 preview."></canvas><div class="album-playback"><button type="button" class="btn" data-v2-play>Play</button><output data-v2-time>0.0s</output></div><input type="range" data-v2-scrub min="0" max="28.5" value="0" step=".01" aria-label="V2 preview time"></section>
    <fieldset class="album-controls"><legend class="sr-only">Album creator V2 settings</legend>
    ${introControls()}
    <details open><summary>Gallery products <span data-v2-count>0 / 5</span></summary><p class="note">Shoot photos in 2:3. Each product opens into a frosted-glass card.</p><div data-v2-products></div></details>
    <details><summary>Sound and export</summary><label class="field"><span>Gallery duration</span><select class="input" data-v2-duration><option value="23">23 seconds</option><option value="30">30 seconds</option></select></label><p class="note">3-second intro · 2.5-second logo ending.</p>${upload('music','Add gallery music','audio/*')}<p class="note" data-v2-music-name>No music selected</p><button type="button" class="btn" data-v2-remove-music>Remove music</button><label class="field"><span>Music volume %</span><input class="input" type="number" data-v2-volume min="0" max="100" value="75"></label><label class="field"><span>Resolution</span><select class="input" data-v2-resolution><option value="1080">1080 × 1920</option><option value="720">720 × 1280</option></select></label></details></fieldset></div>
    <footer class="album-footer"><p class="note" data-v2-status role="status">Loading the gallery…</p><button class="btn" type="button" data-v2-retry hidden>Retry</button><button class="btn btn--primary" type="button" data-v2-generate disabled>Generate reel</button></footer>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector), canvas = $('canvas');
  const state = { models: Array(5).fill(null), intro: null, introEnabled: true, introSound: false, music: null, duration: GALLERY_DURATION, gain: .75, labels: introLabels(), brand: { variant: 'japanese', color: '#ffffff' } };
  let renderer = null, renderError = false, busy = false, pending = false, playing = false, time = 0, frame = 0, paintVersion = 0, initialized = false, audioContext = null, audioSource = null;
  const report = text => { $('[data-v2-status]').textContent = text; };
  const introLength = () => state.introEnabled ? INTRO_DURATION : 0;
  const duration = () => introLength() + state.duration + OUTRO_DURATION;
  function update() {
    $('[data-v2-count]').textContent = `${state.models.filter(Boolean).length} / 5`;
    $('[data-v2-scrub]').max = duration();
    $('[data-v2-generate]').disabled = busy || pending || renderError || !renderer || state.introEnabled && !state.intro;
    $('.album-controls').disabled = busy || pending;
    canvas.dataset.busy = String(busy || pending);
    for (const selector of ['[data-v2-play]', '[data-v2-scrub]', '[data-v2-close]', '[data-v2-retry]']) $(selector).disabled = busy;
  }
  async function paint() {
    const version = ++paintVersion, at = time;
    if (at < introLength()) await state.intro?.seek(at);
    if (version !== paintVersion || busy) return;
    const ctx = canvas.getContext('2d');
    if (renderer) ctx.drawImage(renderer.draw(at, { introDuration: introLength(), galleryDuration: state.duration, intro: state.intro, labels: state.labels, brand: state.brand }), 0, 0);
    else if (state.intro) ctx.drawImage(state.intro.video, 0, 0, canvas.width, canvas.height);
    $('[data-v2-time]').textContent = `${at.toFixed(1)} / ${duration().toFixed(1)}s`; $('[data-v2-scrub]').value = at;
  }
  wireIntroControls(root, state, () => { time = 1; stop(); repaint(); });
  function repaint() { paint().catch(error => report(error.message)); }
  function stop() { playing = false; cancelAnimationFrame(frame); audioSource?.stop(); audioSource = null; $('[data-v2-play]').textContent = 'Play'; }
  $('[data-v2-play]').addEventListener('click', async () => {
    if (busy || pending) return; if (playing) { stop(); return; } if (time >= duration()) time = 0;
    playing = true; $('[data-v2-play]').textContent = 'Pause';
    try {
    const track = galleryAudio(state.intro, state.music, duration(), { introEnabled: state.introEnabled, introSound: state.introSound, gain: state.gain });
    if (track) {
      audioContext ||= new AudioContext(); await audioContext.resume(); if (!playing || busy || root.hidden) return;
      const buffer = audioContext.createBuffer(2, track.frames, track.rate); track.out.forEach((data, c) => buffer.copyToChannel(data, c));
      audioSource = audioContext.createBufferSource(); audioSource.buffer = buffer; audioSource.connect(audioContext.destination); audioSource.start(0, time);
    }
    } catch (error) { stop(); report(error.message); return; }
    const start = performance.now() - time * 1000;
    const tick = async now => { if (!playing || busy) return; time = Math.min(duration(), (now - start) / 1000); try { await paint(); } catch (error) { report(error.message); stop(); } if (playing && time < duration()) frame = requestAnimationFrame(tick); else stop(); };
    frame = requestAnimationFrame(tick);
  });
  $('[data-v2-scrub]').addEventListener('input', event => { stop(); time = +event.target.value; repaint(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  function rows() {
    const host = $('[data-v2-products]'); host.replaceChildren();
    state.models.forEach((asset, i) => {
      if (!asset) return;
      const row = document.createElement('div'); row.className = 'album-model';
      row.innerHTML = `<span class="album-model__number">${i + 1}</span><div class="album-model__thumb"></div><div class="album-model__actions">${upload(`photo-${i}`, 'Replace shoot', 'image/*,.heic,.heif')}${upload(`glb-${i}`, 'Replace 3D garment', '.glb')}</div><div class="album-order"><button type="button" class="btn" data-v2-move="${i}" data-step="-1" aria-label="Move product ${i + 1} earlier" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn" data-v2-move="${i}" data-step="1" aria-label="Move product ${i + 1} later" ${i === 4 ? 'disabled' : ''}>↓</button></div><label class="field album-model__product"><span>Product name</span><input class="input" data-v2-name="${i}" maxlength="160"></label>`;
      row.querySelector('input[data-v2-name]').value = asset.productName;
      const thumb = document.createElement('canvas'); thumb.width = 60; thumb.height = 90; const ctx = thumb.getContext('2d'), image = asset.image, scale = Math.max(60 / image.width, 90 / image.height);
      ctx.drawImage(image, (60 - image.width * scale) / 2, (90 - image.height * scale) / 2, image.width * scale, image.height * scale); row.querySelector('.album-model__thumb').append(thumb); host.append(row);
    }); update();
  }
  async function rebuild() {
    if (state.models.some(model => !model)) throw new Error('Load all five shoot photos first.');
    renderError = true;
    report('Loading the 3D gallery…');
    const { createGalleryRenderer } = await import('./album-v2-render.js');
    const next = await createGalleryRenderer(state.models.map(asset => ({ ...asset })));
    renderer?.dispose(); renderer = next; renderError = false; $('[data-v2-retry]').hidden = true;
  }
  async function initialize() {
    if (busy || pending) return; pending = true; update(); $('[data-v2-retry]').hidden = true;
    try {
      await document.fonts.load('500 44px Geist');
      const products = await v2Defaults();
      const results = await Promise.allSettled([
        ...PRODUCT_ORDER.map(async (source, i) => { if (!state.models[i]) state.models[i] = await loadShoot(products[source]); }),
        (async () => { if (!state.intro) { state.intro = await loadIntro(); repaint(); } })(),
      ]);
      rows(); const failure = results.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
      await rebuild(); initialized = true; report('Ready.');
    } catch (error) { report(`Could not load the gallery: ${error.message}`); $('[data-v2-retry]').hidden = false; }
    finally { pending = false; update(); repaint(); }
  }
  $('[data-v2-retry]').addEventListener('click', initialize);
  root.addEventListener('input', event => { const index = event.target.dataset.v2Name; if (index !== undefined) { state.models[+index].productName = event.target.value; renderer?.setNames(state.models.map(asset => asset.productName)); repaint(); } });
  root.addEventListener('click', async event => {
    const move = event.target.closest('[data-v2-move]'); if (!move || pending || busy) return;
    stop(); pending = true; update(); const i = +move.dataset.v2Move, next = i + +move.dataset.step;
    [state.models[i], state.models[next]] = [state.models[next], state.models[i]];
    try { await rebuild(); report('Ready.'); } catch (error) { report(error.message); $('[data-v2-retry]').hidden = false; }
    finally { pending = false; rows(); repaint(); }
  });
  root.addEventListener('change', async event => {
    const key = event.target.dataset.v2Upload, file = event.target.files?.[0]; if (!key || !file || busy || pending) return;
    stop(); pending = true; update(); report(`Loading ${file.name}…`);
    try {
      if (key === 'music') { state.music = await decodeSfx(await file.arrayBuffer()); $('[data-v2-music-name]').textContent = file.name; }
      else {
        const [kind, index] = key.split('-'), asset = state.models[+index];
        if (kind === 'photo') { let image = await decodeReviewPhoto(file); const scale = Math.min(1, 2560 / Math.max(image.width, image.height)); if (scale < 1) { const resized = new OffscreenCanvas(Math.round(image.width * scale), Math.round(image.height * scale)); resized.getContext('2d').drawImage(image, 0, 0, resized.width, resized.height); image.close?.(); image = await createImageBitmap(resized); } asset.image.close?.(); asset.image = image; }
        else { if (asset.glb.startsWith('blob:')) URL.revokeObjectURL(asset.glb); asset.glb = URL.createObjectURL(file); }
        await rebuild();
      }
      report('Ready.');
    } catch (error) { report(`Could not load this file: ${error.message}`); $('[data-v2-retry]').hidden = false; }
    finally { pending = false; event.target.value = ''; rows(); repaint(); }
  });
  $('[data-v2-duration]').addEventListener('change', event => { stop(); state.duration = +event.target.value; time = 0; update(); repaint(); });
  $('[data-v2-volume]').addEventListener('input', event => { stop(); state.gain = Math.max(0, Math.min(1, (+event.target.value || 0) / 100)); });
  $('[data-v2-remove-music]').addEventListener('click', () => { stop(); state.music = null; $('[data-v2-music-name]').textContent = 'No music selected'; });
  function close() { if (busy) return; stop(); root.hidden = true; }
  $('[data-v2-close]').addEventListener('click', close);
  $('[data-v2-generate]').addEventListener('click', async () => {
    if (busy || pending || renderError || !renderer || state.introEnabled && !state.intro) return;
    stop(); busy = true; paintVersion++; update(); let output = null;
    try {
      const width = +$('[data-v2-resolution]').value, height = width * 16 / 9, total = duration(), frames = Math.ceil(total * 60);
      const support = await supported(width, height); if (!support.ok) throw new Error(support.why);
      await document.fonts.ready; report('Preparing full-quality 3D garments…');
      const { createGalleryRenderer } = await import('./album-v2-render.js'); output = await createGalleryRenderer(state.models.map(asset => ({ ...asset })), { width, height, preview: false });
      const audio = galleryAudio(state.intro, state.music, frames / 60, { introEnabled: state.introEnabled, introSound: state.introSound, gain: state.gain });
      if (audio && !(await audioSupported())) throw new Error('This browser cannot export audio. Turn off audio or use Chrome.');
      const options = { introDuration: introLength(), galleryDuration: state.duration, intro: state.intro, labels: state.labels, brand: state.brand };
      const blob = await encodeToMp4({ width, height, fps: 60, frames, audio, encodeAudio,
        draw: async frame => { const t = frame / 60; if (t < introLength()) await state.intro.seek(t); return output.draw(t, options); },
        onProgress: p => report(`Generating reel… ${Math.round(p * 100)}%`),
      });
      const cover = await output.draw(introLength() + 1.86 * state.duration / GALLERY_DURATION, options).convertToBlob({ type: 'image/png' });
      onVideo(blob, 'tenzen-album-v2.mp4', cover, +(frames / 60).toFixed(2)); onStatus('Album creator V2 ready.'); report('Reel ready.'); root.hidden = true;
    } catch (error) { report(`Could not generate the reel: ${error.message}`); }
    finally { output?.dispose(); busy = false; update(); }
  });
  return { open() { root.hidden = false; if (!initialized) initialize(); else repaint(); }, close, state };
}
