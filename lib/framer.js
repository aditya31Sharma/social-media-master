/* The gestures that move a photograph inside a frame.

   Split out from the two surfaces that need them - the inline cover editor,
   which paints into an <img>, and the full-screen slide editor, which paints
   into a <canvas> - because the arithmetic and the handling are identical and
   only the painting differs. This file owns the adjustment and reports it; the
   caller decides what to draw.

   `enabled` is read on every gesture rather than latched at setup, so the
   per-slide lock can be flipped without tearing the controller down. */

import * as F from './frame.js';

export function createFramer(el, { natural, frame, onChange, origin, enabled = () => true }) {
  let adj = { ...F.IDENTITY };
  const pointers = new Map();
  let pinch = null;

  const ready = () => {
    const n = natural(), f = frame();
    return n && f && n.nw > 0 && f.fw > 0;
  };

  function commit(live, hits = {}) {
    onChange?.(adj, hits, live);
  }

  function settle(live) {
    if (!ready()) return;
    const { nw, nh } = natural(), { fw, fh } = frame();
    const out = F.settle(nw, nh, fw, fh, adj, { snap: live });
    adj = { scale: out.scale, cx: out.cx, cy: out.cy };
    commit(live, { hitX: out.hitX, hitY: out.hitY });
  }

  /* A drag ends with a pointerup, which is what drops the guides. A zoom -
     slider, wheel or pinch - has no such moment, so it schedules its own: snap
     while the scale is still moving, then go quiet once it stops. */
  let quiet = null;
  function goQuiet() {
    clearTimeout(quiet);
    quiet = setTimeout(() => { if (pointers.size === 0) settle(false); }, 650);
  }

  function zoomAt(next, px, py) {
    if (!ready() || !enabled()) return;
    const { nw, nh } = natural(), { fw, fh } = frame();
    adj = F.zoomAbout(nw, nh, fw, fh, adj, next, px, py);
    settle(true);
    goQuiet();
  }

  /* Coordinates are taken in the photograph's own box, not the element's. On a
     flat slide the artwork is inset 166/3000 either side, and without this the
     point a pinch is anchored to would sit that far off from the fingers. */
  function local(e) {
    const r = el.getBoundingClientRect();
    const o = origin?.() || { x: 0, y: 0 };
    return { x: e.clientX - r.left - o.x, y: e.clientY - r.top - o.y };
  }

  el.addEventListener('pointerdown', e => {
    if (!enabled() || !ready()) return;
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    el.classList.add('is-drag');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: adj.scale };
    }
  });

  el.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !enabled()) return;
    const prev = pointers.get(e.pointerId);
    const now = local(e);
    pointers.set(e.pointerId, now);

    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.scale * (d / pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }

    const { nw, nh } = natural(), { fw, fh } = frame();
    const g = F.place(nw, nh, fw, fh, adj);
    const moved = F.fromOffset(g.ox + (now.x - prev.x), g.oy + (now.y - prev.y), g.dw, g.dh, fw, fh);
    adj = { ...adj, ...moved };
    settle(true);
  });

  function release(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      el.classList.remove('is-drag');
      settle(false);                  // drop the guides, keep the position
    }
  }

  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  el.addEventListener('wheel', e => {
    if (!enabled() || !ready()) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(adj.scale * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  /* Keyboard nudging: a pointer is not the only way in, and the snap points are
     exactly what a keyboard user cannot feel for. */
  el.addEventListener('keydown', e => {
    if (!enabled() || !ready()) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      adj = { ...adj, cx: adj.cx + moves[e.key][0], cy: adj.cy + moves[e.key][1] };
      settle(true);
      goQuiet();
      return;
    }
    const f = frame();
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(adj.scale * 1.1, f.fw / 2, f.fh / 2); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(adj.scale / 1.1, f.fw / 2, f.fh / 2); }
  });

  return {
    get adjust() { return { ...adj }; },
    set adjust(next) { adj = { ...F.IDENTITY, ...next }; settle(false); },
    setZoom(s) { const f = frame(); zoomAt(s, f.fw / 2, f.fh / 2); },
    reset() { adj = { ...F.IDENTITY }; settle(false); },
    refresh() { settle(false); },
  };
}
