import { albumTextControls } from './album-text-controls.js';
import { albumDefaults, loadAlbumDefault } from './album-defaults.js';
import { defaultLabels, wireAlbumText } from './album-text.js';
import { drawAlbum, cropToAlpha } from './album-render.js';
import { ALBUM_DURATION, hasIntro } from './album-motion.js';
import { decodeReviewPhoto } from '../stories/heic.js';
import { matteForBlob } from './cutout.js';
import { supported, encodeToMp4 } from './encode.js';
import { decodeSfx, mixTrack, encodeAudio, audioSupported } from './audio.js';

const imageAccept = 'image/*,.heic,.heif';
const upload = (key, title, accept = imageAccept) => `<label class="btn album-upload">${title}<input type="file" data-upload="${key}" accept="${accept}"></label>`;

export function createAlbumUI({ onVideo, onStatus }) {
  const root = document.createElement('div');
  root.id = 'albumSetup'; root.className = 'setup album-setup'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Album showcase');
  root.innerHTML = `
    <header class="setup__head"><button type="button" class="round" data-album-close aria-label="Close album showcase"><svg viewBox="0 0 24 24"><use href="#i-left"/></svg></button><span class="setup__title"><strong>Album showcase</strong><em data-duration-title>Five models · 20 seconds</em></span></header>
    <div class="album-body">
      <section class="album-preview" aria-label="Live preview">
        <canvas width="360" height="640" tabindex="0" aria-label="Album preview. Drag text to position it, or use arrow keys."></canvas>
        <div class="album-playback"><button type="button" class="btn" data-play>Play</button><button type="button" class="btn" data-edit-intro>Edit intro</button><output data-time>0.0s</output></div>
        <input type="range" data-scrub min="0" max="20" step="0.01" value="0" aria-label="Preview time">
      </section>
      <fieldset class="album-controls">
        <legend class="sr-only">Album settings</legend>
        <details open><summary>Five models <span data-count>0 / 5</span></summary><p class="note">The five SKU photos load with transparent backgrounds. You can replace or reorder them.</p><button type="button" class="btn" data-defaults>Load missing SKU photos</button><button type="button" class="btn" data-retry-3d hidden>Retry 3D garments</button><div class="album-models"></div></details>
        <details><summary>Album intro</summary>
          <label class="check"><input type="checkbox" data-intro-enabled><span>Include intro</span></label>
          <label class="check"><input type="checkbox" data-cover-enabled checked><span>Show album cover</span></label>
          <div class="album-cover-row">${upload('cover', 'Choose cover')}<span class="note" data-cover-name>No cover selected</span></div>
          ${albumTextControls()}
        </details>
        <details><summary>Sound and export</summary>
          <label class="field"><span>Duration</span><select class="input" data-duration><option value="20">20 seconds</option><option value="30">30 seconds</option><option value="45">45 seconds</option></select></label>
          ${upload('music', 'Add music', 'audio/*')}<p class="note" data-music-name>No music selected</p>
          <div class="album-grid"><label class="field"><span>Start at (seconds)</span><input class="input" data-music-start type="number" min="0" step=".1" value="0"></label><label class="field"><span>Volume %</span><input class="input" data-music-volume type="number" min="0" max="100" value="100"></label></div>
          <button type="button" class="btn" data-remove-music>Remove music</button>
          <label class="field"><span>Resolution</span><select class="input" data-resolution><option value="1080">1080 × 1920</option><option value="720">720 × 1280</option></select></label>
        </details>
      </fieldset>
    </div>
    <footer class="album-footer"><p class="note" role="status" data-status>Add five model photos to generate the reel.</p><button type="button" class="btn btn--primary" data-generate disabled>Generate reel</button></footer>`;
  document.body.append(root);
  const $ = s => root.querySelector(s), canvas = $('canvas');
  const state = { models: Array(5).fill(null), labels: defaultLabels(), cover: null, coverEnabled: true, music: null, introEnabled: false, duration: ALBUM_DURATION };
  let editing = false, time = 0, playing = false, raf = 0, busy = false, pending = 0;
  let products = null, productSignature = '', productVersion = 0, productsError = false;
  const versions = Array(5).fill(0), frontVersions = Array(5).fill(0), glbVersions = Array(5).fill(0); let coverVersion = 0, musicVersion = 0;
  function report(message) { $('[data-status]').textContent = message; }
  const textEditor = wireAlbumText(root, canvas, state.labels, edit => { if (edit) { editing = true; stop(); } paint(); }, report, delta => { pending += delta; updateReady(); });
  function paint() {
    canvas.dataset.edit = String(editing); canvas.dataset.busy = String(busy);
    drawAlbum(canvas, state, time, { edit: editing, products }); textEditor.drawGuides();
    $('[data-time]').textContent = `${time.toFixed(1)}s`; $('[data-scrub]').value = time;
    $('[data-edit-intro]').setAttribute('aria-pressed', String(editing));
  }
  function stop() { playing = false; cancelAnimationFrame(raf); $('[data-play]').textContent = 'Play'; }
  $('[data-play]').addEventListener('click', () => {
    if (playing) { stop(); return; }
    if (editing || time >= state.duration) time = 0; editing = false;
    playing = true; $('[data-play]').textContent = 'Pause'; let then = performance.now();
    const tick = now => { if (!playing) return; time = Math.min(state.duration, time + (now - then) / 1000); then = now; paint(); if (time < state.duration) raf = requestAnimationFrame(tick); else stop(); };
    raf = requestAnimationFrame(tick);
  });
  $('[data-edit-intro]').addEventListener('click', () => { stop(); editing = true; time = 2.4; paint(); });
  $('[data-scrub]').addEventListener('input', event => { stop(); editing = false; time = +event.target.value; paint(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  function updateReady() {
    const count = state.models.filter(Boolean).length;
    $('[data-count]').textContent = `${count} / 5`;
    $('[data-generate]').disabled = busy || pending > 0 || count !== 5 || productsError;
  }
  function drawModels() {
    const host = $('.album-models'); host.replaceChildren();
    state.models.forEach((asset, i) => {
      const row = document.createElement('div'); row.className = 'album-model';
      row.innerHTML = `<span class="album-model__number">${i + 1}</span><div class="album-model__thumb"></div><div class="album-model__actions">${upload(String(i), asset ? 'Replace photo' : 'Add photo')}<button type="button" class="btn" data-cut="${i}" ${asset && !pending ? '' : 'disabled'}>Remove background</button></div><div class="album-order"><button type="button" class="btn" data-move="${i}" data-direction="-1" aria-label="Move model ${i + 1} earlier" ${i === 0 || pending ? 'disabled' : ''}>↑</button><button type="button" class="btn" data-move="${i}" data-direction="1" aria-label="Move model ${i + 1} later" ${i === 4 || pending ? 'disabled' : ''}>↓</button></div>`;
      if (asset) {
        const thumb = document.createElement('canvas'); thumb.width = 60; thumb.height = 80;
        const c = thumb.getContext('2d'), crop = asset.crop, ratio = Math.min(60 / crop.w, 80 / crop.h);
        c.drawImage(asset.image, crop.x, crop.y, crop.w, crop.h, (60 - crop.w * ratio) / 2, (80 - crop.h * ratio) / 2, crop.w * ratio, crop.h * ratio);
        row.querySelector('.album-model__thumb').append(thumb);
      }
      if (asset) {
        const details = document.createElement('div'); details.className = 'album-model__product';
        details.innerHTML = `<label class="field"><span>Product name</span><input class="input" data-product-name="${i}" maxlength="160"></label><div class="album-button-row" data-photo-controls>${upload(`front-${i}`, 'Front image')}<span class="note" data-front-status></span></div>`;
        const mode = document.createElement('label'); mode.className = 'field';
        mode.innerHTML = `<span>Product detail</span><select class="input" data-detail-mode="${i}"><option value="3d">Rotating 3D garment</option><option value="photo">Front image</option></select>`;
        mode.querySelector('select').value = asset.detailMode || 'photo'; details.append(mode);
        const modelUpload = document.createElement('div'); modelUpload.dataset.glbControls = ''; modelUpload.hidden = asset.detailMode === 'photo'; modelUpload.innerHTML = upload(`glb-${i}`, 'Choose 3D garment', '.glb'); details.append(modelUpload);
        details.querySelector('input[data-product-name]').value = asset.productName || '';
        details.querySelector('[data-photo-controls]').hidden = asset.detailMode !== 'photo';
        details.querySelector('[data-front-status]').textContent = asset.front ? 'Front image ready' : 'No front image selected';
        row.append(details);
      }
      host.append(row);
    }); updateReady();
  }
  root.addEventListener('change', async event => {
    const key = event.target.dataset.upload, file = event.target.files?.[0];
    if (key === undefined || !file) return;
    const isFront = key.startsWith('front-'), isGlb = key.startsWith('glb-'), slot = isFront ? +key.slice(6) : isGlb ? +key.slice(4) : +key;
    const request = isGlb ? ++glbVersions[slot] : isFront ? ++frontVersions[slot] : key === 'cover' ? ++coverVersion : key === 'music' ? ++musicVersion : ++versions[+key];
    pending++; updateReady(); report(`Loading ${file.name}…`);
    try {
      if (isGlb) {
        const asset = state.models[slot]; if (!asset) return;
        if (asset.glb?.startsWith('blob:')) URL.revokeObjectURL(asset.glb);
        asset.glb = URL.createObjectURL(file); asset.detailMode = '3d';
      } else if (key === 'music') {
        const music = await decodeSfx(await file.arrayBuffer());
        if (request !== musicVersion) return;
        state.music = music; $('[data-music-name]').textContent = file.name;
      } else {
        let image = await decodeReviewPhoto(file);
        const ratio = Math.min(1, 2560 / Math.max(image.width, image.height));
        if (ratio < 1) {
          const resized = new OffscreenCanvas(Math.round(image.width * ratio), Math.round(image.height * ratio));
          resized.getContext('2d').drawImage(image, 0, 0, resized.width, resized.height);
          image.close?.(); image = await createImageBitmap(resized);
        }
        if (request !== (isFront ? frontVersions[slot] : key === 'cover' ? coverVersion : versions[+key])) { image.close?.(); return; }
        const asset = { image, blob: file, crop: cropToAlpha(image) };
        if (isFront) {
          if (!state.models[slot]) { image.close?.(); return; }
          state.models[slot].front?.close?.(); state.models[slot].front = image; state.models[slot].frontCrop = asset.crop;
        } else if (key === 'cover') { state.cover?.image.close?.(); state.cover = asset; $('[data-cover-name]').textContent = file.name; editing = true; }
        else { state.models[+key]?.image.close?.(); state.models[+key] = { detailMode: 'photo', ...state.models[+key], ...asset }; editing = false; time = 0; }
      }
      report('Ready.'); paint();
    } catch (error) { report(`Could not load this file: ${error.message}`); }
    finally { await refreshProducts(); pending--; event.target.value = ''; drawModels(); }
  });
  root.addEventListener('click', async event => {
    const move = event.target.closest('[data-move]'), cut = event.target.closest('[data-cut]');
    if (move && !pending && !busy) {
      const a = +move.dataset.move, b = a + +move.dataset.direction;
      [state.models[a], state.models[b]] = [state.models[b], state.models[a]]; drawModels(); paint();
    }
    if (!cut || busy) return;
    const i = +cut.dataset.cut, asset = state.models[i]; if (!asset) return;
    const request = ++versions[i]; pending++; drawModels(); report('Removing background on this device. The first image takes longer.');
    try {
      const source = new OffscreenCanvas(asset.image.width, asset.image.height);
      source.getContext('2d').drawImage(asset.image, 0, 0);
      const matte = await matteForBlob(await source.convertToBlob({ type: 'image/png' }));
      if (request !== versions[i] || state.models[i] !== asset) { matte.close(); return; }
      const cv = new OffscreenCanvas(asset.image.width, asset.image.height), g = cv.getContext('2d');
      g.drawImage(asset.image, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(matte, 0, 0, cv.width, cv.height); matte.close();
      const image = await createImageBitmap(cv);
      if (request !== versions[i] || state.models[i] !== asset) { image.close(); return; }
      const crop = cropToAlpha(image); asset.image.close?.(); asset.image = image; asset.crop = crop;
      report('Background removed.'); paint();
    } catch (error) { report(`Background removal failed: ${error.message}. You can use a transparent image instead.`); }
    finally { pending--; drawModels(); }
  });
  root.addEventListener('input', event => {
    const index = event.target.dataset.productName;
    if (index !== undefined && state.models[+index]) { state.models[+index].productName = event.target.value; paint(); }
  });
  $('[data-intro-enabled]').addEventListener('change', event => { state.introEnabled = event.target.checked; stop(); editing = false; time = 0; paint(); });
  $('[data-duration]').addEventListener('change', event => {
    state.duration = +event.target.value; $('[data-scrub]').max = state.duration;
    $('[data-duration-title]').textContent = `Five models · ${state.duration} seconds`;
    stop(); time = 0; editing = false; paint();
  });
  async function refreshProducts() {
    if (state.models.some(model => !model)) return;
    const signature = state.models.map(asset => asset.detailMode === 'photo' ? 'photo' : asset.glb || 'missing').sort().join('|');
    if (products && signature === productSignature && !productsError) return;
    const request = ++productVersion; pending++; updateReady(); report('Loading rotating 3D garments…');
    try {
      const { createAlbumProducts } = await import('./album-product.js');
      const next = await createAlbumProducts(state.models.map(asset => ({ ...asset })));
      if (request !== productVersion) { next.dispose(); return; }
      products?.dispose(); products = next; productSignature = signature; productsError = false;
      $('[data-retry-3d]').hidden = true; report('Ready.'); paint();
    } catch (error) {
      if (request === productVersion) {
        productsError = true; $('[data-retry-3d]').hidden = false;
        report(`Could not load 3D garments: ${error.message}. Retry or choose another garment.`);
      }
    } finally { pending--; updateReady(); }
  }
  $('[data-retry-3d]').addEventListener('click', refreshProducts);
  root.addEventListener('change', async event => {
    const index = event.target.dataset.detailMode;
    if (index === undefined || busy) return;
    state.models[+index].detailMode = event.target.value;
    drawModels(); await refreshProducts(); paint();
  });
  let loadingDefaults = false;
  async function preloadDefaults() {
    if (loadingDefaults || busy) return;
    loadingDefaults = true; pending++; drawModels(); report('Loading the five SKU photos…');
    $('[data-defaults]').disabled = true;
    const requests = versions.map((version, i) => state.models[i] ? null : ++versions[i]);
    try {
      const products = await albumDefaults();
      const results = await Promise.allSettled(products.map(async (product, i) => {
        if (requests[i] === null) return;
        const asset = await loadAlbumDefault(product);
        if (requests[i] !== versions[i]) { asset.image.close(); asset.front.close(); return; }
        state.models[i] = asset; drawModels(); paint();
      }));
      const failed = results.filter(result => result.status === 'rejected');
      report(failed.length ? 'Some SKU photos could not load. Use Load missing SKU photos to retry.' : 'Ready.');
    } catch (error) { report(error.message); }
    finally { await refreshProducts(); loadingDefaults = false; pending--; $('[data-defaults]').disabled = false; drawModels(); }
  }
  $('[data-defaults]').addEventListener('click', preloadDefaults);
  $('[data-cover-enabled]').addEventListener('change', event => { state.coverEnabled = event.target.checked; editing = true; stop(); paint(); });
  $('[data-remove-music]').addEventListener('click', () => { musicVersion++; state.music = null; $('[data-music-name]').textContent = 'No music selected'; });
  function close() { if (busy) return; stop(); root.hidden = true; }
  $('[data-album-close]').addEventListener('click', close);
  $('[data-generate]').addEventListener('click', async () => {
    if (busy || pending || state.models.some(model => !model)) return;
    const start = +$('[data-music-start]').value, volume = +$('[data-music-volume]').value;
    if (state.music && (!Number.isFinite(start) || start < 0 || start >= state.music.duration || volume < 0 || volume > 100)) { report('Choose a music start within the track and volume from 0 to 100.'); return; }
    busy = true; stop(); updateReady(); $('.album-controls').disabled = true; $('[data-album-close]').disabled = true;
    canvas.dataset.busy = 'true';
    let exportProducts = null;
    try {
      const width = +$('[data-resolution]').value, height = width * 16 / 9;
      const support = await supported(width, height); if (!support.ok) throw new Error(support.why);
      await document.fonts.ready;
      report('Preparing full-quality 3D garments…');
      const { createAlbumProducts } = await import('./album-product.js');
      exportProducts = await createAlbumProducts(state.models, false);
      const output = new OffscreenCanvas(width, height);
      const audio = state.music ? mixTrack(null, [], state.duration, { music: state.music, musicStart: start, musicGain: volume / 100 }) : null;
      if (audio && !(await audioSupported())) throw new Error('This browser cannot export audio. Remove music or use Chrome.');
      const blob = await encodeToMp4({ width, height, fps: 60, frames: Math.round(state.duration * 60), draw: i => drawAlbum(output, state, i / 60, { products: exportProducts }), audio, encodeAudio, onProgress: n => report(`Generating reel… ${Math.round(n * 100)}%`) });
      drawAlbum(output, state, hasIntro(state) ? 2.4 : state.duration, { edit: hasIntro(state), products: exportProducts });
      const cover = await output.convertToBlob({ type: 'image/png' });
      onVideo(blob, 'tenzen-angels-album-reel.mp4', cover, state.duration); report('Reel ready.'); onStatus('Album showcase ready.'); root.hidden = true;
    } catch (error) { report(`Could not generate the reel: ${error.message}`); }
    finally { exportProducts?.dispose(); busy = false; $('.album-controls').disabled = false; $('[data-album-close]').disabled = false; canvas.dataset.busy = 'false'; updateReady(); }
  });
  drawModels(); paint();
  return { open() { root.hidden = false; paint(); if (state.models.some(model => !model)) preloadDefaults(); }, close, state };
}
