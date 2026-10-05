import { albumTextControls } from './album-text-controls.js';
import { introLabels } from './album-v2-labels.js';
import { artworkControls } from './album-v2-artwork.js';
export const endingDefaults = () => ({ gap: -20, gaps: [-20,-20,-20,-20], x: 50, y: 50,
  labels: introLabels().map(label => ({ ...label, font: 'Geist', lineHeight: 1.2, color: '#000000', ...(label.id === 'heading' ? { text: 'Become', y: .256, size: 52, spacing: -1.5 } : { text: '', y: .8, size: 34 }) })),
  brand: { variant: 'wordmark', color: '#000000', x: .5, y: .30, scale: .75, enabled: true },
  link: { variant: 'globe', color: '#000000', x: .5, y: .74, scale: 1, enabled: true },
});
export function endingControls() {
  return `<details><summary>Ending</summary>
    <div data-v2-lineup-controls><label class="field"><span>Gap between models <output data-v2-gap-value>-20 px</output></span><input type="range" data-v2-ending="gap" min="-60" max="100" step="1" value="-20"></label>
    <div class="album-grid">${[0,1,2,3].map(index => `<label class="field"><span>Right of model ${index + 1}</span><input class="input" type="number" data-v2-model-gap="${index}" min="-60" max="100" value="-20"></label>`).join('')}</div>
    <div class="album-grid"><label class="field"><span>Group horizontal %</span><input class="input" type="number" data-v2-ending="x" min="0" max="100" step=".1" value="50"></label>
    <label class="field"><span>Group vertical %</span><input class="input" type="number" data-v2-ending="y" min="0" max="100" step=".1" value="50"></label></div>
    <div class="album-button-row"><button class="btn" type="button" data-v2-center="x">Center horizontally</button><button class="btn" type="button" data-v2-center="y">Center vertically</button></div>
    </div><section id="v2OutroEditor"><details class="v2-style-group"><summary>Logo and globe link</summary>${artworkControls({ link: true })}</details>
    <details class="v2-style-group"><summary>Text</summary>${albumTextControls({ includeAlbum: false, font: 'Geist', nativeFonts: true, previewName: 'the Ending preview' })}</details></section>
    </details>`;
}
export function moveEnding(settings, axis, value) {
  const delta = (value - settings[axis])/100;
  settings[axis] = value;
  for (const item of [...settings.labels, settings.brand, settings.link]) item[axis] += delta;
}
export function wireEndingControls(root, settings, repaint) {
  for (const input of root.querySelectorAll('[data-v2-ending]')) {
    input.addEventListener('input', () => {
      if (!Number.isFinite(input.valueAsNumber)) return;
      const key = input.dataset.v2Ending;
      const value = Math.max(+input.min, Math.min(+input.max, input.valueAsNumber));
      if (key === 'gap') {
        settings.gap = value; settings.gaps.fill(value);
        root.querySelector('[data-v2-gap-value]').textContent = `${settings.gap} px`;
        for (const field of root.querySelectorAll('[data-v2-model-gap]')) field.value = value;
      } else moveEnding(settings, key, value);
      repaint();
    });
    input.addEventListener('change', () => { input.value = Math.round(settings[input.dataset.v2Ending] * 10) / 10; });
  }
  for (const input of root.querySelectorAll('[data-v2-model-gap]')) input.addEventListener('input', () => {
    if (!input.value || !input.checkValidity()) return;
    settings.gaps[+input.dataset.v2ModelGap] = input.valueAsNumber; repaint();
  });
  for (const button of root.querySelectorAll('[data-v2-center]')) button.addEventListener('click', () => {
    const axis = button.dataset.v2Center; moveEnding(settings, axis, 50);
    root.querySelector(`[data-v2-ending="${axis}"]`).value = 50; repaint();
  });
  return { sync() {
    for (const input of root.querySelectorAll('[data-v2-ending]')) input.value = Math.round(settings[input.dataset.v2Ending] * 10) / 10;
    for (const input of root.querySelectorAll('[data-v2-model-gap]')) input.value = settings.gaps[+input.dataset.v2ModelGap];
  } };
}
