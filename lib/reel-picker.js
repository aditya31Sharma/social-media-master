/* Choosing the photographs, and framing them.

   Two sheets. The first lists everything the product was shot with and lets
   you tap them into an order - the number on a thumbnail is when it appears,
   not which one it is. The second is the carousel's framing controls applied
   to one corner of the board: the same frame.js arithmetic, the same snapping,
   the same six alignment buttons, so what you learn on one template carries. */

import { sized } from './shopify.js';
import * as F from './frame.js';
import { createFramer } from './framer.js';
import * as G from './reel-geom.js';

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ── Sheet one: which photographs, in what order ─────────────── */

export function createPhotoPicker(root) {
  let session = null;

  const close = () => { root.hidden = true; session = null; };

  root.addEventListener('click', e => { if (e.target === root) close(); });

  function paint() {
    const { product, chosen } = session;
    const body = root.querySelector('[data-pk-grid]');
    body.innerHTML = '';
    for (const [name, img] of Object.entries(product.byName)) {
      const chosenHere = chosen[0]?.url === img.url;
      const cell = el('button', 'pk__cell' + (chosenHere ? ' is-on' : ''));
      cell.type = 'button';
      cell.innerHTML =
        `<img src="${sized(img.url, 300)}" alt="" loading="lazy" crossorigin="anonymous">
         <span class="pk__name">${name.replace(/-/g, ' ')}</span>
         ${chosenHere ? '<span class="pk__num">Closes</span>' : ''}`;
      /* One shot, the one it ENDS on - the last frame is what stays on
         screen. Everything else the SKU has runs before it, so there is no
         queue to build. */
      cell.addEventListener('click', () => {
        chosen.length = 0;
        chosen.push({ url: img.url, name, width: img.width, height: img.height });
        paint();
      });
      /* The framing button, on whichever shot is chosen. */
      if (chosenHere) {
        const adj = el('span', 'pk__adjust', '<svg viewBox="0 0 24 24"><use href="#i-edit"/></svg>');
        adj.addEventListener('click', ev => { ev.stopPropagation(); session.onAdjust(chosen[0]); });
        cell.appendChild(adj);
      }
      body.appendChild(cell);
    }
    const total = Object.keys(product.byName).length;
    root.querySelector('[data-pk-note]').textContent = chosen.length
      ? `Closes on ${chosen[0].name.replace(/-/g, ' ')}, after the other ${total - 1} shuffled and slowing into it`
      : 'Tap the shot it ends on';
    root.querySelector('[data-pk-done]').disabled = !chosen.length;
  }

  root.querySelector('[data-pk-done]').addEventListener('click', () => {
    session.onDone(session.chosen);
    close();
  });
  root.querySelector('[data-pk-close]').addEventListener('click', close);

  return {
    open(opts) {
      session = { ...opts, chosen: [...opts.chosen] };
      root.querySelector('[data-pk-title]').textContent = opts.title;
      root.hidden = false;
      paint();
    },
    repaint: () => session && paint(),
  };
}

/* ── Sheet two: framing one photograph ───────────────────────── */

export function createPhotoAdjust(root) {
  const stage = root.querySelector('[data-aj-stage]');
  const holder = root.querySelector('[data-aj-frame]');
  const img = root.querySelector('[data-aj-img]');
  const zoom = root.querySelector('[data-aj-zoom]');
  const out = root.querySelector('[data-aj-zoomout]');
  const guides = Object.fromEntries(['vs', 'vc', 've', 'hs', 'hc', 'he']
    .map(k => [k, root.querySelector(`[data-aj-guide="${k}"]`)]));

  let session = null, nat = null;

  const frameSize = () => ({ fw: holder.clientWidth, fh: holder.clientHeight });

  function paint(adj) {
    if (!nat) return;
    const { fw, fh } = frameSize();
    if (!fw) return;
    const cover = F.coverScale(nat.w, nat.h, fw, fh);
    img.style.width = `${nat.w * cover}px`;
    img.style.height = `${nat.h * cover}px`;
    const { ox, oy } = F.place(nat.w, nat.h, fw, fh, adj);
    img.style.transform = `translate3d(${ox}px, ${oy}px, 0) scale(${adj.scale})`;
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

  const framer = createFramer(holder, {
    enabled: () => !!session,
    natural: () => (nat ? { nw: nat.w, nh: nat.h } : null),
    frame: frameSize,
    onChange: (adj, hits, live) => {
      if (!session) return;
      session.adjust = adj;
      paint(adj);
      paintGuides(live ? hits : {});
      out.textContent = `${Math.round(adj.scale * 100)}%`;
      if (!live) zoom.value = adj.scale.toFixed(2);
      session.onChange(adj);
    },
  });

  for (const b of root.querySelectorAll('[data-aj-align]')) {
    b.addEventListener('click', () => {
      const [axis, where] = b.dataset.ajAlign.split(':');
      framer.align(axis, where);
    });
  }
  zoom.addEventListener('input', e => framer.setZoom(+e.target.value));
  root.querySelector('[data-aj-reset]').addEventListener('click', () => { framer.adjust = { ...F.IDENTITY }; });
  root.querySelector('[data-aj-done]').addEventListener('click', () => { root.hidden = true; session = null; });

  new ResizeObserver(() => { if (!root.hidden && session) paint(session.adjust); }).observe(stage);

  return {
    async open(opts) {
      session = { adjust: { ...(opts.adjust || F.IDENTITY) }, onChange: opts.onChange };
      /* The corner's own proportions, so what is framed here is what the
         board will show - the tilt is applied after the crop, so it does not
         belong in this view. */
      const spec = G.PHOTOS.find(p => p.slot === opts.slot);
      holder.style.aspectRatio = `${spec.w} / ${spec.h}`;
      root.querySelector('[data-aj-title]').textContent = opts.photo.name.replace(/-/g, ' ');
      root.hidden = false;
      img.src = sized(opts.photo.url, 1400);
      await img.decode().catch(() => {});
      nat = { w: opts.photo.width || img.naturalWidth, h: opts.photo.height || img.naturalHeight };
      framer.adjust = session.adjust;
      zoom.value = session.adjust.scale.toFixed(2);
    },
  };
}
