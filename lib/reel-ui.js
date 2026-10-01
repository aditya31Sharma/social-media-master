/* The reel panel.

   Two products in, one mp4 out. The panel's whole job is choosing: which
   garment on top, which underneath, and which photographs run in each of the
   four corners. Everything else the board already decides.

   Kept apart from the carousel's code on purpose. The two templates share the
   catalogue and the framing maths and nothing else, and folding the reel into
   the carousel's state would make both harder to read. */

import { readProduct, splitTitle, sized, loadModelIndex } from './shopify.js';
import { isTopwear, isBottomwear } from './garment-scale.js';
import { createReel, allPhotos, closingSequence } from './reel.js';
import { OutfitStage } from './stage3d.js';
import { encodeToMp4, supported } from './encode.js';
import { loadSfx, decodeSfx, mixTrack, encodeAudio, audioSupported, waveform } from './audio.js';
import * as G from './reel-geom.js';

const $ = s => document.querySelector(s);

/* Bumped whenever assets/switch.* is replaced. */
const SFX_V = 'camera2';

/* Each corner names the garment it belongs to, which is what fills its
   picker. Straight off the board: the top garment holds the two upper
   corners, the bottom garment the two lower ones. */
const SLOTS = [
  { key: 'tl', from: 'top',    label: 'Top left' },
  { key: 'tr', from: 'top',    label: 'Top right' },
  { key: 'bl', from: 'bottom', label: 'Bottom left' },
  { key: 'br', from: 'bottom', label: 'Bottom right' },
];

export function createReelUI({ catalogue, onStatus, onVideo, openPicker, openAdjust, onStage }) {
  const state = {
    top: null, bottom: null, models: null,
    slots: { tl: [], tr: [], bl: [], br: [] },
    adjusts: { tl: {}, tr: {}, bl: {}, br: {} },
    size: 1080,
    sfx: null,                  // an AudioBuffer once one is loaded
    music: null,
    sfxVol: 0.15,
    musicVol: 1.0,
    musicStart: 0,              // seconds into the track the clip takes from
    /* Set by hand before the render; the bottom is never adjusted. */
    tune: { topScale: 1, topY: 0 },
    /* The settings the last render was made from. Anything that differs from
       this is a reason to offer another render, and nothing else is. */
    rendered: null,
    fitTurn: 0,                 // the preview only; the clip always turns fully
    busy: false,
  };

  /* The reel turns the garment, so a product without a GLB cannot appear in
     it. Two of forty-eight are in that position; they are left out of the
     list rather than offered and then failing. */
  async function models() {
    if (!state.models) state.models = await loadModelIndex();
    return state.models;
  }
  const wearable = async (half) => {
    const m = await models();
    const keep = half === 'bottom' ? isBottomwear : half === 'top' ? isTopwear : () => true;
    return catalogue().filter(p => m[p.handle] && keep(p.type));
  };

  function slotRows() {
    const host = $('#reelSlots');
    host.innerHTML = '';
    for (const s of SLOTS) {
      const chosen = state.slots[s.key];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'slot';
      row.dataset.slot = s.key;
      const total = Object.keys((s.from === 'top' ? state.top : state.bottom)?.byName || {}).length;
      const caption = chosen.length
        ? `Closes on ${chosen[0].name.replace(/-/g, ' ')} · ${total} shuffled`
        : 'Tap to choose';
      row.innerHTML = `
        <span class="slot__art">${
          chosen.length
            ? chosen.slice(0, 3).map(p => `<img src="${sized(p.url, 120)}" alt="" crossorigin="anonymous">`).join('')
            : '<svg viewBox="0 0 24 24"><use href="#i-plus"/></svg>'}</span>
        <span class="slot__text">
          <strong>${s.label}</strong>
          <em>${caption}</em>
        </span>
        <svg class="slot__chev" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-right"/></svg>`;
      row.addEventListener('click', () => {
        const product = s.from === 'top' ? state.top : state.bottom;
        if (!product) return;
        openPicker({
          title: s.label, product, chosen: state.slots[s.key],
          onDone: list => { state.slots[s.key] = list; slotRows(); refresh(); },
          onAdjust: photo => openAdjust({
            slot: s.key, photo,
            adjust: state.adjusts[s.key][photo.url],
            onChange: adj => { state.adjusts[s.key][photo.url] = adj; },
          }),
        });
      });
      host.appendChild(row);
    }
  }

  function ready() {
    return !!state.top && !!state.bottom
        && SLOTS.every(s => state.slots[s.key].length > 0);
  }

  /* Everything that changes the clip, in one comparable string. Built from
     the settings rather than watched through listeners: a listener per control
     is a listener to forget when a control is added. */
  function signature() {
    return JSON.stringify({
      top: state.top?.handle, bottom: state.bottom?.handle,
      h: [state.top?.heading, state.top?.sub, state.bottom?.heading, state.bottom?.sub],
      slots: SLOTS.map(s => state.slots[s.key][0]?.url || ''),
      adjusts: state.adjusts,
      tune: state.tune,
      size: state.size,
      sound: [state.sfxVol, state.musicVol, state.musicStart,
              state.music ? `${state.music.duration}:${state.music.length}` : '',
              state.sfx ? state.sfx.duration : ''],
    });
  }

  const changed = () => state.rendered !== null && state.rendered !== signature();

  function refresh() {
    const picked = !!(state.top && state.bottom);
    $('#reelAfter').hidden = !picked;

    const go = $('#btnReelGo');
    const missing = SLOTS.filter(s => !state.slots[s.key].length).length;
    const done = state.rendered !== null;
    const dirty = changed();

    if (go) {
      /* Once there is a clip, the button is only worth pressing if something
         has actually changed - otherwise it would re-render the same file. */
      go.disabled = !ready() || state.busy || (done && !dirty);
      go.textContent = done ? 'Regenerate reel' : 'Proceed with the real generation';
    }
    const note = $('#reelSetupNote');
    if (note) {
      note.textContent = state.busy ? 'Rendering…'
        : missing ? `Pick a shot for ${missing} more corner${missing > 1 ? 's' : ''}.`
        : done && !dirty ? 'Nothing has changed yet.'
        : done ? 'Changed. Regenerate to see it.'
        : 'Ready. This takes about ten seconds.';
    }
    const sub = $('#reelSetupSub');
    if (sub && picked) sub.textContent = `${state.top.heading} · ${state.bottom.heading}`;
  }

  const setup = $('#reelSetup');
  function openSetup() {
    if (!state.top || !state.bottom) return;
    setup.hidden = false;
    document.body.classList.add('is-locked');
    refresh();
    drawFit();
  }
  function closeSetup() {
    setup.hidden = true;
    document.body.classList.remove('is-locked');
  }
  $('#btnSetup')?.addEventListener('click', openSetup);
  $('#reelSetupBack')?.addEventListener('click', closeSetup);
  /* Escape closes it, the way every other full surface here does. */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !setup.hidden) closeSetup();
  });

  async function pick(which, product) {
    onStatus(`Reading ${product.title}…`);
    const full = await readProduct(product.handle);
    const [heading, sub] = splitTitle(full.title, full.productType);
    const glb = full.glb || (await models())[full.handle];
    /* `type` rides along because the stage sizes the garment from it. */
    state[which] = { ...full, heading, sub, glb, type: full.type };
    /* The fields are the source of truth once a product is in, so an edit
       survives everything except choosing a different product. */
    const ids = which === 'top' ? ['#reelTopH1', '#reelTopH2'] : ['#reelBotH1', '#reelBotH2'];
    const h1 = $(ids[0]), h2 = $(ids[1]);
    if (h1) h1.value = heading;
    if (h2) h2.value = sub;
    syncText();
    /* Clear that garment's corners: they were pictures of a different
       product. */
    for (const s of SLOTS) if (s.from === which) { state.slots[s.key] = []; state.adjusts[s.key] = {}; }
    onStatus('');
    slotRows();
    refresh();
    drawFit();
  }

  async function build() {
    if (!ready() || state.busy) return;
    state.busy = true; refresh();
    $('#reelOut').hidden = true;
    $('#emptyState').hidden = true;
    const work = $('#reelWorking');
    if (work) { work.hidden = false; $('#reelBar').style.width = '0%'; $('#reelWorkingNote').textContent = 'Getting ready…'; }
    const width = state.size;
    const height = Math.round(G.H * width / G.W);

    const can = await supported(width, height);
    if (!can.ok) { onStatus(can.why); state.busy = false; refresh(); return; }

    try {
      /* A shuffling corner is expanded into its fixed sequence now. Doing it
         inside the frame loop would redraw a different photograph on every
         one of the 900 frames instead of every thirtieth. */
      /* ONE pool of photo objects per product, shared by both of its corners.

         This is the bug that left the second and fourth corners grey. Each
         corner used to build its own objects for the same URLs; allPhotos
         de-duplicates by URL, so the fetch attached the bitmaps to the first
         corner's objects and the second corner kept its own, bitmap-less
         copies - and a slide with no bitmap falls back to a flat grey fill.
         Sharing the objects means there is one bitmap per photograph and
         every corner holding it sees it. */
      const pools = {
        top: Object.entries(state.top.byName)
          .map(([name, img]) => ({ url: img.url, name, width: img.width, height: img.height })),
        bottom: Object.entries(state.bottom.byName)
          .map(([name, img]) => ({ url: img.url, name, width: img.width, height: img.height })),
      };

      const slots = {};
      SLOTS.forEach((s, i) => {
        const pool = pools[s.from];
        /* The closing shot has to come out of the pool too, not out of the
           picker's own copy, or it is bitmap-less for exactly the same reason. */
        const closer = pool.find(p => p.url === state.slots[s.key][0]?.url) || pool[0];
        slots[s.key] = closingSequence(closer, pool, { start: G.SWITCH_START + i * G.STAGGER });
      });

      /* Every cut in the clip, for the sound. The first entry of each corner
         is not a change - it is just what is already there - so it is left
         out, and the reel would otherwise open on four hits at once. */
      const hits = Object.values(slots).flatMap(l => (l.times || []).slice(1));

      onStatus('Fetching the photographs…');
      $('#reelWorkingNote').textContent = 'Fetching the photographs…';
      /* Every picture any corner will show, fetched once up front: stalling
         halfway through an encode is what makes a clip take minutes. The
         cards hold these same objects by reference, so filling in a bitmap
         here fills it in everywhere it is shown. */
      const wanted = allPhotos(slots);
      await Promise.all(wanted.map(async p => {
        if (p.bitmap) return;
        const res = await fetch(sized(p.url, 1600), { mode: 'cors' });
        p.bitmap = await createImageBitmap(await res.blob());
      }));

      onStatus('Loading the models…');
      const logoUrl = URL.createObjectURL(new Blob([
        (await (await fetch('assets/logo.svg')).text()).replace(/currentColor/g, '#9aa3ab'),
      ], { type: 'image/svg+xml' }));

      const reel = await createReel({
        width, top: state.top, bottom: state.bottom,
        slots, adjusts: state.adjusts, logoUrl, tune: state.tune,
      });

      /* No sound is a valid outcome: the clip is still a clip. */
      let audio = null;
      if ((state.sfx || state.music) && await audioSupported()) {
        onStatus('Mixing the sound…');
        audio = mixTrack(state.sfx, hits, G.DURATION, {
          gain: state.sfxVol, music: state.music,
          musicGain: state.musicVol, musicStart: state.musicStart,
        });
      }

      const t0 = performance.now();
      const blob = await encodeToMp4({
        width: reel.width, height: reel.height, fps: G.FPS, frames: G.FRAMES,
        draw: i => reel.drawFrame(i),
        onProgress: v => {
          const pc = Math.round(v * 100);
          onStatus(`Rendering… ${pc}%`);
          const bar = $('#reelBar');
          if (bar) bar.style.width = `${pc}%`;
          const note = $('#reelWorkingNote');
          if (note) note.textContent = `Rendering… ${pc}%`;
        },
        audio, encodeAudio,
      });
      reel.dispose();
      /* Recorded only on success, so a failed render still offers a retry. */
      state.rendered = signature();
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      onStatus(`Done in ${secs}s · ${(blob.size / 1048576).toFixed(1)} MB`);
      onVideo(blob, `${state.top.sku || state.top.handle}-${state.bottom.sku || ''}-reel.mp4`);
    } catch (e) {
      onStatus(e.message || String(e));
    } finally {
      state.busy = false;
      $('#reelWorking').hidden = true;
      refresh();
    }
  }

  for (const b of document.querySelectorAll('[data-reelsize]')) {
    b.addEventListener('click', () => {
      state.size = +b.dataset.reelsize;
      for (const x of document.querySelectorAll('[data-reelsize]')) {
        const on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-checked', String(on));
      }
      $('#reelOutHint').textContent =
        `${G.SIZES.find(s => s.w === state.size)?.label || state.size} · MP4`;
      refresh();
    });
  }
  /* The sound is loaded once and kept, so rebuilding does not re-read it. */
  const sfxInput = $('#reelSfx');
  if (sfxInput) {
    sfxInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.sfx = await decodeSfx(await file.arrayBuffer());
        $('#reelSfxName').textContent = file.name;
      } catch {
        $('#reelSfxName').textContent = 'That file would not decode';
        state.sfx = null;
      }
    });
  }
  /* The one that ships. A file picked by hand still wins. */
  (async () => {
    /* Versioned, because the effect keeps the same filename when it is
       replaced and BOTH the http cache and the coi service worker will
       cheerfully keep serving the previous one - which is indistinguishable
       from the new file never having shipped. Bump SFX_V when it changes. */
    for (const name of [`assets/switch.wav?v=${SFX_V}`, `assets/switch.mp3?v=${SFX_V}`]) {
      const buf = await loadSfx(name);
      if (!buf) continue;
      if (!state.sfx) {
        state.sfx = buf;
        const n = $('#reelSfxName');
        if (n) n.textContent = `${name.split('/').pop().split('?')[0]} · ${buf.duration.toFixed(2)}s`;
      }
      return;
    }
  })();

  /* Background music, from a file. */
  const musicInput = $('#reelMusic');
  if (musicInput) {
    musicInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.music = await decodeSfx(await file.arrayBuffer());
        state.musicStart = 0;
        $('#reelMusicName').textContent = `${file.name} · ${fmtTime(state.music.duration)}`;
        showTrim();
        soundHint();
      } catch {
        state.music = null;
        $('#reelMusicName').textContent = 'That file would not decode';
        $('#reelTrim').hidden = true;
      }
    });
  }

  /* A YouTube link cannot be fetched from a page - there is no public API for
     the audio and the request is cross-origin - so rather than a control that
     silently does nothing, pasting one hands back the command that does work
     locally, and the result is then picked with the button above. */
  const yt = $('#reelYt');
  if (yt) {
    yt.addEventListener('input', () => {
      const note = $('#reelYtNote');
      const v = yt.value.trim();
      const ok = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(v);
      note.hidden = !v;
      note.textContent = !v ? ''
        : ok ? `A page cannot read YouTube audio. Run:  yt-dlp -x --audio-format mp3 -o music.mp3 "${v}"  then pick music.mp3 above.`
             : 'That does not look like a YouTube link.';
    });
  }

  /* A small live view of just the two garments, so the gap is settled before
     fifteen seconds of video are rendered around it. Rebuilt rather than
     mutated on each change: it is one frame at 520px, which is cheaper than
     keeping a second scene in step with the first. */
  let fitBusy = false, fitAgain = false;
  async function drawFit() {
    const cv = $('#reelFitCv');
    if (!cv || !state.top?.glb || !state.bottom?.glb) return;
    if (fitBusy) { fitAgain = true; return; }
    fitBusy = true;
    try {
      const W = cv.width, H = cv.height;
      const box = { x: 0, y: Math.round(H * 0.02), w: W, h: Math.round(H * 0.96) };
      const stage = new OutfitStage(W, H, box, Math.round(H * 1.02), H, state.tune);
      await stage.add('top', state.top.glb, state.top.type);
      await stage.add('bottom', state.bottom.glb, state.bottom.type);
      stage.layout();
      const g = cv.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
      g.drawImage(stage.render(state.fitTurn * Math.PI / 180), 0, 0);
      stage.dispose();
    } catch { /* the preview is a convenience, not the render */ }
    fitBusy = false;
    if (fitAgain) { fitAgain = false; drawFit(); }
  }

  const tune = (id, out, fmt, set) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = +el.value;
      $(out).textContent = fmt(v);
      set(v);
      drawFit();
      refresh();
    });
  };
  tune('#reelFitTurn', '#reelFitTurnOut', v => `${v}°`, v => { state.fitTurn = v; });
  const fitHint = () => {
    const h = $('#reelFitHint');
    if (h) h.textContent = `${Math.round(state.tune.topScale * 100)}% · ${state.tune.topY}cm`;
  };
  tune('#reelTopScale', '#reelTopScaleOut', v => `${v}%`, v => { state.tune.topScale = v / 100; fitHint(); });
  tune('#reelTopY', '#reelTopYOut', v => `${v}cm`, v => { state.tune.topY = v; fitHint(); });

  /* ── The music trimmer ────────────────────────────────────────
     Which fifteen seconds of the track to use. Drawn once per load; moving
     the handle only repositions the lit band. */
  const fmtTime = sec => {
    const m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  function drawWave() {
    const cv = $('#reelWave');
    if (!cv || !state.music) return;
    const w = cv.width, h = cv.height, g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const peaks = waveform(state.music, w);
    g.fillStyle = '#9aa3ab';
    for (let x = 0; x < w; x++) {
      const v = Math.max(1, peaks[x] * (h / 2));
      g.fillRect(x, h / 2 - v, 1, v * 2);
    }
  }

  function placeWindow() {
    const cv = $('#reelWave'), win = $('#reelTrimWin');
    if (!cv || !win || !state.music) return;
    const dur = state.music.duration;
    const frac = Math.min(1, G.DURATION / dur);
    const box = cv.getBoundingClientRect();
    win.style.width = `${Math.max(8, box.width * frac)}px`;
    win.style.left = `${box.width * (state.musicStart / Math.max(dur, 0.001))}px`;
    $('#reelTrimOut').textContent =
      `${fmtTime(state.musicStart)} – ${fmtTime(Math.min(dur, state.musicStart + G.DURATION))}`;
  }

  function showTrim() {
    const wrap = $('#reelTrim');
    if (!wrap || !state.music) return;
    /* Nothing to choose when the track is already shorter than the clip. */
    wrap.hidden = state.music.duration <= G.DURATION + 0.2;
    if (wrap.hidden) return;
    $('#reelTrimAt').value = 0;
    drawWave();
    placeWindow();
  }

  $('#reelTrimAt')?.addEventListener('input', e => {
    if (!state.music) return;
    const room = Math.max(0, state.music.duration - G.DURATION);
    state.musicStart = room * (+e.target.value / 1000);
    placeWindow();
    refresh();
  });

  /* A listen before committing fifteen seconds of render to it. */
  let preview = null;
  $('#reelTrimPlay')?.addEventListener('click', () => {
    if (preview) { preview.stop(); preview = null; $('#reelTrimPlay').textContent = 'Preview'; return; }
    if (!state.music) return;
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = state.music;
    const g = ctx.createGain();
    g.gain.value = state.musicVol;
    src.connect(g).connect(ctx.destination);
    src.start(0, state.musicStart, G.DURATION);
    $('#reelTrimPlay').textContent = 'Stop';
    src.onended = () => { $('#reelTrimPlay').textContent = 'Preview'; preview = null; ctx.close(); };
    preview = { stop: () => { try { src.stop(); } catch { /* already done */ } ctx.close(); } };
  });

  window.addEventListener('resize', placeWindow);

  /* Whatever is in the fields is what gets drawn. */
  function syncText() {
    for (const [which, a, b] of [['top', '#reelTopH1', '#reelTopH2'], ['bottom', '#reelBotH1', '#reelBotH2']]) {
      if (!state[which]) continue;
      const h1 = $(a), h2 = $(b);
      if (h1 && h1.value.trim()) state[which].heading = h1.value.trim();
      if (h2) state[which].sub = h2.value;
    }
    const hint = $('#reelTextHint');
    if (hint) hint.textContent = state.top?.heading || 'From the catalogue';
    refresh();
  }
  for (const id of ['#reelTopH1', '#reelTopH2', '#reelBotH1', '#reelBotH2']) {
    $(id)?.addEventListener('input', syncText);
  }

  const vol = (id, out, set) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = +el.value;
      $(out).textContent = `${v}%`;
      set(v / 100);
      refresh();
    });
  };
  const soundHint = () => {
    const h = $('#reelSoundHint');
    if (!h) return;
    h.textContent = state.music
      ? `Switch ${Math.round(state.sfxVol * 100)}% · music ${Math.round(state.musicVol * 100)}%`
      : `Switch ${Math.round(state.sfxVol * 100)}% · no music`;
  };
  vol('#reelMusicVol', '#reelMusicVolOut', v => { state.musicVol = v; soundHint(); });
  vol('#reelSfxVol', '#reelSfxVolOut', v => { state.sfxVol = v; soundHint(); });

  /* Starting the render hands the screen back: the clip appears in the stage,
     where it is watched, rather than behind a settings panel. */
  $('#btnReelGo')?.addEventListener('click', () => {
    closeSetup();
    /* Out of the way, so the thing being waited for is what is on screen. */
    onStage?.();
    build();
  });

  slotRows();
  return { state, pick, refresh, wearable, ready, openSetup };
}
