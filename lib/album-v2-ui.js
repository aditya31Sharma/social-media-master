import { wireAlbumText } from './album-text.js';
import { wireGalleryEditor, productRows, photoPreviewTime } from './album-v2-editor.js';
import { v2Defaults, loadShoot, loadIntro, galleryAudio } from './album-v2-media.js';
import { PRODUCT_ORDER, FIRST_STACK_HOLD, GALLERY_DURATION, INTRO_DURATION, OUTRO_DURATION, PRODUCT_DURATION, galleryScene, photoScene } from './album-v2-motion.js';
import { introLabels, introControls, wireIntroControls } from './album-v2-labels.js';
import { decodeReviewPhoto } from '../stories/heic.js';
import { decodeSfx, encodeAudio, audioSupported } from './audio.js';
import { encodeToMp4, supported } from './encode.js';
const upload = (key, label, accept) => `<label class="btn album-upload">${label}<input type="file" data-v2-upload="${key}" accept="${accept}"></label>`;
export function createAlbumV2UI({ onVideo, onStatus }) {
  const root = document.createElement('div'); root.id = 'albumV2Setup'; root.className = 'setup album-setup'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Album creator V2');
  root.innerHTML = `<header class="setup__head"><button type="button" class="round" data-v2-close aria-label="Close album creator V2"><svg viewBox="0 0 24 24"><use href="#i-left"/></svg></button><span class="setup__title"><strong>Album creator V2</strong><em>Winter intro · Shoot gallery · 3D garments</em></span></header>
    <div class="album-body"><section class="album-preview"><p class="v2-preview-title" data-v2-preview-title>Intro</p><canvas width="360" height="640" tabindex="0" aria-label="Album creator V2 preview. Drag intro text to position it, or use arrow keys."></canvas><div class="album-playback"><button type="button" class="btn" data-v2-play>Play</button><output data-v2-time>0.0s</output></div><input type="range" data-v2-scrub min="0" max="30" value="0" step=".01" aria-label="V2 preview time"></section>
    <fieldset class="album-controls"><legend class="sr-only">Album creator V2 settings</legend>
    ${introControls()}
    <details open><summary>Products <span data-v2-count>0 / 5</span></summary><p class="note">Shoot → Macro → Full-body model. Men and women alternate by product. Tap an image to preview it.</p><div data-v2-products></div></details>
    <details><summary>Sound and export</summary><label class="field"><span>Reel duration</span><select class="input" data-v2-duration><option value="22">30 seconds total</option><option value="45">53 seconds total</option><option value="40">48 seconds total</option><option value="23">31 seconds total</option><option value="30">38 seconds total</option></select></label><p class="note">3-second intro · 0.5-second stack hold · 4.5-second lineup and logo ending.</p>${upload('music','Add gallery music','audio/*')}<p class="note" data-v2-music-name>No music selected</p><button type="button" class="btn" data-v2-remove-music>Remove music</button><label class="field"><span>Music volume %</span><input class="input" type="number" data-v2-volume min="0" max="100" value="75"></label><label class="field"><span>Resolution</span><select class="input" data-v2-resolution><option value="1080">1080 × 1920</option><option value="720">720 × 1280</option></select></label></details></fieldset></div>
    <footer class="album-footer"><p class="note" data-v2-status role="status">Loading the gallery…</p><button class="btn" type="button" data-v2-retry hidden>Retry</button><button class="btn btn--primary" type="button" data-v2-generate disabled>Generate reel</button></footer>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector), canvas = $('canvas');
  const state = { models: Array(5).fill(null), intro: null, introEnabled: true, introSound: false, music: null, duration: GALLERY_DURATION, gain: .75, labels: introLabels(), brand: { variant: 'japanese', color: '#ffffff' } };
  let selectedProduct = 0, renderer = null, renderError = false, busy = false, pending = false, fontPending = 0, playing = false, time = 0, frame = 0, paintVersion = 0, initialized = false, audioContext = null, audioSource = null;
  const report = text => { $('[data-v2-status]').textContent = text; };
  const introLength = () => state.introEnabled ? INTRO_DURATION : 0;
  const duration = () => introLength() + FIRST_STACK_HOLD + state.duration + OUTRO_DURATION;
  function update() {
    $('[data-v2-count]').textContent = `${state.models.filter(Boolean).length} / 5`;
    $('[data-v2-scrub]').max = duration();
    $('[data-v2-generate]').disabled = busy || pending || fontPending || renderError || !renderer || state.introEnabled && !state.intro;
    $('.album-controls').disabled = busy || pending || fontPending;
    canvas.dataset.busy = String(busy || pending || fontPending);
    for (const button of root.querySelectorAll('[data-v2-chapter]')) button.disabled = busy || pending || fontPending;
    for (const selector of ['[data-v2-play]', '[data-v2-scrub]', '[data-v2-close]', '[data-v2-retry]']) $(selector).disabled = busy;
  }
  async function paint() {
    const version = ++paintVersion, at = time;
    if (at < introLength()) await state.intro?.seek(at);
    if (version !== paintVersion || busy) return;
    const ctx = canvas.getContext('2d');
    if (renderer) ctx.drawImage(renderer.draw(at, { introDuration: introLength(), galleryDuration: state.duration, intro: state.intro, labels: state.labels, brand: state.brand }), 0, 0);
    else if (state.intro) ctx.drawImage(state.intro.video, 0, 0, canvas.width, canvas.height);
    const scene = galleryScene(at, introLength(), state.duration);
    canvas.dataset.edit = String(scene.intro && at >= .5 && at < 1.7 && !playing);
    if (canvas.dataset.edit === 'true') textEditor.drawGuides();
    editor.highlight(scene.intro ? -1 : scene.outro ? 5 : scene.index);
    $('[data-v2-preview-title]').textContent = scene.intro ? 'Intro' : scene.outro ? (scene.local < 3.15 ? 'Model lineup' : 'Become Tenzen') : `${state.models[scene.index]?.heading || 'Product'} · ${state.models[scene.index]?.photos[photoScene(scene).to]?.label || 'Shoot'}`;
    $('[data-v2-time]').textContent = `${at.toFixed(1)} / ${duration().toFixed(1)}s`; $('[data-v2-scrub]').value = at;
  }
  const editor = wireGalleryEditor(root, (index, shot = 0) => {
    if (busy || pending || fontPending) return;
    stop(); time = index < 0 ? 1 : index >= 5 ? duration() - .2 : introLength() + FIRST_STACK_HOLD + (index * PRODUCT_DURATION + photoPreviewTime(shot)) * state.duration / GALLERY_DURATION; repaint();
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-v2-shot-preview]'); if (!button || busy || pending || fontPending) return;
    const [index, shot] = button.dataset.v2ShotPreview.split('-').map(Number);
    stop(); time = introLength() + FIRST_STACK_HOLD + (index * PRODUCT_DURATION + photoPreviewTime(shot)) * state.duration / GALLERY_DURATION; repaint();
  });
  const editIntro = () => { time = 1; stop(); repaint(); };
  const textEditor = wireAlbumText(root, canvas, state.labels, editIntro, report, delta => { fontPending += delta; update(); });
  wireIntroControls(root, state, editIntro);
  function repaint() { paint().catch(error => report(error.message)); }
  function stop() { playing = false; cancelAnimationFrame(frame); audioSource?.stop(); audioSource = null; $('[data-v2-play]').textContent = 'Play'; }
  $('[data-v2-play]').addEventListener('click', async () => {
    if (busy || pending || fontPending) return; if (playing) { stop(); return; } if (time >= duration()) time = 0;
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
    productRows($('[data-v2-products]'), state.models, upload, selectedProduct, index => {
      if (selectedProduct === index) return;
      selectedProduct = index;
      if (!busy && !pending) { stop(); time = introLength() + FIRST_STACK_HOLD + (index * PRODUCT_DURATION + photoPreviewTime(0)) * state.duration / GALLERY_DURATION; repaint(); }
      for (const row of root.querySelectorAll('[data-v2-product]')) row.open = +row.dataset.v2Product === index;
    });
    update();
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
    if (busy || pending || fontPending) return; pending = true; update(); $('[data-v2-retry]').hidden = true;
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
    selectedProduct = next;
    [state.models[i], state.models[next]] = [state.models[next], state.models[i]];
    try { await rebuild(); report('Ready.'); } catch (error) { report(error.message); $('[data-v2-retry]').hidden = false; }
    finally { pending = false; rows(); repaint(); }
  });
  root.addEventListener('change', async event => {
    const key = event.target.dataset.v2Upload, file = event.target.files?.[0]; if (!key || !file || busy || pending || fontPending) return;
    stop(); pending = true; update(); report(`Loading ${file.name}…`);
    try {
      if (key === 'music') { state.music = await decodeSfx(await file.arrayBuffer()); $('[data-v2-music-name]').textContent = file.name; }
      else {
        const [kind, index, shot = 0] = key.split('-'), asset = state.models[+index];
        if (kind === 'photo') { let image = await decodeReviewPhoto(file); const scale = Math.min(1, 2560 / Math.max(image.width, image.height)); if (scale < 1) { const resized = new OffscreenCanvas(Math.round(image.width * scale), Math.round(image.height * scale)); resized.getContext('2d').drawImage(image, 0, 0, resized.width, resized.height); image.close?.(); image = await createImageBitmap(resized); } if (+shot >= 2) {
          const { cutoutPerson } = await import('./album-v2-lineup.js');
          const gender = +shot === 2 ? 'man' : 'woman', person = await cutoutPerson(image);
          asset.people ||= {}; asset.people[gender]?.image.close(); asset.people[gender] = person;
        } asset.photos[+shot].image.close?.(); asset.photos[+shot].image = image; if (+shot === 0) asset.image = image; }
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
    if (busy || pending || fontPending || renderError || !renderer || state.introEnabled && !state.intro) return;
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
      const cover = await output.draw(introLength() + FIRST_STACK_HOLD + 2.8 * state.duration / GALLERY_DURATION, options).convertToBlob({ type: 'image/png' });
      onVideo(blob, 'tenzen-album-v2.mp4', cover, +(frames / 60).toFixed(2)); onStatus('Album creator V2 ready.'); report('Reel ready.'); root.hidden = true;
    } catch (error) { report(`Could not generate the reel: ${error.message}`); }
    finally { output?.dispose(); busy = false; update(); }
  });
  return { open() { root.hidden = false; if (!initialized) initialize(); else repaint(); }, close, state };
}
