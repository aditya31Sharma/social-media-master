/* The reel panel.

   Two products in, one mp4 out. The panel's whole job is choosing: which
   garment on top, which underneath, and which photographs run in each of the
   four corners. Everything else the board already decides.

   Kept apart from the carousel's code on purpose. The two templates share the
   catalogue and the framing maths and nothing else, and folding the reel into
   the carousel's state would make both harder to read. */

import { readProduct, splitTitle, sized, loadModelIndex } from './shopify.js';
import { createReel, allPhotos } from './reel.js';
import { encodeToMp4, supported } from './encode.js';
import * as G from './reel-geom.js';

const $ = s => document.querySelector(s);

/* Each corner names the garment it belongs to, which is what fills its
   picker. Straight off the board: the top garment holds the two upper
   corners, the bottom garment the two lower ones. */
const SLOTS = [
  { key: 'tl', from: 'top',    label: 'Top left' },
  { key: 'tr', from: 'top',    label: 'Top right' },
  { key: 'bl', from: 'bottom', label: 'Bottom left' },
  { key: 'br', from: 'bottom', label: 'Bottom right' },
];

export function createReelUI({ catalogue, onStatus, onVideo, openPicker, openAdjust }) {
  const state = {
    top: null, bottom: null, models: null,
    slots: { tl: [], tr: [], bl: [], br: [] },
    adjusts: { tl: {}, tr: {}, bl: {}, br: {} },
    size: 1080,
    busy: false,
  };

  /* The reel turns the garment, so a product without a GLB cannot appear in
     it. Two of forty-eight are in that position; they are left out of the
     list rather than offered and then failing. */
  async function models() {
    if (!state.models) state.models = await loadModelIndex();
    return state.models;
  }
  const wearable = async () => {
    const m = await models();
    return catalogue().filter(p => m[p.handle]);
  };

  function slotRows() {
    const host = $('#reelSlots');
    host.innerHTML = '';
    for (const s of SLOTS) {
      const chosen = state.slots[s.key];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'slot';
      row.dataset.slot = s.key;
      const each = chosen.length ? (G.DURATION / chosen.length).toFixed(1).replace(/\.0$/, '') : null;
      row.innerHTML = `
        <span class="slot__art">${
          chosen.length
            ? chosen.slice(0, 3).map(p => `<img src="${sized(p.url, 120)}" alt="" crossorigin="anonymous">`).join('')
            : '<svg viewBox="0 0 24 24"><use href="#i-plus"/></svg>'}</span>
        <span class="slot__text">
          <strong>${s.label}</strong>
          <em>${chosen.length ? `${chosen.length} shot${chosen.length > 1 ? 's' : ''} · ${each}s each` : 'Tap to choose'}</em>
        </span>
        <svg class="slot__chev" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-right"/></svg>`;
      row.addEventListener('click', () => {
        const product = s.from === 'top' ? state.top : state.bottom;
        if (!product) return;
        openPicker({
          title: s.label, product, chosen: state.slots[s.key],
          onDone: list => { state.slots[s.key] = list; slotRows(); refresh(); },
          onAdjust: photo => openAdjust({
            slot: s.key, photo,
            adjust: state.adjusts[s.key][photo.url],
            onChange: adj => { state.adjusts[s.key][photo.url] = adj; },
          }),
        });
      });
      host.appendChild(row);
    }
  }

  function ready() {
    return !!state.top && !!state.bottom
        && SLOTS.every(s => state.slots[s.key].length > 0);
  }

  function refresh() {
    const btn = $('#btnReel');
    btn.disabled = !ready() || state.busy;
    $('#reelAfter').hidden = !(state.top && state.bottom);
  }

  async function pick(which, product) {
    onStatus(`Reading ${product.title}…`);
    const full = await readProduct(product.handle);
    const [heading, sub] = splitTitle(full.title, full.productType);
    const glb = full.glb || (await models())[full.handle];
    state[which] = { ...full, heading, sub, glb };
    /* Clear that garment's corners: they were pictures of a different
       product. */
    for (const s of SLOTS) if (s.from === which) { state.slots[s.key] = []; state.adjusts[s.key] = {}; }
    onStatus('');
    slotRows();
    refresh();
  }

  async function build() {
    if (!ready() || state.busy) return;
    state.busy = true; refresh();
    const width = state.size;
    const height = Math.round(G.H * width / G.W);

    const can = await supported(width, height);
    if (!can.ok) { onStatus(can.why); state.busy = false; refresh(); return; }

    try {
      onStatus('Fetching the photographs…');
      /* Every picture any corner will show, fetched once up front: stalling
         halfway through an encode is what makes a clip take minutes. */
      const wanted = allPhotos(state.slots);
      await Promise.all(wanted.map(async p => {
        if (p.bitmap) return;
        const res = await fetch(sized(p.url, 1600), { mode: 'cors' });
        p.bitmap = await createImageBitmap(await res.blob());
      }));

      onStatus('Loading the models…');
      const logoUrl = URL.createObjectURL(new Blob([
        (await (await fetch('assets/logo.svg')).text()).replace(/currentColor/g, '#9aa3ab'),
      ], { type: 'image/svg+xml' }));

      const reel = await createReel({
        width, top: state.top, bottom: state.bottom,
        slots: state.slots, adjusts: state.adjusts, logoUrl,
      });

      const t0 = performance.now();
      const blob = await encodeToMp4({
        width: reel.width, height: reel.height, fps: G.FPS, frames: G.FRAMES,
        draw: i => reel.drawFrame(i),
        onProgress: v => onStatus(`Rendering… ${Math.round(v * 100)}%`),
      });
      reel.dispose();
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      onStatus(`Done in ${secs}s · ${(blob.size / 1048576).toFixed(1)} MB`);
      onVideo(blob, `${state.top.sku || state.top.handle}-${state.bottom.sku || ''}-reel.mp4`);
    } catch (e) {
      onStatus(e.message || String(e));
    } finally {
      state.busy = false; refresh();
    }
  }

  for (const b of document.querySelectorAll('[data-reelsize]')) {
    b.addEventListener('click', () => {
      state.size = +b.dataset.reelsize;
      for (const x of document.querySelectorAll('[data-reelsize]')) {
        const on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-checked', String(on));
      }
      $('#reelOutHint').textContent =
        `${G.SIZES.find(s => s.w === state.size)?.label || state.size} · MP4`;
    });
  }
  $('#btnReel').addEventListener('click', build);

  slotRows();
  return { state, pick, refresh, wearable, ready };
}
