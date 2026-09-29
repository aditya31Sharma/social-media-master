/* Where a photograph sits inside a frame.

   One piece of arithmetic, shared by the editor's live preview and the final
   export. That is the whole reason the crop set on screen is the crop that gets
   drawn at 3000px: there is no second version of these sums to drift out of
   step with the first.

   An adjustment is three numbers and they are all resolution independent:

     scale  a multiple of "just covers the frame", so 1 always fills it exactly
     cx,cy  the photograph's centre, offset from the frame's centre, as a
            fraction of the frame's own width and height

   Nothing here confines the photograph. It may hang off any edge, or sit in
   half the frame and leave the other half empty - whatever is left uncovered is
   the slide's background, which is a composition, not an error. Snapping still
   offers the alignments worth hitting; it just no longer forces one. */

export const SNAP_PX = 9;        // how close an edge comes before it clicks in
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 5;

export const IDENTITY = { scale: 1, cx: 0, cy: 0 };

/* The scale at which the photograph exactly covers the frame. */
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

export function clampScale(s, min = MIN_SCALE) {
  return Math.min(MAX_SCALE, Math.max(min, s));
}

/* Snap, if asked, and report which alignment caught so the guide can name it.
   Three per axis: the photograph's leading edge on the frame's, the two
   centres, and the trailing edges. */
export function settle(nw, nh, fw, fh, adj, { snap = false, minScale = MIN_SCALE } = {}) {
  const scale = clampScale(adj.scale ?? 1, minScale);
  const { dw, dh, ox: ox0, oy: oy0 } = place(nw, nh, fw, fh, { ...adj, scale });
  let ox = ox0, oy = oy0;

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
  return { scale, cx, cy, hitX, hitY };
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
   were the whole frame - used to start a slide at the placement the Figma board
   specifies while still measuring everything against the full 3:4. */
export function scaleForInset(nw, nh, fw, fh, iw, ih) {
  return coverScale(nw, nh, iw, ih) / coverScale(nw, nh, fw, fh);
}
