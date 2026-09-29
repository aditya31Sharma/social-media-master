/* Drawing the slides.

   Every number here is lifted from the Figma board and expressed in its
   3000x4000 design space. A slide is drawn by multiplying through a single
   scale factor S, so 1080 and 3000 are the same drawing rather than one
   resampled from the other.

   The slide is made of three layers, and that split is what makes the editor
   feel like an app rather than a form:

     background   the gradient, or white on the cover
     photograph   the cut-out, the only thing an edit moves
     foreground   the copy, the pill, the wordmark

   For export they are composited onto one canvas. For editing they are handed
   to the DOM as two static canvases with an <img> between them, so dragging is
   one transform on one element and the compositor does the rest. Redrawing the
   whole canvas per pointer move - which is what this replaced - meant building
   a fresh offscreen surface and recompositing a matte sixty times a second. */

import { sized } from './shopify.js';
import { matteFor } from './cutout.js';
import * as F from './frame.js';

export const W = 3000, H = 4000;

const GRAD = { from: '#F2F2F2', to: '#C6C9CC' };   // 216.87deg, top-right to bottom-left
const BOX  = { x: 166, y: 0, w: 2667, h: 4000 };   // the board's inset artwork
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

/* Every slide frames its photograph against the whole 3:4. The board's inset
   box is honoured as a starting SCALE, not as a smaller frame to be trapped
   in - see defaultAdjust. */
export function boxFor() {
  return { x: 0, y: 0, w: W, h: H };
}

/* Where a slide starts: the cover and the close-up fill the frame, the rest sit
   in the board's inset box. */
export function defaultAdjust(kind, nw, nh) {
  if (kind === 'cover' || kind === 'macro' || !nw) return { ...F.IDENTITY };
  return { scale: F.scaleForInset(nw, nh, W, H, BOX.w, BOX.h), cx: 0, cy: 0 };
}

// -- Caches ------------------------------------------------------

const photos = new Map();   // key -> ImageBitmap
const mattes = new Map();   // url -> ImageBitmap
const layers = new Map();   // key -> { url, nw, nh }

const photoKey = (slide, step) => slide.bitmap ? `bitmap:${slide.name}` : `${slide.url.split('?')[0]}@${step}`;

async function photoFor(slide, wantW) {
  if (slide.bitmap) return slide.bitmap;
  const step = Math.min(2800, Math.max(700, Math.ceil(wantW / 350) * 350));
  const key = photoKey(slide, step);
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

export async function preload(slide, cut, wantW = 1400) {
  await photoFor(slide, wantW);
  if (cut && slide.url) await matte(slide.url);
}

/* The photograph on its own, background already lifted, as something the DOM
   can move: one <img> the compositor owns. Built once per slide and cached, so
   opening the editor a second time is instant. */
export async function photoLayer(slide, cut, maxW = 1400) {
  const key = `${photoKey(slide, Math.ceil(maxW / 350) * 350)}:${cut ? 'cut' : 'raw'}`;
  if (layers.has(key)) return layers.get(key);

  const bmp = await photoFor(slide, maxW);
  const s = Math.min(1, maxW / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));

  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  if (cut && slide.url) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(await matte(slide.url), 0, 0, w, h);
  }
  const url = URL.createObjectURL(await c.convertToBlob({ type: 'image/png' }));
  const out = { url, nw: bmp.width, nh: bmp.height };
  layers.set(key, out);
  return out;
}

// -- Helpers -----------------------------------------------------

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

// -- The three layers --------------------------------------------

/* Whatever the photograph does not cover. The cover sits on white because its
   photograph is the design; everything else sits on the gradient, which is why
   a cut-out garment reads as placed rather than as floating. */
export function drawBackground(canvas, slide) {
  const S = canvas.width / W;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = slide.kind === 'cover' ? '#ffffff' : gradient(ctx, S);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/* `clear` is false when this is painting onto the flattened slide, where the
   background and the photograph are already down. Clearing there would wipe
   them both. */
export async function drawForeground(canvas, slide, product, clear = true) {
  const S = canvas.width / W;
  const ctx = canvas.getContext('2d');
  if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (slide.kind === 'cover') {
    const logo = await logoImage(slide.logo || '#ffffff');
    ctx.drawImage(logo, (W / 2 - LOGO.w / 2) * S, LOGO.top * S, LOGO.w * S, LOGO.h * S);
    return;
  }
  if (slide.kind !== 'flat' || !product) return;

  ctx.fillStyle = TYPE.colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  setFont(ctx, TYPE.title.weight, TYPE.title.size, S);
  fillTracked(ctx, product.heading, (W / 2) * S, TYPE.title.top * S, S);

  /* The subhead sits in a 1.5-leaded line box directly under a 1.0-leaded one,
     so its glyphs start half the extra leading below that box's top. */
  const lineTop = TYPE.title.top + TYPE.title.size * TYPE.title.lh;
  const boxH = TYPE.sub.size * TYPE.sub.lh;
  setFont(ctx, TYPE.sub.weight, TYPE.sub.size, S);
  fillTracked(ctx, product.sub, (W / 2) * S, (lineTop + (boxH - TYPE.sub.size) / 2) * S, S);

  if (!product.sku) return;
  const label = `tenzen.in/${product.sku}`;
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
  ctx.textBaseline = 'middle';
  fillTracked(ctx, label, (W / 2) * S, y + h / 2, S);
  ctx.textBaseline = 'top';
}

// -- The flattened slide, for tiles and export -------------------

export async function drawInto(canvas, slide, product, cut) {
  const S = canvas.width / W;
  const ctx = canvas.getContext('2d');

  drawBackground(canvas, slide);

  const bmp = await photoFor(slide, canvas.width);
  const r = F.place(bmp.width, bmp.height, canvas.width, canvas.height, slide.adjust);

  if (cut && slide.url) {
    /* destination-in works on a whole canvas, so the cut-out is composited on a
       scratch surface and stamped down in one go. */
    const scratch = new OffscreenCanvas(canvas.width, canvas.height);
    const sx = scratch.getContext('2d');
    sx.drawImage(bmp, r.ox, r.oy, r.dw, r.dh);
    sx.globalCompositeOperation = 'destination-in';
    sx.drawImage(await matte(slide.url), r.ox, r.oy, r.dw, r.dh);
    ctx.drawImage(scratch, 0, 0);
  } else {
    ctx.drawImage(bmp, r.ox, r.oy, r.dw, r.dh);
  }

  await drawForeground(canvas, slide, product, false);
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
