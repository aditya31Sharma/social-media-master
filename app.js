/* Social Media Master - wiring.

   The work lives in lib/: shopify.js reads the catalogue, cutout.js lifts the
   backgrounds, frame.js and framer.js are the crop arithmetic and its gestures,
   render.js draws the slides and editor.js is the full-screen surface. This
   file connects them to the page and holds the draft.

   The draft is the point. A built carousel is not six finished files, it is six
   slides that can still be reframed; Save changes writes a new version into the
   draft, and Download is the separate, later act of putting them on the
   device. */

import { ORDERS, KINDS, loadCatalogue, readProduct, pickImage } from './lib/shopify.js';
import { warm } from './lib/cutout.js';
import { renderToFile, defaultAdjust } from './lib/render.js';
import { createEditor } from './lib/editor.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  catalogue: [],
  coverBitmap: null,
  coverName: '',
  logo: '#ffffff',
  size: 1620,
  fmt: 'png',
  cut: true,
  product: null,
  slides: [],
};

let editor = null;

function say(msg, tone = '') {
  const el = $('#status');
  el.textContent = msg || '';
  el.className = 'note note--status' + (tone ? ` note--${tone}` : '');
}

const refreshBuild = () => { $('#btnBuild').disabled = !(state.coverBitmap && state.product); };

// -- The sheet ---------------------------------------------------

/* On a phone the controls are a sheet over the slides, so the slides need to
   know how much of the screen is left. Measured rather than guessed, because
   the collapsed height changes with the product name and the status line. */
function measureSheet() {
  const rail = $('#rail');
  if (getComputedStyle(rail).position !== 'fixed') return;
  document.documentElement.style.setProperty('--sheet-h', `${rail.offsetHeight}px`);
  measureStage();
}

/* How wide a slide may be, so the strip and its dots sit clear of the sheet.
   Derived from where the strip actually starts and where the sheet actually
   begins, so it survives the heading wrapping or the sheet growing a line. */
function measureStage() {
  const track = $('#grid');
  const rail = $('#rail');
  if (getComputedStyle(rail).position !== 'fixed') {
    track.style.removeProperty('--slide-w');
    return;
  }
  const dots = $('#dots').hidden ? 0 : $('#dots').offsetHeight + 12;
  const room = window.innerHeight - track.offsetTop - rail.offsetHeight - dots - 8;
  const caption = 40;                       // the tile's name and buttons
  track.style.setProperty('--slide-w', `${Math.max(170, Math.round((room - caption) * 0.75))}px`);
}

function openSheet(open) {
  $('#rail').classList.toggle('is-open', open);
  $('#sheetToggle').setAttribute('aria-expanded', String(open));
  measureSheet();
  measureStage();
}

// -- Cover -------------------------------------------------------

async function setCover(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.coverBitmap = await createImageBitmap(file);
  state.coverName = file.name;

  const thumb = $('#coverThumb');
  thumb.innerHTML = '';
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.alt = '';
  thumb.appendChild(img);
  $('#coverName').textContent = file.name;

  warm(onWarm).catch(() => {});
  refreshBuild();
  measureSheet();
}

function onWarm(pct) {
  $('#engineNote').textContent = pct < 100
    ? `Loading the cut-out model, ${pct}%`
    : (self.crossOriginIsolated ? 'Cut-out model ready (multi-threaded).' : 'Cut-out model ready.');
}

// -- Product combo -----------------------------------------------

let activeRow = -1;

function score(p, q) {
  const hay = `${p.title} ${p.sku} ${p.handle}`.toLowerCase();
  if (!q) return 1;
  if (p.sku.toLowerCase() === q) return 100;
  if (hay.includes(q)) return 10 - hay.indexOf(q) / 100;
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w)) ? 5 : 0;
}

function placeList() {
  const list = $('#prodList');
  if (list.hidden) return;
  const r = $('#prodInput').getBoundingClientRect();
  list.style.left = `${r.left}px`;
  list.style.width = `${r.width}px`;
  const below = window.innerHeight - r.bottom;
  if (below > 260) { list.style.top = `${r.bottom + 6}px`; list.style.bottom = 'auto'; }
  else { list.style.top = 'auto'; list.style.bottom = `${window.innerHeight - r.top + 6}px`; }
}

function renderList(q) {
  const list = $('#prodList');
  const hits = state.catalogue
    .map(p => ({ p, s: score(p, q) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40);

  list.innerHTML = '';
  activeRow = -1;

  if (!hits.length) {
    const li = document.createElement('li');
    li.className = 'combo__empty';
    li.textContent = state.catalogue.length ? `Nothing matches "${q}".` : 'Catalogue still loading.';
    list.appendChild(li);
  } else {
    for (const { p } of hits) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.handle = p.handle;
      const b = document.createElement('b'); b.textContent = p.title;
      const code = document.createElement('code'); code.textContent = p.sku;
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
  say('Reading the product...');
  try {
    const p = await readProduct(handle);
    state.product = p;
    $('#prodInput').value = p.title;
    $('#prodClear').hidden = false;
    $('#fHeading').value = p.heading;
    $('#fSub').value = p.sub;
    $('#fSku').value = p.sku;
    $('#fOrder').value = p.order;
    $('#prodNote').textContent =
      `${Object.keys(p.byName).length} images. Order tag: ${p.order}.`;
    $('#sheetLabel').textContent = p.title;

    /* The rest only means anything once there is a product to apply it to. */
    $('#afterProduct').hidden = false;
    openSheet(true);
    say('');
    refreshBuild();
  } catch (err) {
    say(err.message, 'err');
  }
}

// -- Build -------------------------------------------------------

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nameFor = (i, s) =>
  `${state.product.sku || state.product.handle}-${i + 1}-${slug(s.name)}.${state.fmt === 'png' ? 'png' : 'jpg'}`;
const cutFor = s => state.cut && s.kind !== 'macro' && s.kind !== 'cover' && !!s.url;

async function build() {
  const p = state.product;
  if (!state.coverBitmap || !p) return;

  const btn = $('#btnBuild');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Building';
  $('#btnDownloadAll').hidden = true;
  $('#btnShare').hidden = true;

  p.heading = $('#fHeading').value.trim();
  p.sub = $('#fSub').value.trim();
  p.sku = $('#fSku').value.trim();

  const order = ORDERS[$('#fOrder').value] || ORDERS['man-front'];
  const swapped = [];
  const used = new Set();

  /* The cover is simply slide one. It is picked in the sheet and framed in the
     same editor as everything else, rather than having a stage of its own. */
  const coverStart = defaultAdjust('cover', state.coverBitmap.width, state.coverBitmap.height);
  const slides = [{
    kind: 'cover',
    name: 'Cover',
    bitmap: state.coverBitmap,
    logo: state.logo,
    adjust: { ...coverStart },
    committed: { ...coverStart },
    editable: false,
    dirty: false,
  }];

  order.forEach((want, i) => {
    const hit = pickImage(p.byName, want, used);
    if (!hit) return;
    used.add(hit.name);
    if (hit.name !== want) swapped.push(`${want} -> ${hit.name}`);
    const start = defaultAdjust(KINDS[i], hit.width, hit.height);
    slides.push({
      kind: KINDS[i],
      name: hit.name,
      url: hit.url,
      adjust: { ...start },
      committed: { ...start },
      editable: false,
      dirty: false,
    });
  });

  state.slides = slides;
  skeleton(slides);
  openSheet(false);                    // get out of the way of the result

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    say(`Rendering ${i + 1} of ${slides.length}: ${s.name}...`);
    try {
      s.file = await renderToFile(s, p, cutFor(s), state.size, state.fmt, nameFor(i, s));
      fillTile(i);
    } catch (err) {
      failTile(i, err.message);
    }
  }

  btn.disabled = false;
  btn.textContent = 'Build carousel';
  refreshDraftActions();
  measureSheet();
  measureStage();
  say(swapped.length
      ? `Done. Substituted ${swapped.join(', ')}.`
      : `Done. ${state.slides.filter(s => s.file).length} slides.`,
      swapped.length ? 'warn' : 'ok');
}

// -- The draft ---------------------------------------------------

/* Save does not touch the device. It re-renders the slide at export size and
   swaps that into the draft, which is what the tile shows and what Download
   writes out later. */
async function commit(s) {
  const i = state.slides.indexOf(s);
  s.file = await renderToFile(s, state.product, cutFor(s), state.size, state.fmt, nameFor(i, s));
  s.committed = { ...s.adjust };
  s.dirty = false;
  fillTile(i);
  refreshDraftActions();
}

async function commitAll() {
  for (const s of state.slides) if (s.dirty) await commit(s);
}

function refreshDraftActions() {
  const files = state.slides.map(s => s.file).filter(Boolean);
  $('#btnDownloadAll').hidden = files.length === 0;
  $('#btnShare').hidden = !(files.length && navigator.canShare?.({ files }));
  editor?.refreshActions();
}

// -- Tiles -------------------------------------------------------

function skeleton(slides) {
  const grid = $('#grid');
  grid.innerHTML = '';
  slides.forEach((s, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.i = i;
    tile.innerHTML = `
      <div class="tile__frame is-busy"><span class="tile__n">${i + 1}</span></div>
      <div class="tile__foot">
        <span class="tile__name"></span>
        <button type="button" class="btn btn--quiet btn--tiny" data-act="edit" hidden>Edit</button>
        <button type="button" class="btn btn--quiet btn--tiny" data-act="dl" hidden>Download</button>
      </div>`;
    $('.tile__name', tile).textContent = s.name;
    grid.appendChild(tile);
  });
  buildDots(slides.length);
}

function fillTile(i) {
  const s = state.slides[i];
  const tile = $(`.tile[data-i="${i}"]`);
  if (!tile || !s.file) return;
  const frame = $('.tile__frame', tile);
  frame.classList.remove('is-busy');

  const old = $('img', frame);
  if (old) { URL.revokeObjectURL(old.src); old.remove(); }
  const img = new Image();
  img.src = URL.createObjectURL(s.file);
  img.alt = `Slide ${i + 1}, ${s.name}`;
  frame.prepend(img);

  if (!frame.dataset.wired) {
    frame.dataset.wired = '1';
    frame.addEventListener('click', () => openEditor(i));
  }

  markTile(i);
  const edit = $('[data-act="edit"]', tile);
  const dl = $('[data-act="dl"]', tile);
  edit.hidden = false;
  dl.hidden = false;
  edit.onclick = e => { e.stopPropagation(); openEditor(i); };
  dl.onclick = e => { e.stopPropagation(); saveOne(s.file); };
}

function markTile(i) {
  const s = state.slides[i];
  const frame = $(`.tile[data-i="${i}"] .tile__frame`);
  if (!frame || !s) return;
  const flag = $('.tile__flag', frame);
  if (s.dirty && !flag) {
    const el = document.createElement('span');
    el.className = 'tile__flag';
    el.textContent = 'Unsaved';
    frame.appendChild(el);
  } else if (!s.dirty && flag) flag.remove();
}

function failTile(i, msg) {
  const tile = $(`.tile[data-i="${i}"]`);
  if (!tile) return;
  $('.tile__frame', tile).classList.remove('is-busy');
  const name = $('.tile__name', tile);
  name.textContent = msg;
  name.style.color = 'var(--danger-ink)';
}

function openEditor(i) {
  editor.open(state.slides, i, { product: state.product, cut: state.cut });
}

// -- Dots --------------------------------------------------------

function buildDots(n) {
  const dots = $('#dots');
  dots.innerHTML = '';
  for (let i = 0; i < n; i++) dots.appendChild(document.createElement('i'));
  dots.hidden = n === 0;
  syncDots();
}

/* Whichever slide is nearest the middle of the strip. Dividing the scroll
   offset by an average slide width, which is what this replaced, drifts once
   the gaps and the end padding are counted and never quite reaches the last
   dot. */
function syncDots() {
  const track = $('#grid');
  const dots = [...$('#dots').children];
  if (!dots.length) return;
  /* Viewport coordinates throughout. `offsetLeft` is measured from the
     offsetParent while `scrollLeft` is measured inside the track, and mixing
     the two puts the marker one slide out. */
  const box = track.getBoundingClientRect();
  const mid = box.left + box.width / 2;
  let best = 0, bestGap = Infinity;
  [...track.children].forEach((tile, i) => {
    const r = tile.getBoundingClientRect();
    const gap = Math.abs(r.left + r.width / 2 - mid);
    if (gap < bestGap) { bestGap = gap; best = i; }
  });
  dots.forEach((d, i) => d.classList.toggle('is-on', i === best));
}

// -- Saving to the device ----------------------------------------

function saveOne(file) {
  if (!file) return;
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
async function downloadAll() {
  const files = state.slides.map(s => s.file).filter(Boolean);
  for (const f of files) { saveOne(f); await new Promise(r => setTimeout(r, 400)); }
  say(`Downloaded ${files.length} images.`, 'ok');
}

/* On a phone the share sheet is the only route into Photos, and it takes the
   whole set at once - still separate images, never a zip. */
async function shareAll() {
  try {
    await navigator.share({
      files: state.slides.map(s => s.file).filter(Boolean),
      title: state.product?.title || 'Carousel',
    });
  } catch (err) {
    if (err.name !== 'AbortError') say(err.message, 'err');
  }
}

// -- Wiring ------------------------------------------------------

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

  $('#engineNote').textContent = document.fonts.check('500 100px "Helvetica Neue"')
    ? 'The cut-out model loads once you pick a cover or a product.'
    : 'Helvetica Neue is not on this device, so the slide copy falls back to Arial.';

  editor = createEditor($('#editor'), {
    onSave: commit,
    onSaveAll: commitAll,
    onDirty: () => state.slides.forEach((_, i) => markTile(i)),
  });

  // Sheet
  $('#sheetToggle').addEventListener('click', () => openSheet(!$('#rail').classList.contains('is-open')));
  new ResizeObserver(() => { if (!$('#rail').classList.contains('is-open')) measureSheet(); }).observe($('#rail'));
  window.addEventListener('resize', () => { measureSheet(); measureStage(); });

  // Cover
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

  // Options
  segGroup('logo', v => { state.logo = v; });
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
    $('#afterProduct').hidden = true;
    $('#sheetLabel').textContent = 'Pick a product to start';
    refreshBuild();
    measureSheet();
    input.focus();
  });
  window.addEventListener('resize', placeList);
  window.addEventListener('scroll', placeList, true);
  $('#grid').addEventListener('scroll', syncDots, { passive: true });

  // Actions
  $('#btnBuild').addEventListener('click', build);
  $('#btnDownloadAll').addEventListener('click', downloadAll);
  $('#btnShare').addEventListener('click', shareAll);
  $('#btnReset').addEventListener('click', () => location.reload());

  /* Open to begin with, because the first thing to do is in there. It closes
     itself once there is a carousel to look at. */
  openSheet(true);
  measureSheet();

  loadCatalogue().then(list => {
    state.catalogue = list;
    $('#prodNote').textContent = `${list.length} products. Search, paste a link, or type a SKU.`;
    measureSheet();
  }).catch(err => {
    $('#prodNote').textContent = `Could not load the catalogue: ${err.message}`;
    $('#prodNote').className = 'note note--err';
  });
}

init();
