/* Drawing the slides.

   Every number here is lifted from the Figma board and expressed in its
   3000x4000 design space. A slide is drawn once, at whatever size it is being
   exported at, by multiplying through a single scale factor S - so 1080 and
   3000 are the same drawing rather than one resampled from the other, and there
   is no second set of coordinates to fall out of step. */

import { sized } from './shopify.js';
import { matteFor } from './cutout.js';

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

// ── Helpers ─────────────────────────────────────────────────────

async function bitmapFrom(src) {
  const res = await fetch(src, { mode: 'cors' });
  if (!res.ok) throw new Error(`${res.status} fetching ${src.split('/').pop()}`);
  return createImageBitmap(await res.blob());
}

function canvasAt(S) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * S);
  c.height = Math.round(H * S);
  return c;
}

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

function coverRect(bmp, w, h) {
  const s = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * s, dh = bmp.height * s;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

// ── Pieces ──────────────────────────────────────────────────────

/* Draw a photograph into `box`, knocking its background out first where asked.
   destination-in works on a whole canvas, so the cut-out is composited on a
   scratch surface the size of the box and stamped down in one go. */
async function drawPhoto(ctx, S, url, box, cut) {
  const bw = box.w * S, bh = box.h * S;
  const bmp = await bitmapFrom(sized(url, bw));
  const r = coverRect(bmp, bw, bh);

  if (!cut) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x * S, box.y * S, bw, bh);
    ctx.clip();
    ctx.drawImage(bmp, box.x * S + r.x, box.y * S + r.y, r.w, r.h);
    ctx.restore();
    return;
  }

  const scratch = new OffscreenCanvas(Math.round(bw), Math.round(bh));
  const sx = scratch.getContext('2d');
  sx.drawImage(bmp, r.x, r.y, r.w, r.h);
  const matte = await matteFor(url);
  sx.globalCompositeOperation = 'destination-in';
  sx.drawImage(matte, r.x, r.y, r.w, r.h);
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
const logoCache = new Map();

/* The wordmark is authored with fill="currentColor", so recolouring it is a
   string swap rather than a second asset. */
async function logoImage(colour) {
  if (logoCache.has(colour)) return logoCache.get(colour);
  if (!logoSvg) logoSvg = await (await fetch('assets/logo.svg')).text();
  const url = URL.createObjectURL(
    new Blob([logoSvg.replace(/currentColor/g, colour)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  logoCache.set(colour, img);
  return img;
}

// ── Slides ──────────────────────────────────────────────────────

/* The cover. `rect` comes straight from the editor, computed for this frame
   size, so what was framed on screen is exactly what is drawn. */
export async function renderCover(S, bitmap, rect, logoColour) {
  const c = canvasAt(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, rect.ox, rect.oy, rect.dw, rect.dh);

  const logo = await logoImage(logoColour);
  ctx.drawImage(logo, (W / 2 - LOGO.w / 2) * S, LOGO.top * S, LOGO.w * S, LOGO.h * S);
  return c;
}

export async function renderSlide(S, kind, url, product, cut) {
  const c = canvasAt(S);
  const ctx = c.getContext('2d');

  if (kind === 'macro') {
    /* Full bleed. A fabric close-up is a texture with no subject to lift off a
       background, so it covers the frame and no gradient is drawn beneath it. */
    await drawPhoto(ctx, S, url, { x: 0, y: 0, w: W, h: H }, false);
    return c;
  }

  ctx.fillStyle = gradient(ctx, S);
  ctx.fillRect(0, 0, c.width, c.height);
  await drawPhoto(ctx, S, url, BOX, cut);

  if (kind === 'flat') {
    drawCopy(ctx, S, product.heading, product.sub);
    if (product.sku) drawPill(ctx, S, `tenzen.in/${product.sku}`);
  }
  return c;
}

export function toFile(canvas, name, fmt) {
  const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
  return new Promise(res => canvas.toBlob(
    b => res(new File([b], name, { type: mime })), mime, 0.95));
}
