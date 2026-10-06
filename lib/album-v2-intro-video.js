import { defaultIntroCrop, introPlacement } from './intro-crop.js';
export function introVideoControls() {
  return `<details class="v2-style-group" open><summary>Intro video</summary>
    <label class="btn album-upload">Upload intro video<input type="file" data-v2-upload="intro" accept="video/*,.mp4,.mov,.webm"></label>
    <p class="note" data-intro-filename>intro-winter.mp4</p>
    <button type="button" class="btn" data-intro-crop-mode aria-pressed="false">Crop video</button>
    <div data-intro-crop-controls hidden>
      <p class="note">Drag the video in the preview. The frame stays 9:16. Your video stays muted.</p>
      ${[['scale','Zoom',100,500,100],['cx','Horizontal',-100,100,0],['cy','Vertical',-100,100,0]].map(([key,label,min,max,value]) => `<label class="field"><span>${label} <output data-intro-value="${key}">${value}%</output></span><input type="range" data-intro-adjust="${key}" aria-label="Intro video ${label.toLowerCase()}" min="${min}" max="${max}" step="1" value="${value}"></label>`).join('')}
      <button type="button" class="btn" data-intro-reset>Reset crop</button>
    </div></details>`;
}
export function wireIntroVideo(root, canvas, { state, changed }) {
  const $ = selector => root.querySelector(selector), toggle = $('[data-intro-crop-mode]');
  let enabled = false, drag = null;
  const active = () => enabled && canvas.dataset.edit === 'true' && canvas.dataset.section === 'intro' && canvas.dataset.busy !== 'true' && !!state.intro;
  function bounds() {
    const { dw, dh } = introPlacement(state.intro.video, state.introCrop);
    return { cx: Math.max(0, (dw / 1080 - 1) / 2), cy: Math.max(0, (dh / 1920 - 1) / 2) };
  }
  function sync() {
    $('[data-intro-filename]').textContent = state.intro?.name || 'intro-winter.mp4';
    toggle.setAttribute('aria-pressed', String(enabled));
    $('[data-intro-crop-controls]').hidden = !enabled;
    canvas.dataset.crop = String(active());
    if (!state.intro) return;
    const limits = bounds();
    for (const input of root.querySelectorAll('[data-intro-adjust]')) {
      const key = input.dataset.introAdjust;
      input.value = Math.round(key === 'scale' ? state.introCrop.scale * 100 : limits[key] ? state.introCrop[key] / limits[key] * 100 : 0);
      input.disabled = key !== 'scale' && limits[key] < .00001;
      $(`[data-intro-value="${key}"]`).textContent = `${input.value}%`;
    }
  }
  function apply(patch) {
    if (!state.intro || canvas.dataset.busy === 'true') return;
    state.introCrop = introPlacement(state.intro.video, { ...state.introCrop, ...patch }).adjust;
    changed(); sync();
  }
  toggle.addEventListener('click', () => { enabled = !enabled; drag = null; changed(); sync(); });
  root.addEventListener('click', event => {
    if (event.target.closest('#v2IntroEditor [data-layer-id]')) { enabled = false; drag = null; sync(); }
  });
  $('[data-intro-reset]').addEventListener('click', () => apply(defaultIntroCrop()));
  for (const input of root.querySelectorAll('[data-intro-adjust]')) input.addEventListener('input', () => {
    const key = input.dataset.introAdjust; apply({ [key]: +input.value / 100 * (key === 'scale' ? 1 : bounds()[key]) });
  });
  canvas.addEventListener('pointerdown', event => {
    if (!active() || event.button > 0) return;
    event.preventDefault(); event.stopImmediatePropagation(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, crop: { ...state.introCrop }, rect: canvas.getBoundingClientRect() };
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (!active()) { drag = null; return; }
    event.stopImmediatePropagation(); canvas.style.cursor = 'grab';
    if (!drag || drag.id !== event.pointerId) return;
    apply({ cx: drag.crop.cx + (event.clientX - drag.x) / drag.rect.width, cy: drag.crop.cy + (event.clientY - drag.y) / drag.rect.height });
  }, true);
  for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type, () => { drag = null; }, true);
  canvas.addEventListener('keydown', event => {
    if (!active()) return;
    if (event.key === 'Escape') { enabled = false; changed(); sync(); return; }
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const amount = event.shiftKey ? 10 : 1, key = ['ArrowLeft','ArrowRight'].includes(event.key) ? 'cx' : 'cy';
    apply({ [key]: state.introCrop[key] + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1) * amount / (key === 'cx' ? 1080 : 1920) });
  }, true);
  return { sync, get active() { return active(); }, drawGuides() {
    if (!active()) return;
    const ctx = canvas.getContext('2d'); ctx.save(); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1;
    for (const fraction of [1 / 3, 2 / 3]) { ctx.beginPath(); ctx.moveTo(canvas.width * fraction, 0); ctx.lineTo(canvas.width * fraction, canvas.height); ctx.moveTo(0, canvas.height * fraction); ctx.lineTo(canvas.width, canvas.height * fraction); ctx.stroke(); }
    ctx.restore();
  } };
}
