/* Drawing the slides.

   Every number here is lifted from the Figma board and expressed in its
   3000x4000 design space. A slide is drawn once, at whatever size it is wanted
   at, by multiplying through a single scale factor S - so 1080, a 900px live
   preview and a 3000px export are the same drawing rather than one resampled
   from the other, and there is no second set of coordinates to fall out of step.

   Photographs and mattes are held in memory once decoded. That is what makes
   the editor's preview redraw on every pointer move affordable: after the first
   pass a redraw is a handful of drawImage calls, not a fetch and a decode. */

import { sized } from './shopify.js';
import { matteFor } from './cutout.js';
import * as F from './frame.js';

export const W = 3000, H = 4000;

const GRAD = { from: '#F2F2F2', to: '#C6C9CC' };   // 216.87deg, top-right to bottom-left
const BOX  = { x: 166, y: 0, w: 2667, h: 4000 };   // the contained artwork
const LOGO = { w: 609.757, h: 200, top: 250 };

const TYPE = {
  colour:   '#768696',
  tracking: -2,
  title: { top: 250, size: 100, weight: 500, lh: 1.0 },
  sub:   { size: 76, weight: 400, lh: 1.5 },
};

const PILL = {
  bottom: 250, height: 236, padX: 120, padY: 64,
  border: 4, radius: 136, size: 100, weight: 500,
  fill: 'rgba(255,255,255,0.2)', stroke: '#ffffff',
};

const FAMILY = '"Helvetica Neue", "HelveticaNeue", Helvetica, Arial, sans-serif';

/* Every slide frames its photograph against the whole 3:4, the cover included.

   The inset box the Figma board draws the artwork in is still honoured, but as
   a starting SCALE rather than as a smaller frame to be trapped in: a 2:3 photo
   in a 2:3 box has no room to move at all, which made four of the six slides
   impossible to reframe. Measured against the full frame, the same placement is
   simply a scale below 1, and there is slack on both axes from the start. */
export function boxFor() {
  return { x: 0, y: 0, w: W, h: H };
}

/* Where a slide starts: the cover and the close-up fill the frame, the rest sit
   in the board's inset box. */
export function defaultAdjust(kind, nw, nh) {
  if (kind === 'cover' || kind === 'macro' || !nw) return { ...F.IDENTITY };
  return { scale: F.scaleForInset(nw, nh, W, H, BOX.w, BOX.h), cx: 0, cy: 0 };
}

/* Below 1 a photo no longer covers the frame. That is fine wherever something
   is drawn behind it - the gradient on a flat or a model slide, and a cut-out
   is transparent around the garment anyway - and wrong on the cover and the
   close-up, where the photo IS the background. */
export function minScaleFor(kind) {
  return (kind === 'cover' || kind === 'macro') ? 1 : 0.35;
}

// ── Caches ──────────────────────────────────────────────────────

const photos = new Map();   // cacheKey -> ImageBitmap
const mattes = new Map();   // url      -> ImageBitmap

export function forget(key) {
  photos.get(key)?.close?.();
  photos.delete(key);
}

/* A slide's photograph. Either a URL on Shopify's CDN, or a bitmap the user
   handed us for the cover. Requested at the width it will actually be drawn at,
   rounded to a step so that nudging the preview does not thrash the cache. */
async function photoFor(slide, wantW) {
  if (slide.bitmap) {
    return slide.bitmap;
  }
  const step = Math.min(2800, Math.max(700, Math.ceil(wantW / 350) * 350));
  const key = `${slide.url.split('?')[0]}@${step}`;
  if (photos.has(key)) return photos.get(key);
  const res = await fetch(sized(slide.url, step), { mode: 'cors' });
  if (!res.ok) throw new Error(`${res.status} fetching ${slide.name}`);
  const bmp = await createImageBitmap(await res.blob());
  photos.set(key, bmp);
  return bmp;
}

async function matte(url) {
  if (mattes.has(url)) return mattes.get(url);
  const m = await matteFor(url);
  mattes.set(url, m);
  return m;
}

/* Warm everything a slide needs, so the editor's first redraw is not the one
   that waits on the network. */
export async function preload(slide, cut, wantW = 1200) {
  await photoFor(slide, wantW);
  if (cut && slide.url && slide.kind !== 'macro' && slide.kind !== 'cover') await matte(slide.url);
}

// ── Helpers ─────────────────────────────────────────────────────

function gradient(ctx, S) {
  /* 216.87deg in CSS points down and to the left, so the gradient line runs
     corner to corner from top-right to bottom-left. */
  const g = ctx.createLinearGradient(W * S, 0, 0, H * S);
  g.addColorStop(0, GRAD.from);
  g.addColorStop(1, GRAD.to);
  return g;
}

function setFont(ctx, weight, px, S) {
  ctx.font = `${weight} ${px * S}px ${FAMILY}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${TYPE.tracking * S}px`;
}

/* Safari only learned ctx.letterSpacing in 17.4. Where it is missing the glyphs
   are laid out by hand, so the tracking still lands instead of quietly running
   the copy wider than the pill that was measured for it. */
function trackedWidth(ctx, text, S) {
  if ('letterSpacing' in ctx) return ctx.measureText(text).width;
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width, 0)
       + TYPE.tracking * S * Math.max(0, text.length - 1);
}

function fillTracked(ctx, text, cx, y, S) {
  if ('letterSpacing' in ctx) { ctx.fillText(text, cx, y); return; }
  let x = cx - trackedWidth(ctx, text, S) / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + TYPE.tracking * S;
  }
  ctx.textAlign = align;
}

// ── Pieces ──────────────────────────────────────────────────────

/* Draw a photograph into `box`, knocking its background out where asked.
   destination-in works on a whole canvas, so a cut-out is composited on a
   scratch surface the size of the box and stamped down in one go. */
async function drawPhoto(ctx, S, slide, box, cut) {
  const bw = box.w * S, bh = box.h * S;
  const bmp = await photoFor(slide, bw);
  const r = F.place(bmp.width, bmp.height, bw, bh, slide.adjust);

  if (!cut) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x * S, box.y * S, bw, bh);
    ctx.clip();
    ctx.drawImage(bmp, box.x * S + r.ox, box.y * S + r.oy, r.dw, r.dh);
    ctx.restore();
    return;
  }

  const scratch = new OffscreenCanvas(Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh)));
  const sx = scratch.getContext('2d');
  sx.drawImage(bmp, r.ox, r.oy, r.dw, r.dh);
  sx.globalCompositeOperation = 'destination-in';
  sx.drawImage(await matte(slide.url), r.ox, r.oy, r.dw, r.dh);
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
  const w = trackedWidth(ctx, label, S) + (PILL.padX * 2 + PILL.border * 2) * S;
  const h = PILL.height * S;
  const x = (W / 2) * S - w / 2;
  const y = (H - PILL.bottom - PILL.height) * S;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(PILL.radius * S, h / 2));
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

let logoSvg = null;
const logos = new Map();

/* The wordmark is authored with fill="currentColor", so recolouring it is a
   string swap rather than a second asset. */
async function logoImage(colour) {
  if (logos.has(colour)) return logos.get(colour);
  if (!logoSvg) logoSvg = await (await fetch('assets/logo.svg')).text();
  const url = URL.createObjectURL(
    new Blob([logoSvg.replace(/currentColor/g, colour)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  logos.set(colour, img);
  return img;
}

// ── The one entry point ─────────────────────────────────────────

/* Draw `slide` into `canvas` at whatever size the canvas already is. Everything
   - preview, tile, export - goes through here, which is why the preview can be
   trusted as the thing that will be saved. */
export async function drawInto(canvas, slide, product, cut) {
  const S = canvas.width / W;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (slide.kind === 'cover') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await drawPhoto(ctx, S, slide, boxFor('cover'), false);
    const logo = await logoImage(slide.logo || '#ffffff');
    ctx.drawImage(logo, (W / 2 - LOGO.w / 2) * S, LOGO.top * S, LOGO.w * S, LOGO.h * S);
    return canvas;
  }

  if (slide.kind === 'macro') {
    /* Full bleed. A fabric close-up is a texture with no subject to lift off a
       background, so it covers the frame and no gradient is drawn beneath it. */
    await drawPhoto(ctx, S, slide, boxFor('macro'), false);
    return canvas;
  }

  ctx.fillStyle = gradient(ctx, S);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await drawPhoto(ctx, S, slide, boxFor(), cut);

  if (slide.kind === 'flat') {
    drawCopy(ctx, S, product.heading, product.sub);
    if (product.sku) drawPill(ctx, S, `tenzen.in/${product.sku}`);
  }
  return canvas;
}

export function canvasAt(width) {
  const c = document.createElement('canvas');
  c.width = Math.round(width);
  c.height = Math.round(width * H / W);
  return c;
}

export async function renderToFile(slide, product, cut, width, fmt, name) {
  const canvas = canvasAt(width);
  await drawInto(canvas, slide, product, cut);
  const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
  return new Promise(res => canvas.toBlob(
    b => res(new File([b], name, { type: mime })), mime, 0.95));
}
