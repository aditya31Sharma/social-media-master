import { albumTextControls } from './album-text-controls.js';
import { defaultLabels } from './album-text.js';
export function introLabels() {
  return defaultLabels().filter(label => label.id !== 'album').map(label => ({ ...label, font: 'Geist', color: '#ffffff',
    ...(label.id === 'heading' ? { text: 'Tenzen Presents', y: .32, size: 68, weight: 600 } : { y: .65, size: 36 }),
  }));
}
export function introControls() {
  return `<details open data-v2-intro-controls><summary>Intro</summary>
  <label class="field"><span>Tenzen logo</span><select class="input" data-v2-logo><option value="japanese">Wordmark with Japanese text</option><option value="wordmark">Full wordmark</option><option value="asterisk">Asterisk</option></select></label>
  <label class="field"><span>Logo color</span><input class="input" type="color" data-v2-logo-color value="#ffffff"></label>
  ${albumTextControls({ includeAlbum: false, font: 'Geist' })}</details>`;
}
export function wireIntroControls(root, state, changed) {
  for (const [selector, key] of [['logo', 'variant'], ['logo-color', 'color']]) {
    root.querySelector(`[data-v2-${selector}]`).addEventListener('input', event => { state.brand[key] = event.target.value; changed(); });
  }
}
