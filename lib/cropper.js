/* The inline cover editor.

   A fixed 3:4 window in the rail, with the photograph moving behind it, so the
   cover is framed before anything is built rather than after. The gestures and
   the arithmetic are the same ones the full-screen editor uses - createFramer
   and frame.js - and all this adds is the painting: an <img> moved by transform
   and six guides.

   The wordmark is drawn in the frame so the framing can be judged against it.
   Its place and size are fixed by the layout, so the only thing to decide about
   it is the colour. */

import { createFramer } from './framer.js';
import * as F from './frame.js';

export function createCropper(root, { onChange } = {}) {
  const img = root.querySelector('img');
  const guides = Object.fromEntries(['vs', 'vc', 've', 'hs', 'hc', 'he']
    .map(k => [k, root.querySelector(`[data-guide="${k}"]`)]));

  let nw = 0, nh = 0;

  const framer = createFramer(root, {
    natural: () => (nw ? { nw, nh } : null),
    frame: () => ({ fw: root.clientWidth, fh: root.clientHeight }),
    onChange: (adj, hits, live) => {
      paint(adj, live ? hits : {});
      onChange?.(adj);
    },
  });

  function paint(adj, hits) {
    const fw = root.clientWidth, fh = root.clientHeight;
    if (!nw || !fw) return;
    const { dw, dh, ox, oy } = F.place(nw, nh, fw, fh, adj);
    img.style.width = `${dw}px`;
    img.style.height = `${dh}px`;
    img.style.transform = `translate(${ox}px, ${oy}px)`;

    /* The guide names the alignment that caught, rather than just announcing
       that something snapped. Edge guides are pulled a pixel inside the frame,
       or overflow:hidden clips them to half a hairline. */
    for (const g of Object.values(guides)) g?.classList.remove('is-on');
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

  new ResizeObserver(() => framer.refresh()).observe(root);

  return {
    async setImage(file) {
      const url = URL.createObjectURL(file);
      img.src = url;
      await img.decode();
      nw = img.naturalWidth;
      nh = img.naturalHeight;
      framer.reset();
    },
    setZoom: s => framer.setZoom(s),
    reset: () => framer.reset(),
    get adjust() { return framer.adjust; },
    set adjust(a) { framer.adjust = a; },
    get natural() { return { w: nw, h: nh }; },
    get ready() { return nw > 0; },
  };
}
