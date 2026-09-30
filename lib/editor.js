/* The full-screen slide editor.

   Opening a slide takes over the page. That is deliberate: framing needs the
   whole screen and the whole of your attention, and coming back out through
   Save changes is what makes it a task with an end rather than a panel that is
   always half in the way.

   Every slide starts locked. Locked, the gestures inspect: pinch, wheel or
   double-tap to zoom in, drag to pan, swipe to move through the set. Turn on
   Allow edits and the same gestures move the photograph inside the slide.
   The toggle comes first in the bar because it is not a setting on the edit,
   it is the difference between looking and editing.

   The slide is three DOM layers - a background canvas, the cut-out as an <img>,
   a foreground canvas - so an edit is one transform on one element and the
   compositor does the work. Nothing is redrawn while a finger is down. */

import { createFramer } from './framer.js';
import * as F from './frame.js';
import { drawBackground, drawForeground, photoLayer, defaultAdjust, logoRect, logoImage, W, H } from './render.js';

const MAX_VIEW = 6;
const VIEW_STEP = 2.5;
const LAYER_W = 900;        // the static canvases; the photo is its own layer
const SWIPE_PX = 55;

export function createEditor(root, { onSave, onSaveAll, onDirty }) {
  const stage  = root.querySelector('[data-e-stage]');
  const holder = root.querySelector('[data-e-slide]');
  const bg     = root.querySelector('[data-e-bg]');
  const photo  = root.querySelector('[data-e-photo]');
  const fg     = root.querySelector('[data-e-fg]');
  const logoEl = root.querySelector('[data-e-logo]');
  const lock   = root.querySelector('[data-e-lock]');
  const tools   = root.querySelector('[data-e-tools]');
  const zoom    = root.querySelector('[data-e-zoom]');
  const zoomOut = root.querySelector('[data-e-zoomout]');
  const guides = Object.fromEntries(['vs', 'vc', 've', 'hs', 'hc', 'he']
    .map(k => [k, root.querySelector(`[data-e-guide="${k}"]`)]));

  let slides = [];
  let at = 0;
  let ctxData = { product: null, cut: true };
  let layer = null;             // { url, nw, nh } for the slide on screen
  let wasDirty = null;

  // inspect transform, only meaningful while locked
  let vz = 1, vx = 0, vy = 0;
  const pointers = new Map();
  let pinch = null, lastTap = 0, swipeFrom = null;

  const slide = () => slides[at];
  const unlocked = () => !!slide()?.editable;
  const frameSize = () => ({ fw: holder.clientWidth, fh: holder.clientHeight });

  // -- The photograph, moved -------------------------------------

  /* The whole edit loop, and it is two style writes. `place` is the same
     arithmetic the export uses, so what is on screen is what will be drawn. */
  function paintPhoto(adj) {
    if (!layer) return;
    const { fw, fh } = frameSize();
    if (!fw) return;
    const cover = F.coverScale(layer.nw, layer.nh, fw, fh);
    photo.style.width = `${layer.nw * cover}px`;
    photo.style.height = `${layer.nh * cover}px`;
    const { ox, oy } = F.place(layer.nw, layer.nh, fw, fh, adj);
    photo.style.transform = `translate3d(${ox}px, ${oy}px, 0) scale(${adj.scale})`;
  }

  // -- The wordmark, moved ---------------------------------------

  /* Covers only. It is painted here as a DOM layer rather than into the
     foreground canvas so that dragging it is one transform write, exactly like
     the photograph - and so the canvas never has to be recomposited per
     pointer move. `logoRect` is the same arithmetic the export uses. */
  function paintLogo() {
    const s = slide();
    if (!s || s.kind !== 'cover') { logoEl.hidden = true; return; }
    const { fw } = frameSize();
    if (!fw) return;
    const r = logoRect(s, fw / W);
    logoEl.hidden = false;
    logoEl.style.width = `${r.w}px`;
    logoEl.style.height = `${r.h}px`;
    logoEl.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
  }

  async function loadLogo() {
    const s = slide();
    if (!s || s.kind !== 'cover') { logoEl.hidden = true; return; }
    logoEl.src = (await logoImage(s.logo || '#ffffff')).src;
    paintLogo();
  }

  /* Dragged in frame fractions, so the offset survives any stage size. Snaps
     back to the board's own position - horizontal centre and the 250 top -
     because that is the placement every carousel so far has used and it should
     be effortless to return to. */
  const LOGO_SNAP = 0.006;      // fraction of the frame, ~5px on a 900px stage
  let logoFrom = null;

  logoEl.addEventListener('pointerdown', e => {
    if (!unlocked()) return;
    /* The framer owns `holder`; without this the same gesture would also drag
       the photograph underneath. */
    e.stopPropagation();
    e.preventDefault();
    const s = slide();
    logoEl.setPointerCapture(e.pointerId);
    logoEl.classList.add('is-dragging');
    logoFrom = { px: e.clientX, py: e.clientY, ...(s.logoPos || { x: 0, y: 0 }) };
  });

  logoEl.addEventListener('pointermove', e => {
    if (!logoFrom) return;
    e.stopPropagation();
    const s = slide();
    const { fw, fh } = frameSize();
    let x = logoFrom.x + (e.clientX - logoFrom.px) / fw;
    let y = logoFrom.y + (e.clientY - logoFrom.py) / fh;
    if (Math.abs(x) <= LOGO_SNAP) x = 0;
    if (Math.abs(y) <= LOGO_SNAP) y = 0;
    s.logoPos = { x, y };
    paintLogo();
    syncDirty(s);
  });

  function logoUp(e) {
    if (!logoFrom) return;
    logoFrom = null;
    logoEl.classList.remove('is-dragging');
    try { logoEl.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
  }
  logoEl.addEventListener('pointerup', logoUp);
  logoEl.addEventListener('pointercancel', logoUp);

  const framer = createFramer(holder, {
    enabled: unlocked,
    natural: () => (layer ? { nw: layer.nw, nh: layer.nh } : null),
    frame: frameSize,
    onChange: (adj, hits, live) => {
      const s = slide();
      if (!s) return;
      s.adjust = adj;
      paintPhoto(adj);
      paintGuides(live ? hits : {});
      zoomOut.textContent = `${Math.round(adj.scale * 100)}%`;
      if (!live) zoom.value = adj.scale.toFixed(2);

      /* The heavier work - the unsaved flag here, the flag on the tile behind -
         only runs when the answer actually changes, not on every frame. */
      syncDirty(s);
    },
  });

  const same = (a, b) =>
    Math.abs(a.scale - b.scale) < 1e-6 && Math.abs(a.cx - b.cx) < 1e-6 && Math.abs(a.cy - b.cy) < 1e-6;

  const sameLogo = (a = { x: 0, y: 0 }, b = { x: 0, y: 0 }) =>
    Math.abs((a.x || 0) - (b.x || 0)) < 1e-6 && Math.abs((a.y || 0) - (b.y || 0)) < 1e-6;

  /* A cover is dirty if EITHER the photograph or the wordmark has moved. The
     heavier work - the flag here, the flag on the tile behind - only runs when
     the answer actually changes, not on every frame. */
  function syncDirty(s) {
    const dirty = !same(s.adjust, s.committed)
               || (s.kind === 'cover' && !sameLogo(s.logoPos, s.committedLogo));
    if (dirty === wasDirty) return;
    wasDirty = dirty;
    s.dirty = dirty;
    refreshActions();
    onDirty?.();
  }

  function paintGuides(hits) {
    for (const g of Object.values(guides)) g?.classList.remove('is-on');
    const { fw, fh } = frameSize();
    if (hits.hitX) {
      const g = guides[{ start: 'vs', centre: 'vc', end: 've' }[hits.hitX]];
      g.style.left = `${hits.hitX === 'start' ? 1 : hits.hitX === 'end' ? fw - 1 : fw / 2}px`;
      g.classList.add('is-on');
    }
    if (hits.hitY) {
      const g = guides[{ start: 'hs', centre: 'hc', end: 'he' }[hits.hitY]];
      g.style.top = `${hits.hitY === 'start' ? 1 : hits.hitY === 'end' ? fh - 1 : fh / 2}px`;
      g.classList.add('is-on');
    }
  }

  // -- Inspecting ------------------------------------------------

  function paintView() {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const bw = holder.clientWidth, bh = holder.clientHeight;
    const ex = Math.max(0, (bw * vz - sw) / 2);
    const ey = Math.max(0, (bh * vz - sh) / 2);
    vx = Math.min(ex, Math.max(-ex, vx));
    vy = Math.min(ey, Math.max(-ey, vy));
    holder.style.transform = `translate3d(${vx}px, ${vy}px, 0) scale(${vz})`;
    root.querySelector('[data-e-viewzoom]').textContent = `${Math.round(vz * 100)}%`;
    stage.classList.toggle('can-pan', vz > 1 && !unlocked());
  }

  function viewZoomAt(nz, px, py) {
    nz = Math.min(MAX_VIEW, Math.max(1, nz));
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const bw = holder.clientWidth, bh = holder.clientHeight;
    const ox0 = (sw - bw * vz) / 2 + vx, oy0 = (sh - bh * vz) / 2 + vy;
    const u = (px - ox0) / (bw * vz), v = (py - oy0) / (bh * vz);
    vz = nz;
    vx = (px - u * bw * vz) - (sw - bw * vz) / 2;
    vy = (py - v * bh * vz) - (sh - bh * vz) / 2;
    if (vz === 1) { vx = 0; vy = 0; }
    paintView();
  }

  const localStage = e => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /* Bound on the stage, outside the holder the framer owns, so the two never
     both claim a gesture. While unlocked the stage does nothing. */
  stage.addEventListener('pointerdown', e => {
    if (unlocked()) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localStage(e));
    if (vz > 1) stage.classList.add('is-pan');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: vz };
    } else if (vz === 1) swipeFrom = localStage(e).x;
  });

  stage.addEventListener('pointermove', e => {
    if (unlocked() || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const now = localStage(e);
    pointers.set(e.pointerId, now);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      viewZoomAt(pinch.z * (d / pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (vz > 1) { vx += now.x - prev.x; vy += now.y - prev.y; paintView(); }
  });

  function stageUp(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) stage.classList.remove('is-pan');
  }

  stage.addEventListener('pointerup', e => {
    if (unlocked()) return;
    const p = localStage(e);
    if (swipeFrom !== null && vz === 1) {
      const dx = p.x - swipeFrom;
      if (Math.abs(dx) > SWIPE_PX) { show(at + (dx < 0 ? 1 : -1)); swipeFrom = null; stageUp(e); return; }
    }
    swipeFrom = null;
    // dblclick never fires on touch, so a double-tap is detected by hand.
    const now = Date.now();
    if (now - lastTap < 300) { viewZoomAt(vz > 1 ? 1 : VIEW_STEP, p.x, p.y); lastTap = 0; }
    else lastTap = now;
    stageUp(e);
  });

  stage.addEventListener('pointercancel', stageUp);

  stage.addEventListener('wheel', e => {
    if (unlocked()) return;      // unlocked, the wheel belongs to the framer
    e.preventDefault();
    const p = localStage(e);
    viewZoomAt(vz * Math.exp(-e.deltaY * 0.0022), p.x, p.y);
  }, { passive: false });

  // -- Mode ------------------------------------------------------

  function applyMode() {
    const on = unlocked();
    root.classList.toggle('is-editing', on);
    lock.checked = on;
    tools.hidden = !on;
    root.querySelector('[data-e-viewtools]').hidden = on;
    holder.tabIndex = on ? 0 : -1;
    if (on) {
      vz = 1; vx = 0; vy = 0;
      paintView();
      holder.focus({ preventScroll: true });
    }
    paintGuides({});
    refreshActions();
  }

  function refreshActions() {
    const s = slide();
    root.querySelector('[data-e-save]').disabled = !s?.dirty;
    root.querySelector('[data-e-saveall]').hidden = slides.filter(x => x.dirty).length < 2;
    root.querySelector('[data-e-dirty]').hidden = !s?.dirty;
  }

  lock.addEventListener('change', () => {
    const s = slide();
    if (!s) return;
    s.editable = lock.checked;
    applyMode();
  });

  // -- Moving through the set ------------------------------------

  async function show(i) {
    at = (i + slides.length) % slides.length;
    const s = slide();
    wasDirty = null;

    root.querySelector('[data-e-title]').textContent = s.name;
    root.querySelector('[data-e-sub]').textContent = s.file?.name || '';
    root.querySelector('[data-e-count]').textContent = `${at + 1} / ${slides.length}`;

    vz = 1; vx = 0; vy = 0;
    bg.width = LAYER_W; bg.height = Math.round(LAYER_W * H / W);
    fg.width = LAYER_W; fg.height = Math.round(LAYER_W * H / W);
    applyMode();
    paintView();

    root.querySelector('[data-e-busy]').hidden = false;
    photo.style.visibility = 'hidden';
    try {
      drawBackground(bg, s);
      await drawForeground(fg, s, ctxData.product, true, true);
      await loadLogo();
      layer = await photoLayer(s, ctxData.cut && !!s.url);
      photo.src = layer.url;
      await photo.decode().catch(() => {});
      photo.style.visibility = '';
      framer.adjust = s.adjust;          // paints via onChange
      zoom.value = s.adjust.scale.toFixed(2);
      zoomOut.textContent = `${Math.round(s.adjust.scale * 100)}%`;
    } catch (err) {
      root.querySelector('[data-e-sub]').textContent = err.message;
    }
    root.querySelector('[data-e-busy]').hidden = true;
  }

  // -- Saving into the draft, then out ---------------------------

  async function finish(all) {
    const btn = root.querySelector(all ? '[data-e-saveall]' : '[data-e-save]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving';
    try {
      if (all) await onSaveAll?.();
      else await onSave?.(slide());
    } finally {
      btn.textContent = label;
      btn.disabled = false;
      close();                           // the job has an end; go back to the set
    }
  }

  root.querySelector('[data-e-save]').addEventListener('click', () => finish(false));
  root.querySelector('[data-e-saveall]').addEventListener('click', () => finish(true));
  /* Alignment, the way a design tool does it: an exact edge or an exact
     centre, computed as an offset rather than nudged towards one, so flush
     means zero pixels and not "within the snap radius". */
  for (const btn of root.querySelectorAll('[data-align]')) {
    btn.addEventListener('click', () => {
      const [axis, where] = btn.dataset.align.split(':');
      framer.align(axis, where);
    });
  }

  root.querySelector('[data-e-recentre]').addEventListener('click', () => {
    const s = slide();
    if (!s) return;
    if (s.kind === 'cover') {
      s.logoPos = { x: 0, y: 0 };
      paintLogo();
      syncDirty(s);
    }
    framer.adjust = defaultAdjust(s.kind, layer?.nw, layer?.nh);
  });
  root.querySelector('[data-e-prev]').addEventListener('click', () => show(at - 1));
  root.querySelector('[data-e-next]').addEventListener('click', () => show(at + 1));
  root.querySelector('[data-e-close]').addEventListener('click', close);
  zoom.addEventListener('input', e => framer.setZoom(+e.target.value));

  document.addEventListener('keydown', e => {
    if (root.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (unlocked()) return;                       // arrows nudge the photo instead
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
    const sw = stage.clientWidth, sh = stage.clientHeight;
    if (e.key === '+' || e.key === '=') viewZoomAt(vz * 1.25, sw / 2, sh / 2);
    if (e.key === '-' || e.key === '_') viewZoomAt(vz / 1.25, sw / 2, sh / 2);
    if (e.key === '0') viewZoomAt(1, sw / 2, sh / 2);
  });

  new ResizeObserver(() => {
    if (root.hidden) return;
    paintView();
    if (slide()) { paintPhoto(slide().adjust); paintLogo(); }
  }).observe(stage);

  let restoreFocus = null;

  function close() {
    /* Drop any capture still held. A pointer captured by the stage and never
       released outlives the dialog, and the page behind it then behaves as
       though a finger is still down on it. */
    for (const id of pointers.keys()) {
      try { stage.releasePointerCapture(id); } catch { /* already gone */ }
    }
    pointers.clear();
    pinch = null;
    swipeFrom = null;

    /* Re-arm the lock on every slide. It is a decision about this visit, not a
       property of the slide: left set, a slide you once unlocked opened
       unlocked for ever after, and because the stage hands every gesture to
       the framer while unlocked, swiping through the set stopped working on
       exactly the slides you had already edited. The cover kept working only
       because it had never been unlocked. */
    for (const s of slides) s.editable = false;
    lock.checked = false;
    root.classList.remove('is-editing');
    tools.hidden = true;

    root.hidden = true;
    document.body.style.overflow = '';
    restoreFocus?.focus?.();
  }

  return {
    async open(list, index, context) {
      slides = list;
      ctxData = { ...ctxData, ...context };
      restoreFocus = document.activeElement;
      root.hidden = false;
      document.body.style.overflow = 'hidden';
      await show(index);
      root.querySelector('[data-e-close]').focus();
    },
    close,
    refreshActions,
  };
}
