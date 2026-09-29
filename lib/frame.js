/* Where a photograph sits inside a frame.

   One piece of arithmetic, used by four things: the inline cover editor, the
   full-screen slide editor, the live preview each of them draws, and the final
   export. Keeping it here is the whole reason the crop you set at 340px on
   screen is the crop that gets drawn at 3000px - there is no second version of
   these sums to drift out of step with the first.

   An adjustment is three numbers and they are all resolution independent:

     scale  a multiple of "just covers the frame", so 1 always fills it exactly
     cx,cy  the photograph's centre, offset from the frame's centre, as a
            fraction of the frame's own width and height

   Nothing here knows about pixels on a particular screen, which is why the
   same three numbers survive a resize, a rotate, and the jump to export. */

export const SNAP_PX = 9;        // how close an edge comes before it clicks in
export const MIN_SCALE = 1;      // the floor where nothing is drawn behind the photo
export const MAX_SCALE = 5;

export const IDENTITY = { scale: 1, cx: 0, cy: 0 };

export function isDefault(a) {
  return !a || (a.scale === 1 && a.cx === 0 && a.cy === 0);
}

/* The scale at which the photograph exactly covers the frame, which is the
   floor for every adjustment. */
export function coverScale(nw, nh, fw, fh) {
  return Math.max(fw / nw, fh / nh);
}

/* Where to draw it, for a frame of any size at all. */
export function place(nw, nh, fw, fh, adj = IDENTITY) {
  const s = coverScale(nw, nh, fw, fh) * (adj.scale ?? 1);
  const dw = nw * s;
  const dh = nh * s;
  return {
    dw, dh,
    ox: fw / 2 + (adj.cx ?? 0) * fw - dw / 2,
    oy: fh / 2 + (adj.cy ?? 0) * fh - dh / 2,
  };
}

export function fromOffset(ox, oy, dw, dh, fw, fh) {
  return { cx: (ox + dw / 2 - fw / 2) / fw, cy: (oy + dh / 2 - fh / 2) / fh };
}

/* Clamping and snapping are one operation seen twice: the photograph may never
   leave a gap, and the three positions worth hitting on each axis are
   flush-start, centred and flush-end.

   Clamp runs first, always. If snapping ran first it could push an edge back
   inside the frame, and the clamp would then silently undo the snap - which
   reads as the guide appearing and the photo refusing to move. */
export function settle(nw, nh, fw, fh, adj, { snap = false, minScale = MIN_SCALE } = {}) {
  const { dw, dh } = place(nw, nh, fw, fh, adj);
  let { ox, oy } = place(nw, nh, fw, fh, adj);

  /* Symmetric, so one rule covers both cases: a photo larger than the frame may
     not leave a gap at an edge, and a photo smaller than it may not hang out
     past one. Either it covers the frame or it sits inside it, never half out.
     The one-sided clamp this replaced pinned a smaller photo flush left. */
  const loX = Math.min(0, fw - dw), hiX = Math.max(0, fw - dw);
  const loY = Math.min(0, fh - dh), hiY = Math.max(0, fh - dh);
  ox = Math.min(hiX, Math.max(loX, ox));
  oy = Math.min(hiY, Math.max(loY, oy));

  let hitX = null, hitY = null;
  if (snap) {
    const xs = { start: 0, centre: (fw - dw) / 2, end: fw - dw };
    const ys = { start: 0, centre: (fh - dh) / 2, end: fh - dh };
    for (const [k, v] of Object.entries(xs)) {
      if (Math.abs(ox - v) <= SNAP_PX) { ox = v; hitX = k; break; }
    }
    for (const [k, v] of Object.entries(ys)) {
      if (Math.abs(oy - v) <= SNAP_PX) { oy = v; hitY = k; break; }
    }
  }

  const { cx, cy } = fromOffset(ox, oy, dw, dh, fw, fh);
  return { scale: clampScale(adj.scale ?? 1, minScale), cx, cy, hitX, hitY };
}

export function clampScale(s, min = MIN_SCALE) {
  return Math.min(MAX_SCALE, Math.max(min, s));
}

/* Zoom about a point, so the pixel under the fingers or the cursor stays put.
   Zooming about the frame's centre instead is the classic way to make a cropper
   feel like it is fighting you. */
export function zoomAbout(nw, nh, fw, fh, adj, nextScale, px, py, minScale = MIN_SCALE) {
  const before = place(nw, nh, fw, fh, adj);
  const u = (px - before.ox) / before.dw;
  const v = (py - before.oy) / before.dh;
  const scale = clampScale(nextScale, minScale);
  const after = place(nw, nh, fw, fh, { ...adj, scale });
  const { cx, cy } = fromOffset(px - u * after.dw, py - v * after.dh, after.dw, after.dh, fw, fh);
  return { scale, cx, cy };
}

/* The scale at which a photograph sits in `inner` the way it would if `inner`
   were the whole frame - used to start a slide off at the placement the Figma
   board specifies while still measuring everything against the full 3:4. */
export function scaleForInset(nw, nh, fw, fh, iw, ih) {
  return coverScale(nw, nh, iw, ih) / coverScale(nw, nh, fw, fh);
}
