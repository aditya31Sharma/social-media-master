import { clipRange, introHold, introSourceTime } from './intro-timing.js';
import { loadIntroImage } from './intro-image.js';
import { wireIntroTimeline } from './intro-timeline.js';
import { defaultIntroCrop, drawIntro } from './intro-crop.js';
import { wireIntroVideo } from './album-v2-intro-video.js';
import { wireYouTubeImport } from './youtube-import.js';
import { musicControls, wireMusicEditor } from './album-v2-audio-ui.js';
import { schedulePaint } from './editor-performance.js';
import { prepareExportMedia } from './album-v2-export-media.js';
import { wireEndingAnimation } from './album-v2-animation-controls.js';
import { BRAND_ENTRANCE, endingDuration } from './album-v2-brand-motion.js';
import { wireValueSliders, wireLayerInspector } from './album-v2-inspector.js';
import { wireCanvasEditor } from './album-v2-canvas-editor.js';
import { introBrand, wireArtworkControls } from './album-v2-artwork.js';
import { endingDefaults, endingControls, wireEndingControls } from './album-v2-ending.js';
import { wireAlbumText } from './album-text.js';
import { wireGalleryEditor, productRows, photoPreviewTime } from './album-v2-editor.js';
import { v2Defaults, loadShoot, loadIntro } from './album-v2-media.js';
import { PRODUCT_ORDER, FIRST_STACK_HOLD, GALLERY_DURATION, PRODUCT_DURATION, galleryScene, photoScene } from './album-v2-motion.js';
import { introLabels, introControls } from './album-v2-labels.js';
import { decodeReviewPhoto } from '../stories/heic.js';
import { decodeSfx, encodeAudio, audioSupported } from './audio.js';
import { encodeToMp4, supported } from './encode.js';
const upload = (key, label, accept) => `<label class="btn album-upload">${label}<input type="file" data-v2-upload="${key}" accept="${accept}"></label>`;
export function createAlbumV2UI({ onVideo, onStatus }) {
  const root = document.createElement('div'); root.id = 'albumV2Setup'; root.className = 'setup album-setup'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Album creator V2');
  root.innerHTML = `<header class="setup__head"><button type="button" class="round" data-v2-close aria-label="Close album creator V2"><svg viewBox="0 0 24 24"><use href="#i-left"/></svg></button><span class="setup__title"><strong>Album creator V2</strong><em>Winter intro · Shoot gallery · 3D garments</em></span></header>
    <div class="album-body"><section class="album-preview"><p class="v2-preview-title" data-v2-preview-title>Intro</p><canvas width="360" height="640" tabindex="0" aria-label="Album creator V2 preview. Select and drag text, logos or the ending models. Drag corner handles to resize text and artwork, or use arrow keys to move them."></canvas><div class="album-playback"><button type="button" class="btn" data-v2-play>Play</button><output data-v2-time>0.0s</output></div><input type="range" data-v2-scrub min="0" max="41.8" value="0" step=".01" aria-label="V2 preview time"></section>
    <fieldset class="album-controls"><legend class="sr-only">Album creator V2 settings</legend>
    ${introControls()}
    <details open><summary>Products <span data-v2-count>0 / 5</span></summary><p class="note">Shoot → Macro → Full-body model. Men and women alternate by product. Tap an image to preview it.</p><div data-v2-products></div></details>
    ${endingControls()}
    <details><summary>Audio</summary><h3>Soundtrack</h3><div data-v2-youtube></div>${upload('music','Add gallery music','audio/*')}<p class="note" data-v2-music-name>No music selected</p><button type="button" class="btn" data-v2-remove-music>Remove music</button>${musicControls()}</details>
    <details><summary>Export</summary><h3>Output settings</h3><label class="field"><span>Reel duration</span><select class="input" data-v2-duration><option value="32">41.8 seconds total</option><option value="22">31.8 seconds total</option><option value="45">54.8 seconds total</option><option value="40">49.8 seconds total</option><option value="23">32.8 seconds total</option><option value="30">39.8 seconds total</option></select></label><p class="note" data-v2-duration-note></p><label class="field"><span>Resolution</span><select class="input" data-v2-resolution><option value="1080">1080 × 1920</option><option value="720">720 × 1280</option></select></label></details></fieldset></div>
    <footer class="album-footer"><p class="note" data-v2-status role="status">Loading the gallery…</p><button class="btn" type="button" data-v2-retry hidden>Retry</button><button class="btn btn--primary" type="button" data-v2-generate disabled>Generate reel</button></footer>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector), canvas = $('canvas');
  const state = { models: Array(5).fill(null), intro: null, introCrop: defaultIntroCrop(), introRange: { start: 0, end: 3.5 }, introStillDuration: 3.5, introEnabled: true, introSound: false, music: null, duration: GALLERY_DURATION, gain: .75, ending: endingDefaults(), labels: introLabels(), brand: introBrand() };
  let sourceTimeOverride = null, selectionPlayback = false;
  let selectedProduct = 0, renderer = null, previewPending = false, renderError = false, busy = false, pending = false, fontPending = 0, playing = false, playbackVersion = 0, time = 1, frame = 0, paintVersion = 0, initialized = false;
  const report = text => { $('[data-v2-status]').textContent = text; };
  const introLength = () => state.introEnabled ? introHold(state) + 1.3 : 0;
  const duration = () => introLength() + FIRST_STACK_HOLD + state.duration + endingDuration(state.ending);
  const audioEditor = wireMusicEditor(root, { state, duration, beforePlay: stop, changed: stop, report });
  wireYouTubeImport($('[data-v2-youtube]'), { busy: () => busy || pending || !!fontPending, load: async file => {
    stop(); pending = true; update();
    try { await setMusic(file); report('Ready.'); } finally { pending = false; update(); }
  } });
  async function setMusic(file) {
    state.music = await decodeSfx(await file.arrayBuffer());
    $('[data-v2-music-name]').textContent = file.name; audioEditor.reset();
  }
  function update() {
    audioEditor.sync();
    $('[data-v2-duration-note]').textContent = `${introHold(state).toFixed(2)}s intro + 1.3s transition · ${FIRST_STACK_HOLD}s stack hold · ${state.duration}s products · ${endingDuration(state.ending).toFixed(2)}s ending`;
    $('[data-v2-count]').textContent = `${state.models.filter(Boolean).length} / 5`;
    $('[data-v2-scrub]').max = duration();
    for (const option of $('[data-v2-duration]').options) option.textContent = `${(+option.value + introLength() + FIRST_STACK_HOLD + endingDuration(state.ending)).toFixed(2).replace(/0$/, '')} seconds total`;
    $('[data-v2-generate]').disabled = busy || pending || previewPending || fontPending || renderError || !renderer || state.introEnabled && !state.intro;
    $('.album-controls').disabled = busy || pending || fontPending;
    canvas.dataset.busy = String(busy || pending || fontPending);
    for (const button of root.querySelectorAll('[data-v2-chapter]')) button.disabled = busy || pending || fontPending;
    for (const selector of ['[data-v2-play]', '[data-v2-scrub]', '[data-v2-close]', '[data-v2-retry]']) $(selector).disabled = busy;
  }
  async function paint() {
    if (root.hidden || busy) return;
    const version = ++paintVersion, at = time, intro = state.intro;
    try {
      if (at < introLength()) await intro?.seek(sourceTimeOverride ?? introSourceTime(at, intro.duration, state.introRange));
    } catch (error) {
      if (version !== paintVersion || intro !== state.intro || root.hidden) return;
      throw error;
    }
    if (version !== paintVersion || busy) return;
    const ctx = canvas.getContext('2d');
    if (renderer) ctx.drawImage(renderer.draw(at, { introDuration: introLength(), galleryDuration: state.duration, intro: state.intro, introCrop: state.introCrop, labels: state.labels, brand: state.brand, ending: state.ending }), 0, 0);
    else if (state.intro) drawIntro(ctx, state.intro.video, state.introCrop, canvas.width, canvas.height);
    const scene = galleryScene(at, introLength(), state.duration);
    canvas.dataset.section = scene.intro ? 'intro' : scene.outro ? 'outro' : '';
    canvas.dataset.edit = String(!playing && (scene.intro && at < introHold(state) || scene.outro && scene.local >= endingDuration(state.ending) - .4));
    if (introVideo.active) introVideo.drawGuides();
    else if (canvas.dataset.edit === 'true') canvasEditor.drawGuides();
    introTimeline.showTime(state.intro?.video.currentTime);
    editor.highlight(scene.intro ? -1 : scene.outro ? 5 : scene.index);
    editor.timeline({ intro: introLength(), gallery: state.duration, ending: endingDuration(state.ending), time: at });
    $('[data-v2-preview-title]').textContent = scene.intro ? 'Intro' : scene.outro ? (scene.local < 3.15 ? 'Model lineup' : 'Become Tenzen') : `${state.models[scene.index]?.heading || 'Product'} · ${state.models[scene.index]?.photos[photoScene(scene).to]?.label || 'Shoot'}`;
    $('[data-v2-time]').textContent = `${at.toFixed(1)} / ${duration().toFixed(1)}s`; $('[data-v2-scrub]').value = at;
  }
  const editor = wireGalleryEditor(root, (index, shot = 0) => {
    if (busy || pending || fontPending) return;
    stop(); time = index < 0 ? Math.min(1, introHold(state) / 2) : index >= 5 ? duration() - .2 : introLength() + FIRST_STACK_HOLD + (index * PRODUCT_DURATION + photoPreviewTime(shot)) * state.duration / GALLERY_DURATION; repaint();
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-v2-shot-preview]'); if (!button || busy || pending || fontPending) return;
    const [index, shot] = button.dataset.v2ShotPreview.split('-').map(Number);
    stop(); time = introLength() + FIRST_STACK_HOLD + (index * PRODUCT_DURATION + photoPreviewTime(shot)) * state.duration / GALLERY_DURATION; repaint();
  });
  const editIntro = () => { const sourceAt = sourceTimeOverride; stop(); sourceTimeOverride = sourceAt; time = Math.min(1, introHold(state) / 2); repaint(); };
  const editEnding = () => { stop(); update(); time = duration() - .2; repaint(); };
  const fontBusy = delta => { fontPending += delta; update(); };
  const textEditor = wireAlbumText($('#v2IntroEditor'), canvas, state.labels, editIntro, report, fontBusy, { nativeFonts: true, directManipulation: false, isActive: () => canvas.dataset.section === 'intro' });
  const outroEditor = wireAlbumText($('#v2OutroEditor'), canvas, state.ending.labels, editEnding, report, fontBusy, { nativeFonts: true, directManipulation: false, isActive: () => canvas.dataset.section === 'outro' });
  const introArtwork = wireArtworkControls($('#v2IntroEditor'), state, editIntro);
  const outroArtwork = wireArtworkControls($('#v2OutroEditor'), state.ending, editEnding);
  const endingEditor = wireEndingControls(root, state.ending, () => { outroEditor.sync(); outroArtwork.sync(); editEnding(); });
  let introVideo;
  const introInspector = wireLayerInspector($('#v2IntroEditor'), textEditor, introArtwork, { changed: editIntro, onSelect: id => { if (typeof introVideo !== 'undefined') introVideo.select(id === 'background'); } });
  const animationEditor = wireEndingAnimation($('#v2OutroEditor'), state.ending, editEnding, () => { stop(); time = introLength() + FIRST_STACK_HOLD + state.duration + BRAND_ENTRANCE.start - .25; $('[data-v2-play]').click(); });
  const outroInspector = wireLayerInspector($('#v2OutroEditor'), outroEditor, outroArtwork, { ending: true, changed: editEnding, onSelect: id => animationEditor.select(id) });
  const valueSliders = wireValueSliders(root);
  const canvasEditor = wireCanvasEditor(canvas, { state, introInspector, outroInspector, endingLayout: () => renderer?.endingLayout(state.ending), changed: section => {
    if (section === 'intro') { textEditor.sync(); introArtwork.sync(); editIntro(); }
    else { outroEditor.sync(); outroArtwork.sync(); endingEditor.sync(); editEnding(); }
  } });
  introVideo = wireIntroVideo(root, canvas, { state, changed: editIntro });
  const introTimeline = wireIntroTimeline(root, { state, changed: () => { update(); editIntro(); }, preview: at => { stop(); sourceTimeOverride = at; time = Math.min(1, introHold(state) / 2); repaint(); }, play: () => { stop(); time = 0; $('[data-v2-play]').click(); selectionPlayback = true; } });
  introVideo.select(true);
  const queuePaint = schedulePaint(paint, error => report(error.message));
  function repaint() { paintVersion++; introVideo.sync(); introTimeline.sync(); valueSliders.sync(); queuePaint(); }
  function stop() { sourceTimeOverride = null; selectionPlayback = false; playbackVersion++; playing = false; cancelAnimationFrame(frame); audioEditor.stop(); $('[data-v2-play]').textContent = 'Play'; }
  $('[data-v2-play]').addEventListener('click', async () => {
    if (busy || pending || fontPending) return; if (playing) { stop(); return; } if (time >= duration()) time = 0;
    const playback = ++playbackVersion;
    playing = true; $('[data-v2-play]').textContent = 'Pause';
    try {
    await audioEditor.play(time);
    if (!playing || busy || root.hidden || playback !== playbackVersion) return;
    } catch (error) { stop(); report(error.message); return; }
    const start = performance.now() - time * 1000;
    const tick = async now => { if (!playing || busy || playback !== playbackVersion) return; time = Math.min(selectionPlayback ? introHold(state) : duration(), (audioEditor.clock() ?? (now - start) / 1000)); try { await paint(); } catch (error) { report(error.message); stop(); } if (playing && time < (selectionPlayback ? introHold(state) : duration())) frame = requestAnimationFrame(tick); else stop(); };
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
    const next = await createGalleryRenderer(state.models.map(asset => ({ ...asset })), { deferProducts: true });
    renderer?.dispose(); renderer = next; renderError = false; previewPending = true; $('[data-v2-retry]').hidden = true;
    next.ready.then(() => {
      if (renderer !== next) return;
      previewPending = false; if (!busy) report('Ready.'); update(); repaint();
    }).catch(error => {
      if (renderer !== next) return;
      previewPending = false; renderError = true; report(`Could not load the gallery: ${error.message}`); $('[data-v2-retry]').hidden = false; update();
    });
  }
  async function initialize() {
    if (busy || pending || fontPending) return; pending = true; update(); $('[data-v2-retry]').hidden = true;
    try {
      await Promise.all([document.fonts.load('400 44px Geist'), document.fonts.load('400 220px CarolGothic')]);
      const products = await v2Defaults();
      const results = await Promise.allSettled([
        ...PRODUCT_ORDER.map(async (source, i) => { if (!state.models[i]) state.models[i] = await loadShoot(products[source], { preview: true }); }),
        (async () => { if (!state.intro) { state.intro = await loadIntro(null, { preview: true }); state.introRange = clipRange(state.intro.duration); repaint(); } })(),
      ]);
      rows(); const failure = results.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
      await rebuild(); initialized = true; if (!previewPending) report('Ready.');
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
    try { await rebuild(); if (!previewPending) report('Ready.'); } catch (error) { report(error.message); $('[data-v2-retry]').hidden = false; }
    finally { pending = false; rows(); repaint(); }
  });
  root.addEventListener('change', async event => {
    const key = event.target.dataset.v2Upload, file = event.target.files?.[0]; if (!key || !file || busy || pending || fontPending) return;
    stop(); paintVersion++; pending = true; update(); report(`Loading ${file.name}…`);
    try {
      if (key === 'music') { await setMusic(file); }
      else if (key === 'intro' || key === 'intro-image') {
        const next = key === 'intro-image' ? await loadIntroImage(file) : await loadIntro(file), previous = state.intro;
        paintVersion++; state.intro = next; state.introRange = next.kind === 'image' ? { start: 0, end: 3.5 } : clipRange(next.duration); state.introCrop = defaultIntroCrop(); time = 1; previous?.dispose();
        if (!renderError) $('[data-v2-retry]').hidden = true;
      }
      else {
        const [kind, index, shot = 0] = key.split('-'), asset = state.models[+index];
        if (kind === 'photo') { let image = await decodeReviewPhoto(file); const scale = Math.min(1, 2560 / Math.max(image.width, image.height)); if (scale < 1) { const resized = new OffscreenCanvas(Math.round(image.width * scale), Math.round(image.height * scale)); resized.getContext('2d').drawImage(image, 0, 0, resized.width, resized.height); image.close?.(); image = await createImageBitmap(resized); } if (+shot >= 2) {
          const { cutoutPerson } = await import('./album-v2-lineup.js');
          const gender = +shot === 2 ? 'man' : 'woman', person = await cutoutPerson(image);
          asset.people ||= {}; asset.people[gender]?.image.close(); asset.people[gender] = person;
        } asset.photos[+shot].image.close?.(); asset.photos[+shot].image = image; asset.photos[+shot].preview = false; if (+shot === 0) asset.image = image; }
        else { if (asset.glb.startsWith('blob:')) URL.revokeObjectURL(asset.glb); asset.glb = URL.createObjectURL(file); }
        await rebuild();
      }
      if (!previewPending) report('Ready.');
    } catch (error) { report(`Could not load this file: ${error.message}`); $('[data-v2-retry]').hidden = false; }
    finally { pending = false; event.target.value = ''; rows(); repaint(); }
  });
  $('[data-v2-duration]').addEventListener('change', event => { stop(); state.duration = +event.target.value; time = 0; update(); repaint(); });
  $('[data-v2-remove-music]').addEventListener('click', () => { stop(); state.music = null; $('[data-v2-music-name]').textContent = 'No music selected'; audioEditor.reset(); });
  function close() { if (busy) return; stop(); root.hidden = true; }
  $('[data-v2-close]').addEventListener('click', close);
  $('[data-v2-generate]').addEventListener('click', async () => {
    if (busy || pending || previewPending || fontPending || renderError || !renderer || state.introEnabled && !state.intro) return;
    stop(); busy = true; paintVersion++; update(); let output = null, exportMedia = null;
    try {
      const width = +$('[data-v2-resolution]').value, height = width * 16 / 9, total = duration(), frames = Math.ceil(total * 60);
      const support = await supported(width, height); if (!support.ok) throw new Error(support.why);
      await document.fonts.ready; report('Preparing full-quality 3D garments…');
      exportMedia = await prepareExportMedia(state.models, state.intro, state.introEnabled);
      const { createGalleryRenderer } = await import('./album-v2-render.js'); output = await createGalleryRenderer(exportMedia.models, { width, height, preview: false });
      const audio = audioEditor.mix(frames / 60);
      if (audio && !(await audioSupported())) throw new Error('This browser cannot export audio. Turn off audio or use Chrome.');
      const options = { introDuration: introLength(), galleryDuration: state.duration, intro: exportMedia.intro, introCrop: state.introCrop, labels: state.labels, brand: state.brand, ending: state.ending };
      const blob = await encodeToMp4({ width, height, fps: 60, frames, audio, encodeAudio,
        draw: async frame => { const t = frame / 60; if (t < introLength()) await exportMedia.intro.seek(introSourceTime(t, exportMedia.intro.duration, state.introRange)); return output.draw(t, options); },
        onProgress: p => report(`Generating reel… ${Math.round(p * 100)}%`),
      });
      const cover = await output.draw(introLength() + FIRST_STACK_HOLD + photoPreviewTime(2) * state.duration / GALLERY_DURATION, options).convertToBlob({ type: 'image/png' });
      onVideo(blob, 'tenzen-album-v2.mp4', cover, +(frames / 60).toFixed(2)); onStatus('Album creator V2 ready.'); report('Reel ready.'); root.hidden = true;
    } catch (error) { report(`Could not generate the reel: ${error.message}`); }
    finally { output?.dispose(); exportMedia?.dispose(); busy = false; update(); }
  });
  return { open() { root.hidden = false; if (!initialized) initialize(); else repaint(); }, close, state };
}
