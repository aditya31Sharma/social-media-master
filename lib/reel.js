/* Drawing the reel.

   One frame is: the gradient, the four photographs at their angles, the two turning
   garments, the wordmark, the two blocks of type. Same three-layer thinking as
   the carousel - what does not change is drawn once and reused, what does is
   drawn per frame - because 900 frames is 900 chances to waste time.

   The photographs do not move. They are composited once into a still plate at
   the start, and every frame is that plate plus the garments plus the type. */

import * as G from './reel-geom.js';
import { paintReelBackground } from './reel-background.js';
import * as F from './frame.js';
import { OutfitStage } from './stage3d.js';

const rad = d => d * Math.PI / 180;

/* Which photograph a corner is showing at time t.

   Two ways a corner can run. Left to itself it holds each shot for a fixed
   half second; given an explicit order it shares the clip equally, so five
   shots get three seconds each and two get seven and a half. Hard cuts either
   way. `hold` on the list is what distinguishes them. */
export function photoAt(list, t) {
  if (!list || !list.length) return null;
  /* `times[k]` is when photograph k comes up. Holds are not equal - they
     lengthen across the clip - so the position has to be looked up rather
     than divided out. Before its turn comes round a corner holds its first
     shot; staggering the starts is what stops all four cutting together,
     which reads as a glitch rather than as four things happening. */
  if (list.times) {
    if (t <= list.times[0]) return list[0];
    for (let k = list.times.length - 1; k >= 0; k--) if (t >= list.times[k]) return list[k];
    return list[0];
  }
  const i = Math.min(list.length - 1, Math.floor((t / G.DURATION) * list.length));
  return list[i];
}

/* Integrate a smooth change in cut frequency, then place a cut at each whole
   beat. Frequency is constant through DECEL_FROM; smoothstep gives the final
   slowdown zero slope at both ends, so it never lurches into deceleration. */
function photoHolds(start, duration, first, final) {
  const from = Math.min(G.DECEL_FROM, duration), span = duration - from;
  const fast = 1 / first, slow = 1 / final;
  const phase = t => {
    const u = span ? Math.max(0, Math.min(1, (t - from) / span)) : 0;
    return fast * t + (slow - fast) * span * (u ** 3 - u ** 4 / 2);
  };
  const origin = phase(start), beats = phase(duration) - origin;
  const times = [start];
  for (let beat = 1; beat < beats - 1e-9; beat++) {
    let lo = times[times.length - 1], hi = duration;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (phase(mid) - origin < beat) lo = mid; else hi = mid;
    }
    times.push(Math.round((lo + hi) / 2 * 1e9) / 1e9);
  }
  // A partial final beat must not create a faster flash of the closing shot.
  const n = times.length;
  if (n > 1 && duration - times[n - 1] < times[n - 1] - times[n - 2]) times.pop();
  return times.map((t, i) => (times[i + 1] ?? duration) - t);
}

/* Fisher-Yates over a copy. */
function shuffled(items, rnd) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Expand one chosen opening shot into the whole fifteen seconds: it leads,
   then everything the SKU has follows in a random order, reshuffled on each
   pass so a short set does not visibly repeat the same cycle.

   Resolved ONCE, here, and handed to the renderer as a fixed list. Shuffling
   inside the frame loop would draw a different photograph on every one of the
   900 frames instead of every thirtieth. */
/* The chosen photograph is where the corner ENDS, not where it begins: the
   last frame is the one that stays on screen, so that is the one worth
   choosing. Everything the SKU has runs before it, fast at first and slowing
   into it.

   The photo cadence stays fast until the final three seconds, then eases
   down. The selected closing shot occupies the final hold.

   Resolved ONCE, here. Shuffling inside the frame loop would draw a different
   photograph on all 900 frames instead of on the couple of dozen cuts. */
export function closingSequence(last, all, {
  duration = G.DURATION, start = 0,
  first = G.SWITCH_FIRST, final = G.SWITCH_LAST, rnd = Math.random,
} = {}) {
  const holds = photoHolds(start, duration, first, final);
  const n = holds.length;

  const rest = all.filter(p => p.url !== last.url);
  const out = [];
  let pass = shuffled(rest, rnd);
  while (out.length < n - 1) {
    if (!pass.length) pass = shuffled(rest.length ? rest : [last], rnd);
    out.push(pass.shift());
  }
  out.push(last);                       // the shot it closes on

  /* Each turn of the deck gets its own angle and size. Dealt HERE, once, for
     the same reason the shuffle is: doing it per frame would re-roll the card
     on all 900 of them instead of on the three dozen cuts.

     The photograph is held BY REFERENCE, never copied. Spreading it into a new
     object - which is what this did first - takes a snapshot before the
     bitmaps are fetched, so every card ends up holding a bitmap-less twin and
     the corners render as empty grey. Same trap as the per-corner pools. */
  for (let k = 0; k < out.length; k++) {
    const w = G.CARD_W_MIN + rnd() * (G.CARD_W_MAX - G.CARD_W_MIN);
    out[k] = { photo: out[k], rot: (rnd() * 2 - 1) * G.CARD_TILT, cardW: w, cardH: w * 1.5 };
  }

  let at = start;
  out.times = holds.map(h => { const t = at; at += h; return t; });
  out.holds = holds;
  out.start = start;
  return out;
}

/* Kept under its old name so nothing that still calls it breaks. */
export const autoSequence = closingSequence;

/* Every distinct image any slot will show, so they can all be fetched before
   the render rather than stalling it halfway through. */
export function allPhotos(slots) {
  const seen = new Map();
  for (const list of Object.values(slots || {})) {
    for (const card of list || []) {
      const p = card?.photo || card;
      if (p?.url && !seen.has(p.url)) seen.set(p.url, p);
    }
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

/* Ease-out: fast away from the middle, settling into place. The opening is
   meant to arrive, not to coast. */
const ease = x => 1 - Math.pow(1 - x, 3);

/* A photograph fills its rectangle the way `object-fit: cover` would, then the
   whole thing is turned about the rectangle's centre. The adjustment is the
   carousel's: scale and a centre offset in fractions, so the framing set on a
   preview lands identically at any export size.

   `k` is the opening: at 0 the photograph is a small square in the dead centre
   of the frame, behind the garments, unrotated; at 1 it is where the board
   puts it. Position, size and angle all travel together, which is what makes
   them look like they are spreading out rather than sliding in. */
function drawPhoto(ctx, spec, shot, adjust, S, k = 1) {
  /* Nothing at all on the first frame: the clip opens on white, and the
     photographs fade up as they spread rather than sitting in the middle
     waiting to move. */
  if (k <= 0) return;
  const photo = shot?.photo || shot;
  const img = photo?.bitmap || null;
  /* The card's own angle and size as dealt, falling back to the board's for
     anything that was not dealt. */
  const deg = shot?.rot ?? spec.deg;
  const cardW = shot?.cardW ?? spec.w;
  const cardH = shot?.cardH ?? spec.h;

  const grow = 0.10 + 0.90 * k;
  const w = cardW * S * grow, h = cardH * S * grow;
  const cx = (G.W / 2 + (spec.cx - G.W / 2) * k) * S;
  const cy = (G.H / 2 + (spec.cy - G.H / 2) * k) * S;
  const blur = k < 1 ? (1 - k) * G.CARD_BLUR * S : 0;

  /* Painting the card into the frame and blurring as it goes leaves its EDGES
     sharp, because the edge comes from the clip and a clip is never blurred -
     whatever the filter is set to. So while it is travelling the card is
     composited whole on its own surface first, with room around it for the
     blur to spread into, and THAT is what gets blurred onto the frame. The
     result is a soft blob that resolves into a crisp photograph, rather than
     a crisp rectangle with soft contents. */
  if (blur > 0.3) {
    const pad = Math.ceil(blur * 3) + 2;
    const diag = Math.ceil(Math.hypot(w, h)) + pad * 2;
    const card = new OffscreenCanvas(diag, diag);
    const c = card.getContext('2d');
    c.translate(diag / 2, diag / 2);
    c.rotate(rad(deg * k));
    c.beginPath();
    c.rect(-w / 2, -h / 2, w, h);
    c.clip();
    if (img) {
      const r = F.place(img.width, img.height, w, h, adjust || F.IDENTITY);
      c.drawImage(img, -w / 2 + r.ox, -h / 2 + r.oy, r.dw, r.dh);
    } else {
      c.fillStyle = '#d9d9d9';
      c.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2.2);
    if ('filter' in ctx) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.drawImage(card, cx - diag / 2, cy - diag / 2);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 2.2);
  ctx.translate(cx, cy);
  ctx.rotate(rad(deg * k));
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

export async function createReel({ width, top, bottom, slots, adjusts, logoUrl, tune }) {
  const S = width / G.W;
  const height = Math.round(G.H * S);

  /* One box for the pair, because they are one outfit. */
  const box = {
    x: Math.round(G.OUTFIT.x * S), y: Math.round(G.OUTFIT.y * S),
    w: Math.round(G.OUTFIT.w * S), h: Math.round(G.OUTFIT.h * S),
  };
  /* The hem sits below the frame's bottom edge by `bleed`, so it runs off
     rather than stopping short of it. */
  const hemPx = Math.round((G.H + G.FIT.bleed) * S);
  const stage = new OutfitStage(width, height, box, hemPx, height, tune);
  await stage.add('top', top.glb, top.type);
  await stage.add('bottom', bottom.glb, bottom.type);
  stage.layout();

  /* The still plate: gradient and the four photographs, drawn once. */
  const plate = new OffscreenCanvas(width, height);
  const out = new OffscreenCanvas(width, height);
  const octx = out.getContext('2d');

  let logo = null;
  if (logoUrl) { logo = new Image(); logo.src = logoUrl; await logo.decode().catch(() => { logo = null; }); }

  /* How far through its own arrival each corner is. They start a quarter
     second apart, so corner four is still a blur while corner one is sharp. */
  function cardK(i, t) {
    if (G.CARDS_IN <= 0) return 1;
    const from = G.MODEL_IN + i * G.CARD_STAGGER;
    return ease(Math.min(1, Math.max(0, (t - from) / G.CARDS_IN)));
  }

  function paintPlate(t, intro = false) {
    const ctx = plate.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    paintReelBackground(ctx, width, height);
    G.PHOTOS.forEach((spec, i) => {
      const shot = photoAt(slots[spec.slot], t);
      const url = (shot?.photo || shot)?.url;
      drawPhoto(ctx, spec, shot, adjusts?.[spec.slot]?.[url], S, intro ? cardK(i, t) : 1);
    });
  }

  /* Only repainted when a slot actually changes picture, which on a normal
     reel is a handful of times in 900 frames rather than 900. */
  let plateKey = null;
  function plateFor(t) {
    /* The key follows the dealt CARD, not just the photograph: a change of
       angle or size is a change of frame even when the picture is the same. */
    const key = G.PHOTOS.map(s => {
      const c = photoAt(slots[s.slot], t);
      return c ? `${(c.photo || c).url}@${(c.rot ?? 0).toFixed(2)}@${Math.round(c.cardW ?? 0)}` : '-';
    }).join('|');
    if (key !== plateKey) { plateKey = key; paintPlate(t); }
    return plate;
  }

  function drawFrame(i, { photos = true, labels = true } = {}) {
    const t = (i / G.FRAMES) * G.DURATION;
    const turn = (i / G.FRAMES) * Math.PI * 2 * G.TURNS;   // whole turns, seamless
    /* Two stages, in order: the garments, then the photographs one by one.
       `k` here is the LAST corner's progress, which is what the type and the
       wordmark wait for - they belong to the finished board. */
    const kModel = G.MODEL_IN > 0 ? ease(Math.min(1, t / G.MODEL_IN)) : 1;
    const k = cardK(G.PHOTOS.length - 1, t);

    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, width, height);
    /* While the opening runs the geometry changes every frame, so the still
       plate is repainted rather than reused - it is a second of the clip, not
       the other fourteen. */
    if (!photos) paintReelBackground(octx, width, height);
    else if (t < G.INTRO) { paintPlate(t, true); plateKey = null; octx.drawImage(plate, 0, 0); }
    else octx.drawImage(plateFor(t), 0, 0);

    stage.setEntry(kModel);
    const garments = stage.render(turn);
    if (kModel < 1) {
      /* Only while they are dropping in: 48 frames of the 900, so a full-frame
         blur here costs nothing over the clip. */
      octx.save();
      if ('filter' in octx) octx.filter = `blur(${((1 - kModel) * G.MODEL_BLUR * S).toFixed(2)}px)`;
      octx.drawImage(garments, 0, 0);
      octx.restore();
    } else {
      octx.drawImage(garments, 0, 0);
    }

    /* The type and the wordmark arrive with everything else rather than
       sitting on an empty white frame waiting for it. */
    octx.globalAlpha = k;
    if (logo) {
      octx.drawImage(logo, (G.W / 2 - G.LOGO.w / 2) * S, G.LOGO.top * S, G.LOGO.w * S, G.LOGO.h * S);
    }
    if (labels) {
      drawBlock(octx, G.TEXT.topRight, top.heading, top.sub, S);
      drawBlock(octx, G.TEXT.bottomLeft, bottom.heading, bottom.sub, S);
    }
    octx.globalAlpha = 1;
    return out;
  }

  function drawCover() {
    const cover = new OffscreenCanvas(width, height);
    cover.getContext('2d').drawImage(drawFrame(G.FRAMES - 1, { photos: false, labels: false }), 0, 0);
    return cover;
  }

  return { width, height, drawFrame, drawCover, dispose: () => stage.dispose() };
}
