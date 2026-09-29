/* The full-screen slide surface.

   One surface, two modes, and the toggle decides which. Locked - the default,
   and the state every slide starts in - the gestures inspect: pinch, wheel or
   double-tap to zoom to 6x, drag to pan, swipe to move through the set. Nothing
   can be changed by accident. Unlocked, the same gestures reframe the
   photograph inside the slide, with the snapping the cover editor has.

   That is why the toggle comes first rather than sitting next to the controls:
   it is not a setting on the edit, it is the difference between looking and
   editing.

   Saving here never touches the device. It re-renders the slide at export size
   and replaces the version held in the draft - which is what the tile shows and
   what Download later writes out. */

import { createFramer } from './framer.js';
import * as F from './frame.js';
import { drawInto, preload, boxFor, canvasAt, W, H } from './render.js';

const MAX_VIEW = 6;
const VIEW_STEP = 2.5;
const PREVIEW_W = 1000;        // enough to judge 100px type, cheap enough to redraw live
const SWIPE_PX = 55;

export function createEditor(root, { onSave, onSaveAll, onDownload, onDirty }) {
  const stage   = root.querySelector('[data-e-stage]');
  const holder  = root.querySelector('[data-e-slide]');
  const canvas  = root.querySelector('[data-e-canvas]');
  const lock    = root.querySelector('[data-e-lock]');
  const zoomRow = root.querySelector('[data-e-zoomrow]');
  const zoom    = root.querySelector('[data-e-zoom]');
  const zoomOut = root.querySelector('[data-e-zoomout]');
  const guides  = Object.fromEntries(['vs', 'vc', 've', 'hs', 'hc', 'he']
    .map(k => [k, root.querySelector(`[data-e-guide="${k}"]`)]));

  let slides = [];
  let at = 0;
  let ctxData = { product: null, cut: true, width: 1620, fmt: 'png' };

  // inspect transform, only meaningful while locked
  let vz = 1, vx = 0, vy = 0;
  const pointers = new Map();
  let pinch = null, lastTap = 0, swipeFrom = null;

  const slide = () => slides[at];
  const unlocked = () => !!slide()?.editable;

  // ── Framing ───────────────────────────────────────────────────

  let redrawPending = false;

  function scheduleRedraw() {
    if (redrawPending) return;
    redrawPending = true;
    requestAnimationFrame(async () => {
      redrawPending = false;
      try { await drawInto(canvas, slide(), ctxData.product, ctxData.cut); } catch { /* shown on the tile */ }
    });
  }

  const framer = createFramer(holder, {
    enabled: unlocked,
    natural: () => {
      const s = slide();
      return s?.natural ? { nw: s.natural.w, nh: s.natural.h } : null;
    },
    /* The framer works in the photograph's own box, not the whole slide: on a
       flat the artwork is inset 166/3000 either side, and dragging has to mean
       the same thing there as it does on a full-bleed close-up. */
    frame: framerFrame,
    origin: () => {
      const s = slide();
      if (!s) return { x: 0, y: 0 };
      const b = boxFor(s.kind);
      const px = holder.clientWidth / W;
      return { x: b.x * px, y: b.y * px };
    },
    onChange: (adj, hits, live) => {
      const s = slide();
      if (!s) return;
      s.adjust = adj;
      s.dirty = !sameAdjust(adj, s.committed);
      zoom.value = adj.scale.toFixed(2);
      zoomOut.textContent = `${Math.round(adj.scale * 100)}%`;
      paintGuides(live ? hits : {});
      showSlack();
      scheduleRedraw();
      /* The state above is the truth; these two put it on screen. Leaving it
         out is how the Save button stays greyed over a slide that has already
         been changed. */
      refreshActions();
      onDirty?.();
    },
  });

  /* Most product shots are 2:3 and sit in a 2:3 box, so at 100% they fill it
     exactly and there is nowhere to drag to. Saying so is the difference
     between a considered constraint and an editor that looks broken. */
  function showSlack() {
    const s = slide();
    const hint = root.querySelector('[data-e-hint]');
    if (!s || !s.natural) { hint.hidden = true; return; }
    const f = framerFrame();
    if (!f) { hint.hidden = true; return; }
    const { dw, dh } = F.place(s.natural.w, s.natural.h, f.fw, f.fh, s.adjust);
    hint.hidden = !(dw <= f.fw + 0.5 && dh <= f.fh + 0.5);
  }

  function framerFrame() {
    const s = slide();
    if (!s || !holder.clientWidth) return null;
    const b = boxFor(s.kind);
    const px = holder.clientWidth / W;
    return { fw: b.w * px, fh: b.h * px };
  }

  const sameAdjust = (a, b) =>
    Math.abs(a.scale - b.scale) < 1e-6 && Math.abs(a.cx - b.cx) < 1e-6 && Math.abs(a.cy - b.cy) < 1e-6;

  /* Guides are drawn against the photograph's box, so on a flat they sit on the
     artwork's own edges rather than the slide's. Pulled a pixel inside, or
     overflow:hidden clips them to half a hairline. */
  function paintGuides(hits) {
    for (const g of Object.values(guides)) g?.classList.remove('is-on');
    const s = slide();
    if (!s || !hits.hitX && !hits.hitY) return;
    const b = boxFor(s.kind);
    const px = holder.clientWidth / W;
    const left = b.x * px, top = b.y * px, fw = b.w * px, fh = b.h * px;

    if (hits.hitX) {
      const key = { start: 'vs', centre: 'vc', end: 've' }[hits.hitX];
      const g = guides[key];
      g.style.left = `${left + (hits.hitX === 'start' ? 1 : hits.hitX === 'end' ? fw - 1 : fw / 2)}px`;
      g.classList.add('is-on');
    }
    if (hits.hitY) {
      const key = { start: 'hs', centre: 'hc', end: 'he' }[hits.hitY];
      const g = guides[key];
      g.style.top = `${top + (hits.hitY === 'start' ? 1 : hits.hitY === 'end' ? fh - 1 : fh / 2)}px`;
      g.classList.add('is-on');
    }
  }

  // ── Inspecting ────────────────────────────────────────────────

  function paintView() {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const bw = holder.clientWidth, bh = holder.clientHeight;
    const ex = Math.max(0, (bw * vz - sw) / 2);
    const ey = Math.max(0, (bh * vz - sh) / 2);
    vx = Math.min(ex, Math.max(-ex, vx));
    vy = Math.min(ey, Math.max(-ey, vy));
    holder.style.transform = `translate(${vx}px, ${vy}px) scale(${vz})`;
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

  /* All of this is bound on the stage, outside the holder the framer owns, so
     the two never both claim a gesture. While unlocked the stage does nothing. */
  stage.addEventListener('pointerdown', e => {
    if (unlocked()) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localStage(e));
    if (vz > 1) stage.classList.add('is-pan');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: vz };
    } else if (vz === 1) {
      swipeFrom = localStage(e).x;
    }
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

    // Swipe through the set, but only at rest: zoomed in, a drag is a pan.
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

  // ── Mode ──────────────────────────────────────────────────────

  function applyMode() {
    const on = unlocked();
    root.classList.toggle('is-editing', on);
    lock.checked = on;
    zoomRow.hidden = !on;
    root.querySelector('[data-e-viewtools]').hidden = on;
    holder.tabIndex = on ? 0 : -1;
    /* Focus moves to the slide when it is unlocked, so the arrow keys nudge the
       photograph straight away rather than after a hunt for the right target. */
    if (on) { vz = 1; vx = 0; vy = 0; paintView(); holder.focus({ preventScroll: true }); }
    paintGuides({});
    showSlack();
    if (!on) root.querySelector('[data-e-hint]').hidden = true;
    refreshActions();
  }

  function refreshActions() {
    const s = slide();
    const dirty = slides.some(x => x.dirty);
    root.querySelector('[data-e-save]').disabled = !s?.dirty;
    root.querySelector('[data-e-saveall]').hidden = !dirty;
    root.querySelector('[data-e-dirty]').hidden = !s?.dirty;
  }

  lock.addEventListener('change', () => {
    const s = slide();
    if (!s) return;
    s.editable = lock.checked;
    applyMode();
  });

  // ── Moving through the set ────────────────────────────────────

  async function show(i) {
    at = (i + slides.length) % slides.length;
    const s = slide();

    root.querySelector('[data-e-title]').textContent = s.name;
    root.querySelector('[data-e-sub]').textContent = s.file?.name || '';
    root.querySelector('[data-e-count]').textContent = `${at + 1} / ${slides.length}`;

    vz = 1; vx = 0; vy = 0;
    sizeCanvas();
    framer.adjust = s.adjust;
    zoom.value = s.adjust.scale.toFixed(2);
    zoomOut.textContent = `${Math.round(s.adjust.scale * 100)}%`;
    applyMode();
    paintView();

    root.querySelector('[data-e-busy]').hidden = false;
    try {
      await preload(s, ctxData.cut, PREVIEW_W);
      await drawInto(canvas, s, ctxData.product, ctxData.cut);
    } catch (err) {
      root.querySelector('[data-e-sub]').textContent = err.message;
    }
    root.querySelector('[data-e-busy]').hidden = true;
  }

  function sizeCanvas() {
    canvas.width = PREVIEW_W;
    canvas.height = Math.round(PREVIEW_W * H / W);
  }

  // ── Saving into the draft ─────────────────────────────────────

  async function saveCurrent() {
    const s = slide();
    if (!s?.dirty) return;
    const btn = root.querySelector('[data-e-save]');
    btn.disabled = true;
    btn.textContent = 'Saving';
    await onSave?.(s);
    btn.textContent = 'Save image';
    root.querySelector('[data-e-sub]').textContent = s.file?.name || '';
    refreshActions();
  }

  async function saveEvery() {
    const btn = root.querySelector('[data-e-saveall]');
    btn.disabled = true;
    btn.textContent = 'Saving';
    await onSaveAll?.();
    btn.disabled = false;
    btn.textContent = 'Save all';
    root.querySelector('[data-e-sub]').textContent = slide()?.file?.name || '';
    refreshActions();
  }

  root.querySelector('[data-e-save]').addEventListener('click', saveCurrent);
  root.querySelector('[data-e-saveall]').addEventListener('click', saveEvery);
  root.querySelector('[data-e-download]').addEventListener('click', () => onDownload?.(slide().file));
  root.querySelector('[data-e-recentre]').addEventListener('click', () => framer.reset());
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
    framer.refresh();
  }).observe(stage);

  let restoreFocus = null;

  function close() {
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
