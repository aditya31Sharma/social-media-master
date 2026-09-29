/* Social Media Master - wiring.

   The work lives in lib/: shopify.js reads the catalogue, cutout.js lifts the
   backgrounds, render.js draws the slides, cropper.js is the cover editor and
   viewer.js is the zoom. This file is what connects them to the page. */

import { ORDERS, KINDS, loadCatalogue, readProduct, pickImage } from './lib/shopify.js';
import { warm } from './lib/cutout.js';
import { W, H, renderCover, renderSlide, toFile } from './lib/render.js';
import { createCropper } from './lib/cropper.js';
import { createViewer } from './lib/viewer.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  catalogue: [],
  coverFile: null,
  coverBitmap: null,
  logo: '#ffffff',
  size: 1620,
  fmt: 'png',
  cut: true,
  product: null,
  slides: [],
};

let cropper = null;
let viewer = null;

function say(msg, tone = '') {
  const el = $('#status');
  el.textContent = msg || '';
  el.className = 'note note--status' + (tone ? ` note--${tone}` : '');
}

function refreshBuild() {
  $('#btnBuild').disabled = !(state.coverBitmap && state.product);
}

// ── Cover ───────────────────────────────────────────────────────

async function setCover(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.coverFile = file;
  state.coverBitmap = await createImageBitmap(file);
  $('#picker').hidden = true;
  $('#cropWrap').hidden = false;
  $('#btnRecrop').hidden = false;
  await cropper.setImage(file);
  warm(onWarm).catch(() => {});
  refreshBuild();
}

function onWarm(pct) {
  $('#engineNote').textContent = pct < 100
    ? `Loading the cut-out model, ${pct}%`
    : (self.crossOriginIsolated ? 'Cut-out model ready (multi-threaded).' : 'Cut-out model ready.');
}

// ── Product combo ───────────────────────────────────────────────

let activeRow = -1;

function score(p, q) {
  const hay = `${p.title} ${p.sku} ${p.handle}`.toLowerCase();
  if (!q) return 1;
  if (p.sku.toLowerCase() === q) return 100;
  if (hay.includes(q)) return 10 - hay.indexOf(q) / 100;
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w)) ? 5 : 0;
}

/* The list is a body-level element positioned by script rather than an absolute
   child of the field. The rail scrolls and clips on desktop, which would slice
   the list in half. */
function placeList() {
  const list = $('#prodList');
  if (list.hidden) return;
  const r = $('#prodInput').getBoundingClientRect();
  list.style.left = `${r.left}px`;
  list.style.width = `${r.width}px`;
  const below = window.innerHeight - r.bottom;
  if (below > 240) {
    list.style.top = `${r.bottom + 6}px`;
    list.style.bottom = 'auto';
  } else {
    list.style.top = 'auto';
    list.style.bottom = `${window.innerHeight - r.top + 6}px`;
  }
}

function renderList(q) {
  const list = $('#prodList');
  const hits = state.catalogue
    .map(p => ({ p, s: score(p, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40);

  list.innerHTML = '';
  activeRow = -1;

  if (!hits.length) {
    const li = document.createElement('li');
    li.className = 'combo__empty';
    li.textContent = state.catalogue.length ? `Nothing matches “${q}”.` : 'Catalogue still loading.';
    list.appendChild(li);
  } else {
    for (const { p } of hits) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.handle = p.handle;
      const b = document.createElement('b');
      b.textContent = p.title;
      const code = document.createElement('code');
      code.textContent = p.sku;
      li.append(b, code);
      li.addEventListener('mousedown', e => { e.preventDefault(); choose(p.handle); });
      list.appendChild(li);
    }
  }
  list.hidden = false;
  $('#prodInput').setAttribute('aria-expanded', 'true');
  placeList();
}

function closeList() {
  $('#prodList').hidden = true;
  $('#prodInput').setAttribute('aria-expanded', 'false');
}

function moveRow(dir) {
  const rows = $$('#prodList li[data-handle]');
  if (!rows.length) return;
  activeRow = (activeRow + dir + rows.length) % rows.length;
  rows.forEach((r, i) => r.classList.toggle('is-active', i === activeRow));
  rows[activeRow].scrollIntoView({ block: 'nearest' });
}

/* Accepts whatever is to hand: a PDP link, a tenzen.in short link, a bare
   handle, or a SKU code typed from memory. */
function resolve(text) {
  const raw = text.trim();
  if (!raw) return null;
  const m = raw.match(/\/products\/([a-z0-9-]+)/i);
  if (m) return m[1];
  const code = raw.replace(/^.*\//, '').toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(code)) {
    const hit = state.catalogue.find(p => p.sku.toUpperCase() === code);
    if (hit) return hit.handle;
  }
  const slug = raw.replace(/^https?:\/\/[^/]+\//i, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  if (/^[a-z0-9-]+$/i.test(slug) && state.catalogue.some(p => p.handle === slug)) return slug;
  return null;
}

async function choose(handle) {
  closeList();
  warm(onWarm).catch(() => {});
  say('Reading the product…');
  try {
    const p = await readProduct(handle);
    state.product = p;
    $('#prodInput').value = p.title;
    $('#prodClear').hidden = false;
    $('#fHeading').value = p.heading;
    $('#fSub').value = p.sub;
    $('#fSku').value = p.sku;
    $('#fOrder').value = p.order;
    $('#detail').hidden = false;
    $('#prodNote').textContent =
      `${Object.keys(p.byName).length} images on this SKU. Order tag: ${p.order}.`;
    say('');
    refreshBuild();
  } catch (err) {
    say(err.message, 'err');
  }
}

// ── Build ───────────────────────────────────────────────────────

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function build() {
  const p = state.product;
  if (!state.coverBitmap || !p) return;

  const btn = $('#btnBuild');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Building';
  $('#btnSaveAll').hidden = true;
  $('#btnShare').hidden = true;
  state.slides = [];

  const S = state.size / W;
  p.heading = $('#fHeading').value.trim();
  p.sub = $('#fSub').value.trim();
  p.sku = $('#fSku').value.trim();

  const order = ORDERS[$('#fOrder').value] || ORDERS['man-front'];
  const plan = [{ kind: 'cover', name: 'Cover' }];
  const swapped = [];
  const used = new Set();
  order.forEach((want, i) => {
    const hit = pickImage(p.byName, want, used);
    if (!hit) return;
    used.add(hit.name);
    if (hit.name !== want) swapped.push(`${want} → ${hit.name}`);
    plan.push({ kind: KINDS[i], name: hit.name, url: hit.url });
  });

  skeleton(plan);
  const ext = state.fmt === 'png' ? 'png' : 'jpg';

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    say(`Rendering ${i + 1} of ${plan.length}: ${step.name}…`);
    try {
      const canvas = step.kind === 'cover'
        ? await renderCover(S, state.coverBitmap,
            cropper.rectFor(Math.round(W * S), Math.round(H * S)), state.logo)
        : await renderSlide(S, step.kind, step.url, p, state.cut && step.kind !== 'macro');

      const name = `${p.sku || p.handle}-${i + 1}-${slug(step.name)}.${ext}`;
      const file = await toFile(canvas, name, state.fmt);
      state.slides.push({ file, label: step.name, sub: name });
      fillTile(i, file, step.name);
    } catch (err) {
      failTile(i, err.message);
    }
  }

  btn.disabled = false;
  btn.textContent = 'Build carousel';
  if (state.slides.length) {
    $('#btnSaveAll').hidden = false;
    if (navigator.canShare?.({ files: state.slides.map(s => s.file) })) $('#btnShare').hidden = false;
  }
  say(swapped.length
      ? `Done. Substituted ${swapped.join(', ')}.`
      : `Done. ${state.slides.length} slides.`,
      swapped.length ? 'warn' : 'ok');
}

// ── Tiles ───────────────────────────────────────────────────────

function skeleton(plan) {
  const grid = $('#grid');
  grid.innerHTML = '';
  plan.forEach((step, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.i = i;
    tile.innerHTML = `
      <div class="tile__frame is-busy"><span class="tile__n">${i + 1}</span></div>
      <div class="tile__foot">
        <span class="tile__name">${step.name}</span>
        <button type="button" class="btn btn--quiet btn--tiny" hidden>Save</button>
      </div>`;
    grid.appendChild(tile);
  });
}

function fillTile(i, file, label) {
  const tile = $(`.tile[data-i="${i}"]`);
  if (!tile) return;
  const frame = $('.tile__frame', tile);
  frame.classList.remove('is-busy');

  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.alt = `Slide ${i + 1}, ${label}`;
  frame.appendChild(img);

  const zoom = document.createElement('button');
  zoom.type = 'button';
  zoom.className = 'tile__zoom';
  zoom.setAttribute('aria-label', `Zoom into slide ${i + 1}`);
  zoom.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-zoom"/></svg>';
  frame.appendChild(zoom);

  const open = () => viewer.open(state.slides, i);
  frame.addEventListener('click', open);
  zoom.addEventListener('click', e => { e.stopPropagation(); open(); });

  const save = $('.tile__foot button', tile);
  save.hidden = false;
  save.addEventListener('click', () => saveOne(file));
}

function failTile(i, msg) {
  const tile = $(`.tile[data-i="${i}"]`);
  if (!tile) return;
  $('.tile__frame', tile).classList.remove('is-busy');
  const name = $('.tile__name', tile);
  name.textContent = msg;
  name.style.color = 'var(--danger-ink)';
}

// ── Saving ──────────────────────────────────────────────────────

function saveOne(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/* One at a time, with a beat between: browsers rate-limit a burst of
   programmatic downloads and silently drop the tail of one. */
async function saveAll() {
  for (const s of state.slides) {
    saveOne(s.file);
    await new Promise(r => setTimeout(r, 400));
  }
  say(`Saved ${state.slides.length} images.`, 'ok');
}

/* On a phone the share sheet is the only route into Photos, and it takes the
   whole set at once - still separate images, never a zip. */
async function shareAll() {
  try {
    await navigator.share({
      files: state.slides.map(s => s.file),
      title: state.product?.title || 'Carousel',
    });
  } catch (err) {
    if (err.name !== 'AbortError') say(err.message, 'err');
  }
}

// ── Wiring ──────────────────────────────────────────────────────

function segGroup(attr, onPick) {
  $$(`.seg__btn[data-${attr}]`).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.seg__btn', btn.parentElement).forEach(b => {
        b.classList.toggle('is-on', b === btn);
        b.setAttribute('aria-checked', String(b === btn));
      });
      onPick(btn.dataset[attr]);
    });
  });
}

function init() {
  document.documentElement.style.setProperty('--logo', 'url(assets/logo.svg)');

  if (!document.fonts.check('500 100px "Helvetica Neue"')) {
    $('#engineNote').textContent =
      'Helvetica Neue is not on this device, so the slide copy falls back to Arial.';
  } else {
    $('#engineNote').textContent = 'The cut-out model loads once you pick a cover or a product.';
  }

  cropper = createCropper($('#crop'), {
    onChange: ({ scale }) => {
      $('#zoom').value = scale.toFixed(2);
      $('#zoomOut').textContent = `${Math.round(scale * 100)}%`;
    },
  });

  viewer = createViewer($('#viewer'), { onSave: saveOne });

  // Cover input
  const picker = $('#picker');
  picker.addEventListener('click', () => $('#coverFile').click());
  picker.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#coverFile').click(); }
  });
  $('#coverFile').addEventListener('change', e => setCover(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(t =>
    picker.addEventListener(t, e => { e.preventDefault(); picker.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(t =>
    picker.addEventListener(t, e => { e.preventDefault(); picker.classList.remove('is-over'); }));
  picker.addEventListener('drop', e => setCover(e.dataTransfer.files[0]));
  window.addEventListener('paste', e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) setCover(item.getAsFile());
  });

  $('#zoom').addEventListener('input', e => cropper.setZoom(+e.target.value));
  $('#btnRecrop').addEventListener('click', () => cropper.reset());

  // Options
  segGroup('logo', v => {
    state.logo = v;
    $('#cropLogo').style.setProperty('--logo-ink', v);
  });
  segGroup('size', v => { state.size = +v; });
  segGroup('fmt',  v => { state.fmt = v; });
  $('#optCut').addEventListener('change', e => { state.cut = e.target.checked; });

  // Product
  const input = $('#prodInput');
  input.addEventListener('input', () => {
    $('#prodClear').hidden = !input.value;
    const handle = resolve(input.value);
    if (handle) { choose(handle); return; }
    renderList(input.value.trim().toLowerCase());
  });
  input.addEventListener('focus', () => renderList(input.value.trim().toLowerCase()));
  input.addEventListener('blur', () => setTimeout(closeList, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveRow(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveRow(-1); }
    else if (e.key === 'Enter') {
      const row = $$('#prodList li[data-handle]')[activeRow];
      if (row) { e.preventDefault(); choose(row.dataset.handle); }
    } else if (e.key === 'Escape') closeList();
  });
  $('#prodClear').addEventListener('click', () => {
    input.value = '';
    $('#prodClear').hidden = true;
    state.product = null;
    $('#detail').hidden = true;
    refreshBuild();
    input.focus();
  });
  window.addEventListener('resize', placeList);
  window.addEventListener('scroll', placeList, true);

  // Actions
  $('#btnBuild').addEventListener('click', build);
  $('#btnSaveAll').addEventListener('click', saveAll);
  $('#btnShare').addEventListener('click', shareAll);
  $('#btnReset').addEventListener('click', () => location.reload());

  // Catalogue
  loadCatalogue().then(list => {
    state.catalogue = list;
    $('#prodNote').textContent = `${list.length} products. Search, paste a link, or type a SKU.`;
  }).catch(err => {
    $('#prodNote').textContent = `Could not load the catalogue: ${err.message}`;
    $('#prodNote').className = 'note note--err';
  });
}

init();
