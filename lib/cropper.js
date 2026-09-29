/* The cover editor.

   A fixed 3:4 window with the photograph moving behind it. The frame never
   changes shape, because the slide never does; what the user controls is where
   the photograph sits inside it and how big it is. Nothing else - the wordmark's
   place in the layout is a design decision, not a setting, so it is drawn here
   only so the framing can be judged against it.

   The model is resolution independent on purpose. Position is held as the
   photograph's centre offset from the frame's centre, expressed as a fraction
   of the frame; scale is a multiple of "just covers the frame". The same three
   numbers therefore describe the crop at 340px on screen and at 3000px on
   export, with no second code path to drift out of step. */

const MIN_SCALE = 1;      // 1 = exactly covers the frame; below it there'd be gaps
const MAX_SCALE = 5;
const SNAP_PX = 9;        // how close an edge has to come before it clicks in

export function createCropper(root, { onChange } = {}) {
  const img = root.querySelector('img');
  const guides = {
    vl: root.querySelector('[data-guide="vl"]'),
    vc: root.querySelector('[data-guide="vc"]'),
    vr: root.querySelector('[data-guide="vr"]'),
    ht: root.querySelector('[data-guide="ht"]'),
    hc: root.querySelector('[data-guide="hc"]'),
    hb: root.querySelector('[data-guide="hb"]'),
  };

  let nw = 0, nh = 0;              // the photograph's natural size
  let scale = 1, cx = 0, cy = 0;   // the whole model
  const pointers = new Map();
  let pinch = null;

  const frame = () => ({ fw: root.clientWidth, fh: root.clientHeight });

  /* Where the photograph lands, for any frame size. Export calls this with the
     export frame, the screen calls it with the on-screen one. */
  function geometry(fw, fh, s = scale, x = cx, y = cy) {
    const cover = Math.max(fw / nw, fh / nh);
    const dw = nw * cover * s;
    const dh = nh * cover * s;
    return { dw, dh, ox: fw / 2 + x * fw - dw / 2, oy: fh / 2 + y * fh - dh / 2 };
  }

  function fromOffset(ox, oy, dw, dh, fw, fh) {
    cx = (ox + dw / 2 - fw / 2) / fw;
    cy = (oy + dh / 2 - fh / 2) / fh;
  }

  /* Clamping and snapping are the same operation seen twice: the photograph may
     never leave a gap, and the three positions worth hitting on each axis are
     flush-start, centred and flush-end. Clamp first so a snap can never push an
     edge inside the frame. */
  function settle(live) {
    const { fw, fh } = frame();
    if (!nw || !fw) return { x: false, y: false };
    const { dw, dh } = geometry(fw, fh);
    let { ox, oy } = { ox: geometry(fw, fh).ox, oy: geometry(fw, fh).oy };

    ox = Math.min(0, Math.max(fw - dw, ox));
    oy = Math.min(0, Math.max(fh - dh, oy));

    let hitX = null, hitY = null;
    if (live) {
      const xs = { vl: 0, vc: (fw - dw) / 2, vr: fw - dw };
      const ys = { ht: 0, hc: (fh - dh) / 2, hb: fh - dh };
      for (const [k, v] of Object.entries(xs)) {
        if (Math.abs(ox - v) <= SNAP_PX) { ox = v; hitX = k; break; }
      }
      for (const [k, v] of Object.entries(ys)) {
        if (Math.abs(oy - v) <= SNAP_PX) { oy = v; hitY = k; break; }
      }
    }

    fromOffset(ox, oy, dw, dh, fw, fh);
    return { hitX, hitY };
  }

  function paint(hits = {}) {
    const { fw, fh } = frame();
    if (!nw || !fw) return;
    const { dw, dh, ox, oy } = geometry(fw, fh);
    img.style.width = `${dw}px`;
    img.style.height = `${dh}px`;
    img.style.transform = `translate(${ox}px, ${oy}px)`;

    /* A guide is drawn on the edge that actually clicked in, so the feedback
       names the alignment rather than just saying "something snapped". Edge
       guides are pulled a pixel inside the frame, or overflow:hidden would clip
       them to half a hairline. */
    for (const k of Object.keys(guides)) guides[k]?.classList.remove('is-on');
    if (hits.hitX && guides[hits.hitX]) {
      const g = guides[hits.hitX];
      g.style.left = hits.hitX === 'vl' ? '1px'
                   : hits.hitX === 'vr' ? `${fw - 1}px`
                   : `${fw / 2}px`;
      g.classList.add('is-on');
    }
    if (hits.hitY && guides[hits.hitY]) {
      const g = guides[hits.hitY];
      g.style.top = hits.hitY === 'ht' ? '1px'
                  : hits.hitY === 'hb' ? `${fh - 1}px`
                  : `${fh / 2}px`;
      g.classList.add('is-on');
    }
    onChange?.({ scale, cx, cy });
  }

  function apply(live = false) { paint(settle(live)); }

  /* Zoom about a point, so the pixel under the fingers or the cursor stays put.
     Zooming about the centre instead is the classic way to make a cropper feel
     like it is fighting you. */
  function zoomAt(next, px, py) {
    const { fw, fh } = frame();
    if (!nw || !fw) return;
    const before = geometry(fw, fh);
    const u = (px - before.ox) / before.dw;
    const v = (py - before.oy) / before.dh;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    const after = geometry(fw, fh);
    fromOffset(px - u * after.dw, py - v * after.dh, after.dw, after.dh, fw, fh);
    apply(true);
  }

  // ── Pointer: drag, and two-finger pinch ───────────────────────

  function local(e) {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  root.addEventListener('pointerdown', e => {
    if (!nw) return;
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    root.classList.add('is-drag');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        scale,
      };
    }
  });

  root.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const now = local(e);
    pointers.set(e.pointerId, now);

    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAt(pinch.scale * (dist / pinch.dist), mid.x, mid.y);
      return;
    }

    const { fw, fh } = frame();
    const g = geometry(fw, fh);
    fromOffset(g.ox + (now.x - prev.x), g.oy + (now.y - prev.y), g.dw, g.dh, fw, fh);
    apply(true);
  });

  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      root.classList.remove('is-drag');
      apply(false);            // drop the guides, keep the position
    }
  }

  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  root.addEventListener('wheel', e => {
    if (!nw) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(scale * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  /* Keyboard nudging, because a pointer is not the only way in and the snap
     points are exactly what a keyboard user cannot feel for. */
  root.addEventListener('keydown', e => {
    if (!nw) return;
    const step = (e.shiftKey ? 0.05 : 0.01);
    const moves = {
      ArrowLeft:  [-step, 0], ArrowRight: [step, 0],
      ArrowUp:    [0, -step], ArrowDown:  [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      cx += moves[e.key][0];
      cy += moves[e.key][1];
      apply(true);
      setTimeout(() => apply(false), 500);
      return;
    }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(scale * 1.1, root.clientWidth / 2, root.clientHeight / 2); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(scale / 1.1, root.clientWidth / 2, root.clientHeight / 2); }
  });

  const ro = new ResizeObserver(() => apply(false));
  ro.observe(root);

  // ── API ───────────────────────────────────────────────────────

  return {
    async setImage(file) {
      const url = URL.createObjectURL(file);
      img.src = url;
      await img.decode();
      nw = img.naturalWidth;
      nh = img.naturalHeight;
      scale = 1; cx = 0; cy = 0;
      apply(false);
    },
    setZoom(next) { zoomAt(next, root.clientWidth / 2, root.clientHeight / 2); },
    reset() { scale = 1; cx = 0; cy = 0; apply(false); },
    get state() { return { scale, cx, cy }; },
    get ready() { return nw > 0; },
    /* The one thing the renderer needs: where to put this photograph inside a
       frame of any size at all. */
    rectFor(fw, fh) { return geometry(fw, fh); },
    limits: { MIN_SCALE, MAX_SCALE },
  };
}
