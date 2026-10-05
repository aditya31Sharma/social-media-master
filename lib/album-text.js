import { wireFontPicker } from './album-font-picker.js';
import { labelRect } from './album-render.js';

export const snapCenter = (value, pixels, threshold = 8) => Math.abs(value - .5) * pixels <= threshold ? .5 : value;
export function defaultLabels() {
  return [
    { id: 'heading', name: 'Heading', text: '', y: .25, size: 72, weight: 700 },
    { id: 'album', name: 'Album name', text: '', y: .71, size: 54, weight: 600 },
    { id: 'creator', name: 'Creator', text: 'Tenzen Angels', y: .77, size: 34, weight: 400 },
  ].map(label => ({ x: .5, enabled: true, font: 'Plus Jakarta Sans', spacing: 0, lineHeight: 1.2, color: '#111111', align: 'center', italic: false, ...label }));
}
export function wireAlbumText(root, canvas, labels, changed, report, onBusy = () => {}, { nativeFonts = false, directManipulation = true, isActive = () => true } = {}) {
  const $ = s => root.querySelector(s);
  let selected = labels[0], drag = null, fontVersion = 0, guides = {}, serial = 0;
  const fontSelect = $('[data-font]'), localFonts = new Map();
  let picker = null;
  const controls = ['text', 'enabled', 'size', 'spacing', 'lineHeight', 'color', 'align', 'weight', 'italic', 'x', 'y'].filter(key => $(`[data-text-${key}]`));
  function sync() {
    $('[data-layer]').value = selected.id;
    for (const key of controls) {
      const el = $(`[data-text-${key}]`);
      if (el.type === 'checkbox') el.checked = selected[key];
      else el.value = key === 'x' || key === 'y' ? Math.round(selected[key] * 1000) / 10 : selected[key];
    }
    fontSelect.value = selected.font; picker?.sync();
  }
  $('[data-layer]').addEventListener('change', event => { selected = labels.find(l => l.id === event.target.value); sync(); changed(true); });
  for (const key of controls) {
    const el = $(`[data-text-${key}]`);
    el.addEventListener('input', () => {
      let value = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number') {
        if (!el.value || !el.checkValidity()) return;
        value = Number(value); if (key === 'x' || key === 'y') value /= 100;
      }
      if (key === 'weight') value = +value;
      selected[key] = value; changed(true);
    });
  }
  for (const axis of ['x', 'y']) $(`[data-center-${axis}]`).addEventListener('click', () => {
    selected[axis] = .5; guides = { [axis]: true }; sync(); changed(true);
  });
  async function addFont(name, bytes) {
    const family = `AlbumFont${root.id}${++serial}`;
    const face = await new FontFace(family, bytes).load();
    document.fonts.add(face);
    fontSelect.add(new Option(name, family));
    return family;
  }
  if (nativeFonts) picker = wireFontPicker(root, () => selected, () => { sync(); changed(true); }, report, onBusy);
  else {
  fontSelect.addEventListener('change', async () => {
    const version = ++fontVersion, layer = selected, key = fontSelect.value;
    onBusy(1);
    try {
      let family = key;
      if (localFonts.has(key)) {
        const entry = localFonts.get(key);
        family = entry.loaded || await addFont(entry.fullName, await (await entry.blob()).arrayBuffer());
        entry.loaded = family;
      }
      if (version !== fontVersion) return;
      layer.font = family; sync(); changed(true);
    } catch (error) { report(`Font could not load: ${error.message}`); sync(); }
    finally { onBusy(-1); }
  });
  $('[data-local-fonts]').addEventListener('click', async () => {
    if (!window.queryLocalFonts) { report('Use Add font file to load a local font in this browser.'); return; }
    try {
      const fonts = await window.queryLocalFonts();
      for (const font of fonts.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
        const key = `local:${font.postscriptName}`;
        if (localFonts.has(key)) continue;
        localFonts.set(key, font); fontSelect.add(new Option(font.fullName, key));
      }
      report(`${fonts.length} local fonts available.`);
    } catch { report('Font access was not granted. Use Add font file instead.'); }
  });
  $('[data-font-upload]').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const layer = selected, version = ++fontVersion; onBusy(1);
    try {
      const family = await addFont(file.name, await file.arrayBuffer());
      if (version === fontVersion) { layer.font = family; sync(); changed(true); report('Font added.'); }
    }
    catch { report('This font file could not load. Choose a TTF, OTF, WOFF or WOFF2 file.'); }
    finally { onBusy(-1); }
    event.target.value = '';
  });
  }
  canvas.addEventListener('pointerdown', event => {
    if (!directManipulation || !isActive() || canvas.dataset.edit !== 'true' || canvas.dataset.busy === 'true') return;
    const r = canvas.getBoundingClientRect(), x = (event.clientX - r.left) / r.width * 1080, y = (event.clientY - r.top) / r.height * 1920;
    const hit = [...labels].reverse().find(label => {
      if (!label.enabled || !label.text) return false;
      const box = labelRect(canvas.getContext('2d'), label);
      return x >= box.x - 24 && x <= box.x + box.w + 24 && y >= box.y - 24 && y <= box.y + box.h + 24;
    });
    if (!hit) return;
    event.preventDefault(); selected = hit; sync(); canvas.focus({ preventScroll: true });
    drag = { px: event.clientX, py: event.clientY, x: hit.x, y: hit.y, w: r.width, h: r.height };
    canvas.setPointerCapture(event.pointerId); changed(true);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    const x = drag.x + (event.clientX - drag.px) / drag.w, y = drag.y + (event.clientY - drag.py) / drag.h;
    selected.x = Math.max(0, Math.min(1, snapCenter(x, drag.w)));
    selected.y = Math.max(0, Math.min(1, snapCenter(y, drag.h)));
    guides = { x: selected.x === .5, y: selected.y === .5 }; sync(); changed(true);
  });
  function release() { if (!drag) return; drag = null; guides = {}; changed(true); }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('keydown', event => {
    if (!directManipulation || !isActive() || canvas.dataset.edit !== 'true' || canvas.dataset.busy === 'true' || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); const amount = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') selected.x -= amount / 1080;
    if (event.key === 'ArrowRight') selected.x += amount / 1080;
    if (event.key === 'ArrowUp') selected.y -= amount / 1920;
    if (event.key === 'ArrowDown') selected.y += amount / 1920;
    selected.x = Math.max(0, Math.min(1, selected.x)); selected.y = Math.max(0, Math.min(1, selected.y));
    sync(); changed(true);
  });
  sync();
  return { sync, select(id) { selected = labels.find(label => label.id === id); sync(); }, drawGuides() {
    if (!directManipulation || !isActive() || canvas.dataset.edit !== 'true') return;
    const ctx = canvas.getContext('2d'), box = labelRect(ctx, selected);
    ctx.save(); ctx.setTransform(canvas.width / 1080, 0, 0, canvas.height / 1920, 0, 0);
    ctx.strokeStyle = '#7b3fc9'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    if (selected.enabled && selected.text) ctx.strokeRect(box.x - 10, box.y - 10, box.w + 20, box.h + 20);
    ctx.beginPath();
    if (guides.x) { ctx.moveTo(540, 0); ctx.lineTo(540, 1920); }
    if (guides.y) { ctx.moveTo(0, 960); ctx.lineTo(1080, 960); }
    ctx.stroke(); ctx.restore();
  } };
}
