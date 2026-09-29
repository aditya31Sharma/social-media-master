/* Social Media Master - wiring.

   The work lives in lib/: shopify.js reads the catalogue, cutout.js lifts the
   backgrounds, frame.js and framer.js are the crop arithmetic and its gestures,
   render.js draws the slides and editor.js is the full-screen surface.

   The page is a stack of carousels and a composer. The composer always builds
   the NEXT one: pick a product, pick a cover, Build, and a carousel is appended
   below the last. Each keeps its own product, its own slides and its own set of
   six files, because each one is a separate post. */

import { ORDERS, KINDS, loadCatalogue, readProduct, pickImage } from './lib/shopify.js';
import { warm } from './lib/cutout.js';
import { renderToFile, renderThumb, defaultAdjust } from './lib/render.js';
import { createEditor } from './lib/editor.js';
import { buildCaption, captionStats, copyText } from './lib/caption.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  catalogue: [],
  size: 1620,
  fmt: 'png',
  cut: true,
  logo: '#ffffff',
  product: null,
  coverBitmap: null,
  carousels: [],
};

let editor = null;
let nextId = 1;

function say(msg, tone = '') {
  const el = $('#status');
  el.textContent = msg || '';
  el.className = 'note note--status' + (tone ? ` note--${tone}` : '');
}

/* Hidden rather than disabled until there is a product: a large dead primary
   button is the loudest thing on a collapsed sheet, and it is louder the less
   there is to do. */
function refreshBuild() {
  const btn = $('#btnBuild');
  btn.hidden = !state.product;
  btn.disabled = !(state.coverBitmap && state.product);
}
const cutFor = s => state.cut && s.kind !== 'macro' && s.kind !== 'cover' && !!s.url;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = (c, i, s) =>
  `${c.product.sku || c.product.handle}-${i + 1}-${slug(s.name)}.${state.fmt === 'png' ? 'png' : 'jpg'}`;

const carouselOf = s => state.carousels.find(c => c.slides.includes(s));

// -- Layout measuring --------------------------------------------

/* On a phone the controls are a sheet over the slides, so the slides need to
   know how much screen is left. Measured rather than guessed: the collapsed
   height changes with the product name and the status line. */
function measureSheet() {
  const rail = $('#rail');
  if (getComputedStyle(rail).position !== 'fixed') return;
  document.documentElement.style.setProperty('--sheet-h', `${rail.offsetHeight}px`);
}

/* How wide a slide may be. Derived from where the first strip starts and where
   the sheet begins, so it survives the heading wrapping or the sheet growing a
   line. Set once on the root: every strip is the same size. */
function measureStage() {
  const root = document.documentElement;
  const rail = $('#rail');
  const track = $('.track');
  if (!track || getComputedStyle(rail).position !== 'fixed') {
    root.style.removeProperty('--slide-w');
    return;
  }
  const dots = 20;
  const head = 44;                          // the carousel's own header row
  const room = window.innerHeight - track.getBoundingClientRect().top - rail.offsetHeight - dots - 8;
  const caption = 40;                       // the tile's name and buttons
  root.style.setProperty('--slide-w', `${Math.max(160, Math.round((room - caption) * 0.75))}px`);
}

function relayout() { measureSheet(); measureStage(); }

function openSheet(open) {
  $('#rail').classList.toggle('is-open', open);
  $('#sheetToggle').setAttribute('aria-expanded', String(open));
  relayout();
}

// -- Cover -------------------------------------------------------

async function setCover(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.coverBitmap = await createImageBitmap(file);

  const thumb = $('#coverThumb');
  thumb.innerHTML = '';
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.alt = '';
  thumb.appendChild(img);
  $('#coverName').textContent = file.name;

  warm(onWarm).catch(() => {});
  refreshBuild();
  relayout();
}

function clearCover() {
  state.coverBitmap = null;
  const thumb = $('#coverThumb');
  thumb.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-upload"/></svg>';
  $('#coverName').textContent = 'Choose an image';
  $('#coverFile').value = '';
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
  const slugged = raw.replace(/^https?:\/\/[^/]+\//i, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  if (/^[a-z0-9-]+$/i.test(slugged) && state.catalogue.some(p => p.handle === slugged)) return slugged;
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
    $('#prodNote').textContent = `${Object.keys(p.byName).length} images. Order tag: ${p.order}.`;
    $('#sheetLabel').textContent = p.title;
    $('#afterProduct').hidden = false;
    openSheet(true);
    say('');
    refreshBuild();
  } catch (err) {
    say(err.message, 'err');
  }
}

function resetComposer() {
  state.product = null;
  clearCover();
  $('#prodInput').value = '';
  $('#prodClear').hidden = true;
  $('#afterProduct').hidden = true;
  $('#sheetLabel').textContent = 'Add another SKU';
  $('#btnBuild').textContent = 'Build carousel';
  refreshBuild();
}

// -- Build -------------------------------------------------------

async function build() {
  const p = state.product;
  if (!state.coverBitmap || !p) return;

  const btn = $('#btnBuild');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Building';

  p.heading = $('#fHeading').value.trim();
  p.sub = $('#fSub').value.trim();
  p.sku = $('#fSku').value.trim();

  const order = ORDERS[$('#fOrder').value] || ORDERS['man-front'];
  const swapped = [];
  const used = new Set();

  /* The cover is simply slide one. It is picked in the composer and framed in
     the same editor as everything else. */
  const coverStart = defaultAdjust('cover', state.coverBitmap.width, state.coverBitmap.height);
  const slides = [{
    kind: 'cover', name: 'Cover',
    bitmap: state.coverBitmap,
    logo: state.logo,
    adjust: { ...coverStart }, committed: { ...coverStart },
    editable: false, dirty: false,
  }];

  order.forEach((want, i) => {
    const hit = pickImage(p.byName, want, used);
    if (!hit) return;
    used.add(hit.name);
    if (hit.name !== want) swapped.push(`${want} -> ${hit.name}`);
    const start = defaultAdjust(KINDS[i], hit.width, hit.height);
    slides.push({
      kind: KINDS[i], name: hit.name, url: hit.url,
      adjust: { ...start }, committed: { ...start },
      editable: false, dirty: false,
    });
  });

  const carousel = { id: nextId++, product: p, logo: state.logo, slides };
  state.carousels.push(carousel);
  $('#emptyState').hidden = true;
  const section = renderCarousel(carousel);
  openSheet(false);
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  relayout();

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    say(`Rendering ${i + 1} of ${slides.length}: ${s.name}...`);
    try {
      s.file = await renderToFile(s, p, cutFor(s), state.size, state.fmt, fileName(carousel, i, s));
      s.thumb = await renderThumb(s, p, cutFor(s));
      fillTile(carousel, i);
    } catch (err) {
      failTile(carousel, i, err.message);
    }
  }

  resetComposer();
  refreshDraftActions();
  relayout();
  say(swapped.length
      ? `Done. Substituted ${swapped.join(', ')}.`
      : `Done. ${slides.filter(s => s.file).length} slides. Add another SKU below.`,
      swapped.length ? 'warn' : 'ok');
}

// -- The draft ---------------------------------------------------

/* Save does not touch the device. It re-renders the slide at export size and
   swaps that into the draft, which is what the tile shows and what Download
   writes out later. */
async function commit(s) {
  const c = carouselOf(s);
  if (!c) return;
  const i = c.slides.indexOf(s);
  s.file = await renderToFile(s, c.product, cutFor(s), state.size, state.fmt, fileName(c, i, s));
  s.thumb = await renderThumb(s, c.product, cutFor(s));
  s.committed = { ...s.adjust };
  s.dirty = false;
  fillTile(c, i);
  refreshDraftActions();
}

async function commitAll() {
  for (const c of state.carousels) {
    for (const s of c.slides) if (s.dirty) await commit(s);
  }
}

function refreshDraftActions() {
  const any = state.carousels.some(c => c.slides.some(s => s.file));
  $('#btnDownloadEvery').hidden = state.carousels.length < 2 || !any;
  for (const c of state.carousels) {
    const sec = sectionOf(c);
    if (!sec) continue;
    const files = c.slides.map(s => s.file).filter(Boolean);
    $('[data-act="cdl"]', sec).disabled = !files.length;
    $('[data-act="cshare"]', sec).hidden = !(files.length && navigator.canShare?.({ files }));
    $('.cara__meta', sec).textContent =
      `${c.product.sku || '—'} · ${files.length} of ${c.slides.length} ready`;
  }
  editor?.refreshActions();
}

const sectionOf = c => $(`.cara[data-c="${c.id}"]`);

// -- Carousel sections -------------------------------------------

function renderCarousel(c) {
  const sec = document.createElement('section');
  sec.className = 'cara';
  sec.dataset.c = c.id;
  sec.innerHTML = `
    <header class="cara__head">
      <span class="cara__n"></span>
      <span class="cara__id">
        <strong class="cara__title"></strong>
        <em class="cara__meta"></em>
      </span>
      <span class="cara__actions">
        <button type="button" class="btn btn--quiet btn--tiny" data-act="cshare" hidden>Share</button>
        <button type="button" class="btn btn--quiet btn--tiny" data-act="cdl" disabled>Download 6</button>
        <button type="button" class="round round--sm round--danger" data-act="crm" aria-label="Remove this carousel">
          <svg viewBox="0 0 24 24"><use href="#i-close"/></svg>
        </button>
      </span>
    </header>
    <div class="track" data-track></div>
    <div class="dots" data-dots aria-hidden="true"></div>
    <div class="cap">
      <textarea class="cap__text" data-cap rows="6" spellcheck="false"
                aria-label="Caption for this post"></textarea>
      <div class="cap__foot">
        <span class="cap__count" data-capcount></span>
        <button type="button" class="btn btn--quiet btn--tiny" data-act="capreset">Reset</button>
        <button type="button" class="btn btn--tiny" data-act="capcopy">Copy caption</button>
      </div>
    </div>`;

  $('.cara__title', sec).textContent = c.product.title;
  $('.cara__n', sec).textContent = state.carousels.indexOf(c) + 1;

  const track = $('[data-track]', sec);
  c.slides.forEach((s, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.i = i;
    tile.innerHTML = `
      <div class="tile__frame is-busy"><span class="tile__n"><b>${i + 1}</b> <span></span></span></div>
      <div class="tile__foot">
        <button type="button" class="btn btn--quiet btn--tiny" data-act="edit" hidden>Edit</button>
        <button type="button" class="round round--sm" data-act="dl" hidden aria-label="Save this slide to the device">
          <svg viewBox="0 0 24 24"><use href="#i-dl"/></svg>
        </button>
      </div>`;
    $('.tile__n span', tile).textContent = s.name;
    track.appendChild(tile);
  });

  const dots = $('[data-dots]', sec);
  for (let i = 0; i < c.slides.length; i++) dots.appendChild(document.createElement('i'));

  /* The caption is generated from the product's own copy, then it is the
     user's: edits stick to the carousel and Reset goes back to the draft. */
  const cap = $('[data-cap]', sec);
  c.caption = c.caption ?? buildCaption(c.product);
  cap.value = c.caption;
  const tally = () => {
    const { chars, overLimit } = captionStats(cap.value);
    const el = $('[data-capcount]', sec);
    el.textContent = `${chars} characters${overLimit ? ' — over Instagram\u2019s 2,200 limit' : ''}`;
    el.classList.toggle('is-over', overLimit);
  };
  cap.addEventListener('input', () => { c.caption = cap.value; tally(); });
  tally();

  const copyBtn = $('[data-act="capcopy"]', sec);
  copyBtn.addEventListener('click', async () => {
    /* Held in a variable, not read off the event: `currentTarget` is null by
       the time an async handler resumes after its first await. */
    const ok = await copyText(cap.value);
    copyBtn.textContent = ok ? 'Copied' : 'Press Cmd-C';
    copyBtn.classList.toggle('is-done', ok);
    setTimeout(() => { copyBtn.textContent = 'Copy caption'; copyBtn.classList.remove('is-done'); }, 1600);
  });
  $('[data-act="capreset"]', sec).addEventListener('click', () => {
    c.caption = buildCaption(c.product);
    cap.value = c.caption;
    tally();
  });

  track.addEventListener('scroll', () => syncDots(c), { passive: true });
  $('[data-act="cdl"]', sec).addEventListener('click', () => downloadCarousel(c));
  $('[data-act="cshare"]', sec).addEventListener('click', () => shareCarousel(c));
  $('[data-act="crm"]', sec).addEventListener('click', () => removeCarousel(c));

  $('#carousels').appendChild(sec);
  syncDots(c);
  return sec;
}

function removeCarousel(c) {
  const at = state.carousels.indexOf(c);
  if (at < 0) return;
  state.carousels.splice(at, 1);
  sectionOf(c)?.remove();
  $$('.cara').forEach((sec, i) => { $('.cara__n', sec).textContent = i + 1; });
  $('#emptyState').hidden = state.carousels.length > 0;
  refreshDraftActions();
  relayout();
}

function fillTile(c, i) {
  const s = c.slides[i];
  const sec = sectionOf(c);
  const tile = sec && $(`.tile[data-i="${i}"]`, sec);
  if (!tile || !s.file) return;
  const frame = $('.tile__frame', tile);
  frame.classList.remove('is-busy');

  /* The src is swapped in place rather than the node being replaced. Taking an
     image out of a scroll-snap strip and putting a new one back reflows the
     strip, and a mandatory snap container that reflows under you can stop
     responding to a swipe until it is touched again. */
  let img = $('img', frame);
  if (!img) {
    img = new Image();
    img.draggable = false;
    frame.prepend(img);
  }
  const old = img.src;
  img.src = URL.createObjectURL(s.thumb || s.file);
  img.alt = `Slide ${i + 1}, ${s.name}`;
  if (old) setTimeout(() => URL.revokeObjectURL(old), 2000);

  if (!frame.dataset.wired) {
    frame.dataset.wired = '1';
    frame.addEventListener('click', () => openEditor(c, i));
  }

  markTile(c, i);
  const edit = $('[data-act="edit"]', tile);
  const dl = $('[data-act="dl"]', tile);
  edit.hidden = false;
  dl.hidden = false;
  edit.onclick = e => { e.stopPropagation(); openEditor(c, i); };
  dl.onclick = e => { e.stopPropagation(); saveOne(s.file); };
}

function markTile(c, i) {
  const s = c.slides[i];
  const sec = sectionOf(c);
  const frame = sec && $(`.tile[data-i="${i}"] .tile__frame`, sec);
  if (!frame || !s) return;
  const flag = $('.tile__flag', frame);
  if (s.dirty && !flag) {
    const el = document.createElement('span');
    el.className = 'tile__flag';
    el.textContent = 'Unsaved';
    frame.appendChild(el);
  } else if (!s.dirty && flag) flag.remove();
}

function failTile(c, i, msg) {
  const sec = sectionOf(c);
  const tile = sec && $(`.tile[data-i="${i}"]`, sec);
  if (!tile) return;
  $('.tile__frame', tile).classList.remove('is-busy');
  const chip = $('.tile__n', tile);
  chip.textContent = msg;
  chip.style.background = 'var(--danger-ink)';
}

function markAll() {
  for (const c of state.carousels) c.slides.forEach((_, i) => markTile(c, i));
}

function openEditor(c, i) {
  editor.open(c.slides, i, { product: c.product, cut: state.cut });
}

/* Whichever slide is nearest the middle of the strip. Viewport coordinates
   throughout: `offsetLeft` is measured from the offsetParent while
   `scrollLeft` is measured inside the track, and mixing the two puts the
   marker one slide out. */
function syncDots(c) {
  const sec = sectionOf(c);
  if (!sec) return;
  const track = $('[data-track]', sec);
  const dots = [...$('[data-dots]', sec).children];
  if (!dots.length) return;
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
async function downloadFiles(files) {
  for (const f of files) { saveOne(f); await new Promise(r => setTimeout(r, 400)); }
}

async function downloadCarousel(c) {
  const files = c.slides.map(s => s.file).filter(Boolean);
  await downloadFiles(files);
  say(`Downloaded ${files.length} images for ${c.product.sku || c.product.title}.`, 'ok');
}

async function downloadEverything() {
  let n = 0;
  for (const c of state.carousels) {
    const files = c.slides.map(s => s.file).filter(Boolean);
    await downloadFiles(files);
    n += files.length;
  }
  say(`Downloaded ${n} images across ${state.carousels.length} carousels.`, 'ok');
}

/* On a phone the share sheet is the only route into Photos, and it takes a
   whole carousel at once - still separate images, never a zip. */
async function shareCarousel(c) {
  try {
    await navigator.share({
      files: c.slides.map(s => s.file).filter(Boolean),
      title: c.product.title,
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
    onDirty: markAll,
  });

  $('#sheetToggle').addEventListener('click', () => openSheet(!$('#rail').classList.contains('is-open')));
  new ResizeObserver(() => { if (!$('#rail').classList.contains('is-open')) relayout(); }).observe($('#rail'));
  window.addEventListener('resize', () => { relayout(); placeList(); });
  window.addEventListener('scroll', placeList, true);

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

  segGroup('logo', v => { state.logo = v; });
  segGroup('size', v => { state.size = +v; });
  segGroup('fmt',  v => { state.fmt = v; });
  $('#optCut').addEventListener('change', e => { state.cut = e.target.checked; });

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
    $('#sheetLabel').textContent = state.carousels.length ? 'Add another SKU' : 'Pick a product to start';
    refreshBuild();
    relayout();
    input.focus();
  });

  $('#btnBuild').addEventListener('click', build);
  $('#btnDownloadEvery').addEventListener('click', downloadEverything);
  $('#btnReset').addEventListener('click', () => location.reload());

  /* Open to begin with, because the first thing to do is in there. It closes
     itself once there is a carousel to look at. */
  openSheet(true);
  relayout();

  loadCatalogue().then(list => {
    state.catalogue = list;
    $('#prodNote').textContent = `${list.length} products. Search, paste a link, or type a SKU.`;
    relayout();
  }).catch(err => {
    $('#prodNote').textContent = `Could not load the catalogue: ${err.message}`;
    $('#prodNote').className = 'note note--err';
  });
}

init();
