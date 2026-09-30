/* Drawing the reel.

   One frame is: white, the four photographs at their angles, the two turning
   garments, the wordmark, the two blocks of type. Same three-layer thinking as
   the carousel - what does not change is drawn once and reused, what does is
   drawn per frame - because 900 frames is 900 chances to waste time.

   The photographs do not move. They are composited once into a still plate at
   the start, and every frame is that plate plus the garments plus the type. */

import * as G from './reel-geom.js';
import * as F from './frame.js';
import { Stage, loadModel } from './stage3d.js';

const rad = d => d * Math.PI / 180;

/* Which photograph a slot is showing at time t. Each slot holds an ordered
   list and they share the clip equally, so a slot with five spends three
   seconds on each and a slot with two spends seven and a half. Hard cuts. */
export function photoAt(list, t) {
  if (!list || !list.length) return null;
  const i = Math.min(list.length - 1, Math.floor((t / G.DURATION) * list.length));
  return list[i];
}

/* Every distinct image any slot will show, so they can all be fetched before
   the render rather than stalling it halfway through. */
export function allPhotos(slots) {
  const seen = new Map();
  for (const list of Object.values(slots || {})) {
    for (const p of list || []) if (p?.url && !seen.has(p.url)) seen.set(p.url, p);
  }
  return [...seen.values()];
}

function setFont(ctx, weight, px, S) {
  ctx.font = `${weight} ${px * S}px ${G.FAMILY}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${G.TEXT.tracking * S}px`;
}

/* Safari only learned ctx.letterSpacing in 17.4; where it is missing the
   glyphs are placed by hand so the tracking still lands. Same as the carousel. */
function drawTracked(ctx, text, x, y, align, S) {
  if ('letterSpacing' in ctx) { ctx.textAlign = align; ctx.fillText(text, x, y); return; }
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width;
  w += G.TEXT.tracking * S * Math.max(0, text.length - 1);
  let cx = align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + G.TEXT.tracking * S; }
}

function drawBlock(ctx, spec, title, sub, S) {
  ctx.save();
  ctx.globalCompositeOperation = spec.blend;
  ctx.fillStyle = spec.fill;
  ctx.textBaseline = 'top';
  setFont(ctx, G.TEXT.title.weight, G.TEXT.title.size, S);
  drawTracked(ctx, title, spec.x * S, spec.y * S, spec.align, S);
  /* The subhead sits in a 1.5-leaded box under a 1.0-leaded one, so its
     glyphs start half the extra leading below that box's top. */
  const lineTop = spec.y + G.TEXT.title.size * G.TEXT.title.lh;
  const boxH = G.TEXT.sub.size * G.TEXT.sub.lh;
  setFont(ctx, G.TEXT.sub.weight, G.TEXT.sub.size, S);
  drawTracked(ctx, sub, spec.x * S, (lineTop + (boxH - G.TEXT.sub.size) / 2) * S, spec.align, S);
  ctx.restore();
}

/* A photograph fills its rectangle the way `object-fit: cover` would, then the
   whole thing is turned about the rectangle's centre. The adjustment is the
   carousel's: scale and a centre offset in fractions, so the framing set on a
   preview lands identically at any export size. */
function drawPhoto(ctx, spec, img, adjust, S) {
  const w = spec.w * S, h = spec.h * S;
  ctx.save();
  ctx.translate(spec.cx * S, spec.cy * S);
  ctx.rotate(rad(spec.deg));
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  if (img) {
    const r = F.place(img.width, img.height, w, h, adjust || F.IDENTITY);
    ctx.drawImage(img, -w / 2 + r.ox, -h / 2 + r.oy, r.dw, r.dh);
  } else {
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

export async function createReel({ width, top, bottom, slots, adjusts, logoUrl }) {
  const S = width / G.W;
  const height = Math.round(G.H * S);

  /* The garments' boxes in render pixels, which is what the stage needs. */
  const boxOf = g => ({
    x: Math.round(g.x * S), y: Math.round(g.y * S),
    w: Math.round(g.w * S), h: Math.round(g.h * S),
  });

  const stage = new Stage(width, height);
  const [topModel, bottomModel] = await Promise.all([loadModel(top.glb), loadModel(bottom.glb)]);
  /* FILL was set by eye against the Figma board, which is what the brief
     asked for: the flat art in it leaves a margin inside its 2:3 box and a
     bare model does not, so fitting the box edge to edge renders both
     garments noticeably larger than the board shows them. */
  stage.add(bottomModel, boxOf(G.GARMENTS.bottom), G.FIT.bottom.fill, Math.round(G.FIT.bottom.offsetY * S));
  stage.add(topModel, boxOf(G.GARMENTS.top), G.FIT.top.fill, Math.round(G.FIT.top.offsetY * S));

  /* The still plate: white and the four photographs, drawn once. */
  const plate = new OffscreenCanvas(width, height);
  const out = new OffscreenCanvas(width, height);
  const octx = out.getContext('2d');

  let logo = null;
  if (logoUrl) { logo = new Image(); logo.src = logoUrl; await logo.decode().catch(() => { logo = null; }); }

  function paintPlate(t) {
    const ctx = plate.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    for (const spec of G.PHOTOS) {
      const shot = photoAt(slots[spec.slot], t);
      drawPhoto(ctx, spec, shot?.bitmap || null, adjusts?.[spec.slot]?.[shot?.url], S);
    }
  }

  /* Only repainted when a slot actually changes picture, which on a normal
     reel is a handful of times in 900 frames rather than 900. */
  let plateKey = null;
  function plateFor(t) {
    const key = G.PHOTOS.map(s => photoAt(slots[s.slot], t)?.url || '-').join('|');
    if (key !== plateKey) { plateKey = key; paintPlate(t); }
    return plate;
  }

  function drawFrame(i) {
    const t = (i / G.FRAMES) * G.DURATION;
    const turn = (i / G.FRAMES) * Math.PI * 2;      // one full turn, seamless

    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, width, height);
    octx.drawImage(plateFor(t), 0, 0);
    octx.drawImage(stage.render(turn), 0, 0);

    if (logo) {
      octx.drawImage(logo, (G.W / 2 - G.LOGO.w / 2) * S, G.LOGO.top * S, G.LOGO.w * S, G.LOGO.h * S);
    }
    drawBlock(octx, G.TEXT.topRight, top.heading, top.sub, S);
    drawBlock(octx, G.TEXT.bottomLeft, bottom.heading, bottom.sub, S);
    return out;
  }

  return { width, height, drawFrame, dispose: () => stage.dispose() };
}
