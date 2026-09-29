/* Social Media Master - build a Tenzen Instagram carousel from one cover shot
   and one product link.

   Everything runs in the browser. There is no server, because there is nothing
   here a server would be needed for: the catalogue comes from Shopify's
   Storefront API (public, read-only), the photography comes off Shopify's CDN
   with permissive CORS, and the cut-outs are computed locally by an ONNX model.
   That is what lets the whole tool live on GitHub Pages.

   Geometry below is lifted verbatim from the Figma board and expressed in its
   3000x4000 design space. Every draw call multiplies by S, the ratio between
   the chosen export width and 3000, so a slide is rendered once at its final
   size rather than rendered big and shrunk. */

// ── Config ──────────────────────────────────────────────────────

const SHOP = 'xjaypt-f5.myshopify.com';

/* A Storefront API token. This is the public, read-only kind that every
   headless Shopify storefront ships in its client bundle: it can read products
   that are already published on tenzen.in and nothing else. It is not the Admin
   token and must never be swapped for one. */
const SF_TOKEN = '476ba38529f786d04dd455bac86b07d4';
const SF_URL = `https://${SHOP}/api/2025-01/graphql.json`;

const BG_CDN = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const MASK_W = 1400;          // the matting model works at 1024 internally
const CACHE_DB = 'tcs-masks';

// ── The design, in Figma's 3000x4000 space ──────────────────────

const W = 3000, H = 4000;

const GRAD = { from: '#F2F2F2', to: '#C6C9CC' };   // 216.87deg => top-right to bottom-left
const BOX  = { x: 166, y: 0, w: 2667, h: 4000 };   // contained artwork
const LOGO = { w: 609.757, h: 200, top: 250 };

const TYPE = {
  colour:   '#768696',
  tracking: -2,
  title:    { top: 250, size: 100, weight: 500, lh: 1.0 },
  sub:      { size: 76, weight: 400, lh: 1.5 },
};

const PILL = {
  bottom: 250, height: 236, padX: 120, padY: 64,
  border: 4, radius: 136, size: 100, weight: 500,
  fill: 'rgba(255,255,255,0.2)', stroke: '#ffffff',
};

/* The four carousel orders, transcribed from the Figma board. These are NOT the
   website's media orders - the site leads with a model shot, the carousel leads
   with the flat - so they are kept here in full rather than derived. */
const ORDERS = {
  'man-front':   ['Front', 'Model-Man-Front',   'Macro-Front', 'Model-Woman-Back',  'Back'],
  'man-back':    ['Back',  'Model-Man-Back',    'Macro-Back',  'Model-Woman-Front', 'Front'],
  'woman-front': ['Front', 'Model-Woman-Front', 'Macro-Front', 'Model-Man-Back',    'Back'],
  'woman-back':  ['Back',  'Model-Woman-Back',  'Macro-Back',  'Model-Man-Front',   'Front'],
};

/* How each position is treated, again straight off the board: the two flats
   carry the wordmark copy, the models sit plain on the gradient, and the
   close-up is the one slide that bleeds to all four edges. */
const KINDS = ['flat', 'model', 'macro', 'model', 'flat'];

// ── Small helpers ───────────────────────────────────────────────

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function say(msg, tone = '') {
  const el = $('#status');
  el.textContent = msg || '';
  el.className = 'note note--status' + (tone ? ' note--' + tone : '');
}

/* Shopify serves any stored image at any width, so ask for the size actually
   about to be drawn instead of pulling 2800px and letting the GPU throw most of
   it away. */
function sized(url, w) {
  const base = url.split('?')[0];
  return `${base}?width=${Math.min(2800, Math.max(200, Math.round(w)))}`;
}

/* "Model-Man-Front_536fb994-....webp" -> "Model-Man-Front". Shopify appends a
   uuid on re-upload; the part before the first underscore is the name the
   studio actually gave the file. */
function baseName(url) {
  const file = url.split('?')[0].split('/').pop() || '';
  return file.replace(/\.[a-z0-9]+$/i, '').split('_')[0];
}

async function bitmapFrom(src) {
  const res = await fetch(src, { mode: 'cors' });
  if (!res.ok) throw new Error(`${res.status} on ${baseName(src)}`);
  return createImageBitmap(await res.blob());
}

// ── Storefront API ──────────────────────────────────────────────

async function sf(query, variables = {}) {
  const res = await fetch(SF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SF_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Storefront API ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const Q_LIST = `query($cursor:String){
  products(first:100, after:$cursor, sortKey:CREATED_AT, reverse:true){
    pageInfo{ hasNextPage endCursor }
    nodes{ handle title productType tags
      sku: metafield(namespace:"tenzen", key:"sku_code"){ value } } } }`;

const Q_ONE = `query($h:String!){
  product(handle:$h){ handle title productType tags
    sku: metafield(namespace:"tenzen", key:"sku_code"){ value }
    media(first:40){ nodes{ ... on MediaImage { image{ url width height } } } } } }`;

async function loadCatalogue() {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 6; page++) {
    const d = await sf(Q_LIST, { cursor });
    out.push(...d.products.nodes);
    if (!d.products.pageInfo.hasNextPage) break;
    cursor = d.products.pageInfo.endCursor;
  }
  return out.map(p => ({
    handle: p.handle,
    title: p.title,
    type: p.productType || '',
    sku: p.sku?.value || '',
    order: (p.tags || []).find(t => ORDERS[t]) || 'man-front',
  }));
}

// ── Reading a product ───────────────────────────────────────────

/* The heading is whatever the title says before the product type, and the
   subheading is the product type plus the colour that trails it. Splitting on
   the type rather than on a word count is what keeps "The Ragnarsons Polo
   Sweatshirt Navy" from breaking in the wrong place. */
function splitTitle(title, type) {
  if (type) {
    const at = title.toLowerCase().indexOf(type.toLowerCase());
    if (at > 0) return [title.slice(0, at).trim(), title.slice(at).trim()];
  }
  const words = title.split(/\s+/);
  const cut = Math.max(1, words.length - 3);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

/* A slot names one exact file, but not every SKU was shot the same way - baby
   tees have no man in them at all, some drops have no alternate. Rather than
   fail, walk outwards from the wanted frame: its own alternate and full-length
   crops first, then the same pose on the other model, then the other pose, then
   anything at all. */
function variants(name) {
  return [name, `${name}-Alt`, `${name}-Full`];
}

function fallbacks(want) {
  const chain = [...variants(want)];
  const m = want.match(/^Model-(Man|Woman)-(Front|Back)$/);
  if (m) {
    const [, who, side] = m;
    const other = who === 'Man' ? 'Woman' : 'Man';
    const flip = side === 'Front' ? 'Back' : 'Front';
    chain.push(...variants(`Model-${other}-${side}`),
               ...variants(`Model-${who}-${flip}`),
               ...variants(`Model-${other}-${flip}`),
               'Model-Side');
  }
  if (want === 'Macro-Front') chain.push('Macro-Back');
  if (want === 'Macro-Back')  chain.push('Macro-Front');
  if (want === 'Front')       chain.push('Back');
  if (want === 'Back')        chain.push('Front');
  chain.push('Shoot-1', 'Shoot-2');
  return chain;
}

/* `used` keeps a carousel from showing the same photograph twice: a baby tee
   has no man's back to fall back to, and without this both model slides would
   land on the one woman's front shot it does have. A repeat is still better
   than a gap, so the second pass ignores the set rather than dropping a slide. */
function pickImage(byName, want, used) {
  const chain = fallbacks(want);
  for (const name of chain) if (byName[name] && !used.has(name)) return { name, ...byName[name] };
  for (const name of chain) if (byName[name]) return { name, ...byName[name] };
  const spare = Object.keys(byName).find(n => !used.has(n)) || Object.keys(byName)[0];
  return spare ? { name: spare, ...byName[spare] } : null;
}

async function readProduct(handle) {
  const d = await sf(Q_ONE, { h: handle });
  if (!d.product) throw new Error('No product at that link.');
  const p = d.product;
  const byName = {};
  for (const n of p.media.nodes) {
    if (!n.image) continue;
    byName[baseName(n.image.url)] = n.image;
  }
  const [heading, sub] = splitTitle(p.title, p.productType || '');
  return {
    handle: p.handle,
    title: p.title,
    heading, sub,
    sku: p.sku?.value || '',
    order: (p.tags || []).find(t => ORDERS[t]) || 'man-front',
    byName,
  };
}

// ── Cut-out masks, with a cache ─────────────────────────────────

let bgModule = null;
let bgReady = null;

async function bgMod() {
  if (!bgModule) bgModule = await import(BG_CDN);
  return bgModule;
}

/* The model weighs ~88MB. Pull it once, in the background, the moment the page
   opens, so the first Build does not sit there downloading. */
function warmEngine() {
  if (bgReady) return bgReady;
  bgReady = (async () => {
    const m = await bgMod();
    await m.preload({ progress: (key, cur, total) => {
      if (!key.startsWith('fetch')) return;
      const pct = Math.round((cur / total) * 100);
      $('#engineNote').textContent = pct < 100
        ? `Loading the cut-out model, ${pct}%`
        : 'Cut-out model ready.';
    } });
    $('#engineNote').textContent = self.crossOriginIsolated
      ? 'Cut-out model ready (multi-threaded).'
      : 'Cut-out model ready.';
  })().catch(err => {
    $('#engineNote').textContent = `Cut-outs unavailable: ${err.message}`;
    throw err;
  });
  return bgReady;
}

function idb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(CACHE_DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('masks');
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

async function cacheGet(key) {
  try {
    const db = await idb();
    return await new Promise(res => {
      const rq = db.transaction('masks').objectStore('masks').get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}

async function cachePut(key, blob) {
  try {
    const db = await idb();
    db.transaction('masks', 'readwrite').objectStore('masks').put(blob, key);
  } catch { /* a full or blocked store is not worth failing a render over */ }
}

/* Returns a white-on-transparent matte at MASK_W. Kept separate from the photo
   so the cut-out can be applied to the full-resolution original rather than to
   a downscaled copy of it: the matte is soft-edged anyway, the photo is not. */
async function maskFor(url) {
  const key = url.split('?')[0] + '@' + MASK_W;
  const hit = await cacheGet(key);
  if (hit) return createImageBitmap(hit);

  await warmEngine().catch(() => { /* fall through: bgMod() alone still works */ });
  const m = await bgMod();
  const src = await (await fetch(sized(url, MASK_W), { mode: 'cors' })).blob();
  const mask = await m.alphamask(src, { output: { format: 'image/png' } });
  cachePut(key, mask);
  return createImageBitmap(mask);
}

// ── Drawing ─────────────────────────────────────────────────────

function gradient(ctx, S) {
  /* 216.87deg in CSS points down and left, so the gradient line runs from the
     top-right corner to the bottom-left one. */
  const g = ctx.createLinearGradient(W * S, 0, 0, H * S);
  g.addColorStop(0, GRAD.from);
  g.addColorStop(1, GRAD.to);
  return g;
}

function setFont(ctx, weight, px, S) {
  ctx.font = `${weight} ${px * S}px ${getComputedStyle(document.body).fontFamily}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${TYPE.tracking * S}px`;
}

/* Safari only learned ctx.letterSpacing in 17.4. Where it is missing, lay the
   glyphs out by hand so the tracking still lands instead of silently drifting
   the copy wider than the pill that was measured for it. */
function trackedWidth(ctx, text, S) {
  if ('letterSpacing' in ctx) return ctx.measureText(text).width;
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width, 0)
       + TYPE.tracking * S * Math.max(0, text.length - 1);
}

function fillTracked(ctx, text, cx, y, S) {
  if ('letterSpacing' in ctx) { ctx.fillText(text, cx, y); return; }
  const total = trackedWidth(ctx, text, S);
  let x = cx - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + TYPE.tracking * S;
  }
  ctx.textAlign = prev;
}

/* Fit `how` = cover (fill the box, crop the overflow) or contain (fit inside).
   Returns the rectangle to draw the whole bitmap into. */
function fit(bmp, box, how) {
  const s = how === 'cover'
    ? Math.max(box.w / bmp.width, box.h / bmp.height)
    : Math.min(box.w / bmp.width, box.h / bmp.height);
  const w = bmp.width * s, h = bmp.height * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/* Draw a photo into `box`, optionally knocking its background out first.
   destination-in works on a whole canvas, so the cut-out is composited on a
   scratch surface the size of the box and stamped down in one go. */
async function drawPhoto(ctx, S, url, box, { cut, how }) {
  const bw = box.w * S, bh = box.h * S;
  const bmp = await bitmapFrom(sized(url, bw));
  const rect = fit(bmp, { x: 0, y: 0, w: bw, h: bh }, how);

  if (!cut) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x * S, box.y * S, bw, bh);
    ctx.clip();
    ctx.drawImage(bmp, box.x * S + rect.x, box.y * S + rect.y, rect.w, rect.h);
    ctx.restore();
    return;
  }

  const scratch = new OffscreenCanvas(Math.round(bw), Math.round(bh));
  const sx = scratch.getContext('2d');
  sx.drawImage(bmp, rect.x, rect.y, rect.w, rect.h);
  const mask = await maskFor(url);
  sx.globalCompositeOperation = 'destination-in';
  sx.drawImage(mask, rect.x, rect.y, rect.w, rect.h);
  ctx.drawImage(scratch, box.x * S, box.y * S);
}

function drawCopy(ctx, S, heading, sub) {
  ctx.fillStyle = TYPE.colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  setFont(ctx, TYPE.title.weight, TYPE.title.size, S);
  fillTracked(ctx, heading, (W / 2) * S, TYPE.title.top * S, S);

  /* The subhead sits in a 1.5-leaded line box directly under a 1.0-leaded one,
     so its glyphs start half the extra leading below that box's top. */
  const lineTop = TYPE.title.top + TYPE.title.size * TYPE.title.lh;
  const boxH = TYPE.sub.size * TYPE.sub.lh;
  setFont(ctx, TYPE.sub.weight, TYPE.sub.size, S);
  fillTracked(ctx, sub, (W / 2) * S, (lineTop + (boxH - TYPE.sub.size) / 2) * S, S);
}

function drawPill(ctx, S, label) {
  setFont(ctx, PILL.weight, PILL.size, S);
  const textW = trackedWidth(ctx, label, S);
  const w = textW + (PILL.padX * 2 + PILL.border * 2) * S;
  const h = PILL.height * S;
  const x = (W / 2) * S - w / 2;
  const y = (H - PILL.bottom - PILL.height) * S;
  const r = Math.min(PILL.radius * S, h / 2);

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = PILL.fill;
  ctx.fill();
  ctx.lineWidth = PILL.border * S;
  ctx.strokeStyle = PILL.stroke;
  ctx.stroke();

  ctx.fillStyle = TYPE.colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillTracked(ctx, label, (W / 2) * S, y + h / 2, S);
  ctx.textBaseline = 'top';
}

let logoSrc = null;
async function logoImage(colour) {
  if (!logoSrc) logoSrc = await (await fetch('assets/logo.svg')).text();
  const svg = logoSrc.replace(/currentColor/g, colour);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    /* Revoking immediately would race the decode on Safari, so let the task
       queue drain first. */
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

// ── Slides ──────────────────────────────────────────────────────

function newCanvas(S) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * S);
  c.height = Math.round(H * S);
  return c;
}

async function renderCover(S, file, logoColour) {
  const c = newCanvas(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);

  const bmp = await createImageBitmap(file);
  const r = fit(bmp, { x: 0, y: 0, w: c.width, h: c.height }, 'cover');
  ctx.drawImage(bmp, r.x, r.y, r.w, r.h);

  const logo = await logoImage(logoColour);
  ctx.drawImage(logo, (W / 2 - LOGO.w / 2) * S, LOGO.top * S, LOGO.w * S, LOGO.h * S);
  return c;
}

async function renderSlide(S, kind, url, product, cut) {
  const c = newCanvas(S);
  const ctx = c.getContext('2d');

  if (kind === 'macro') {
    /* Full bleed: the close-up is a texture, there is no subject to lift off a
       background, so it covers the frame and no gradient is drawn under it. */
    await drawPhoto(ctx, S, url, { x: 0, y: 0, w: W, h: H }, { cut: false, how: 'cover' });
    return c;
  }

  ctx.fillStyle = gradient(ctx, S);
  ctx.fillRect(0, 0, c.width, c.height);
  await drawPhoto(ctx, S, url, BOX, { cut, how: 'cover' });

  if (kind === 'flat') {
    drawCopy(ctx, S, product.heading, product.sub);
    if (product.sku) drawPill(ctx, S, `tenzen.in/${product.sku}`);
  }
  return c;
}

// ── State ───────────────────────────────────────────────────────

const state = {
  catalogue: [],
  cover: null,
  logo: '#ffffff',
  size: 1620,
  fmt: 'png',
  cut: true,
  product: null,
  slides: [],
};

// ── Build ───────────────────────────────────────────────────────

function slugFor(i, name) {
  if (i === 0) return 'cover';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function build() {
  const p = state.product;
  if (!state.cover || !p) return;

  $('#btnBuild').disabled = true;
  $('#btnSaveAll').hidden = true;
  $('#btnShare').hidden = true;
  state.slides = [];

  const S = state.size / W;
  const order = ORDERS[$('#fOrder').value] || ORDERS['man-front'];
  p.heading = $('#fHeading').value.trim();
  p.sub = $('#fSub').value.trim();
  p.sku = $('#fSku').value.trim();

  const plan = [{ kind: 'cover', name: 'Cover' }];
  const missing = [];
  const used = new Set();
  order.forEach((want, i) => {
    const hit = pickImage(p.byName, want, used);
    if (!hit) return;
    used.add(hit.name);
    if (hit.name !== want) missing.push(`${want} -> ${hit.name}`);
    plan.push({ kind: KINDS[i], name: hit.name, url: hit.url });
  });

  skeleton(plan);
  const mime = state.fmt === 'png' ? 'image/png' : 'image/jpeg';
  const ext = state.fmt === 'png' ? 'png' : 'jpg';

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    say(`Rendering ${i + 1} of ${plan.length}: ${step.name}…`);
    try {
      const canvas = step.kind === 'cover'
        ? await renderCover(S, state.cover, state.logo)
        : await renderSlide(S, step.kind, step.url, p,
            state.cut && step.kind !== 'macro');

      const blob = await new Promise(res => canvas.toBlob(res, mime, 0.95));
      const file = new File(
        [blob],
        `${p.sku || p.handle}-${i + 1}-${slugFor(i, step.name)}.${ext}`,
        { type: mime });
      state.slides.push(file);
      fillTile(i, file);
    } catch (err) {
      failTile(i, err.message);
    }
  }

  $('#btnBuild').disabled = false;
  if (state.slides.length) {
    $('#btnSaveAll').hidden = false;
    if (navigator.canShare?.({ files: state.slides })) $('#btnShare').hidden = false;
  }
  say(missing.length
    ? `Done. Substituted: ${missing.join(', ')}.`
    : `Done. ${state.slides.length} slides.`,
    missing.length ? 'warn' : 'ok');
}

// ── Preview tiles ───────────────────────────────────────────────

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
        <button type="button" class="tile__save" hidden>Save</button>
      </div>`;
    grid.appendChild(tile);
  });
}

function fillTile(i, file) {
  const tile = $(`.tile[data-i="${i}"]`);
  if (!tile) return;
  const frame = $('.tile__frame', tile);
  frame.classList.remove('is-busy');
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.alt = file.name;
  frame.appendChild(img);
  frame.addEventListener('click', () => openLightbox(img.src, file.name));

  const save = $('.tile__save', tile);
  save.hidden = false;
  save.addEventListener('click', e => { e.stopPropagation(); saveOne(file); });
}

function failTile(i, msg) {
  const tile = $(`.tile[data-i="${i}"]`);
  if (!tile) return;
  $('.tile__frame', tile).classList.remove('is-busy');
  $('.tile__name', tile).textContent = msg;
  $('.tile__name', tile).style.color = 'var(--accent)';
}

function openLightbox(src, alt) {
  $('#lbImg').src = src;
  $('#lbImg').alt = alt;
  $('#lightbox').hidden = false;
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

/* One file at a time, with a beat between each. Browsers rate-limit a burst of
   programmatic downloads and will silently drop the tail of one. */
async function saveAll() {
  for (const file of state.slides) {
    saveOne(file);
    await new Promise(r => setTimeout(r, 400));
  }
  say(`Saved ${state.slides.length} images.`, 'ok');
}

/* On a phone the share sheet is the only route into Photos, and it takes the
   whole set at once - still as separate images, never a zip. */
async function shareAll() {
  try {
    await navigator.share({ files: state.slides, title: state.product?.title || 'Carousel' });
  } catch (err) {
    if (err.name !== 'AbortError') say(err.message, 'err');
  }
}

// ── Product picker ──────────────────────────────────────────────

function score(p, q) {
  const hay = `${p.title} ${p.sku} ${p.handle}`.toLowerCase();
  if (!q) return 1;
  if (p.sku.toLowerCase() === q) return 100;
  if (hay.includes(q)) return 10 - hay.indexOf(q) / 100;
  const words = q.split(/\s+/).filter(Boolean);
  return words.every(w => hay.includes(w)) ? 5 : 0;
}

function renderList(q) {
  const list = $('#prodList');
  const hits = state.catalogue
    .map(p => ({ p, s: score(p, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40);

  list.innerHTML = '';
  for (const { p } of hits) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.innerHTML = `<b></b><code></code>`;
    $('b', li).textContent = p.title;
    $('code', li).textContent = p.sku;
    li.addEventListener('mousedown', e => { e.preventDefault(); choose(p.handle); });
    list.appendChild(li);
  }
  list.hidden = hits.length === 0;
  $('#prodInput').setAttribute('aria-expanded', String(!list.hidden));
}

/* Accepts whatever is to hand: a full PDP link, a tenzen.in short link, a bare
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
  $('#prodList').hidden = true;
  say('Reading the product…');
  try {
    const p = await readProduct(handle);
    state.product = p;
    $('#prodInput').value = p.title;
    $('#fHeading').value = p.heading;
    $('#fSub').value = p.sub;
    $('#fSku').value = p.sku;
    $('#fOrder').value = p.order;
    $('#prodCard').hidden = false;

    const n = Object.keys(p.byName).length;
    $('#prodNote').textContent = `${n} images on this SKU. Order tag: ${p.order}.`;
    say('');
    refreshBuild();
  } catch (err) {
    say(err.message, 'err');
  }
}

function refreshBuild() {
  $('#btnBuild').disabled = !(state.cover && state.product);
}

// ── Cover input ─────────────────────────────────────────────────

function setCover(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.cover = file;
  warmEngine().catch(() => {});
  const thumb = $('#coverThumb');
  thumb.src = URL.createObjectURL(file);
  thumb.hidden = false;
  $('#dropInner').hidden = true;
  $('#drop').classList.add('has-img');
  refreshBuild();
}

// ── Wiring ──────────────────────────────────────────────────────

function segGroup(attr, onPick) {
  $$(`.seg__btn[data-${attr}]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      $$('.seg__btn', group).forEach(b => {
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
      'Helvetica Neue is not on this device, so the slide copy will fall back to Arial.';
  }

  // Cover
  const drop = $('#drop');
  drop.addEventListener('click', () => $('#coverFile').click());
  drop.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#coverFile').click(); }
  });
  $('#coverFile').addEventListener('change', e => setCover(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
    e.preventDefault(); drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => {
    e.preventDefault(); drop.classList.remove('is-over');
  }));
  drop.addEventListener('drop', e => setCover(e.dataTransfer.files[0]));
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
    const handle = resolve(input.value);
    if (handle) { choose(handle); return; }
    renderList(input.value.trim().toLowerCase());
  });
  input.addEventListener('focus', () => renderList(input.value.trim().toLowerCase()));
  input.addEventListener('blur', () => setTimeout(() => { $('#prodList').hidden = true; }, 120));

  // Actions
  $('#btnBuild').addEventListener('click', build);
  $('#btnSaveAll').addEventListener('click', saveAll);
  $('#btnShare').addEventListener('click', shareAll);
  $('#btnReset').addEventListener('click', () => location.reload());

  $('#lbClose').addEventListener('click', () => { $('#lightbox').hidden = true; });
  $('#lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') $('#lightbox').hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $('#lightbox').hidden = true;
  });

  // Catalogue + engine, both in the background
  loadCatalogue().then(list => {
    state.catalogue = list;
    $('#prodNote').textContent = `${list.length} products loaded. Search, paste a link, or type a SKU.`;
  }).catch(err => {
    $('#prodNote').textContent = `Could not load the catalogue: ${err.message}`;
    $('#prodNote').className = 'note note--err';
  });

  /* The model is ~88MB. Holding it back until the user has actually picked
     something keeps a casual page open off their mobile data, and by the time
     they have chosen both a cover and a product it is usually already down. */
  $('#engineNote').textContent = 'Cut-out model loads when you pick a cover or a product.';
}

init();
