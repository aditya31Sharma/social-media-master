/* The slide viewer.

   A tile in the grid is 190px wide; the copy on a slide is set at 100px in a
   3000px frame. There is no way to judge one from the other, so every slide
   gets a real look: fit to the stage, then zoom to 6x and pan around it, by
   wheel, pinch, double-tap or the buttons.

   Zoom is anchored to wherever the gesture happened rather than to the middle
   of the stage, which is the difference between inspecting an image and
   wrestling with one. Panning is bounded by the overflow, so the slide can
   never be flung off into space and lost. */

const MAX_Z = 6;
const STEP_Z = 2.5;      // where a double-tap lands

export function createViewer(root, { onSave } = {}) {
  const stage = root.querySelector('[data-v-stage]');
  const img = root.querySelector('[data-v-img]');
  const title = root.querySelector('[data-v-title]');
  const sub = root.querySelector('[data-v-sub]');
  const count = root.querySelector('[data-v-count]');
  const prev = root.querySelector('[data-v-prev]');
  const next = root.querySelector('[data-v-next]');

  let items = [];
  let at = 0;
  let z = 1, tx = 0, ty = 0;
  let bw = 0, bh = 0;              // the fitted size at z = 1
  const pointers = new Map();
  let pinch = null;
  let lastTap = 0;
  let objectUrl = null;

  const box = () => ({ sw: stage.clientWidth, sh: stage.clientHeight });

  function measure() {
    const { sw, sh } = box();
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !sw) return;
    const s = Math.min(sw / nw, sh / nh) * 0.94;   // a little air around it
    bw = nw * s;
    bh = nh * s;
    img.style.width = `${bw}px`;
    img.style.height = `${bh}px`;
  }

  function clampPan() {
    const { sw, sh } = box();
    const ex = Math.max(0, (bw * z - sw) / 2);
    const ey = Math.max(0, (bh * z - sh) / 2);
    tx = Math.min(ex, Math.max(-ex, tx));
    ty = Math.min(ey, Math.max(-ey, ty));
  }

  function paint() {
    const { sw, sh } = box();
    clampPan();
    const ox = (sw - bw * z) / 2 + tx;
    const oy = (sh - bh * z) / 2 + ty;
    img.style.transform = `translate(${ox}px, ${oy}px) scale(${z})`;
    stage.classList.toggle('can-pan', z > 1);
    root.querySelector('[data-v-zoom]').textContent = `${Math.round(z * 100)}%`;
  }

  function zoomAt(nz, px, py) {
    const { sw, sh } = box();
    nz = Math.min(MAX_Z, Math.max(1, nz));
    const ox0 = (sw - bw * z) / 2 + tx;
    const oy0 = (sh - bh * z) / 2 + ty;
    const u = (px - ox0) / (bw * z);
    const v = (py - oy0) / (bh * z);
    z = nz;
    tx = (px - u * bw * z) - (sw - bw * z) / 2;
    ty = (py - v * bh * z) - (sh - bh * z) / 2;
    if (z === 1) { tx = 0; ty = 0; }
    paint();
  }

  function local(e) {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Gestures ──────────────────────────────────────────────────

  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (z > 1) stage.classList.add('is-pan');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), z };
    }
  });

  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prevPt = pointers.get(e.pointerId);
    const now = local(e);
    pointers.set(e.pointerId, now);

    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.z * (d / pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (z > 1) {
      tx += now.x - prevPt.x;
      ty += now.y - prevPt.y;
      paint();
    }
  });

  function up(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) stage.classList.remove('is-pan');
  }

  stage.addEventListener('pointerup', e => {
    // A double-tap has to be detected here: dblclick does not fire on touch.
    const now = Date.now();
    const p = local(e);
    if (now - lastTap < 300) {
      zoomAt(z > 1 ? 1 : STEP_Z, p.x, p.y);
      lastTap = 0;
    } else {
      lastTap = now;
    }
    up(e);
  });

  stage.addEventListener('pointercancel', up);

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const p = local(e);
    zoomAt(z * Math.exp(-e.deltaY * 0.0022), p.x, p.y);
  }, { passive: false });

  // ── Moving through the set ────────────────────────────────────

  async function show(i) {
    at = (i + items.length) % items.length;
    const item = items[at];
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(item.file);
    img.src = objectUrl;
    img.alt = item.label;
    await img.decode().catch(() => {});
    z = 1; tx = 0; ty = 0;
    measure();
    paint();
    title.textContent = item.label;
    sub.textContent = item.sub || '';
    count.textContent = `${at + 1} / ${items.length}`;
    prev.disabled = items.length < 2;
    next.disabled = items.length < 2;
  }

  prev.addEventListener('click', () => show(at - 1));
  next.addEventListener('click', () => show(at + 1));
  root.querySelector('[data-v-close]').addEventListener('click', close);
  root.querySelector('[data-v-save]').addEventListener('click', () => onSave?.(items[at].file));
  root.querySelector('[data-v-fit]').addEventListener('click', () => {
    const { sw, sh } = box();
    zoomAt(z > 1 ? 1 : STEP_Z, sw / 2, sh / 2);
  });

  function onKey(e) {
    if (root.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowRight') { show(at + 1); return; }
    if (e.key === 'ArrowLeft') { show(at - 1); return; }
    const { sw, sh } = box();
    if (e.key === '+' || e.key === '=') zoomAt(z * 1.25, sw / 2, sh / 2);
    if (e.key === '-' || e.key === '_') zoomAt(z / 1.25, sw / 2, sh / 2);
    if (e.key === '0') zoomAt(1, sw / 2, sh / 2);
  }

  document.addEventListener('keydown', onKey);
  new ResizeObserver(() => { if (!root.hidden) { measure(); paint(); } }).observe(stage);

  let restoreFocus = null;

  function close() {
    root.hidden = true;
    document.body.style.overflow = '';
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    restoreFocus?.focus?.();
  }

  return {
    async open(list, index = 0) {
      items = list;
      restoreFocus = document.activeElement;
      root.hidden = false;
      document.body.style.overflow = 'hidden';   // the page must not scroll behind
      await show(index);
      root.querySelector('[data-v-close]').focus();
    },
    close,
  };
}
